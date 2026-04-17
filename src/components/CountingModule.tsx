import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import domtoimage from 'dom-to-image';
import { Toaster, toast } from 'react-hot-toast';
import { Barcode } from 'lucide-react';
import { cn } from '../utils';

import { getInventory } from '../lib/supabase';

import { Origin, Reading, GroupedReading, StockItem } from '../types';
import { MOCK_STOCK } from '../constants';

import { SetupView } from './SetupView';
import { Header } from './Header';
import { ScannerInput } from './ScannerInput';
import { ResultsList } from './ResultsList';
import { ExportTable } from './ExportTable';
import { ExportModal, ExportStatus } from './ExportModal';
import { ManualAddModal } from './ManualAddModal';

export const CountingModule = ({ onBackToMenu }: { onBackToMenu: () => void }) => {
  const [view, setView] = useState<'setup' | 'counting'>('setup');
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [client, setClient] = useState(''); // Estado para Devolução
  const [readings, setReadings] = useState<Reading[]>(() => {
    const saved = localStorage.getItem('@MK_SAVED_READINGS');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [scanError, setScanError] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [customStock, setCustomStock] = useState<StockItem[]>([]);
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  const [generatedFiles, setGeneratedFiles] = useState<{ files: { blob: Blob | File; name: string; type: 'excel' | 'image' }[]; fileName: string }>({ files: [], fileName: '' });

  const inputRef = useRef<HTMLInputElement>(null);
  const exportRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Audio refs
  const successSound = useRef<HTMLAudioElement | null>(null);
  const errorSound = useRef<HTMLAudioElement | null>(null);

  const [defaultStock, setDefaultStock] = useState<StockItem[]>([]);

  // Load custom stock from localStorage on mount, or fetch the default CSV
  const fetchStock = async () => {
    try {
      const data = await getInventory();
      if (data && data.length > 0) {
        setDefaultStock(data as StockItem[]); // We are using defaultStock to hold the DB data
      }
    } catch (err) {
      console.error('Erro ao buscar do Supabase', err);
    }
  };

  useEffect(() => {
    // Carregar os áudios
    successSound.current = new Audio('/sounds/success.mp3');
    errorSound.current = new Audio('/sounds/error.mp3');
    // Preload them
    if (successSound.current) successSound.current.load();
    if (errorSound.current) errorSound.current.load();

    fetchStock();
  }, []);

  const currentStock = defaultStock;

  // Carregar os meta dados locais
  useEffect(() => {
    const savedOrigin = localStorage.getItem('@MK_SAVED_ORIGIN');
    const savedClient = localStorage.getItem('@MK_SAVED_CLIENT');

    if (savedOrigin) setOrigin(savedOrigin as Origin);
    if (savedClient) setClient(savedClient);

    // Se tinha algo salvo, já pular pra tela de counting?
    // Somente se a view for setup e tiver readings
    const savedReadings = localStorage.getItem('@MK_SAVED_READINGS');
    if (savedReadings && savedReadings !== '[]' && savedOrigin) {
      setView('counting');
      toast('Contagem restaurada automaticamente', { icon: '🔄' });
    }
  }, []);

  // Salvar no localStorage sempre que as leituras mudarem a partir de uma contagem
  useEffect(() => {
    localStorage.setItem('@MK_SAVED_READINGS', JSON.stringify(readings));
    if (origin) localStorage.setItem('@MK_SAVED_ORIGIN', origin);
    if (client) localStorage.setItem('@MK_SAVED_CLIENT', client);
  }, [readings, origin, client]);

  // Auto-focus input field
  useEffect(() => {
    if (view === 'counting' && !isManualAddOpen && !isExportModalOpen) {
      const focusInput = () => {
        // Only focus if there is no active selection in another text input to prevent stealing focus 
        // from other inputs accidentally if modals state glitches, but especially because the modals use inputs
        if (
          document.activeElement?.tagName !== 'INPUT' ||
          document.activeElement === inputRef.current
        ) {
          inputRef.current?.focus();
        }
      };
      focusInput();
      // Keep focus even if user clicks away
      const interval = setInterval(focusInput, 1000);
      return () => clearInterval(interval);
    }
  }, [view, isManualAddOpen, isExportModalOpen]);

  const handleStartCounting = () => {
    if (!origin) {
      toast.error('Selecione uma origem para começar');
      return;
    }
    setView('counting');
  };

  const handleAddReading = (e?: React.FormEvent) => {
    e?.preventDefault();
    const code = inputValue.trim();
    if (!code) return;

    const newReading: Reading = {
      id: crypto.randomUUID(),
      codigo: code,
      timestamp: Date.now(),
    };

    setReadings(prev => [newReading, ...prev]);
    setInputValue('');

    // Feedback
    const found = currentStock.some(item => item.codigo === code);
    if (found) {
      if (successSound.current) {
        successSound.current.currentTime = 0;
        successSound.current.play().catch(() => { });
      }
      toast.success(`Lido: ${code}`, { duration: 1000 });
    } else {
      setScanError(true);
      setTimeout(() => setScanError(false), 400); // Pisca por 400ms

      if (errorSound.current) {
        errorSound.current.currentTime = 0;
        errorSound.current.play().catch(() => { });
      }
      toast.error(`Não encontrado: ${code}`, { duration: 1500 });
    }
  };

  const handleManualAdd = (codigo: string, quantity: number) => {
    if (quantity < 1) return;

    const newReadings: Reading[] = Array.from({ length: quantity }).map((_, i) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${i}`,
      codigo,
      timestamp: Date.now() + i, // slight offset to maintain order
    }));

    setReadings(prev => [...newReadings, ...prev]);

    if (successSound.current) {
      successSound.current.currentTime = 0;
      successSound.current.play().catch(() => { });
    }
    toast.success(`Adicionado: ${quantity}x ${codigo}`, { duration: 2000 });
  };

  const undoLastReading = () => {
    if (readings.length === 0) return;
    setReadings(prev => prev.slice(1));
    toast.success('Última leitura removida');
  };

  const clearAllReadings = () => {
    if (readings.length === 0) return;
    if (window.confirm('Tem certeza que deseja apagar toda a contagem?')) {
      setReadings([]);
      toast.success('Contagem limpa');
    }
  };

  const removeReadingGroup = (codigo: string) => {
    if (window.confirm('Tem certeza que deseja remover TODAS as leituras deste item?')) {
      setReadings(prev => prev.filter(r => r.codigo !== codigo));
      toast.success('Item removido da contagem');
    }
  };

  const handleEditQuantity = (codigo: string, newQty: number, promptUser: boolean = false) => {
    let finalQty = newQty;
    const currentQty = readings.filter(r => r.codigo === codigo).length;

    if (promptUser) {
      const newQtyStr = window.prompt(`Alterar quantidade para o código ${codigo}:`, String(currentQty));
      if (newQtyStr === null) return; // user cancelled

      finalQty = parseInt(newQtyStr, 10);
      if (isNaN(finalQty) || finalQty < 0) {
        toast.error('Quantidade inválida');
        return;
      }
    } else {
      if (isNaN(finalQty) || finalQty < 0) return;
    }

    if (finalQty === currentQty) return; // no change

    if (finalQty === 0) {
      removeReadingGroup(codigo);
      return;
    }

    setReadings(prev => {
      // Filtrar leituras que não são deste código
      const outrasLeituras = prev.filter(r => r.codigo !== codigo);
      // Pega as leituras atuais deste código para manter o mesmo timestamp das primeiras
      const leiturasDeste = prev.filter(r => r.codigo === codigo);

      const result = [...outrasLeituras];

      // Adiciona N vezes a leitura baseada na quantidade solicitada, do mais antigo pro mais novo (para ficar na mesma ordem)
      for (let i = 0; i < finalQty; i++) {
        if (i < leiturasDeste.length) {
          result.push(leiturasDeste[i]); // reaproveita os dados e IDs originais
        } else {
          result.push({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${i}`,
            codigo: codigo,
            timestamp: Date.now() + i // slight offset
          });
        }
      }

      // Re-ordena pelo timestamp (descrente, mais novo primeiro) para o fluxo da UI se manter igual
      return result.sort((a, b) => b.timestamp - a.timestamp);
    });

    if (promptUser) {
      toast.success(`Quantidade atualizada para ${finalQty}`);
    }
  };

  const handleExportClick = () => {
    if (groupedData.length === 0 && readings.length === 0) {
      toast.error('Nada para exportar');
      return;
    }

    setIsExportModalOpen(true);
    setExportStatus('generating');

    // We wait for the modal to fully render before starting the heavy generation
    setTimeout(() => {
      generateExportFiles();
    }, 500);
  };

  const generateExportFiles = async () => {
    try {
      // 1. Gerar Excel (Formato Lado a Lado)
      const sortedAlphaData = [...groupedData].sort((a, b) => 
        a.descricao.localeCompare(b.descricao)
      );
      
      const worksheetData = [];
      const maxRows = Math.max(sortedAlphaData.length, readings.length);

      for (let i = 0; i < maxRows; i++) {
        const itemAgrupado = sortedAlphaData[i];
        const itemLido = readings[i];

        worksheetData.push({
          'Código': itemAgrupado ? itemAgrupado.codigo : '',
          'Descrição': itemAgrupado ? itemAgrupado.descricao : '',
          'Quant.': itemAgrupado ? itemAgrupado.quantidade : '',
          ' ': '',   // Primeira coluna vazia
          '  ': '',  // Segunda coluna vazia
          'Item Lido (Histórico)': itemLido ? itemLido.codigo : ''
        });
      }

      const ws = XLSX.utils.json_to_sheet(worksheetData);

      // Definindo a largura das colunas
      ws['!cols'] = [
        { wch: 18 }, // A: Código
        { wch: 45 }, // B: Descrição
        { wch: 10 }, // C: Quant.
        { wch: 5 },  // D: Vazio
        { wch: 5 },  // E: Vazio
        { wch: 22 }, // F: Item Lido (Histórico)
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Contagem");

      const now = new Date();
      const dateString = now.toISOString().split('T')[0];
      const timeString = now.toTimeString().split(' ')[0].replace(/:/g, '-').substring(0, 5);
      const fileName = `contagem_${origin}_${dateString}_${timeString}`;

      // Gerar Arquivo Excel na Memória
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const excelBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const excelFile = new File([excelBlob], `${fileName}.xlsx`, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      // 2. Generate Images
      const imageFiles: { blob: Blob | File; name: string; type: 'excel' | 'image' }[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const el = exportRefs.current[i];
        if (el) {
          el.style.display = 'block';

          const dataUrl = await domtoimage.toPng(el, {
            bgcolor: '#ffffff',
            width: 900,
            quality: 1,
            style: {
              display: 'block',
              position: 'static',
              left: '0'
            }
          });

          el.style.display = 'none';

          const res = await fetch(dataUrl);
          const imageBlob = await res.blob();
          const imgFileName = chunks.length > 1 ? `${fileName}_parte${i + 1}.png` : `${fileName}.png`;
          const imgFile = new File([imageBlob], imgFileName, { type: 'image/png' });
          imageFiles.push({ blob: imgFile, name: imgFileName, type: 'image' });
        }
      }

      setGeneratedFiles({
        files: [
          { blob: excelFile, name: `${fileName}.xlsx`, type: 'excel' },
          ...imageFiles
        ],
        fileName: fileName
      });

      setExportStatus('ready');

    } catch (error) {
      console.error('Erro ao gerar exportação:', error);
      setExportStatus('error');
    }
  };

  const handleShareImage = async () => {
    const images = generatedFiles.files.filter(f => f.type === 'image').map(f => f.blob as File);
    if (images.length === 0) return;

    const shareTitle = origin === 'DEVOLUÇÃO' && client ? `Contagem ${origin} - ${client}` : `Contagem ${origin}`;
    const shareText = origin === 'DEVOLUÇÃO' && client ? `Rodas que vieram de: ${origin} / Cliente: ${client}` : `Rodas que vieram de: ${origin}`;

    if (navigator.canShare && navigator.canShare({ files: images })) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          files: images
        });
        toast.success('Imagem compartilhada com sucesso!');
        // Keep modal open so they can share excel next if they want, or download.
      } catch (error) {
        console.log('Compartilhamento de imagem cancelado ou falhou', error);
      }
    } else {
      toast.error("Compartilhamento não disponível. Selecione 'Baixar Arquivos'.");
    }
  };

  const handleShareExcel = async () => {
    const excel = generatedFiles.files.find(f => f.type === 'excel');
    if (!excel) return;
    const excelFile = excel.blob as File;

    const shareTitle = origin === 'DEVOLUÇÃO' && client ? `Contagem ${origin} - ${client}` : `Contagem ${origin}`;
    const shareText = origin === 'DEVOLUÇÃO' && client ? `Segue o relatório Excel da contagem: ${origin} / Cliente: ${client}` : `Segue o relatório Excel da contagem: ${origin}`;

    if (navigator.canShare && navigator.canShare({ files: [excelFile] })) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          files: [excelFile]
        });
        toast.success('Planilha compartilhada com sucesso!');
      } catch (error) {
        console.log('Compartilhamento de planilha cancelado ou falhou', error);
      }
    } else {
      toast.error("Compartilhamento não disponível. Selecione 'Baixar Arquivos'.");
    }
  };

  const resetCounting = () => {
    if (readings.length > 0) {
      if (!window.confirm('Deseja iniciar uma nova contagem? Os dados atuais serão perdidos.')) {
        return;
      }
    }
    setView('setup');
    setOrigin(null);
    setClient('');
    setReadings([]);
    setInputValue('');

    // Limpar cache local
    localStorage.removeItem('@MK_SAVED_READINGS');
    localStorage.removeItem('@MK_SAVED_ORIGIN');
    localStorage.removeItem('@MK_SAVED_CLIENT');
  };

  const groupedData = useMemo(() => {
    const groups: Record<string, number> = {};
    const orderedCodes: string[] = [];

    readings.forEach(r => {
      if (!groups[r.codigo]) {
        groups[r.codigo] = 0;
        orderedCodes.push(r.codigo);
      }
      groups[r.codigo]++;
    });

    return orderedCodes.map((codigo): GroupedReading => {
      const quantidade = groups[codigo];
      const stockItem = currentStock.find(item => item.codigo === codigo);
      return {
        codigo,
        quantidade,
        descricao: stockItem?.descricao || 'Não encontrado no estoque',
        local: stockItem?.local || '---',
        found: !!stockItem
      };
    }).filter(item =>
      item.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.descricao.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [readings, searchTerm, currentStock]);

  const chunks = useMemo(() => {
    const sorted = [...groupedData].sort((a, b) => a.descricao.localeCompare(b.descricao));
    const result = [];
    for (let i = 0; i < sorted.length; i += 15) {
      result.push(sorted.slice(i, i + 15));
    }
    if (result.length === 0) result.push([]);
    return result;
  }, [groupedData]);

  const lastReading = readings[0]?.codigo || '---';
  const totalUnique = Object.keys(readings.reduce((acc, r) => ({ ...acc, [r.codigo]: true }), {})).length;

  // Lógica de cálculo de Volumes (Caixas)
  const totalVolumes = useMemo(() => {
    return groupedData.reduce((acc, item) => {
      const textoBase = `${item.descricao} ${item.codigo}`.toUpperCase();

      // Verifica se é aro 13, 14 ou 15x6 para dividir por 2 e arredondar para cima
      const isCaixaDupla = textoBase.includes('13X') ||
        textoBase.includes('14X') ||
        textoBase.includes('15X6');

      if (isCaixaDupla) {
        return acc + Math.ceil(item.quantidade / 2);
      } else {
        return acc + item.quantidade;
      }
    }, 0);
  }, [groupedData]);

  if (view === 'setup') {
    return (
      <SetupView
        origin={origin}
        setOrigin={setOrigin}
        client={client}
        setClient={setClient}
        onStartCounting={handleStartCounting}
        defaultStockCount={defaultStock.length}
        onBackToMenu={onBackToMenu}
      />
    );
  }

  return (
    <div className={cn(
      "min-h-screen transition-colors pb-20",
      scanError ? "bg-red-500/20 dark:bg-red-900/40" : "bg-slate-50 dark:bg-slate-950"
    )}>
      {scanError && (
        <div className="fixed inset-0 z-50 pointer-events-none border-8 border-red-500/50 animate-pulse" />
      )}
      <Toaster position="top-center" />

      {/* Header Stats */}
      <Header
        origin={origin}
        client={client}
        onReset={resetCounting}
        onUndo={undoLastReading}
        onClear={clearAllReadings}
        onExport={handleExportClick}
        onBackToMenu={onBackToMenu}
        readingsCount={readings.length}
        uniqueCount={totalUnique}
        totalVolumes={totalVolumes}
        lastReading={lastReading}
      />

      <main className="max-w-5xl mx-auto px-4 mt-8">
        <section className="mb-8 flex gap-3">
          <div className="flex-1">
            <ScannerInput
              ref={inputRef}
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleAddReading}
            />
          </div>
          <button
            onClick={() => setIsManualAddOpen(true)}
            className="h-16 px-6 bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
            title="Adicionar item manualmente"
          >
            <span className="hidden sm:inline">Busca Manual</span>
            <Barcode className="w-6 h-6 sm:hidden" />
          </button>
        </section>

        <ResultsList
          groupedData={groupedData}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onRemoveGroup={removeReadingGroup}
          onEditQuantity={handleEditQuantity}
        />
      </main>

      <div className="fixed bottom-6 right-6 sm:hidden">
        <button
          onClick={() => inputRef.current?.focus()}
          className="w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-300 flex items-center justify-center active:scale-90 transition-transform"
        >
          <Barcode className="w-6 h-6" />
        </button>
      </div>

      <div className="fixed top-0 left-[-9999px] z-[-10]">
        {chunks.map((chunk, i) => (
          <ExportTable
            key={i}
            ref={(el) => { exportRefs.current[i] = el; }}
            groupedData={chunk}
            origin={origin}
            client={client}
            totalUnique={totalUnique}
            totalReadings={readings.length}
            totalVolumes={totalVolumes}
            page={i + 1}
            totalPages={chunks.length}
          />
        ))}
      </div>

      {/* Manual Add Modal */}
      <ManualAddModal
        isOpen={isManualAddOpen}
        onClose={() => setIsManualAddOpen(false)}
        stock={currentStock}
        onAdd={handleManualAdd}
      />

      {/* Modal de Exportação */}
      <ExportModal
        isOpen={isExportModalOpen}
        status={exportStatus}
        onClose={() => setIsExportModalOpen(false)}
        onShareImage={handleShareImage}
        onShareExcel={handleShareExcel}
        files={generatedFiles.files}
        hasFiles={generatedFiles.files.length > 0}
      />
    </div>
  );
}