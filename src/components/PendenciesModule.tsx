import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { ArrowLeft, ClipboardList, Pencil, Search, Filter, Upload, Trash2, Archive, X, CloudUpload, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getInventory, loadPedidosFabrica, upsertPedidoFabrica, archiveAndClearPedidos, syncPendenciasToCloud, getPendenciasInventory } from '../lib/supabase';
import { StockItem } from '../types';
import { PendencyQuantityModal } from './PendencyQuantityModal';
import { cn } from '../utils';
import photoMap from '../data/photoMap.json';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { getWheelPhotoUrl } from '../utils/photoUtils';

const finishMapping: Record<string, string> = {
  'PRETO DIAMANTADO': 'BD',
  'BLACK DIAMOND': 'BD',
  'PRETO': 'B',
  'BLACK': 'B',
  'PRETO FOSCO': 'BF',
  'BRONZE FOSCO': 'BF',
  'PRETA FOSCO DIAM': 'BFD',
  'PRATA': 'SS',
  'PRATA DIAM': 'SS',
  'PRATA DIAMANTAD': 'SS',
  'SILVER STAR': 'SS',
  'GRAFITE BRILHANT': 'GB',
  'GRAPHITE BRILHANT': 'GB',
  'GRAPHITE BRILHANTE': 'GB',
  'GRAFITE FOSC': 'GF',
  'GRAPHITE FOSCO': 'GF',
  'GRAPHITE FOSCO F.L': 'GF',
  'GRAPHITE DIAM': 'GD',
  'GRAPHITE DIAMANTAD': 'GD',
  'GRAPHITE DIAM F.L': 'GD',
  'GRAPHITE DIAM FL': 'GD',
  'GRAF DIAM. F.L': 'GD',
  'GRAPHITE FOSCO DIAM': 'GFD',
  'GRAPHITE FOS DIAM': 'GFD',
  'GRAPHITE FOSCO DIA': 'GFD',
  'GRAPHITE FOSCO DI': 'GFD',
  'OURO VELHO': 'OURO',
  'OURO VELHO F': 'OURO',
  'OURO BORDA DIAM.': 'OURO',
  'OURO V DIAMANTADO': 'OURO',
  'POLIDA': 'POLIDA',
  'BRUTA': 'BRUTA',
  'DIAMOND': 'D',
  'DOURADA DIAMANTADA': 'DD',
  'HYPER DIAM': 'HD',
  'HYPER DIA.*R.C': 'HD',
  'HYPER DIAM R.C': 'HD',
  'HD': 'HD',
  'HYPER GLOSS': 'HG',
  'HYPER GLOSS F.L': 'HG',
  'HYPER GLOS': 'HG',
  'HYPER GL': 'HG',
  'GLOSS': 'GL',
  'GLOSS SHADOW': 'GS',
  'GL SHADOW': 'GS',
  'GLOS SHADOW': 'GS',
  'INOX': 'INOX',
  'CROMADA': 'CROMADA',
  'FGF': 'FGF',
  'VERM BORDA DIAM': 'LVD',
  'VERM. C/BORDA DIA': 'LVD',
  'VERM.. C/BORDA DIAM': 'LVD',
  'VERM BORD DIAM': 'LVD',
  'VERM. C/ BORDA DIAM': 'LVD',
  'VERM. BORDA DIA': 'LVD',
  'VER BOR DIAM': 'LVD',
  'GOLD BLACK LIP': 'GBL',

  // Mapeamentos diretos de abreviações e palavras isoladas que podem ser usadas
  'OURO': 'OURO',
  ' BD ': 'BD',
  ' SS ': 'SS',
  ' GB ': 'GB',
  ' B ': 'B',
  ' BF ': 'BF',
  ' GF ': 'GF',
  ' GD ': 'GD',
  ' GFD ': 'GFD',
  ' DD ': 'DD',
  ' HD ': 'HD',
  ' HG ': 'HG',
  ' GL ': 'GL',
  ' GS ': 'GS',
  ' FGF ': 'FGF',
  ' LVD ': 'LVD',
  ' GBL ': 'GBL',
};

// Sort mapping keys by length descending to match longest phrases first (e.g., 'PRETO DIAMANTADO' before 'PRETO')
const sortedFinishKeys = Object.keys(finishMapping).sort((a,b) => b.length - a.length);

interface PendenciesModuleProps {
    onBackToMenu: () => void;
}

export const PendenciesModule: React.FC<PendenciesModuleProps> = ({ onBackToMenu }) => {
    const [stock, setStock] = useState<StockItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUploadDate, setLastUploadDate] = useState<string | null>(null);

    type FactoryName = 'MK' | 'MOLERI' | 'CM' | 'OLIMPO';
    const [pendencies, setPendencies] = useState<Record<string, Record<FactoryName, number>>>({});
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalConfig, setModalConfig] = useState<{
        item: StockItem | null;
        factory: FactoryName;
        currentQty: number;
        stockQty: number;
        pendencyQty: number;
        photoUrl?: string;
    }>({ item: null, factory: 'MK', currentQty: 0, stockQty: 0, pendencyQty: 0, photoUrl: '' });
 
    // Upload Modal State
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [tempProcessedData, setTempProcessedData] = useState<StockItem[]>([]);
    const [isSyncingCloud, setIsSyncingCloud] = useState(false);

    // Export Modal State
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isExportLoading, setIsExportLoading] = useState(false);

    const openModal = (item: StockItem, factory: FactoryName) => {
        const currentQty = pendencies[item.codigo]?.[factory] || 0;
        
        let stockQty = 0;
        let pendencyQty = 0;

        switch (factory) {
            case 'MK':
                stockQty = item.est_mk || 0;
                pendencyQty = item.pend_mk || 0;
                break;
            case 'MOLERI':
                stockQty = item.est_moleri || 0;
                pendencyQty = item.pend_moleri || 0;
                break;
            case 'CM':
                stockQty = item.est_cm || 0;
                pendencyQty = item.pend_cm || 0;
                break;
            case 'OLIMPO':
                stockQty = item.est_olimpo || 0;
                pendencyQty = item.pend_olimpo || 0;
                break;
        }

        const photoUrl = getWheelPhotoUrl(item.descricao);

        setModalConfig({ item, factory, currentQty, stockQty, pendencyQty, photoUrl });
        setIsModalOpen(true);
    };

    const handleConfirmQty = async (newQty: number) => {
        if (!modalConfig.item) return;
        const { codigo } = modalConfig.item;
        const { factory } = modalConfig;

        setPendencies(prev => {
            const itemPendencies = prev[codigo] || { MK: 0, MOLERI: 0, CM: 0, OLIMPO: 0 };
            return {
                ...prev,
                [codigo]: {
                    ...itemPendencies,
                    [factory]: newQty
                }
            };
        });

        // Background sync to db
        const success = await upsertPedidoFabrica(codigo, factory, newQty);
        if (!success) {
            toast.error(`Falha ao salvar o pedido na nuvem para a ${factory}.`);
        }
    };

    const handleClearAll = async () => {
        const confirm1 = window.confirm("ATENÇÃO: Isso irá mover TODOS os pedidos atuais para o HISTÓRICO e zerar a lista atual para uma nova semana.\n\nDeseja continuar?");
        if (!confirm1) return;

        const confirm2 = window.confirm("Tem certeza absoluta? Essa ação não pode ser desfeita facilmente.");
        if (!confirm2) return;

        const loadingToast = toast.loading("Arquivando e limpando lista...");

        const success = await archiveAndClearPedidos();
        if (success) {
            setPendencies({});
            toast.success("Lista arquivada e zerada com sucesso! Pronto para nova semana.", { id: loadingToast });
        } else {
            toast.error("Erro ao arquivar pedidos. Tente novamente.", { id: loadingToast });
        }
    };

    const handleExport = () => {
        if (stock.length === 0) {
            toast.error("Não há dados para exportar.");
            return;
        }
        setIsExportModalOpen(true);
    };

    const executeExport = async () => {
        setIsExportLoading(true);
        const loadingToast = toast.loading("Gerando planilha estilizada...");

        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Pendências');

            // 1. Configurar Colunas
            worksheet.columns = [
                { header: 'CÓDIGO', key: 'codigo', width: 15 },
                { header: 'CATÁLOGO', key: 'descricao', width: 45 },
                { header: 'QTDE MIN', key: 'qtd_min', width: 10 },
                { header: 'PREÇO FÁBRICA', key: 'preco', width: 18 },
                { header: 'EST. MK', key: 'est_mk', width: 10 },
                { header: 'PEND MK', key: 'pend_mk', width: 10 },
                { header: 'MK', key: 'order_mk', width: 8 },
                { header: 'EST. MOLERI', key: 'est_moleri', width: 12 },
                { header: 'PEND MOLERI', key: 'pend_moleri', width: 12 },
                { header: 'MOLERI', key: 'order_moleri', width: 10 },
                { header: 'EST. CM', key: 'est_cm', width: 10 },
                { header: 'PEND CM', key: 'pend_cm', width: 10 },
                { header: 'CM', key: 'order_cm', width: 8 },
                { header: 'EST. OLIMPO', key: 'est_olimpo', width: 12 },
                { header: 'PEND OLIMPO', key: 'pend_olimpo', width: 12 },
                { header: 'OLIMPO', key: 'order_olimpo', width: 10 }
            ];

            // 2. Estilizar Cabeçalho
            const headerRow = worksheet.getRow(1);
            headerRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE0E0E0' } // Cinza claro igual à foto
                };
                cell.font = { bold: true, size: 10 };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
            headerRow.height = 30; // Altura maior para o cabeçalho

            // 3. Adicionar Dados
            stock.forEach((item) => {
                const itemPends = pendencies[item.codigo] || { MK: 0, MOLERI: 0, CM: 0, OLIMPO: 0 };
                const row = worksheet.addRow({
                    codigo: item.codigo,
                    descricao: item.descricao,
                    qtd_min: 0,
                    preco: item.preco || 0,
                    est_mk: item.est_mk || 0,
                    pend_mk: item.pend_mk || 0,
                    order_mk: itemPends.MK || 0,
                    est_moleri: item.est_moleri || 0,
                    pend_moleri: item.pend_moleri || 0,
                    order_moleri: itemPends.MOLERI || 0,
                    est_cm: item.est_cm || 0,
                    pend_cm: item.pend_cm || 0,
                    order_cm: itemPends.CM || 0,
                    est_olimpo: item.est_olimpo || 0,
                    pend_olimpo: item.pend_olimpo || 0,
                    order_olimpo: itemPends.OLIMPO || 0
                });

                // Estilizar Linha de Dados
                row.eachCell((cell, colNumber) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                    
                    // Alinhamento central para colunas após o catálogo
                    if (colNumber > 2) {
                        cell.alignment = { horizontal: 'center' };
                    }
                    
                    // Formatar Preço
                    if (colNumber === 4) {
                        cell.value = item.preco || 0;
                        cell.numFmt = '"R$ " #,##0.00';
                        cell.alignment = { horizontal: 'right' };
                    }
                });
            });

            // 4. Gerar e Baixar
            const buffer = await workbook.xlsx.writeBuffer();
            const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `Pendencias_Export_${dateStr}.xlsx`);
            
            toast.success("Planilha exportada com sucesso!", { id: loadingToast });
            setIsExportModalOpen(false);
        } catch (err) {
            console.error("Erro ao exportar:", err);
            toast.error("Erro ao gerar a planilha.", { id: loadingToast });
        } finally {
            setIsExportLoading(false);
        }
    };

    const processExcelFile = (file: File) => {
        const reader = new FileReader();
        const toastId = toast.loading("Lendo planilha...");
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames.find(n => n.toUpperCase() === 'PRINCIPAL') || wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                const mappedData: StockItem[] = data.map((row: any) => {
                    const normalize = (s: string) => 
                        String(s || '').normalize("NFD")
                            .replace(/[\u0300-\u036f]/g, "")
                            .replace(/[^A-Z0-9]/gi, "")
                            .toUpperCase();

                    const parseBrNumber = (val: any) => {
                        if (typeof val === 'number') return val;
                        if (!val) return 0;
                        const str = String(val).replace(/\s/g, '').replace(/\./g, '').replace(',', '.').trim();
                        const num = parseFloat(str);
                        return isNaN(num) ? 0 : num;
                    };

                    const find = (keywords: string[]) => {
                        const normalizedKeywords = keywords.map(normalize);
                        const foundKey = Object.keys(row).find(k => 
                            normalizedKeywords.includes(normalize(k))
                        );
                        return foundKey ? row[foundKey] : undefined;
                    };

                    return {
                        codigo: String(find(['CÓDIGO', 'CODIGO', 'CÓD']) || '').trim(),
                        descricao: String(find(['CATÁLOGO', 'CATALOGO', 'DESCRIÇÃO', 'DESCRICAO']) || '').trim(),
                        local: 'Planilha',
                        quantidade: parseBrNumber(find(['EST. MK', 'EST MK', 'ESTMK'])),
                        est_mk: parseBrNumber(find(['EST. MK', 'EST MK', 'ESTMK'])),
                        pend_mk: parseBrNumber(find(['PEND MK', 'PEND. MK', 'PENDMK'])),
                        est_moleri: parseBrNumber(find(['EST. MOLERI', 'EST MOLERI', 'ESTMOLERI'])),
                        pend_moleri: parseBrNumber(find(['PEND MOLERI', 'PEND. MOLERI', 'PENDMOLERI'])),
                        est_cm: parseBrNumber(find(['EST. CM', 'EST CM', 'ESTCM'])),
                        pend_cm: parseBrNumber(find(['PEND CM', 'PEND. CM', 'PENDCM'])),
                        est_olimpo: parseBrNumber(find(['EST. OLIMPO', 'EST OLIMPO', 'ESTOLIMPO'])),
                        pend_olimpo: parseBrNumber(find(['PEND OLIMPO', 'PEND. OLIMPO', 'PENDOLIMPO'])),
                        preco: parseBrNumber(find(['PREÇO FÁBRICA', 'PRECO FABRICA', 'PREÇO', 'PRECO']))
                    };
                }).filter(item => item.codigo);

                if (mappedData.length > 0) {
                    setTempProcessedData(mappedData);
                    toast.success(`${mappedData.length} itens extraídos com sucesso!`, { id: toastId });
                } else {
                    toast.error("Nenhum dado válido encontrado na planilha.", { id: toastId });
                }
            } catch (err) {
                console.error("Erro ao ler Excel:", err);
                toast.error("Erro ao processar o arquivo Excel.", { id: toastId });
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleSyncToCloud = async () => {
        if (tempProcessedData.length === 0) return;
        
        setIsSyncingCloud(true);
        const syncToast = toast.loading("Sincronizando com a nuvem...");
        try {
            await syncPendenciasToCloud(tempProcessedData);
            
            // Sucesso! Atualizar estado local
            setStock(tempProcessedData);
            const now = new Date().toISOString();
            setLastUploadDate(now);
            localStorage.setItem('inventory_cache', JSON.stringify({
                data: tempProcessedData,
                updatedAt: now
            }));

            toast.success("Estoque sincronizado com a nuvem v!", { id: syncToast });
            setIsUploadModalOpen(false); // Fecha o modal automaticamente
            setTempProcessedData([]); // Limpa dados temporários
        } catch (err) {
            console.error(err);
            toast.error("Erro ao sincronizar. Tente novamente.", { id: syncToast });
        } finally {
            setIsSyncingCloud(false);
        }
    };

    // Filtros
    const [showOnlyPending, setShowOnlyPending] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    
    const [filterLinha, setFilterLinha] = useState("");
    const [filterAro, setFilterAro] = useState("");
    const [filterFuracao, setFilterFuracao] = useState("");
    const [filterModelo, setFilterModelo] = useState("");
    const [filterAcabamento, setFilterAcabamento] = useState("");

    const getFields = (item: StockItem) => {
        const descUpper = item.descricao.toUpperCase();
        const model = descUpper.split(' ')[0];
        const linha = model.match(/^[A-Z]+/i)?.[0] || "";
        const aroMatch = descUpper.match(/(\d{2})[XxX\*]/i);
        const aro = aroMatch ? aroMatch[1] : "";
        const furMatch = descUpper.match(/\d[XxX\*]\d{2,3}|\d[Ff]/i);
        const furacao = furMatch ? furMatch[0] : "";
        
        let acabamento = "";
        for (const key of sortedFinishKeys) {
            if (descUpper.includes(key)) {
                acabamento = finishMapping[key];
                break;
            }
        }
        return { linha, aro, furacao, model, acabamento, descUpper };
    };

    const uniqueLinhas = Array.from(new Set(stock.map(item => getFields(item).linha))).filter(Boolean).sort();
    const uniqueAros = Array.from(new Set(stock.map(item => getFields(item).aro))).filter(Boolean).sort();
    const uniqueFuracoes = Array.from(new Set(stock.map(item => getFields(item).furacao))).filter(Boolean).sort();
    const uniqueModelos = Array.from(new Set(stock.map(item => getFields(item).model))).filter(Boolean).sort();
    const uniqueAcabamentos = Array.from(new Set(stock.map(item => getFields(item).acabamento))).filter(Boolean).sort();

    const filteredStock = stock.filter(item => {
        if (showOnlyPending) {
            const p = pendencies[item.codigo];
            if (!p || (p.MK === 0 && p.MOLERI === 0 && p.CM === 0 && p.OLIMPO === 0)) {
                return false;
            }
        }
        
        if (searchQuery) {
            const sqMatch = searchQuery.toUpperCase();
            if (!item.descricao.toUpperCase().includes(sqMatch) && !item.codigo.toUpperCase().includes(sqMatch)) {
                return false;
            }
        }

        const { linha, aro, furacao, model, acabamento } = getFields(item);
        if (filterLinha && linha !== filterLinha) return false;
        if (filterAro && aro !== filterAro) return false;
        if (filterFuracao && furacao !== filterFuracao) return false;
        if (filterModelo && model !== filterModelo) return false;
        if (filterAcabamento && acabamento !== filterAcabamento) return false;
        return true;
    });

    // Reset page to 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [showOnlyPending, searchQuery, filterLinha, filterAro, filterFuracao, filterModelo, filterAcabamento]);

    const itemsPerPage = 100;
    const totalPages = Math.ceil(filteredStock.length / itemsPerPage) || 1;
    const paginatedStock = filteredStock.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Carregar Pedidos da Nuvem (Sempre a prioridade para estar sincronizado)
                const pedidosData = await loadPedidosFabrica();
                if (pedidosData && pedidosData.length > 0) {
                    const loadedPendencies: Record<string, Record<FactoryName, number>> = {};
                    pedidosData.forEach((row: any) => {
                        if (!loadedPendencies[row.codigo]) {
                            loadedPendencies[row.codigo] = { MK: 0, MOLERI: 0, CM: 0, OLIMPO: 0 };
                        }
                        loadedPendencies[row.codigo][row.factory as FactoryName] = row.quantidade;
                    });
                    setPendencies(loadedPendencies);
                }

                // 2. Tentar buscar inventário base das PENDÊNCIAS na Nuvem
                const inventoryData = await getPendenciasInventory();
                if (inventoryData && inventoryData.length > 0) {
                    setStock(inventoryData as StockItem[]);
                    // Atualizar cache local com dados da nuvem
                    localStorage.setItem('inventory_cache', JSON.stringify({
                        data: inventoryData,
                        updatedAt: new Date().toISOString()
                    }));
                } else {
                    // 3. Se não houver nada na nuvem, tentar carregar do Cache Local (Backup)
                    const savedCache = localStorage.getItem('inventory_cache');
                    if (savedCache) {
                        const { data, updatedAt } = JSON.parse(savedCache);
                        setStock(data as StockItem[]);
                        setLastUploadDate(updatedAt || null);
                        toast.success('Usando inventário carregado localmente.', { duration: 2000 });
                    }
                }
            } catch (err) {
                console.error('Erro ao inicializar', err);
                toast.error('Erro ao carregar dados.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    return (
        <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors overflow-hidden">
            <Toaster position="top-center" />

            <header className="flex-none bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors z-20">
                <div className="w-full max-w-[98%] mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBackToMenu}
                            className="p-1.5 shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm font-bold flex items-center justify-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span className="hidden sm:inline text-sm">Menu</span>
                        </button>
                        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 whitespace-nowrap">
                            <ClipboardList className="text-amber-500 w-5 h-5" /> Pendências
                        </h1>
                        <div className="hidden md:block h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>
                        <div className="flex flex-col">
                            <p className="hidden lg:block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
                                {isLoading ? "Carregando..." : `${filteredStock.length} / ${stock.length} Rodas`}
                            </p>
                            {lastUploadDate && (
                                <p className="hidden lg:block text-[9px] font-medium text-slate-400 dark:text-slate-500">
                                    Planilha: {new Date(lastUploadDate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            )}
                        </div>
                    </div>

                    {!isLoading && (
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative w-48 lg:w-64">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar roda..." 
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-500/50"
                                />
                            </div>
                            
                            <button 
                                onClick={() => setShowFilters(!showFilters)} 
                                className={cn(
                                    "px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-colors flex items-center gap-1.5", 
                                    showFilters ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                                )}
                            >
                                <Filter className="w-3.5 h-3.5" /> Filtros
                            </button>

                            <button 
                                onClick={() => setShowOnlyPending(!showOnlyPending)} 
                                className={cn(
                                    "px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all border flex items-center gap-1.5 shadow-sm", 
                                    showOnlyPending 
                                        ? "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-700" 
                                        : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                )}
                            >
                                📌 Pedidos
                            </button>

                            <button 
                                onClick={() => {
                                    setTempProcessedData([]);
                                    setIsUploadModalOpen(true);
                                }}
                                className="px-2.5 py-1.5 text-xs font-bold rounded-lg border bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-1.5 shadow-sm"
                            >
                                <Upload className="w-3.5 h-3.5" /> Importar
                            </button>

                            <button 
                                onClick={handleExport}
                                className="px-2.5 py-1.5 text-xs font-black rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm"
                            >
                                <Upload className="w-3.5 h-3.5 rotate-180" /> Exportar
                            </button>

                            {(filterLinha || filterAro || filterFuracao || filterModelo || filterAcabamento || searchQuery) && (
                                <button onClick={() => { setFilterLinha(""); setFilterAro(""); setFilterFuracao(""); setFilterModelo(""); setFilterAcabamento(""); setSearchQuery(""); }} className="px-2.5 py-1.5 text-[10px] uppercase tracking-tighter font-black text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors border border-red-200 dark:border-red-900/40">
                                    Limpar
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </header>

            <main className="flex-1 flex flex-col w-full max-w-[98%] mx-auto px-2 sm:px-4 py-3 overflow-hidden">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden"
                >
                    <div className="flex-none px-4 py-2 border-b border-slate-200 dark:border-slate-800">
                        {showFilters && (
                            <div className="flex flex-wrap items-center gap-2 py-1">
                                <select value={filterLinha} onChange={e => setFilterLinha(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer shadow-sm">
                                    <option value="">Todas Linhas</option>
                                    {uniqueLinhas.map(o => <option key={o} value={o}>Linha {o}</option>)}
                                </select>

                                <select value={filterAro} onChange={e => setFilterAro(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer shadow-sm">
                                    <option value="">Todos Aros</option>
                                    {uniqueAros.map(o => <option key={o} value={o}>Aro {o}</option>)}
                                </select>

                                <select value={filterFuracao} onChange={e => setFilterFuracao(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer shadow-sm">
                                    <option value="">Todas Furações</option>
                                    {uniqueFuracoes.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>

                                <select value={filterModelo} onChange={e => setFilterModelo(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer shadow-sm">
                                    <option value="">Todos Modelos</option>
                                    {uniqueModelos.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>

                                <select value={filterAcabamento} onChange={e => setFilterAcabamento(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer shadow-sm">
                                    <option value="">Todos Acabamentos</option>
                                    {uniqueAcabamentos.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-auto relative">
                        <table className="w-full text-sm text-left whitespace-nowrap">
                            <thead className="sticky top-0 z-20 text-[10px] font-black uppercase bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                                {/* Linha 1: Cabeçalhos de Grupo */}
                                <tr className="bg-slate-50 dark:bg-slate-800">
                                    <th rowSpan={2} className="sticky left-0 z-30 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 min-w-[100px] text-slate-400">FOTO</th>
                                    <th rowSpan={2} className="sticky left-[100px] z-30 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 min-w-[300px] lg:min-w-[400px] border-r shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] text-slate-400">IDENTIFICAÇÃO DO PRODUTO</th>
                                    <th rowSpan={2} className="px-2 py-3 border-b border-slate-200 dark:border-slate-700 text-right min-w-[80px] text-slate-400">PREÇO</th>
                                    
                                    <th colSpan={3} className="px-2 py-2 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 tracking-[0.2em]">MK - PARANÁ</th>
                                    <th colSpan={3} className="px-2 py-2 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-emerald-50/50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 tracking-[0.2em]">MOLERI</th>
                                    <th colSpan={3} className="px-2 py-2 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-amber-50/50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 tracking-[0.2em]">CM</th>
                                    <th colSpan={3} className="px-2 py-2 border-b border-slate-200 dark:border-slate-700 text-center bg-rose-50/50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 tracking-[0.2em]">OLIMPO</th>
                                </tr>
                                {/* Linha 2: Cabeçalhos Individuais */}
                                <tr>
                                    <th className="px-2 py-2 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-indigo-50/30 dark:bg-indigo-900/10">EST.</th>
                                    <th className="px-2 py-2 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-indigo-50/30 dark:bg-indigo-900/10">PEND.</th>
                                    <th className="px-2 py-2 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-indigo-100/50 dark:bg-indigo-800/30">PEDIDO</th>
                                    
                                    <th className="px-2 py-2 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-emerald-50/30 dark:bg-emerald-900/10">EST.</th>
                                    <th className="px-2 py-2 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-emerald-50/30 dark:bg-emerald-900/10">PEND.</th>
                                    <th className="px-2 py-2 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-emerald-100/50 dark:bg-emerald-800/30">PEDIDO</th>
                                    
                                    <th className="px-2 py-2 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-amber-50/30 dark:bg-amber-900/10">EST.</th>
                                    <th className="px-2 py-2 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-amber-50/30 dark:bg-amber-900/10">PEND.</th>
                                    <th className="px-2 py-2 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-amber-100/50 dark:bg-amber-800/30">PEDIDO</th>
                                    
                                    <th className="px-2 py-2 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-rose-50/30 dark:bg-rose-900/10">EST.</th>
                                    <th className="px-2 py-2 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-rose-50/30 dark:bg-rose-900/10">PEND.</th>
                                    <th className="px-2 py-2 border-b border-slate-200 dark:border-slate-700 text-center bg-rose-100/50 dark:bg-rose-800/30">PEDIDO</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                                {!isLoading && paginatedStock.map((item, idx) => {
                                    const isEven = idx % 2 === 0;
                                    const bgNormal = isEven ? "bg-white dark:bg-slate-900" : "bg-slate-50 dark:bg-slate-800";
                                    const bgHighlight = isEven ? "bg-slate-50 dark:bg-slate-800" : "bg-slate-100 dark:bg-slate-700";
                                    const bgInput = isEven ? "bg-white dark:bg-slate-900" : "bg-slate-50 dark:bg-slate-800";

                                    const photoUrl = getWheelPhotoUrl(item.descricao);
                                    const modelCode = item.descricao.split(' ')[0].toUpperCase();

                                    return (
                                        <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors group">
                                            <td className={cn("sticky left-0 z-10 px-4 py-3 min-w-[100px]", bgNormal)}>
                                                <img 
                                                    src={photoUrl} 
                                                    alt={`Foto ${modelCode}`} 
                                                    className="w-16 h-16 rounded-md object-cover border border-slate-200 dark:border-slate-700 shadow-sm" 
                                                />
                                            </td>
                                            <td className={cn("sticky left-[100px] z-10 px-4 py-3 text-slate-600 dark:text-slate-400 min-w-[300px] lg:min-w-[400px] border-r border-slate-200 dark:border-slate-700/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]", bgNormal)}>{item.descricao}</td>
                                            <td className={cn("px-2 py-3 text-right text-slate-500", bgNormal)}>
                                                {item.preco ? item.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                                            </td>
                                            
                                            {/* MK */}
                                            <td className={cn("px-2 py-3 text-center font-bold text-slate-500", "bg-indigo-50/20 dark:bg-indigo-900/5")}>{item.est_mk || 0}</td>
                                            <td className={cn("px-2 py-3 text-center text-slate-400", "bg-indigo-50/20 dark:bg-indigo-900/5")}>{item.pend_mk || 0}</td>
                                            <td 
                                                className={cn("px-2 py-3 text-center cursor-pointer hover:bg-indigo-100/50 dark:hover:bg-indigo-800/20 transition-colors border-x border-slate-200 dark:border-slate-700 font-black text-red-600 dark:text-red-400 group", "bg-indigo-100/30 dark:bg-indigo-800/10")}
                                                onClick={() => openModal(item, 'MK')}
                                            >
                                                <div className="flex items-center justify-center gap-1 mx-auto w-16 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 rounded-lg py-1.5 shadow-sm group-hover:border-indigo-400 group-hover:ring-1 group-hover:ring-indigo-400/50 transition-all">
                                                    <span className="text-lg">{pendencies[item.codigo]?.MK || 0}</span>
                                                    <Pencil className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 transition-colors" />
                                                </div>
                                            </td>

                                            {/* MOLERI */}
                                            <td className={cn("px-2 py-3 text-center font-bold text-slate-500", "bg-emerald-50/20 dark:bg-emerald-900/5")}>{item.est_moleri || 0}</td>
                                            <td className={cn("px-2 py-3 text-center text-slate-400", "bg-emerald-50/20 dark:bg-emerald-900/5")}>{item.pend_moleri || 0}</td>
                                            <td 
                                                className={cn("px-2 py-3 text-center cursor-pointer hover:bg-emerald-100/50 dark:hover:bg-emerald-800/20 transition-colors border-x border-slate-200 dark:border-slate-700 font-black text-red-600 dark:text-red-400 group", "bg-emerald-100/30 dark:bg-emerald-800/10")}
                                                onClick={() => openModal(item, 'MOLERI')}
                                            >
                                                <div className="flex items-center justify-center gap-1 mx-auto w-16 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 rounded-lg py-1.5 shadow-sm group-hover:border-emerald-400 group-hover:ring-1 group-hover:ring-emerald-400/50 transition-all">
                                                    <span className="text-lg">{pendencies[item.codigo]?.MOLERI || 0}</span>
                                                    <Pencil className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-emerald-500 transition-colors" />
                                                </div>
                                            </td>

                                            {/* CM */}
                                            <td className={cn("px-2 py-3 text-center font-bold text-slate-500", "bg-amber-50/20 dark:bg-amber-900/5")}>{item.est_cm || 0}</td>
                                            <td className={cn("px-2 py-3 text-center text-slate-400", "bg-amber-50/20 dark:bg-amber-900/5")}>{item.pend_cm || 0}</td>
                                            <td 
                                                className={cn("px-2 py-3 text-center cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors border-x border-slate-200 dark:border-slate-700 font-black text-red-600 dark:text-red-400 group", "bg-amber-100/30 dark:bg-amber-900/10")}
                                                onClick={() => openModal(item, 'CM')}
                                            >
                                                <div className="flex items-center justify-center gap-1 mx-auto w-16 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 rounded-lg py-1.5 shadow-sm group-hover:border-amber-400 group-hover:ring-1 group-hover:ring-amber-400/50 transition-all">
                                                    <span className="text-lg">{pendencies[item.codigo]?.CM || 0}</span>
                                                    <Pencil className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-amber-500 transition-colors" />
                                                </div>
                                            </td>

                                            {/* OLIMPO */}
                                            <td className={cn("px-2 py-3 text-center font-bold text-slate-500", "bg-rose-50/20 dark:bg-rose-900/5")}>{item.est_olimpo || 0}</td>
                                            <td className={cn("px-2 py-3 text-center text-slate-400", "bg-rose-50/20 dark:bg-rose-900/5")}>{item.pend_olimpo || 0}</td>
                                            <td 
                                                className={cn("px-2 py-3 text-center cursor-pointer hover:bg-rose-100/50 dark:hover:bg-rose-900/30 transition-colors border-x border-slate-200 dark:border-slate-700 font-black text-red-600 dark:text-red-400 group", "bg-rose-100/30 dark:bg-rose-900/10")}
                                                onClick={() => openModal(item, 'OLIMPO')}
                                            >
                                                <div className="flex items-center justify-center gap-1 mx-auto w-16 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 rounded-lg py-1.5 shadow-sm group-hover:border-rose-400 group-hover:ring-1 group-hover:ring-rose-400/50 transition-all">
                                                    <span className="text-lg">{pendencies[item.codigo]?.OLIMPO || 0}</span>
                                                    <Pencil className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-rose-500 transition-colors" />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {isLoading && (
                                    <tr>
                                        <td colSpan={16} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                                            Carregando itens...
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {!isLoading && (
                        <div className="flex-none border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-20 shadow-[0_-8px_15px_-3px_rgba(0,0,0,0.1)]">
                            {/* Totais do Rodapé - Divididos por Fábrica */}
                            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
                                <div className="flex items-start justify-start gap-6 min-w-max pb-1">
                                    {/* MK */}
                                    <div className="flex flex-col gap-1 border-r border-slate-200 dark:border-slate-700 pr-6">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MK</span>
                                        <div className="flex items-center gap-4">
                                            <div className="flex flex-col"><span className="text-[9px] text-slate-500 uppercase">Est</span><span className="text-sm font-bold">{filteredStock.reduce((acc, item) => acc + (item.est_mk || 0), 0)}</span></div>
                                            <div className="flex flex-col"><span className="text-[9px] text-slate-500 uppercase">Pnd</span><span className="text-sm font-bold">{filteredStock.reduce((acc, item) => acc + (item.pend_mk || 0), 0)}</span></div>
                                            <div className="flex flex-col bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                                <span className="text-[9px] text-amber-700 dark:text-amber-400 font-bold uppercase">Ped</span>
                                                <span className="text-sm font-black text-amber-800 dark:text-amber-300">{filteredStock.reduce((acc, item) => acc + (pendencies[item.codigo]?.MK || 0), 0)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* MOLERI */}
                                    <div className="flex flex-col gap-1 border-r border-slate-200 dark:border-slate-700 pr-6">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MOLERI</span>
                                        <div className="flex items-center gap-4">
                                            <div className="flex flex-col"><span className="text-[9px] text-slate-500 uppercase">Est</span><span className="text-sm font-bold">{filteredStock.reduce((acc, item) => acc + (item.est_moleri || 0), 0)}</span></div>
                                            <div className="flex flex-col"><span className="text-[9px] text-slate-500 uppercase">Pnd</span><span className="text-sm font-bold">{filteredStock.reduce((acc, item) => acc + (item.pend_moleri || 0), 0)}</span></div>
                                            <div className="flex flex-col bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                                <span className="text-[9px] text-amber-700 dark:text-amber-400 font-bold uppercase">Ped</span>
                                                <span className="text-sm font-black text-amber-800 dark:text-amber-300">{filteredStock.reduce((acc, item) => acc + (pendencies[item.codigo]?.MOLERI || 0), 0)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* CM */}
                                    <div className="flex flex-col gap-1 border-r border-slate-200 dark:border-slate-700 pr-6">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CM</span>
                                        <div className="flex items-center gap-4">
                                            <div className="flex flex-col"><span className="text-[9px] text-slate-500 uppercase">Est</span><span className="text-sm font-bold">{filteredStock.reduce((acc, item) => acc + (item.est_cm || 0), 0)}</span></div>
                                            <div className="flex flex-col"><span className="text-[9px] text-slate-500 uppercase">Pnd</span><span className="text-sm font-bold">{filteredStock.reduce((acc, item) => acc + (item.pend_cm || 0), 0)}</span></div>
                                            <div className="flex flex-col bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                                <span className="text-[9px] text-amber-700 dark:text-amber-400 font-bold uppercase">Ped</span>
                                                <span className="text-sm font-black text-amber-800 dark:text-amber-300">{filteredStock.reduce((acc, item) => acc + (pendencies[item.codigo]?.CM || 0), 0)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* OLIMPO */}
                                    <div className="flex flex-col gap-1 pr-6 border-r border-slate-200 dark:border-slate-700">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">OLIMPO</span>
                                        <div className="flex items-center gap-4">
                                            <div className="flex flex-col"><span className="text-[9px] text-slate-500 uppercase">Est</span><span className="text-sm font-bold">{filteredStock.reduce((acc, item) => acc + (item.est_olimpo || 0), 0)}</span></div>
                                            <div className="flex flex-col"><span className="text-[9px] text-slate-500 uppercase">Pnd</span><span className="text-sm font-bold">{filteredStock.reduce((acc, item) => acc + (item.pend_olimpo || 0), 0)}</span></div>
                                            <div className="flex flex-col bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                                <span className="text-[9px] text-amber-700 dark:text-amber-400 font-bold uppercase">Ped</span>
                                                <span className="text-sm font-black text-amber-800 dark:text-amber-300">{filteredStock.reduce((acc, item) => acc + (pendencies[item.codigo]?.OLIMPO || 0), 0)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Botão Zerar/Arquivar - Estilo Bloco */}
                                    <div className="flex flex-col gap-1 pl-6">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AÇÕES</span>
                                        <button 
                                            onClick={handleClearAll}
                                            className="flex items-center gap-2 h-[42px] px-3 bg-slate-100 dark:bg-slate-800 hover:bg-red-500 dark:hover:bg-red-900/50 hover:text-white dark:hover:text-red-100 text-slate-500 rounded-xl transition-all border border-slate-200 dark:border-slate-700 hover:border-red-500 group shadow-sm active:scale-95"
                                        >
                                            <Archive className="w-4 h-4" />
                                            <span className="text-[10px] font-black uppercase whitespace-nowrap">Zerar Semana</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Paginação */}
                            <div className="p-3 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900">
                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredStock.length)} de {filteredStock.length} rodas
                                </span>
                                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1.5 text-sm font-semibold rounded cursor-pointer transition-colors text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 dark:active:bg-slate-600"
                                    >
                                        Anterior
                                    </button>
                                    <div className="text-sm font-black text-amber-600 dark:text-amber-500 px-3 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded shadow-inner">
                                        {currentPage} <span className="text-slate-400 font-medium">/ {totalPages}</span>
                                    </div>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1.5 text-sm font-semibold rounded cursor-pointer transition-colors text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 dark:active:bg-slate-600"
                                    >
                                        Próximo
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
            </main>

            <PendencyQuantityModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                item={modalConfig.item}
                factory={modalConfig.factory}
                photoUrl={modalConfig.photoUrl}
                stockQty={modalConfig.stockQty}
                pendencyQty={modalConfig.pendencyQty}
                currentQty={modalConfig.currentQty}
                onConfirm={handleConfirmQty}
            />

            {/* Modal de Importação e Sincronização Cloud */}
            {/* Modal de Exportação */}
            <AnimatePresence>
                {isExportModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => !isExportLoading && setIsExportModalOpen(false)}
                            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl relative overflow-hidden"
                        >
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="bg-emerald-100 dark:bg-emerald-900/30 p-3 rounded-2xl">
                                        <FileSpreadsheet className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <button 
                                        onClick={() => setIsExportModalOpen(false)}
                                        disabled={isExportLoading}
                                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
                                    >
                                        <X className="w-6 h-6 text-slate-400" />
                                    </button>
                                </div>

                                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">Exportar Pedidos</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
                                    Deseja gerar o relatório com todos os pedidos atuais e saldos de fábrica em formato Excel?
                                </p>

                                <div className="space-y-3">
                                    <button
                                        onClick={executeExport}
                                        disabled={isExportLoading}
                                        className={cn(
                                            "w-full py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20",
                                            isExportLoading 
                                                ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed" 
                                                : "bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98]"
                                        )}
                                    >
                                        {isExportLoading ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 border-3 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                                                Gerando...
                                            </div>
                                        ) : (
                                            <>
                                                <CloudUpload className="w-6 h-6" />
                                                Gerar Planilha
                                            </>
                                        )}
                                    </button>
                                    
                                    <button
                                        onClick={() => setIsExportModalOpen(false)}
                                        disabled={isExportLoading}
                                        className="w-full py-4 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-colors disabled:opacity-50"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                            
                            {/* Footer decorativo */}
                            <div className="bg-slate-50 dark:bg-slate-950/50 px-6 py-4 flex items-center justify-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Excel Automático</span>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isUploadModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                        >
                            <div className="p-8">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                        <CloudUpload className="text-amber-500 w-6 h-6" /> Importar
                                    </h2>
                                    <button 
                                        onClick={() => setIsUploadModalOpen(false)}
                                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    {tempProcessedData.length === 0 ? (
                                        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50/50 dark:hover:bg-amber-900/20 transition-all cursor-pointer group">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                <FileSpreadsheet className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4 group-hover:scale-110 transition-transform" />
                                                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Clique para carregar planilha</p>
                                                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">.XLSX ou .XLS</p>
                                            </div>
                                            <input 
                                                type="file" 
                                                className="hidden" 
                                                accept=".xlsx, .xlsm, .xls"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) processExcelFile(file);
                                                }}
                                            />
                                        </label>
                                    ) : (
                                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-3xl p-6 text-center">
                                            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                                            <h3 className="text-xl font-black text-emerald-800 dark:text-emerald-300">Planilha Carregada!</h3>
                                            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mt-1">
                                                Identificamos <span className="text-lg font-black">{tempProcessedData.length}</span> rodas prontas para sincronizar.
                                            </p>
                                        </div>
                                    )}

                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 text-center">Instruções</p>
                                        <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2 font-medium">
                                            <li className="flex gap-2"><span>1.</span> A aba deve se chamar <strong>"PRINCIPAL"</strong></li>
                                            <li className="flex gap-2"><span>2.</span> Colunas obrigatórias: Código, Catálogo, Preço.</li>
                                            <li className="flex gap-2"><span>3.</span> Campos de estoque MK, Moleri, CM e Olimpo são opcionais.</li>
                                        </ul>
                                    </div>

                                    {tempProcessedData.length > 0 && (
                                        <button
                                            onClick={handleSyncToCloud}
                                            disabled={isSyncingCloud}
                                            className="w-full h-14 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-black flex items-center justify-center gap-3 hover:opacity-90 transition-all active:scale-[0.98] shadow-lg shadow-slate-200 dark:shadow-none disabled:opacity-50"
                                        >
                                            {isSyncingCloud ? (
                                                <div className="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <CloudUpload className="w-5 h-5" />
                                            )}
                                            {isSyncingCloud ? 'SINCRONIZANDO...' : 'SINCRONIZAR COM NUVEM'}
                                        </button>
                                    )}

                                    {tempProcessedData.length > 0 && !isSyncingCloud && (
                                        <button 
                                            onClick={() => setTempProcessedData([])}
                                            className="w-full text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors uppercase tracking-widest"
                                        >
                                            Trocar Planilha
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
