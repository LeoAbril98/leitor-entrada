import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    ArrowLeft, 
    Download, 
    Upload, 
    RotateCcw, 
    Search, 
    Save, 
    X, 
    TrendingUp, 
    Package, 
    ShoppingCart, 
    Factory,
    FileSpreadsheet,
    Pencil,
    History as HistoryIcon,
    Tag,
    Trash2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

import { 
    getPendenciasInventory, 
    loadPedidosFabrica, 
    archiveAndClearPedidos, 
    getItemTags,
    getAllCloudSketches,
    getAllCloudAudios,
    getGlobalTags,
    addGlobalTag,
    deleteGlobalTag
} from '../lib/supabase';
import { getAllSketches, getAllAudioKeys, getAudio, deleteSketch, deleteAudio } from '../lib/sketchStore';
import { StockItem } from '../types';
import { cn } from '../utils';

interface AdminManagementPanelProps {
    onBack: () => void;
    onViewTable: () => void;
    onViewHistory: () => void;
}

export const AdminManagementPanel: React.FC<AdminManagementPanelProps> = ({ onBack, onViewTable, onViewHistory }) => {
    const [stock, setStock] = useState<StockItem[]>([]);
    const [pendencies, setPendencies] = useState<Record<string, any>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<{ descricao?: string, preco?: number }>({});
    const [isExporting, setIsExporting] = useState(false);
    const [allTags, setAllTags] = useState<Record<string, string[]>>({});
    
    // Gestão de Tags Globais
    const [globalTags, setGlobalTags] = useState<string[]>([]);
    const [isTagModalOpen, setIsTagModalOpen] = useState(false);
    const [newTagName, setNewTagName] = useState("");

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const inventory = await getPendenciasInventory();
            const pendsData = await loadPedidosFabrica();
            const tags = await getItemTags();
            const gTags = await getGlobalTags();

            // Organizar pedidos no formato Record<codigo, Record<factory, qty>>
            const pends: Record<string, any> = {};
            pendsData.forEach((row: any) => {
                if (!pends[row.codigo]) {
                    pends[row.codigo] = { MK: 0, MOLERI: 0, CM: 0, OLIMPO: 0 };
                }
                pends[row.codigo][row.factory] = row.quantidade;
            });

            setStock(inventory);
            setPendencies(pends);
            setAllTags(tags);
            setGlobalTags(gTags);
        } catch (error) {
            toast.error("Erro ao carregar dados administrativos");
        } finally {
            setIsLoading(false);
        }
    };

    // Cálculos para o Dashboard
    const totals = React.useMemo(() => {
        const stats = {
            totalStock: 0,
            totalPnd: 0,
            totalOrders: 0,
            byFactoryEst: { MK: 0, MOLERI: 0, CM: 0, OLIMPO: 0 },
            byFactoryPnd: { MK: 0, MOLERI: 0, CM: 0, OLIMPO: 0 },
            byFactoryOrders: { MK: 0, MOLERI: 0, CM: 0, OLIMPO: 0 }
        };

        stock.forEach(item => {
            // Estoque
            stats.byFactoryEst.MK += (item.est_mk || 0);
            stats.byFactoryEst.MOLERI += (item.est_moleri || 0);
            stats.byFactoryEst.CM += (item.est_cm || 0);
            stats.byFactoryEst.OLIMPO += (item.est_olimpo || 0);
            stats.totalStock += (item.est_mk || 0) + (item.est_moleri || 0) + (item.est_cm || 0) + (item.est_olimpo || 0);

            // Pendencias
            stats.byFactoryPnd.MK += (item.pend_mk || 0);
            stats.byFactoryPnd.MOLERI += (item.pend_moleri || 0);
            stats.byFactoryPnd.CM += (item.pend_cm || 0);
            stats.byFactoryPnd.OLIMPO += (item.pend_olimpo || 0);
            stats.totalPnd += (item.pend_mk || 0) + (item.pend_moleri || 0) + (item.pend_cm || 0) + (item.pend_olimpo || 0);
            
            // Pedidos
            const itemPends = pendencies[item.codigo] || {};
            Object.keys(itemPends).forEach(factory => {
                const qty = itemPends[factory] || 0;
                stats.totalOrders += qty;
                if (stats.byFactoryOrders[factory as keyof typeof stats.byFactoryOrders] !== undefined) {
                    stats.byFactoryOrders[factory as keyof typeof stats.byFactoryOrders] += qty;
                }
            });
        });

        return stats;
    }, [stock, pendencies]);



    const handleExportExcel = async () => {
        setIsExporting(true);
        const loadingToast = toast.loading("Gerando relatório profissional...");

        try {
            // Buscar dados de mídia frescos para o export
            const sketches = await getAllCloudSketches();
            const audios = await getAllCloudAudios();

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Pendências');

            // 1. Configurar Página para Impressão
            worksheet.pageSetup = {
                orientation: 'landscape',
                paperSize: 9, // A4
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0,
                margins: {
                    left: 0.3, right: 0.3, top: 0.3, bottom: 0.3,
                    header: 0.1, footer: 0.1
                },
                printTitlesRow: '1:2',
                printArea: `B1:P${stock.length + 3}`
            };

            // 2. Definir Colunas
            worksheet.columns = [
                { header: 'CATÁLOGO', key: 'codigo', width: 22 },
                { header: 'DESCRIÇÃO', key: 'descricao', width: 40 },
                { header: 'QTDE MIN', key: 'qtd_min', width: 10 },
                { header: 'PREÇO FÁBRICA', key: 'preco', width: 15 },
                { header: 'EST. MK', key: 'est_mk', width: 9 },
                { header: 'PEND MK', key: 'pend_mk', width: 9 },
                { header: 'MK', key: 'order_mk', width: 9 },
                { header: 'EST. MOLERI', key: 'est_moleri', width: 9 },
                { header: 'PEND MOLERI', key: 'pend_moleri', width: 9 },
                { header: 'MOLERI', key: 'order_moleri', width: 9 },
                { header: 'EST. CM', key: 'est_cm', width: 9 },
                { header: 'PEND CM', key: 'pend_cm', width: 9 },
                { header: 'CM', key: 'order_cm', width: 9 },
                { header: 'EST. OLIMPO', key: 'est_olimpo', width: 9 },
                { header: 'PEND OLIMPO', key: 'pend_olimpo', width: 9 },
                { header: 'OLIMPO', key: 'order_olimpo', width: 9 },
                { header: 'ETIQUETAS', key: 'tags', width: 25 },
                { header: 'TEM ÁUDIO?', key: 'has_audio', width: 15 },
                { header: 'TEM POST-IT?', key: 'has_sketch', width: 15 }
            ];

            // 3. Adicionar Título no Topo
            worksheet.spliceRows(1, 0, []);
            const titleRow = worksheet.getRow(1);
            titleRow.height = 40;
            worksheet.mergeCells('B1:P1');
            const titleCell = worksheet.getCell('B1');
            const today = new Date().toLocaleDateString('pt-BR').split('/').join(' ');
            titleCell.value = `PEDIDO MK /SC/SP/RS ${today}`;
            titleCell.font = { bold: true, italic: true, size: 14 };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

            // 4. Cabeçalho na Linha 2
            const headerRow = worksheet.getRow(2);
            headerRow.height = 35;
            headerRow.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
                cell.font = { bold: true, size: 11, color: { argb: 'FF000000' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF000000' } },
                    left: { style: 'thin', color: { argb: 'FF000000' } },
                    bottom: { style: 'thin', color: { argb: 'FF000000' } },
                    right: { style: 'thin', color: { argb: 'FF000000' } }
                };
            });

            // 5. Adicionar Dados
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
                    order_olimpo: itemPends.OLIMPO || 0,
                    tags: (allTags[item.codigo] || []).join(', '),
                    has_audio: audios[item.codigo] ? 'SIM' : 'NÃO',
                    has_sketch: sketches[item.codigo] ? 'SIM' : 'NÃO'
                });

                row.height = 25;
                row.eachCell((cell, colNumber) => {
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FF000000' } },
                        left: { style: 'thin', color: { argb: 'FF000000' } },
                        bottom: { style: 'thin', color: { argb: 'FF000000' } },
                        right: { style: 'thin', color: { argb: 'FF000000' } }
                    };
                    cell.font = { size: 11 };
                    cell.alignment = { vertical: 'middle' };

                    if (colNumber === 1 || colNumber >= 3) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    }

                    if (colNumber === 4) {
                        cell.numFmt = '"R$ " #,##0.00';
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    }

                    // Ocultar zeros nas ordens
                    if ([7, 10, 13, 16].includes(colNumber) && cell.value === 0) {
                        cell.value = null;
                    }
                });
            });

            // 6. Totais
            const lastDataRowIndex = stock.length + 2;
            const totalRowIndex = lastDataRowIndex + 1;
            const totalRow = worksheet.addRow({});
            totalRow.height = 30;
            totalRow.getCell(1).value = 'TOTAL GERAL';
            totalRow.getCell(1).font = { bold: true, size: 10 };
            totalRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
            worksheet.mergeCells(`A${totalRowIndex}:B${totalRowIndex}`);

            for (let i = 5; i <= 16; i++) {
                const cell = totalRow.getCell(i);
                const colLetter = worksheet.getColumn(i).letter;
                cell.value = { formula: `SUM(${colLetter}3:${colLetter}${lastDataRowIndex})` };
                cell.font = { bold: true };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                cell.border = {
                    top: { style: 'medium', color: { argb: 'FF000000' } },
                    left: { style: 'thin', color: { argb: 'FF000000' } },
                    bottom: { style: 'medium', color: { argb: 'FF000000' } },
                    right: { style: 'thin', color: { argb: 'FF000000' } }
                };
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `Relatorio_Geral_${dateStr}.xlsx`);

            toast.success("Excel gerado com sucesso!", { id: loadingToast });
        } catch (err) {
            console.error(err);
            toast.error("Erro ao gerar Excel", { id: loadingToast });
        } finally {
            setIsExporting(false);
        }
    };

    const handleAddTag = async () => {
        if (!newTagName.trim()) return;
        const success = await addGlobalTag(newTagName.trim());
        if (success) {
            setGlobalTags(prev => [...prev, newTagName.trim().toUpperCase()].sort());
            setNewTagName("");
            toast.success("Tag adicionada!");
        } else {
            toast.error("Erro ao adicionar tag");
        }
    };

    const handleDeleteTag = async (tagName: string) => {
        if (!window.confirm(`Excluir a etiqueta "${tagName}" da biblioteca?`)) return;
        const success = await deleteGlobalTag(tagName);
        if (success) {
            setGlobalTags(prev => prev.filter(t => t !== tagName));
            toast.success("Tag removida");
        } else {
            toast.error("Erro ao remover tag");
        }
    };

    const handleClearWeek = async () => {
        const confirmMsg = "ATENÇÃO: Isso irá ARQUIVAR todos os pedidos atuais, incluindo Etiquetas, Rascunhos e Áudios, e zerar a tabela para uma nova semana. Deseja continuar?";
        
        if (window.confirm(confirmMsg)) {
            const loadingToast = toast.loading("Preparando snapshot completo...");
            try {
                // 1. Coletar Etiquetas
                const tags = await getItemTags();

                // 2. Coletar Rascunhos
                const sketches = await getAllSketches();

                // 3. Coletar Áudios (e converter Blobs para Base64 para arquivamento no JSON)
                const audioKeys = await getAllAudioKeys();
                const audios: Record<string, string> = {};
                
                for (const key of audioKeys) {
                    const blob = await getAudio(key);
                    if (blob) {
                        const base64 = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.readAsDataURL(blob);
                        });
                        audios[key] = base64;
                    }
                }

                // 4. Executar Arquivamento com Metadados
                await archiveAndClearPedidos({ tags, sketches, audios });
                
                // 5. Limpar armazenamento LOCAL (IndexedDB) para não sobrar rascunhos e áudios na nova semana
                for (const key of Object.keys(sketches)) await deleteSketch(key);
                for (const key of audioKeys) await deleteAudio(key);

                toast.success("Semana zerada e snapshot total arquivado!", { id: loadingToast });
                loadData();
            } catch (error) {
                console.error(error);
                toast.error("Erro ao zerar semana", { id: loadingToast });
            }
        }
    };

    const startEditing = (item: StockItem) => {
        setEditingId(item.codigo);
        setEditValues({ descricao: item.descricao, preco: item.preco });
    };

    const saveEdit = () => {
        // Logica para salvar no DB local/Supabase
        // Por enquanto apenas feedback visual ja que o inventário base costuma vir do Excel
        toast.success("Alteração salva (Simulação)");
        setEditingId(null);
    };

    const filteredStock = stock.filter(item => 
        item.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.descricao.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 50); // Limitar a 50 para performance na edição rápida

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header Superior */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <button 
                        onClick={onBack}
                        className="flex items-center gap-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors group"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className="font-bold uppercase tracking-widest text-sm">Painel Principal</span>
                    </button>

                    <div className="flex flex-wrap gap-3">
                        <button 
                            onClick={onViewHistory}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                        >
                            <HistoryIcon className="w-4 h-4 text-amber-500" />
                            Histórico
                        </button>
                        <button 
                            disabled={isExporting}
                            onClick={handleExportExcel}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            Exportar Excel
                        </button>
                        <button 
                            onClick={handleClearWeek}
                            className="flex items-center gap-2 px-5 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl text-red-600 dark:text-red-400 font-bold hover:bg-red-100 transition-all shadow-sm active:scale-95"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Zerar Semana
                        </button>
                        <button 
                            onClick={onViewTable}
                            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                        >
                            <LayoutGrid className="w-4 h-4" />
                            Acessar Tabela
                        </button>
                        <button 
                            onClick={() => setIsTagModalOpen(true)}
                            className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all shadow-lg active:scale-95 border border-slate-700"
                        >
                            <Tag className="w-4 h-4" />
                            Gestão de Tags
                        </button>
                    </div>
                </div>

                {/* Grid de Totais Estruturado em 3 Blocos */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                    {/* BLOCO 1: ESTOQUE TOTAL */}
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col group hover:border-indigo-500/50 transition-colors">
                        <div className="p-8 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                                    <Package className="w-6 h-6" />
                                </div>
                                <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Estoque Geral</span>
                            </div>
                            <div className="text-5xl font-black text-slate-800 dark:text-slate-100 tracking-tighter">
                                {totals.totalStock}
                            </div>
                        </div>
                        <div className="p-8 grid grid-cols-2 gap-y-6 gap-x-4 flex-1 bg-white dark:bg-slate-900">
                            {Object.entries(totals.byFactoryEst).map(([filial, valor]) => (
                                <div key={filial} className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{filial}</span>
                                    <span className="text-xl font-black text-slate-700 dark:text-slate-300">{valor}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* BLOCO 2: PENDÊNCIAS (DO EXCEL) */}
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col group hover:border-amber-500/50 transition-colors">
                        <div className="p-8 border-b border-slate-50 dark:border-slate-800 bg-amber-50/20 dark:bg-amber-900/10">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl">
                                    <TrendingUp className="w-6 h-6" />
                                </div>
                                <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Pendências Fixas</span>
                            </div>
                            <div className="text-5xl font-black text-amber-600 dark:text-amber-500 tracking-tighter">
                                {totals.totalPnd}
                            </div>
                        </div>
                        <div className="p-8 grid grid-cols-2 gap-y-6 gap-x-4 flex-1 bg-white dark:bg-slate-900">
                            {Object.entries(totals.byFactoryPnd).map(([filial, valor]) => (
                                <div key={filial} className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{filial}</span>
                                    <span className="text-xl font-black text-slate-700 dark:text-slate-300">{valor}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* BLOCO 3: PEDIDOS DA SEMANA */}
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col group hover:border-emerald-500/50 transition-colors">
                        <div className="p-8 border-b border-slate-50 dark:border-slate-800 bg-emerald-50/20 dark:bg-emerald-900/10">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                                    <ShoppingCart className="w-6 h-6" />
                                </div>
                                <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Pedidos da Semana</span>
                            </div>
                            <div className="text-5xl font-black text-emerald-600 dark:text-emerald-500 tracking-tighter">
                                {totals.totalOrders}
                            </div>
                        </div>
                        <div className="p-8 grid grid-cols-2 gap-y-6 gap-x-4 flex-1 bg-white dark:bg-slate-900">
                            {Object.entries(totals.byFactoryOrders).map(([filial, valor]) => (
                                <div key={filial} className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{filial}</span>
                                    <span className="text-xl font-black text-slate-700 dark:text-slate-300 transition-colors group-hover:text-emerald-600">{valor}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Gestor de Dados - Edição Rápida */}
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
                    <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">Gestor de Modelos e Preços</h2>
                            <p className="text-slate-500 text-sm font-medium">Edite descrições e preços rapidamente sem sair do painel.</p>
                        </div>
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input 
                                type="text"
                                placeholder="Buscar código ou descrição..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-700 dark:text-slate-200"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                    <th className="px-8 py-4 w-32 text-center">Código</th>
                                    <th className="px-6 py-4">Descrição do Produto</th>
                                    <th className="px-6 py-4 w-40">Preço Atual</th>
                                    <th className="px-8 py-4 w-32 border-l border-slate-100 dark:border-slate-800 text-center">Ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence>
                                    {filteredStock.map(item => (
                                        <motion.tr 
                                            key={item.codigo}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-indigo-500/5 transition-colors group"
                                        >
                                            <td className="px-8 py-5">
                                                <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-xs font-black text-slate-600 dark:text-slate-300 text-center">
                                                    {item.codigo}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                {editingId === item.codigo ? (
                                                    <input 
                                                        autoFocus
                                                        value={editValues.descricao}
                                                        onChange={e => setEditValues({ ...editValues, descricao: e.target.value })}
                                                        className="w-full bg-indigo-50 dark:bg-slate-800 border-2 border-indigo-200 dark:border-indigo-900 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none"
                                                    />
                                                ) : (
                                                    <div className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate max-w-md">
                                                        {item.descricao}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-5">
                                                {editingId === item.codigo ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-black text-slate-400">R$</span>
                                                        <input 
                                                            type="number"
                                                            value={editValues.preco}
                                                            onChange={e => setEditValues({ ...editValues, preco: parseFloat(e.target.value) })}
                                                            className="w-full bg-indigo-50 dark:bg-slate-800 border-2 border-indigo-200 dark:border-indigo-900 rounded-lg px-3 py-2 text-sm font-black text-slate-700 dark:text-slate-200 outline-none"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                                                        {item.preco ? `R$ ${item.preco.toFixed(2)}` : 'R$ 0,00'}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-8 py-5 border-l border-slate-50 dark:border-slate-800/50">
                                                <div className="flex items-center justify-center">
                                                    {editingId === item.codigo ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <button 
                                                                onClick={saveEdit}
                                                                className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all"
                                                            >
                                                                <Save className="w-4 h-4" />
                                                            </button>
                                                            <button 
                                                                onClick={() => setEditingId(null)}
                                                                className="p-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-300 transition-all"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button 
                                                            onClick={() => startEditing(item)}
                                                            className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-all"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>

                    <div className="p-6 bg-slate-50 dark:bg-slate-800/20 text-center">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
                            <TrendingUp className="w-3 h-3" />
                            Mostrando as primeiras 50 rodas encontradas. Use a busca para filtrar.
                        </p>
                    </div>
                </div>
            </div>

            {/* Modal de Gestão de Tags */}
            <AnimatePresence>
                {isTagModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsTagModalOpen(false)}
                            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        />
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden"
                        >
                            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase">Biblioteca de Tags</h3>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Personalize suas sugestões</p>
                                </div>
                                <button onClick={() => setIsTagModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>

                            <div className="p-8">
                                <div className="flex gap-2 mb-6">
                                    <input 
                                        type="text"
                                        placeholder="Nova etiqueta..."
                                        value={newTagName}
                                        onChange={e => setNewTagName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                                        className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 transition-all uppercase"
                                    />
                                    <button 
                                        onClick={handleAddTag}
                                        className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                                    >
                                        Add
                                    </button>
                                </div>

                                <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                    {globalTags.map(tag => (
                                        <div key={tag} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 group">
                                            <span className="text-sm font-black text-slate-600 dark:text-slate-300 tracking-wider">
                                                {tag}
                                            </span>
                                            <button 
                                                onClick={() => handleDeleteTag(tag)}
                                                className="p-3.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all active:scale-90"
                                                title="Excluir etiqueta"
                                            >
                                                <Trash2 className="w-6 h-6" />
                                            </button>
                                        </div>
                                    ))}
                                    {globalTags.length === 0 && (
                                        <p className="text-center py-4 text-slate-400 text-sm italic">Nenhuma tag cadastrada.</p>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50 dark:bg-slate-800/20 text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                    Alterações sincronizadas em tempo real
                                </p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Adicionar um tipo LayoutGrid manual se o lucide-react do user for antigo
const LayoutGrid = (props: any) => (
    <svg 
        {...props} 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
    >
        <rect width="7" height="7" x="3" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="14" rx="1" />
        <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
);
