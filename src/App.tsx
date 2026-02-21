import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import domtoimage from 'dom-to-image';
import { Toaster, toast } from 'react-hot-toast';
import { Barcode } from 'lucide-react';

import { Origin, Reading, GroupedReading, StockItem } from './types';
import { MOCK_STOCK } from './constants';

import { SetupView } from './components/SetupView';
import { Header } from './components/Header';
import { ScannerInput } from './components/ScannerInput';
import { ResultsList } from './components/ResultsList';
import { ExportTable } from './components/ExportTable';

export default function App() {
  const [view, setView] = useState<'setup' | 'counting'>('setup');
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [client, setClient] = useState(''); // Estado para Devolução
  const [readings, setReadings] = useState<Reading[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [customStock, setCustomStock] = useState<StockItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // Audio refs
  const successSound = useRef<HTMLAudioElement | null>(null);
  const errorSound = useRef<HTMLAudioElement | null>(null);

  const [defaultStock, setDefaultStock] = useState<StockItem[]>(MOCK_STOCK);

  // Load custom stock from localStorage on mount, or fetch the default CSV
  useEffect(() => {
    // Carregar os áudios
    successSound.current = new Audio('/sounds/success.mp3');
    errorSound.current = new Audio('/sounds/error.mp3');
    // Preload them
    if (successSound.current) successSound.current.load();
    if (errorSound.current) errorSound.current.load();

    const savedStock = localStorage.getItem('scancount_custom_stock');
    if (savedStock) {
      try {
        setCustomStock(JSON.parse(savedStock));
      } catch (e) {
        console.error('Erro ao carregar estoque salvo:', e);
      }
    }

    // Carregar a tabela por padrão (tabela.csv) da pasta public
    const loadDefaultCsv = async () => {
      try {
        const response = await fetch('/tabela.csv');
        if (!response.ok) return;

        const csvText = await response.text();

        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          delimiter: ';', // Conforme vimos no log do CSV
          complete: (results) => {
            const parsedData: StockItem[] = results.data.map((row: any) => {
              // Encontra a chave do código (às vezes o CSV vem com caracteres estranhos tipo Cdigo)
              const codeKey = Object.keys(row).find(k => k.toLowerCase().includes('c') && k.toLowerCase().includes('digo')) || Object.keys(row)[0];
              const descKey = Object.keys(row).find(k => k.toLowerCase().includes('descri')) || Object.keys(row)[1];
              const localKey = Object.keys(row).find(k => k.toLowerCase().includes('local')) || Object.keys(row)[2];

              return {
                codigo: String(row[codeKey] || '').trim(),
                descricao: String(row[descKey] || 'Sem descrição').trim(),
                local: String(row[localKey] || '---').trim()
              }
            }).filter(item => item.codigo !== '');

            if (parsedData.length > 0) {
              setDefaultStock(parsedData);
            }
          }
        })
      } catch (err) {
        console.error('Erro ao buscar tabela.csv local', err);
      }
    }

    loadDefaultCsv();
  }, []);

  const currentStock = useMemo(() => {
    return customStock.length > 0 ? customStock : defaultStock;
  }, [customStock, defaultStock]);

  // Auto-focus input field
  useEffect(() => {
    if (view === 'counting') {
      const focusInput = () => inputRef.current?.focus();
      focusInput();
      // Keep focus even if user clicks away
      const interval = setInterval(focusInput, 1000);
      return () => clearInterval(interval);
    }
  }, [view]);

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
      if (errorSound.current) {
        errorSound.current.currentTime = 0;
        errorSound.current.play().catch(() => { });
      }
      toast.error(`Não encontrado: ${code}`, { duration: 1500 });
    }
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

  const handleEditQuantity = (codigo: string, currentQty: number) => {
    const newQtyStr = window.prompt(`Alterar quantidade para o código ${codigo}:`, String(currentQty));
    if (newQtyStr === null) return; // user cancelled

    const newQty = parseInt(newQtyStr, 10);
    if (isNaN(newQty) || newQty < 0) {
      toast.error('Quantidade inválida');
      return;
    }

    if (newQty === currentQty) return; // no change

    if (newQty === 0) {
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
      for (let i = 0; i < newQty; i++) {
        if (i < leiturasDeste.length) {
          result.push(leiturasDeste[i]); // reaproveita os dados e IDs originais
        } else {
          result.push({
            id: crypto.randomUUID(),
            codigo: codigo,
            timestamp: Date.now() + i // slight offset
          });
        }
      }

      // Re-ordena pelo timestamp (descrente, mais novo primeiro) para o fluxo da UI se manter igual
      return result.sort((a, b) => b.timestamp - a.timestamp);
    });

    toast.success(`Quantidade atualizada para ${newQty}`);
  };

  const handleExport = async () => {
    if (groupedData.length === 0 && readings.length === 0) {
      toast.error('Nada para exportar');
      return;
    }

    const toastId = toast.loading('Gerando arquivos...');

    try {
      // 1. Gerar Excel (Formato Lado a Lado)
      const worksheetData = [];

      const maxRows = Math.max(groupedData.length, readings.length);

      for (let i = 0; i < maxRows; i++) {
        const itemAgrupado = groupedData[i];
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

      // Adicionar aba de relatório de divergências (Itens não lidos da base atual)
      const missingItems = currentStock.filter(
        stockItem => !groupedData.some(scannedItem => scannedItem.codigo === stockItem.codigo)
      );

      if (missingItems.length > 0) {
        const missingData = missingItems.map(item => ({
          'Código': item.codigo,
          'Descrição': item.descricao,
          'Local': item.local
        }));

        const missingWs = XLSX.utils.json_to_sheet(missingData);
        missingWs['!cols'] = [
          { wch: 18 }, // Código
          { wch: 45 }, // Descrição
          { wch: 15 }  // Local
        ];
        XLSX.utils.book_append_sheet(wb, missingWs, "Não Lidos");
      }

      const now = new Date();
      const dateString = now.toISOString().split('T')[0];
      const timeString = now.toTimeString().split(' ')[0].replace(/:/g, '-').substring(0, 5);
      const fileName = `contagem_${origin}_${dateString}_${timeString}`;

      // Gerar Arquivo Excel na Memória
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const excelBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const excelFile = new File([excelBlob], `${fileName}.xlsx`, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      // 2. Generate Image
      let imageBlob: Blob | null = null;
      let imgFile: File | null = null;

      if (exportRef.current) {
        exportRef.current.style.display = 'block';

        const dataUrl = await domtoimage.toPng(exportRef.current, {
          bgcolor: '#ffffff',
          width: 900,
          quality: 1,
          style: {
            display: 'block',
            position: 'static',
            left: '0'
          }
        });

        exportRef.current.style.display = 'none';

        // Convert base64 DataURL to Blob
        const res = await fetch(dataUrl);
        imageBlob = await res.blob();
        imgFile = new File([imageBlob], `${fileName}.png`, { type: 'image/png' });
      }

      // 3. Tentar Compartilhar via Web Share API (WhatsApp/etc)
      // Nota: o Web Share API com arquivos suporta apenas compartilhamento de arquivos *únicos* em alguns dispositivos
      // Então tentaremos enviar os dois arquivos. Se não der, tentamos fallback clássico.

      const filesToShare = [];
      if (imgFile) filesToShare.push(imgFile);
      if (excelFile) filesToShare.push(excelFile);

      let shared = false;

      if (navigator.canShare && navigator.canShare({ files: filesToShare })) {
        try {
          await navigator.share({
            title: `Contagem ${origin}`,
            text: `Segue o relatório e fechamento de caixa: ${origin}`,
            files: filesToShare
          });
          shared = true;
          toast.success('Arquivos compartilhados com sucesso!', { id: toastId });
        } catch (shareError: any) {
          // Usuário pode ter cancelado o share, ignoramos e caímos no download padrão
          console.log('Compartilhamento cancelado ou falhou', shareError);
        }
      }

      // Se não suporta Web Share ou o usuário cancelou/falhou o share, fazemos o Download Padrão Clássico
      if (!shared) {
        // Baixar Excel
        XLSX.writeFile(wb, `${fileName}.xlsx`);

        // Baixar Imagem
        if (imageBlob) {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(imageBlob);
          link.download = `${fileName}.png`;
          link.click();
        }

        toast.success('Arquivos baixados com sucesso!', { id: toastId });
      }

    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error('Erro ao gerar arquivos', { id: toastId });
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
        customStockCount={customStock.length}
        defaultStockCount={defaultStock.length}
        onStockImported={(data) => {
          setCustomStock(data);
          localStorage.setItem('scancount_custom_stock', JSON.stringify(data));
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors pb-20">
      <Toaster position="top-center" />

      {/* Header Stats */}
      <Header
        origin={origin}
        client={client}
        onReset={resetCounting}
        onUndo={undoLastReading}
        onClear={clearAllReadings}
        onExport={handleExport}
        readingsCount={readings.length}
        uniqueCount={totalUnique}
        totalVolumes={totalVolumes}
        lastReading={lastReading}
      />

      <main className="max-w-5xl mx-auto px-4 mt-8">
        <section className="mb-8">
          <ScannerInput
            ref={inputRef}
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleAddReading}
          />
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

      <ExportTable
        ref={exportRef}
        groupedData={groupedData}
        origin={origin}
        client={client}
        totalUnique={totalUnique}
        totalReadings={readings.length}
        totalVolumes={totalVolumes}
      />
    </div>
  );
}