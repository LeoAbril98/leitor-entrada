import React, { useState, useEffect, useMemo } from 'react';
import {
    ArrowLeft,
    ArrowUp,
    Search,
    Printer,
    Download,
    Calendar,
    SlidersHorizontal,
    Box,
    FileSpreadsheet,
    MapPin,
    Truck,
    Database,
    RefreshCw,
    Cloud
} from 'lucide-react';
import { cn } from '../utils';
import {
    Romaneio,
    RomaneioItem,
    getRomaneios,
    getRomaneioById,
    exportRomaneioToExcel,
    fetchAndSyncRomaneios
} from '../services/romaneioService';
import { getInventory } from '../lib/supabase';
import { StockItem } from '../types';
import { extractAro, extractModel, extractFuracao } from '../utils/wheelVariations';
import { getWheelPhotoUrl } from '../utils/photoUtils';

interface RomaneioModuleProps {
    onBackToMenu: () => void;
}

// Cálculo de caixas baseado na regra da MKR Rodas (Aros 13, 14 e 15x6 são caixa dupla)
function calculateItemBoxes(item: { quantidade: number; descricao: string; codigo?: string }) {
    const textoBase = `${item.descricao || ''} ${item.codigo || ''}`.toUpperCase();
    const isCaixaDupla = textoBase.includes('13X') || textoBase.includes('14X') || textoBase.includes('15X6');
    const caixas = isCaixaDupla ? Math.ceil(item.quantidade / 2) : item.quantidade;

    return {
        caixas,
        unidades: item.quantidade,
        displayQtd: `${item.quantidade} un (${caixas} cx)`,
        isDupla: isCaixaDupla
    };
}

// Função para ordenação inteligente e alfanumérica natural de rodas (ex: 4x98 antes de 4x100, R2 antes de R10)
function sortWheelItems(a: RomaneioItem, b: RomaneioItem): number {
    const descA = (a.descricao || a.codigo || '').trim().toUpperCase();
    const descB = (b.descricao || b.codigo || '').trim().toUpperCase();

    // 1. Extrair modelo para manter itens do mesmo modelo juntos
    const modelA = extractModel(descA, a.codigo);
    const modelB = extractModel(descB, b.codigo);

    if (modelA && modelB && modelA !== modelB) {
        const cmpModel = modelA.localeCompare(modelB, 'pt-BR', { numeric: true, sensitivity: 'base' });
        if (cmpModel !== 0) return cmpModel;
    }

    // 2. Extrair furação (4X98 vem antes de 4X100 pois 98 < 100 numericamente)
    const furacaoA = extractFuracao(descA) || extractFuracao(a.codigo);
    const furacaoB = extractFuracao(descB) || extractFuracao(b.codigo);

    if (furacaoA && furacaoB && furacaoA !== furacaoB) {
        const matchA = furacaoA.match(/([34568])\s*[X\*\-]\s*([\d\.,]+)/i);
        const matchB = furacaoB.match(/([34568])\s*[X\*\-]\s*([\d\.,]+)/i);

        if (matchA && matchB) {
            const holesA = parseInt(matchA[1], 10) || 0;
            const holesB = parseInt(matchB[1], 10) || 0;
            if (holesA !== holesB) return holesA - holesB;

            const pcdA = parseFloat(matchA[2].replace(',', '.')) || 0;
            const pcdB = parseFloat(matchB[2].replace(',', '.')) || 0;
            if (pcdA !== pcdB) return pcdA - pcdB;
        }
    }

    // 3. Ordenação alfanumérica natural completa (compara números como inteiros: 98 < 100)
    const cmpDesc = descA.localeCompare(descB, 'pt-BR', { numeric: true, sensitivity: 'base' });
    if (cmpDesc !== 0) return cmpDesc;

    // 4. Desempate por código com ordenação natural
    return (a.codigo || '').localeCompare(b.codigo || '', 'pt-BR', { numeric: true, sensitivity: 'base' });
}

export const RomaneioModule: React.FC<RomaneioModuleProps> = ({ onBackToMenu }) => {
    const [romaneios, setRomaneios] = useState<Romaneio[]>([]);
    const [selectedRomaneioId, setSelectedRomaneioId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAroFilter, setSelectedAroFilter] = useState<string>('todos');
    const [dbStockMap, setDbStockMap] = useState<Map<string, number>>(new Map());
    const [isSyncing, setIsSyncing] = useState<boolean>(false);
    const [showScrollTop, setShowScrollTop] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setShowScrollTop(window.scrollY > 150);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Carregar romaneios salvos do cache local
    const loadRomaneios = () => {
        const list = getRomaneios();
        setRomaneios(list);
        if (list.length > 0 && !selectedRomaneioId) {
            setSelectedRomaneioId(list[0].id);
        }
    };

    // Sincronizar com a nuvem (Supabase)
    const handleManualSync = async () => {
        setIsSyncing(true);
        try {
            const list = await fetchAndSyncRomaneios();
            setRomaneios(list);
            if (list.length > 0) {
                setSelectedRomaneioId(prev => (prev && list.some(r => r.id === prev) ? prev : list[0].id));
            }
        } catch (e) {
            console.warn('Erro na sincronização com Supabase:', e);
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        loadRomaneios();
        // Buscar novidades da nuvem ao abrir
        handleManualSync();

        // Carregar estoque em tempo real do banco de dados (MK / Supabase)
        getInventory().then((inv) => {
            if (inv && Array.isArray(inv)) {
                const map = new Map<string, number>();
                inv.forEach((it: StockItem) => {
                    if (it.codigo) {
                        map.set(it.codigo.trim().toUpperCase(), Number(it.quantidade) || 0);
                    }
                });
                setDbStockMap(map);
            }
        }).catch(err => console.warn('Erro ao carregar estoque do banco:', err));

        const handleUpdate = () => loadRomaneios();
        window.addEventListener('mkr_romaneios_updated', handleUpdate);
        return () => window.removeEventListener('mkr_romaneios_updated', handleUpdate);
    }, []);

    // Romaneio ativo selecionado
    const activeRomaneio = useMemo(() => {
        if (!selectedRomaneioId) return romaneios[0] || null;
        return romaneios.find(r => r.id === selectedRomaneioId) || romaneios[0] || null;
    }, [romaneios, selectedRomaneioId]);

    // Agrupamento dos itens por ARO
    const { groupsByAro, totalRodas, totalCaixas, availableAros } = useMemo(() => {
        if (!activeRomaneio || !activeRomaneio.itens) {
            return { groupsByAro: [], totalRodas: 0, totalCaixas: 0, availableAros: [] };
        }

        let sumRodas = 0;
        let sumCaixas = 0;
        const map = new Map<string, {
            aro: string;
            itens: (RomaneioItem & {
                boxInfo: ReturnType<typeof calculateItemBoxes>;
                estoqueReal: number;
                photoUrl: string;
            })[];
        }>();

        activeRomaneio.itens.forEach(it => {
            const q = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm ||
                it.codigo.toLowerCase().includes(q) ||
                (it.descricao && it.descricao.toLowerCase().includes(q)) ||
                (it.local && it.local.toLowerCase().includes(q));

            const boxInfo = calculateItemBoxes(it);
            sumRodas += it.quantidade;
            sumCaixas += boxInfo.caixas;

            if (!matchesSearch) return;

            let rawAro = extractAro(it.descricao) || extractAro(it.codigo);
            const aroKey = rawAro ? rawAro : 'OUTROS';

            if (selectedAroFilter !== 'todos' && aroKey !== selectedAroFilter) {
                return;
            }

            const estoqueReal = dbStockMap.has(it.codigo)
                ? dbStockMap.get(it.codigo)!
                : (it.estoqueDb || 0);

            const photoUrl = getWheelPhotoUrl(it.descricao, it.codigo);

            if (!map.has(aroKey)) {
                map.set(aroKey, { aro: aroKey, itens: [] });
            }

            map.get(aroKey)!.itens.push({
                ...it,
                boxInfo,
                estoqueReal,
                photoUrl
            });
        });

        // Ordenar itens dentro de cada Aro de forma alfanumérica natural (4x98 antes de 4x100)
        map.forEach(group => {
            group.itens.sort(sortWheelItems);
        });

        // Ordenar os grupos por Aro numericamente (13", 14", 15", ..., OUTROS no fim)
        const sortedGroups = Array.from(map.values()).sort((a, b) => {
            if (a.aro === 'OUTROS') return 1;
            if (b.aro === 'OUTROS') return -1;
            const numA = parseInt(a.aro.replace(/[^0-9]/g, ''), 10) || 0;
            const numB = parseInt(b.aro.replace(/[^0-9]/g, ''), 10) || 0;
            return numA - numB;
        });

        const allArosSet = new Set<string>();
        activeRomaneio.itens.forEach(it => {
            const a = extractAro(it.descricao) || extractAro(it.codigo) || 'OUTROS';
            allArosSet.add(a);
        });
        const sortedArosList = Array.from(allArosSet).sort((a, b) => {
            if (a === 'OUTROS') return 1;
            if (b === 'OUTROS') return -1;
            return (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0);
        });

        return {
            groupsByAro: sortedGroups,
            totalRodas: sumRodas,
            totalCaixas: sumCaixas,
            availableAros: sortedArosList
        };
    }, [activeRomaneio, searchTerm, selectedAroFilter, dbStockMap]);

    // Data formatada
    const dataDisplay = activeRomaneio?.dataCriacao
        ? new Date(activeRomaneio.dataCriacao).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        })
        : new Date().toLocaleDateString('pt-BR');

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-800 dark:text-slate-100 antialiased print:p-0 print:m-0 print:bg-white print:overflow-visible overflow-x-clip w-full max-w-full">
            {/* ESTILOS DE IMPRESSÃO ECONÔMICA (MÁXIMO ITENS POR FOLHA, SEM FOTOS, SEM BORDAS ARREDONDADAS) */}
            <style dangerouslySetInnerHTML={{ __html: `
                @page {
                    size: A4 portrait;
                    margin: 8mm 8mm 8mm 8mm;
                }
                @media print {
                    html, body {
                        background: #ffffff !important;
                        color: #0f172a !important;
                        font-size: 12px !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: visible !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    /* Eliminação total de cantos arredondados e sombras no papel */
                    *, *::before, *::after {
                        box-shadow: none !important;
                        text-shadow: none !important;
                        border-radius: 0 !important;
                    }
                    div, section, main, article {
                        overflow: visible !important;
                        border-radius: 0 !important;
                    }
                    table {
                        border-collapse: collapse !important;
                        width: 100% !important;
                    }
                    thead {
                        display: table-header-group !important;
                    }
                    tr {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .print-section {
                        page-break-inside: auto;
                        break-inside: auto;
                        margin-bottom: 6px !important;
                        border-radius: 0 !important;
                    }
                    .print-aro-header {
                        page-break-after: avoid !important;
                        break-after: avoid !important;
                        border-radius: 0 !important;
                    }
                }
            ` }} />

            {/* CABEÇALHO FIXO / STICKY NO TOPO (Voltar, Carga, Nuvem, Imprimir, Excel) */}
            <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 shadow-xs transition-colors print:hidden">
                <div className="max-w-5xl mx-auto px-3.5 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2.5">
                    {/* Lado Esquerdo: Botão Voltar + Título e Totais Rápidos */}
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <button
                            onClick={onBackToMenu}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm transition-all active:scale-95 shrink-0 shadow-2xs"
                            title="Voltar ao Menu"
                        >
                            <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
                            <span className="hidden sm:inline">Voltar</span>
                        </button>

                        <div className="min-w-0 flex items-center gap-2">
                            <span className="font-black text-slate-800 dark:text-slate-100 text-sm sm:text-base tracking-tight truncate">
                                {activeRomaneio ? (activeRomaneio.titulo || 'Romaneio de Carga') : 'Romaneio'}
                            </span>
                            {activeRomaneio && (
                                <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 shrink-0">
                                    {totalRodas} un • {totalCaixas} cx
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Lado Direito: Ações (Trocar Carga, Nuvem, Imprimir, Excel) */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {romaneios.length > 1 && (
                            <select
                                value={selectedRomaneioId || ''}
                                onChange={(e) => {
                                    setSelectedRomaneioId(e.target.value);
                                    setSearchTerm('');
                                    setSelectedAroFilter('todos');
                                }}
                                className="h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500 shadow-2xs max-w-[120px] sm:max-w-[180px] truncate"
                            >
                                {romaneios.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.numero} - {r.titulo}
                                    </option>
                                ))}
                            </select>
                        )}

                        <button
                            onClick={handleManualSync}
                            disabled={isSyncing}
                            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition shadow-2xs disabled:opacity-50"
                            title="Sincronizar com a nuvem Supabase"
                        >
                            <RefreshCw className={cn("w-3.5 h-3.5 text-emerald-500", isSyncing && "animate-spin")} />
                            <span className="hidden md:inline">{isSyncing ? 'Sincronizando...' : 'Nuvem'}</span>
                        </button>

                        <button
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition shadow-2xs"
                            title="Imprimir Relatório"
                        >
                            <Printer className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Imprimir</span>
                        </button>

                        {activeRomaneio && (
                            <button
                                onClick={() => exportRomaneioToExcel(activeRomaneio)}
                                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-2xs"
                                title="Exportar Planilha Excel"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Excel</span>
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <div className="max-w-5xl mx-auto p-2.5 sm:p-6 md:p-8 space-y-4 sm:space-y-6 w-full max-w-full print:max-w-none print:w-full print:p-0 print:m-0 print:space-y-1.5 print:overflow-visible">

                {/* RELATÓRIO ESTILO FOLHA DE CARGA (Zero Scroll Lateral no Mobile) */}
                {!activeRomaneio ? (
                    <div className="bg-white dark:bg-slate-900 rounded-[24px] sm:rounded-[28px] p-8 sm:p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4">
                            <FileSpreadsheet className="w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Nenhum Romaneio Cadastrado</h2>
                        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-md mx-auto">
                            Acesse o <strong>Painel Administrativo</strong> para importar as planilhas Excel da carga e gerar a lista de consulta por aro.
                        </p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-[20px] sm:rounded-[28px] p-3.5 sm:p-8 md:p-10 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 sm:space-y-6 print:border-none print:shadow-none print:p-0 print:m-0 print:space-y-1.5 print:rounded-none print:overflow-visible w-full max-w-full overflow-visible">

                        {/* CABEÇALHO DO RELATÓRIO */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-800/80 print:pb-2 print:mb-2 print:border-b-2 print:border-slate-900">
                            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                                {/* Ícone de Roda Estilizado */}
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 flex items-center justify-center p-1.5 shrink-0 print:hidden">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                                        <circle cx="12" cy="12" r="10" />
                                        <circle cx="12" cy="12" r="3" />
                                        <line x1="12" y1="2" x2="12" y2="9" />
                                        <line x1="12" y1="15" x2="12" y2="22" />
                                        <line x1="2" y1="12" x2="9" y2="12" />
                                        <line x1="15" y1="12" x2="22" y2="12" />
                                    </svg>
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h1 className="text-lg sm:text-2xl font-black text-[#1E293B] dark:text-white tracking-tight uppercase truncate print:text-xl print:font-black print:tracking-normal">
                                            RELATÓRIO DE CAMINHÃO
                                        </h1>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 shrink-0 print:hidden">
                                            <Cloud className="w-3 h-3" /> Supabase
                                        </span>
                                    </div>
                                    <p className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5 truncate print:text-xs print:text-slate-800 print:font-bold">
                                        {activeRomaneio.titulo || 'RODAS E CAIXAS EM ESTOQUE'}
                                        {activeRomaneio.clienteOuDestino ? ` • ${activeRomaneio.clienteOuDestino}` : ''}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-4 text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-semibold self-start sm:self-center shrink-0 print:items-center">
                                {/* Resumo de Totais em Destaque na Impressão (Grande e Fácil de Ler) */}
                                <div className="hidden print:flex items-center gap-4 px-3.5 py-1.5 bg-slate-100 border-2 border-slate-900 text-slate-900">
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">TOTAL RODAS:</span>
                                        <span className="text-xl font-black text-black leading-none">{totalRodas}</span>
                                        <span className="text-xs font-black uppercase text-indigo-700">un</span>
                                    </div>
                                    <span className="text-slate-400 font-black">|</span>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">TOTAL CAIXAS:</span>
                                        <span className="text-xl font-black text-black leading-none">{totalCaixas}</span>
                                        <span className="text-xs font-black uppercase text-indigo-700">cx</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 text-slate-500 print:text-xs print:font-bold print:text-slate-700">
                                    <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0 print:hidden" />
                                    <span>{dataDisplay}</span>
                                </div>
                            </div>
                        </div>

                        {/* CARDS KPI DE TOTAIS: TOTAL DE RODAS | TOTAL DE CAIXAS (Lado a Lado no Mobile) - OCULTOS NO PRINT */}
                        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 print:hidden">
                            {/* Card 1: Total de Rodas */}
                            <div className="p-3.5 sm:p-6 rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-50/70 to-indigo-50/60 dark:from-indigo-950/30 dark:to-blue-950/20 border border-indigo-100 dark:border-indigo-900/40 flex items-center gap-2.5 sm:gap-4 shadow-xs">
                                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-indigo-100/80 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 sm:w-8 sm:h-8">
                                        <circle cx="12" cy="12" r="10" />
                                        <circle cx="12" cy="12" r="3" />
                                        <line x1="12" y1="2" x2="12" y2="9" />
                                        <line x1="12" y1="15" x2="12" y2="22" />
                                        <line x1="2" y1="12" x2="9" y2="12" />
                                        <line x1="15" y1="12" x2="22" y2="12" />
                                    </svg>
                                </div>
                                <div className="min-w-0">
                                    <span className="block text-[9px] sm:text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                                        TOTAL RODAS
                                    </span>
                                    <span className="text-xl sm:text-4xl font-black text-indigo-700 dark:text-indigo-300 tracking-tight leading-tight mt-0.5 block">
                                        {totalRodas.toLocaleString('pt-BR')}
                                    </span>
                                </div>
                            </div>

                            {/* Card 2: Total de Caixas */}
                            <div className="p-3.5 sm:p-6 rounded-xl sm:rounded-2xl bg-gradient-to-r from-purple-50/70 to-indigo-50/60 dark:from-purple-950/30 dark:to-indigo-950/20 border border-purple-100 dark:border-purple-900/40 flex items-center gap-2.5 sm:gap-4 shadow-xs">
                                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-purple-100/80 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                                    <Box className="w-5 h-5 sm:w-8 sm:h-8 stroke-[2.2]" />
                                </div>
                                <div className="min-w-0">
                                    <span className="block text-[9px] sm:text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                                        TOTAL CAIXAS
                                    </span>
                                    <span className="text-xl sm:text-4xl font-black text-indigo-700 dark:text-indigo-300 tracking-tight leading-tight mt-0.5 block">
                                        {totalCaixas.toLocaleString('pt-BR')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* FILTROS E BUSCA */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1 print:hidden">
                            <div className="relative w-full sm:flex-1">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Filtrar por descrição..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full h-10 sm:h-11 pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            {/* Dropdown Filtro por Aro */}
                            <div className="relative w-full sm:w-auto">
                                <div className="flex items-center gap-2 h-10 sm:h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200">
                                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <select
                                        value={selectedAroFilter}
                                        onChange={(e) => setSelectedAroFilter(e.target.value)}
                                        className="bg-transparent focus:outline-none cursor-pointer pr-3 font-bold w-full"
                                    >
                                        <option value="todos">Todos os Aros</option>
                                        {availableAros.map((aro) => (
                                            <option key={aro} value={aro}>
                                                Aro {aro}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* LISTA AGRUPADA POR ARO (Responsiva: Desktop Tabela | Mobile Lista Fluida Sem Scroll) */}
                        <div className="space-y-3 sm:space-y-4 pt-1 w-full max-w-full print:space-y-1.5 print:pt-0">
                            {groupsByAro.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-sm">
                                    Nenhuma roda encontrada para os filtros aplicados.
                                </div>
                            ) : (
                                groupsByAro.map((group) => {
                                    const aroTotalRodas = group.itens.reduce((acc, i) => acc + i.quantidade, 0);
                                    const aroTotalCaixas = group.itens.reduce((acc, i) => acc + i.boxInfo.caixas, 0);

                                    return (
                                        <div
                                            key={group.aro}
                                            className="print-section rounded-xl sm:rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-visible shadow-xs w-full max-w-full print:rounded-none print:border print:border-slate-300 print:shadow-none print:overflow-visible"
                                        >
                                            {/* CABEÇALHO UNIFICADO DO ARO + COLUNAS (STICKY AO ROLAR) */}
                                            <div className="sticky top-[47px] sm:top-[53px] z-20 bg-white dark:bg-slate-900 rounded-t-xl sm:rounded-t-2xl shadow-xs print:static print:shadow-none">
                                                {/* LINHA 1: Aro X • Y modelos • Z un • W cx */}
                                                <div className="print-aro-header bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-md px-4 py-2.5 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between flex-wrap gap-2 rounded-t-xl sm:rounded-t-2xl print:rounded-none print:bg-slate-200 print:border-b print:border-slate-300">
                                                    <div className="flex items-center gap-2.5 print:gap-1.5">
                                                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-lg bg-indigo-600 text-white font-black text-xs tracking-wider shadow-2xs print:px-1.5 print:py-0 print:text-[10px] print:rounded print:bg-slate-900">
                                                            ARO {group.aro}
                                                        </span>
                                                        <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 print:text-[10px]">
                                                            {group.itens.length} {group.itens.length === 1 ? 'modelo' : 'modelos'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 sm:gap-3 text-xs font-bold text-slate-500 dark:text-slate-400 print:text-[10px] print:gap-1.5">
                                                        <span className="inline-flex items-center gap-1">
                                                            <strong className="text-slate-800 dark:text-slate-100 font-black print:text-black">{aroTotalRodas}</strong> un
                                                        </span>
                                                        <span>•</span>
                                                        <span className="inline-flex items-center gap-1">
                                                            <strong className="text-slate-800 dark:text-slate-100 font-black print:text-black">{aroTotalCaixas}</strong> cx
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* LINHA 2: COLUNAS NO DESKTOP (STICKY JUNTO COM O ARO) */}
                                                <div className="hidden md:block print:hidden w-full border-b border-slate-200 dark:border-slate-700 bg-slate-50/95 dark:bg-slate-800/90 backdrop-blur-md">
                                                    <table className="w-full text-left text-[14px] table-fixed">
                                                        <colgroup>
                                                            <col className="w-auto" />
                                                            <col className="w-48 sm:w-52" />
                                                            <col className="w-36 sm:w-40" />
                                                            <col className="w-36 sm:w-40" />
                                                        </colgroup>
                                                        <thead className="text-slate-500 dark:text-slate-400 font-black uppercase tracking-wider text-xs">
                                                            <tr>
                                                                <th className="py-2.5 px-5 text-left">DESCRIÇÃO</th>
                                                                <th className="py-2.5 px-4 text-center">QTD.</th>
                                                                <th className="py-2.5 px-4 text-center">LOCAL</th>
                                                                <th className="py-2.5 px-4 text-center">ESTOQUE</th>
                                                            </tr>
                                                        </thead>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* CONTEÚDO PRINCIPAL (100% DA LARGURA): MOBILE LISTA | TABLET & PC TABELA ALINHADA */}
                                            <div className="w-full max-w-full">
                                                {/* VISÃO MOBILE (< md): Layout Fluido Sem Scroll (Oculto no print para usar tabela compacta) */}
                                                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/80 w-full print:hidden">
                                                    {group.itens.map((it) => (
                                                        <div key={it.id} className="p-3.5 sm:p-4 space-y-3 w-full hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                            {/* Topo: Foto Circular + Descrição Destaque + Código */}
                                                            <div className="flex items-start gap-3.5">
                                                                <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shrink-0 overflow-hidden flex items-center justify-center p-0.5 shadow-xs mt-0.5">
                                                                    <img
                                                                        src={it.photoUrl}
                                                                        alt={it.descricao}
                                                                        className="w-full h-full object-contain"
                                                                        onError={(e) => {
                                                                            (e.target as HTMLImageElement).src = '/logo 2.svg';
                                                                        }}
                                                                    />
                                                                </div>

                                                                <div className="flex-1 min-w-0 self-center">
                                                                    <h4 className="font-black text-slate-900 dark:text-white text-sm sm:text-base leading-snug break-words">
                                                                        {it.descricao || it.codigo}
                                                                    </h4>
                                                                </div>
                                                            </div>

                                                            {/* Bloco de Métricas Simplificado (Baixa Carga Cognitiva • Zero Truncamento) */}
                                                            <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-xl p-2.5 space-y-2 border border-slate-200/60 dark:border-slate-800/60">
                                                                {/* Linha 1: Quantidades com Caminhão em destaque amplo */}
                                                                <div className="flex items-center justify-between gap-3">
                                                                    {/* CAMINHÃO (Sem truncamento de caixas) */}
                                                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                                                            <Truck className="w-3.5 h-3.5" />
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block leading-tight">
                                                                                Caminhão
                                                                            </span>
                                                                            <span className="font-black text-sm text-slate-900 dark:text-white leading-tight block">
                                                                                {it.boxInfo.displayQtd}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    {/* ESTOQUE REAL (Limpo, sem sub-fundo pesado) */}
                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                                                            <Database className="w-3.5 h-3.5" />
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block leading-tight">
                                                                                Est. Real
                                                                            </span>
                                                                            <span className="font-bold text-sm text-slate-800 dark:text-slate-200 leading-tight block">
                                                                                {it.estoqueReal} un
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Linha 2: Localização em Linha Inteira (Nunca corta posições múltiplas) */}
                                                                <div className="flex items-center gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/40">
                                                                    <div className="w-7 h-7 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                                                                        <MapPin className="w-3.5 h-3.5" />
                                                                    </div>
                                                                    <div className="min-w-0 flex-1 flex items-baseline gap-1.5 flex-wrap">
                                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0">
                                                                            Local:
                                                                        </span>
                                                                        <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-white break-words">
                                                                            {it.local || 'SEM LOCAL'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* VISÃO DESKTOP & TABLET (>= md): TABELA AMPLIADA (Forçada no print para máxima economia de papel) */}
                                                <div className="hidden md:block print:block w-full overflow-x-auto print:overflow-visible">
                                                    <table className="w-full text-left text-[14px] table-fixed print:text-[12px]">
                                                        <colgroup>
                                                            <col className="w-auto" />
                                                            <col className="w-48 sm:w-52 print:w-32" />
                                                            <col className="w-36 sm:w-40 print:w-28" />
                                                            <col className="w-36 sm:w-40 print:w-24" />
                                                        </colgroup>
                                                        {/* Thead apenas para impressão em papel para repetir cabeçalhos entre páginas */}
                                                        <thead className="hidden print:table-header-group">
                                                            <tr className="print:bg-slate-100 print:text-slate-900 print:text-[11px] print:border-b print:border-slate-300">
                                                                <th className="print:py-1.5 print:px-2 text-left">DESCRIÇÃO</th>
                                                                <th className="print:py-1.5 print:px-1.5 text-center">QTD.</th>
                                                                <th className="print:py-1.5 print:px-1.5 text-center">LOCAL</th>
                                                                <th className="print:py-1.5 print:px-1.5 text-center">ESTOQUE</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium print:divide-slate-200">
                                                            {group.itens.map((it) => (
                                                                <tr
                                                                    key={it.id}
                                                                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors print:hover:bg-transparent print:border-b print:border-slate-200"
                                                                >
                                                                    {/* FOTO E CÓDIGO (OCULTOS NO PRINT) + DESCRIÇÃO MAIOR */}
                                                                    <td className="py-3.5 px-5 text-left print:py-1 print:px-2">
                                                                        <div className="flex items-center gap-3.5 print:gap-0">
                                                                            {/* FOTO OCULTA NO PRINT */}
                                                                            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shrink-0 overflow-hidden flex items-center justify-center p-0.5 shadow-xs print:hidden">
                                                                                <img
                                                                                    src={it.photoUrl}
                                                                                    alt={it.descricao}
                                                                                    className="w-full h-full object-contain"
                                                                                    onError={(e) => {
                                                                                        (e.target as HTMLImageElement).src = '/logo 2.svg';
                                                                                    }}
                                                                                />
                                                                            </div>

                                                                            <div className="min-w-0 flex-1">
                                                                                <span className="font-black text-slate-900 dark:text-white text-base sm:text-[17px] block leading-snug print:text-[13px] print:font-bold print:leading-snug">
                                                                                    {it.descricao || it.codigo}
                                                                                </span>
                                                                                {/* CÓDIGO OCULTO NO PRINT */}
                                                                                <div className="flex items-center gap-2 mt-1 print:hidden">
                                                                                    <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/80 dark:border-slate-700/60 inline-block">
                                                                                        CÓD: {it.codigo}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </td>

                                                                    {/* QUANTIDADE (Compacta no print em linha única com letras maiores) */}
                                                                    <td className="py-3.5 px-4 text-center whitespace-nowrap print:py-1 print:px-1.5">
                                                                        <div className="inline-flex flex-col items-center print:flex-row print:justify-center print:items-baseline print:gap-1.5">
                                                                            <div className="flex items-baseline gap-1">
                                                                                <span className="font-black text-slate-900 dark:text-white text-xl sm:text-2xl tracking-tight print:text-[13.5px] print:font-black">
                                                                                    {it.quantidade}
                                                                                </span>
                                                                                <span className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 print:text-[10px] print:text-slate-700">
                                                                                    un
                                                                                </span>
                                                                            </div>
                                                                            <span className="text-xs sm:text-sm font-bold text-slate-400 dark:text-slate-500 mt-0.5 print:mt-0 print:text-[11.5px] print:font-medium print:text-slate-600">
                                                                                ({it.boxInfo.caixas} cx)
                                                                            </span>
                                                                        </div>
                                                                    </td>

                                                                    {/* LOCALIZAÇÃO (Sem fundo/borda pesada no print com letras maiores) */}
                                                                    <td className="py-3.5 px-4 text-center print:py-1 print:px-1.5">
                                                                        <span className="font-mono font-black text-sm sm:text-base text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 inline-block shadow-2xs tracking-wide print:p-0 print:bg-transparent print:border-none print:text-[12.5px] print:font-black print:shadow-none">
                                                                            {it.local || 'SEM LOCAL'}
                                                                        </span>
                                                                    </td>

                                                                    {/* ESTOQUE DO BANCO */}
                                                                    <td className="py-3.5 px-4 text-center print:py-1 print:px-1.5">
                                                                        <span className="inline-flex items-center justify-center min-w-[54px] px-3 py-1.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 text-sm sm:text-base font-black border border-indigo-100/90 dark:border-indigo-900/40 shadow-2xs print:min-w-0 print:p-0 print:bg-transparent print:border-none print:text-[12.5px] print:font-black print:shadow-none print:text-slate-800">
                                                                            {it.estoqueReal} un
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* RODAPÉ DO RELATÓRIO */}
                        <div className="pt-3 sm:pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 print:pt-1 print:border-t print:border-slate-300 print:text-[9.5px]">
                            <div className="flex items-center gap-2 print:text-slate-700">
                                <Box className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 print:hidden" />
                                <span>
                                    Total de rodas: <strong className="text-slate-800 dark:text-slate-100 font-black print:text-black">{totalRodas}</strong>
                                </span>
                                <span className="text-slate-300 dark:text-slate-600">|</span>
                                <span>
                                    Total de caixas: <strong className="text-slate-800 dark:text-slate-100 font-black print:text-black">{totalCaixas}</strong>
                                </span>
                            </div>

                            <span className="text-[11px] font-semibold text-slate-400 print:text-[9px]">
                                Emitido em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* BOTÃO FLUTUANTE DE VOLTAR AO TOPO (Canto Inferior Direito) */}
            <div
                className={cn(
                    "fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 transition-all duration-300 print:hidden",
                    showScrollTop
                        ? "opacity-100 translate-y-0 pointer-events-auto"
                        : "opacity-0 translate-y-4 pointer-events-none"
                )}
            >
                <button
                    onClick={scrollToTop}
                    aria-label="Voltar ao topo"
                    title="Voltar ao topo"
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/95 dark:bg-slate-800/95 backdrop-blur-md text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700 shadow-lg hover:shadow-xl hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
                >
                    <ArrowUp className="w-5 h-5 stroke-[2.2]" />
                </button>
            </div>
        </div>
    );
};
