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
    Cloud,
    Check,
    Layers
} from 'lucide-react';
import { cn } from '../utils';
import {
    Romaneio,
    RomaneioItem,
    RomaneioTipo,
    getRomaneios,
    getRomaneioById,
    exportRomaneioToExcel,
    fetchAndSyncRomaneios
} from '../services/romaneioService';
import { getInventoryWithStateStock } from '../lib/supabase';
import { StockFreshness } from './StockFreshness';
import { matchesStockFilter, type StockFilter } from '../utils/stockFilters';
import { extractAro, extractModel, extractFuracao } from '../utils/wheelVariations';
import { getWheelPhotoUrl } from '../utils/photoUtils';
import { FlagPR, FlagSC, FlagBR } from './StateFlags';
import { FlagCM } from './FlagCM';

interface RomaneioModuleProps {
    onBackToMenu: () => void;
    onOpenSCOrder?: () => void;
    onOpenCMOrder?: () => void;
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

export const RomaneioModule: React.FC<RomaneioModuleProps> = ({ onBackToMenu, onOpenSCOrder, onOpenCMOrder }) => {
    const [romaneios, setRomaneios] = useState<Romaneio[]>([]);
    const [selectedRomaneioId, setSelectedRomaneioId] = useState<string | null>(null);
    const [tipoFilter, setTipoFilter] = useState<'PR' | 'SC' | 'CM' | 'TODOS'>('PR');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAroFilter, setSelectedAroFilter] = useState<string>('todos');
    const [dbStockMapPR, setDbStockMapPR] = useState<Map<string, number>>(new Map());
    const [dbStockMapSC, setDbStockMapSC] = useState<Map<string, number>>(new Map());
    const [scStockAvailable, setSCStockAvailable] = useState(false);
    const [cmStockAvailable, setCMStockAvailable] = useState(false);
    const [dbStockMapCM, setDbStockMapCM] = useState<Map<string, number>>(new Map());
    const [stockUpdatedCM, setStockUpdatedCM] = useState<string | null>(null);
    const foreignOrigin = tipoFilter === 'CM' ? 'CM' : 'SC';
    const [stockUpdatedPR, setStockUpdatedPR] = useState<string | null>(null);
    const [stockUpdatedSC, setStockUpdatedSC] = useState<string | null>(null);
    const [stockFilter, setStockFilter] = useState<StockFilter>('all');
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

    // Contadores por tipo (PR e SC)
    const countPR = useMemo(() => romaneios.filter(r => (r.tipo || 'PR') === 'PR').length, [romaneios]);
    const countSC = useMemo(() => romaneios.filter(r => (r.tipo || 'PR') === 'SC').length, [romaneios]);

    const countCM = useMemo(() => romaneios.filter(r => r.tipo === 'CM').length, [romaneios]);

    // Romaneios filtrados pelo tipo selecionado (PR ou SC)
    const filteredRomaneios = useMemo(() => {
        if (tipoFilter === 'TODOS') return romaneios;
        return romaneios.filter(r => (r.tipo || 'PR') === tipoFilter);
    }, [romaneios, tipoFilter]);

    // Trocar aba de tipo e sincronizar o romaneio selecionado
    const handleSelectTipo = (tipo: 'PR' | 'SC' | 'CM' | 'TODOS') => {
        setTipoFilter(tipo);
        setSearchTerm('');
        setSelectedAroFilter('todos');
        setStockFilter('all');
        if (tipo === 'TODOS') {
            setSelectedRomaneioId('consolidado-pr-sc');
        } else {
            const subset = romaneios.filter(r => (r.tipo || 'PR') === tipo);
            if (subset.length > 0) {
                setSelectedRomaneioId(subset[0].id);
            } else {
                setSelectedRomaneioId(null);
            }
        }
    };

    // Carregar romaneios salvos do cache local
    const loadRomaneios = () => {
        const list = getRomaneios();
        setRomaneios(list);
    };

    // Sincronizar com a nuvem (Supabase)
    const handleManualSync = async () => {
        setIsSyncing(true);
        try {
            const [list, { prMap, scMap, scStockAvailable, stockUpdatedPR, stockUpdatedSC, cmMap, cmStockAvailable, stockUpdatedCM }] = await Promise.all([
                fetchAndSyncRomaneios(),
                getInventoryWithStateStock()
            ]);
            setRomaneios(list);
            setDbStockMapPR(prMap);
            setDbStockMapSC(scMap);
            setSCStockAvailable(scStockAvailable);
            setDbStockMapCM(cmMap); setCMStockAvailable(cmStockAvailable); setStockUpdatedCM(stockUpdatedCM);
            setStockUpdatedPR(stockUpdatedPR); setStockUpdatedSC(stockUpdatedSC);
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

        const handleUpdate = () => loadRomaneios();
        window.addEventListener('mkr_romaneios_updated', handleUpdate);
        return () => window.removeEventListener('mkr_romaneios_updated', handleUpdate);
    }, []);

    // Se só houver cargas de SC, alternar automaticamente para SC
    useEffect(() => {
        if (romaneios.length > 0) {
            const hasPR = romaneios.some(r => (r.tipo || 'PR') === 'PR');
            const hasSC = romaneios.some(r => (r.tipo || 'PR') === 'SC');
            if (!hasPR && tipoFilter === 'PR') {
                setTipoFilter(hasSC ? 'SC' : romaneios.some(r => r.tipo === 'CM') ? 'CM' : 'PR');
            }
        }
    }, [romaneios]);

    // Romaneio consolidado combinando Paraná e Santa Catarina
    const consolidatedRomaneio = useMemo<Romaneio | null>(() => {
        if (romaneios.length === 0) return null;

        const prRomaneios = romaneios.filter(r => (r.tipo || 'PR') === 'PR');
        const scRomaneios = romaneios.filter(r => (r.tipo || 'PR') === 'SC');
        if (!prRomaneios.length && !scRomaneios.length) return null;

        // Mapear por estado + código para não juntar a mesma roda entre PR e SC.
        const map = new Map<string, {
            item: RomaneioItem;
            qtdPR: number;
            qtdSC: number;
            total: number;
            localPR: string;
        }>();

        const addRomaneioItem = (it: RomaneioItem, estado: 'PR' | 'SC') => {
            const codigoKey = it.codigo.trim().toUpperCase();
            const key = `${estado}:${codigoKey}`;
            const quantidade = it.quantidade;

            if (!map.has(key)) {
                map.set(key, {
                    item: {
                        ...it,
                        local: estado === 'PR' ? (it.local || '') : ''
                    },
                    qtdPR: estado === 'PR' ? quantidade : 0,
                    qtdSC: estado === 'SC' ? quantidade : 0,
                    total: quantidade,
                    localPR: estado === 'PR' ? (it.local || '') : ''
                });
                return;
            }

            const cur = map.get(key)!;
            cur.total += quantidade;
            if (estado === 'PR') {
                cur.qtdPR += quantidade;
                if (!cur.localPR && it.local) cur.localPR = it.local;
            } else {
                cur.qtdSC += quantidade;
            }
        };

        prRomaneios.forEach(r => {
            r.itens?.forEach(it => {
                addRomaneioItem(it, 'PR');
            });
        });

        scRomaneios.forEach(r => {
            r.itens?.forEach(it => {
                addRomaneioItem(it, 'SC');
            });
        });

        const itensConsolidados: RomaneioItem[] = Array.from(map.values()).map(({ item, qtdPR, qtdSC, total, localPR }) => {
            const origemEstado: 'PR' | 'SC' = qtdSC > 0 ? 'SC' : 'PR';
            return {
                ...item,
                id: `consolidated-${origemEstado}-${item.codigo}`,
                quantidade: total,
                qtdPR,
                qtdSC,
                origemEstado,
                local: localPR
            };
        });

        const totalPecas = itensConsolidados.reduce((acc, it) => acc + it.quantidade, 0);

        return {
            id: 'consolidado-pr-sc',
            numero: 'PR + SC',
            titulo: 'Cargas Consolidadas (Paraná + Santa Catarina)',
            clienteOuDestino: `${prRomaneios.length} carga(s) PR • ${scRomaneios.length} carga(s) SC`,
            dataCriacao: new Date().toISOString(),
            dataAtualizacao: new Date().toISOString(),
            status: 'pendente',
            totalItens: itensConsolidados.length,
            totalPecas,
            totalConferido: 0,
            itens: itensConsolidados,
            arquivos: []
        };
    }, [romaneios]);

    // Romaneio ativo selecionado
    const activeRomaneio = useMemo(() => {
        if (tipoFilter === 'TODOS') {
            return consolidatedRomaneio;
        }
        const list = romaneios.filter(r => (r.tipo || 'PR') === tipoFilter);
        if (list.length === 0) return null;

        if (selectedRomaneioId) {
            const found = list.find(r => r.id === selectedRomaneioId);
            if (found) return found;
        }
        return list[0] || null;
    }, [tipoFilter, romaneios, selectedRomaneioId, consolidatedRomaneio]);

    // Agrupamento dos itens por ARO
    const { groupsByAro, totalRodas, totalCaixas, availableAros } = useMemo(() => {
        if (!activeRomaneio || !activeRomaneio.itens) {
            return { groupsByAro: [], totalRodas: 0, totalCaixas: 0, availableAros: [] };
        }

        const isSC = tipoFilter === 'SC';
        const isPR = tipoFilter === 'PR';

        let sumRodas = 0;
        let sumCaixas = 0;
        const map = new Map<string, {
            aro: string;
            itens: (RomaneioItem & {
                boxInfo: ReturnType<typeof calculateItemBoxes>;
                estoquePR: number;
                estoqueSC: number | null;
                qtdPR: number;
                qtdSC: number;
                origemEstado: 'PR' | 'SC' | 'AMBOS';
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

            const codigoKey = it.codigo.trim().toUpperCase();
            const estoquePR = dbStockMapPR.get(codigoKey) ?? 0;
            const estoqueSC = (tipoFilter === 'CM' ? cmStockAvailable : scStockAvailable)
                ? (tipoFilter === 'CM' ? dbStockMapCM : dbStockMapSC).get(codigoKey) ?? 0 : null;
            if (!matchesStockFilter(stockFilter, estoquePR, estoqueSC)) return;

            const qtdPR = it.qtdPR !== undefined
                ? it.qtdPR
                : (isPR ? it.quantidade : 0);

            const qtdSC = it.qtdSC !== undefined
                ? it.qtdSC
                : (isSC ? it.quantidade : 0);

            const origemEstado: 'PR' | 'SC' | 'AMBOS' = it.origemEstado || (
                qtdPR > 0 && qtdSC > 0 ? 'AMBOS' : (qtdSC > 0 ? 'SC' : 'PR')
            );

            const photoUrl = getWheelPhotoUrl(it.descricao, it.codigo);

            if (!map.has(aroKey)) {
                map.set(aroKey, { aro: aroKey, itens: [] });
            }

            map.get(aroKey)!.itens.push({
                ...it,
                boxInfo,
                estoquePR,
                estoqueSC,
                qtdPR,
                qtdSC,
                origemEstado,
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
    }, [activeRomaneio, searchTerm, selectedAroFilter, dbStockMapPR, dbStockMapSC, scStockAvailable, tipoFilter, stockFilter, cmStockAvailable, dbStockMapCM]);

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
                                <span className={cn(
                                    "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0 border",
                                    tipoFilter === 'TODOS'
                                        ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800"
                                        : activeRomaneio.tipo === 'CM'
                                            ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800"
                                            : (activeRomaneio.tipo || 'PR') === 'SC'
                                                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                                                : "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800"
                                )}>
                                    {tipoFilter === 'TODOS' ? (
                                        <>
                                            <FlagPR className="w-3.5 h-2.5" />
                                            <FlagSC className="w-3.5 h-2.5" />
                                            <span>PR + SC Juntos</span>
                                        </>
                                    ) : (
                                        <>
                                            {activeRomaneio.tipo === 'CM' ? <FlagCM className="w-3.5 h-2.5" /> : (activeRomaneio.tipo || 'PR') === 'SC' ? <FlagSC className="w-3.5 h-2.5" /> : <FlagPR className="w-3.5 h-2.5" />}
                                            <span>{activeRomaneio.tipo === 'CM' ? 'CM' : (activeRomaneio.tipo || 'PR') === 'SC' ? 'SC' : 'PR'}</span>
                                        </>
                                    )}
                                </span>
                            )}
                            {activeRomaneio && (
                                <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 shrink-0">
                                    {totalRodas} un • {totalCaixas} cx
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Lado Direito: Ações (Filtro PR/SC, Trocar Carga, Nuvem, Imprimir, Excel) */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {/* Seletor rápido PR / SC / Todos no topo */}
                        {romaneios.length > 0 && (
                            <div className="hidden sm:inline-flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-[11px] font-bold">
                                <button
                                    onClick={() => handleSelectTipo('PR')}
                                    className={cn(
                                        "px-2.5 py-1 rounded-lg transition text-[11px] flex items-center gap-1.5",
                                        tipoFilter === 'PR'
                                            ? "bg-blue-600 text-white shadow-2xs font-black"
                                            : "text-blue-700 dark:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/30"
                                    )}
                                    title="Filtrar por cargas do Paraná (PR)"
                                >
                                    <FlagPR className="w-3.5 h-2.5" />
                                    <span>PR</span>
                                    {countPR > 0 && <span className="text-[9px] opacity-80">({countPR})</span>}
                                </button>
                                <button
                                    onClick={() => handleSelectTipo('SC')}
                                    className={cn(
                                        "px-2.5 py-1 rounded-lg transition text-[11px] flex items-center gap-1.5",
                                        tipoFilter === 'SC'
                                            ? "bg-emerald-600 text-white shadow-2xs font-black"
                                            : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30"
                                    )}
                                    title="Filtrar por cargas de Santa Catarina (SC)"
                                >
                                    <FlagSC className="w-3.5 h-2.5" />
                                    <span>SC</span>
                                    {countSC > 0 && <span className="text-[9px] opacity-80">({countSC})</span>}
                                </button>
                                <button
                                    onClick={() => handleSelectTipo('CM')}
                                    className={cn(
                                        "px-2.5 py-1 rounded-lg transition text-[11px] flex items-center gap-1.5",
                                        tipoFilter === 'CM'
                                            ? "bg-rose-600 text-white shadow-2xs font-black"
                                            : "text-rose-700 dark:text-rose-400 hover:bg-rose-50/50 dark:hover:bg-rose-950/30"
                                    )}
                                    title="Filtrar por cargas de Campinas (CM)"
                                >
                                    <FlagCM className="w-3.5 h-2.5" />
                                    <span>CM</span>
                                    {countCM > 0 && <span className="text-[9px] opacity-80">({countCM})</span>}
                                </button>
                                <button
                                    onClick={() => handleSelectTipo('TODOS')}
                                    className={cn(
                                        "px-2.5 py-1 rounded-lg transition text-[11px] flex items-center gap-1.5",
                                        tipoFilter === 'TODOS'
                                            ? "bg-indigo-600 text-white shadow-2xs font-black"
                                            : "text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30"
                                    )}
                                    title="Ver cargas do Paraná e Santa Catarina juntas com identificação roda a roda"
                                >
                                    <span className="flex -space-x-1 items-center">
                                        <FlagPR className="w-3 h-2" />
                                        <FlagSC className="w-3 h-2" />
                                    </span>
                                    <span>Ver os 2</span>
                                </button>
                            </div>
                        )}

                        {tipoFilter !== 'TODOS' && filteredRomaneios.length > 1 && (
                            <select
                                value={selectedRomaneioId || ''}
                                onChange={(e) => {
                                    setSelectedRomaneioId(e.target.value);
                                    setSearchTerm('');
                                    setSelectedAroFilter('todos');
                                }}
                                className="h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500 shadow-2xs max-w-[120px] sm:max-w-[180px] truncate"
                            >
                                {filteredRomaneios.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {(r.numero ? `${r.numero} - ` : '') + r.titulo}
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

                {onOpenSCOrder && (
                    <div className="flex justify-end print:hidden">
                        <button onClick={onOpenSCOrder} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold">
                            <Truck className="w-4 h-4" /> Pedir Rodas de SC
                        </button>
                    </div>
                )}

                {onOpenCMOrder && <div className="flex justify-end print:hidden"><button onClick={onOpenCMOrder} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-sm font-semibold"><Truck className="w-4 h-4" />Pedir Rodas de CM</button></div>}

                {/* SELETOR HERO DE ESTADO (PARANÁ / SANTA CATARINA / TODOS) - ESTILO MÓDULO DE CONTAGEM */}
                {romaneios.length > 0 && (
                    <div className="space-y-3.5 print:hidden">
                        {/* Grade de Cards de Estado (3 colunas: Paraná, Santa Catarina e Ver os 2 Juntos) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-5xl mx-auto">
                            {/* CARD PARANÁ */}
                            <button
                                type="button"
                                onClick={() => handleSelectTipo('PR')}
                                className={cn(
                                    "relative p-3.5 sm:p-5 rounded-[22px] sm:rounded-[24px] border-2 transition-all duration-200 flex flex-col items-center text-center cursor-pointer active:scale-95 group",
                                    tipoFilter === 'PR'
                                        ? "border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/20 bg-blue-50/70 dark:bg-blue-950/30 shadow-md"
                                        : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                                )}
                            >
                                {tipoFilter === 'PR' && (
                                    <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                                        <Check className="w-3 h-3 stroke-[3]" />
                                    </span>
                                )}

                                {/* Container de Sigla com Bandeira do Paraná */}
                                <div className="relative mb-2.5">
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-[18px] sm:rounded-[20px] bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white transition-transform group-hover:scale-105 shadow-md shadow-blue-500/25">
                                        <span className="text-[18px] sm:text-[21px] font-black tracking-wider drop-shadow-sm font-sans select-none">
                                            PR
                                        </span>
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 ring-2 ring-white dark:ring-slate-900 rounded-[4px] overflow-hidden shadow-sm">
                                        <FlagPR className="w-5 h-3.5 sm:w-6 sm:h-4" />
                                    </div>
                                </div>

                                <div className="flex items-center justify-center gap-1.5">
                                    <h3 className="font-extrabold text-slate-900 dark:text-white text-[14px] sm:text-[16px] tracking-tight">
                                        Paraná (PR)
                                    </h3>
                                </div>
                                <p className="text-[11px] sm:text-[12px] text-slate-400 dark:text-slate-500 font-medium leading-tight mt-0.5">
                                    {countPR} {countPR === 1 ? 'carga cadastrada' : 'cargas cadastradas'}
                                </p>
                                <span className="mt-2 text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-100/60 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">
                                    Local • Estoque PR
                                </span>
                            </button>

                            {/* CARD SANTA CATARINA */}
                            <button
                                type="button"
                                onClick={() => handleSelectTipo('SC')}
                                className={cn(
                                    "relative p-3.5 sm:p-5 rounded-[22px] sm:rounded-[24px] border-2 transition-all duration-200 flex flex-col items-center text-center cursor-pointer active:scale-95 group",
                                    tipoFilter === 'SC'
                                        ? "border-emerald-500 dark:border-emerald-400 ring-2 ring-emerald-500/20 bg-emerald-50/70 dark:bg-emerald-950/30 shadow-md"
                                        : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                                )}
                            >
                                {tipoFilter === 'SC' && (
                                    <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                                        <Check className="w-3 h-3 stroke-[3]" />
                                    </span>
                                )}

                                {/* Container de Sigla com Bandeira de Santa Catarina */}
                                <div className="relative mb-2.5">
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-[18px] sm:rounded-[20px] bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white transition-transform group-hover:scale-105 shadow-md shadow-emerald-500/25">
                                        <span className="text-[18px] sm:text-[21px] font-black tracking-wider drop-shadow-sm font-sans select-none">
                                            SC
                                        </span>
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 ring-2 ring-white dark:ring-slate-900 rounded-[4px] overflow-hidden shadow-sm">
                                        <FlagSC className="w-5 h-3.5 sm:w-6 sm:h-4" />
                                    </div>
                                </div>

                                <div className="flex items-center justify-center gap-1.5">
                                    <h3 className="font-extrabold text-slate-900 dark:text-white text-[14px] sm:text-[16px] tracking-tight">
                                        Santa Catarina (SC)
                                    </h3>
                                </div>
                                <p className="text-[11px] sm:text-[12px] text-slate-400 dark:text-slate-500 font-medium leading-tight mt-0.5">
                                    {countSC} {countSC === 1 ? 'carga cadastrada' : 'cargas cadastradas'}
                                </p>
                                <span className="mt-2 text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full">
                                    Estoque SC • Estoque PR
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleSelectTipo('CM')}
                                className={cn(
                                    "relative p-3.5 sm:p-5 rounded-[22px] sm:rounded-[24px] border-2 transition-all duration-200 flex flex-col items-center text-center cursor-pointer active:scale-95 group",
                                    tipoFilter === 'CM'
                                        ? "border-rose-500 dark:border-rose-400 ring-2 ring-rose-500/20 bg-rose-50/70 dark:bg-rose-950/30 shadow-md"
                                        : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                                )}
                            >
                                {tipoFilter === 'CM' && (
                                    <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                                        <Check className="w-3 h-3 stroke-[3]" />
                                    </span>
                                )}
                                <div className="relative mb-2.5">
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-[18px] sm:rounded-[20px] bg-gradient-to-br from-rose-600 to-red-700 flex items-center justify-center text-white transition-transform group-hover:scale-105 shadow-md shadow-rose-500/25">
                                        <span className="text-[18px] sm:text-[21px] font-black tracking-wider drop-shadow-sm font-sans select-none">CM</span>
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 ring-2 ring-white dark:ring-slate-900 rounded-[4px] overflow-hidden shadow-sm">
                                        <FlagCM className="w-5 h-3.5 sm:w-6 sm:h-4" />
                                    </div>
                                </div>
                                <div className="flex items-center justify-center gap-1.5">
                                    <h3 className="font-extrabold text-slate-900 dark:text-white text-[14px] sm:text-[16px] tracking-tight">Campinas (CM)</h3>
                                </div>
                                <p className="text-[11px] sm:text-[12px] text-slate-400 dark:text-slate-500 font-medium leading-tight mt-0.5">
                                    {countCM} {countCM === 1 ? 'carga cadastrada' : 'cargas cadastradas'}
                                </p>
                                <span className="mt-2 text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-100/60 dark:bg-rose-900/40 px-2 py-0.5 rounded-full">
                                    Estoque CM • Estoque PR
                                </span>
                            </button>

                            {/* CARD VER OS 2 JUNTOS */}
                            <button
                                type="button"
                                onClick={() => handleSelectTipo('TODOS')}
                                className={cn(
                                    "relative p-3.5 sm:p-5 rounded-[22px] sm:rounded-[24px] border-2 transition-all duration-200 flex flex-col items-center text-center cursor-pointer active:scale-95 group",
                                    tipoFilter === 'TODOS'
                                        ? "border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/20 bg-indigo-50/70 dark:bg-indigo-950/30 shadow-md"
                                        : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                                )}
                            >
                                {tipoFilter === 'TODOS' && (
                                    <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                                        <Check className="w-3 h-3 stroke-[3]" />
                                    </span>
                                )}

                                <div className="relative mb-2.5">
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-[18px] sm:rounded-[20px] bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center text-white transition-transform group-hover:scale-105 shadow-md shadow-indigo-500/25">
                                        <span className="text-[13px] sm:text-[15px] font-black tracking-tight drop-shadow-sm font-sans select-none">
                                            PR+SC
                                        </span>
                                    </div>
                                    <div className="absolute -bottom-1 -right-2 flex -space-x-1 ring-2 ring-white dark:ring-slate-900 rounded-[4px] overflow-hidden shadow-sm">
                                        <FlagPR className="w-4 h-3 sm:w-5 sm:h-3.5" />
                                        <FlagSC className="w-4 h-3 sm:w-5 sm:h-3.5" />
                                    </div>
                                </div>

                                <div className="flex items-center justify-center gap-1.5">
                                    <h3 className="font-extrabold text-slate-900 dark:text-white text-[14px] sm:text-[16px] tracking-tight">
                                        Ver os 2 Juntos
                                    </h3>
                                </div>
                                <p className="text-[11px] sm:text-[12px] text-slate-400 dark:text-slate-500 font-medium leading-tight mt-0.5">
                                    Consolidado ({countPR + countSC} cargas)
                                </p>
                                <span className="mt-2 text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-100/60 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full">
                                    Mostra qual é PR e SC
                                </span>
                            </button>
                        </div>

                        {/* SELETOR DE CARGA ATIVA DO ESTADO SELECIONADO OU RESUMO CONSOLIDADO */}
                        {tipoFilter === 'TODOS' ? (
                            <div className="bg-white dark:bg-slate-900 rounded-[20px] sm:rounded-[22px] p-3.5 sm:p-4 border border-indigo-200/90 dark:border-indigo-900/60 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center gap-1 shrink-0">
                                        <FlagPR className="w-4 h-3" />
                                        <FlagSC className="w-4 h-3" />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block leading-tight">
                                            Visualização Combinada • Paraná + Santa Catarina:
                                        </span>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-black text-slate-900 dark:text-white truncate">
                                                Cargas Consolidadas de Ambos os Estados
                                            </span>
                                            <span className="text-[11px] font-bold text-slate-400">
                                                ({countPR} carga{countPR === 1 ? '' : 's'} PR • {countSC} carga{countSC === 1 ? '' : 's'} SC)
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 self-start sm:self-center">
                                    Cada roda identifica se é do PR, SC ou de ambos
                                </div>
                            </div>
                        ) : filteredRomaneios.length > 0 && (
                            <div className="bg-white dark:bg-slate-900 rounded-[20px] sm:rounded-[22px] p-3.5 sm:p-4 border border-slate-200/90 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                        {activeRomaneio?.tipo === 'CM' ? <FlagCM className="w-6 h-4" /> : activeRomaneio?.tipo === 'SC' ? <FlagSC className="w-6 h-4" /> : <FlagPR className="w-6 h-4" />}
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block leading-tight">
                                            Carga Ativa na Tela ({tipoFilter === 'CM' ? 'Campinas' : tipoFilter === 'SC' ? 'Santa Catarina' : 'Paraná'}):
                                        </span>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-black text-slate-900 dark:text-white truncate">
                                                {activeRomaneio?.titulo || 'Sem título'}
                                            </span>
                                            <span className="text-[11px] font-bold text-slate-400">
                                                ({activeRomaneio?.numero})
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Chips de troca rápida entre romaneios disponíveis do estado */}
                                {filteredRomaneios.length > 1 && (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[11px] font-bold text-slate-400 mr-1 hidden lg:inline">Trocar:</span>
                                        {filteredRomaneios.map((r) => {
                                            const isCurrent = r.id === activeRomaneio?.id;
                                            return (
                                                <button
                                                    key={r.id}
                                                    onClick={() => {
                                                        setSelectedRomaneioId(r.id);
                                                        setSearchTerm('');
                                                        setSelectedAroFilter('todos');
                                                    }}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border active:scale-95 shadow-2xs",
                                                        isCurrent
                                                            ? r.tipo === 'CM'
                                                                ? "bg-rose-600 text-white border-rose-700 font-black shadow-rose-500/20"
                                                                : r.tipo === 'SC'
                                                                    ? "bg-emerald-600 text-white border-emerald-700 font-black shadow-emerald-500/20"
                                                                    : "bg-blue-600 text-white border-blue-700 font-black shadow-blue-500/20"
                                                            : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                                                    )}
                                                >
                                                    {r.tipo === 'CM' ? <FlagCM className="w-4 h-2.5" /> : r.tipo === 'SC' ? <FlagSC className="w-4 h-2.5" /> : <FlagPR className="w-4 h-2.5" />}
                                                    <span className="truncate max-w-[120px] sm:max-w-[160px]">{r.numero || r.titulo}</span>
                                                    <span className="text-[10px] opacity-80">({r.totalPecas} un)</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* RELATÓRIO ESTILO FOLHA DE CARGA (Zero Scroll Lateral no Mobile) */}
                {romaneios.length > 0 && filteredRomaneios.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 rounded-[24px] sm:rounded-[28px] p-8 sm:p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
                            <Truck className="w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            Nenhum Romaneio de {tipoFilter === 'CM' ? 'Campinas (CM)' : tipoFilter === 'SC' ? 'Santa Catarina (SC)' : 'Paraná (PR)'}
                        </h2>
                        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-md mx-auto">
                            Existem romaneios cadastrados no outro estado. Você pode alternar o estado abaixo ou importar novas planilhas no Painel Administrativo.
                        </p>
                        <div className="mt-4 flex justify-center gap-2">
                            <button
                                onClick={() => handleSelectTipo(tipoFilter === 'SC' ? 'PR' : 'SC')}
                                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold hover:bg-slate-800 transition"
                            >
                                Ver Cargas do {tipoFilter === 'SC' ? 'Paraná (PR)' : 'Santa Catarina (SC)'}
                            </button>
                        </div>
                    </div>
                ) : !activeRomaneio ? (
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
                                            {tipoFilter === 'TODOS'
                                                ? 'RELATÓRIO CONSOLIDADO • PARANÁ + SANTA CATARINA'
                                                : tipoFilter === 'CM'
                                                    ? 'RELATORIO DE CAMINHAO · CAMPINAS (CM)'
                                                : tipoFilter === 'SC'
                                                    ? 'RELATÓRIO DE CAMINHÃO • SANTA CATARINA (SC)'
                                                    : 'RELATÓRIO DE CAMINHÃO • PARANÁ (PR)'}
                                        </h1>
                                        {activeRomaneio && (
                                            tipoFilter === 'TODOS' ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0 print:hidden bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800">
                                                    <FlagPR className="w-3.5 h-2.5" />
                                                    <FlagSC className="w-3.5 h-2.5" />
                                                    <span>PR + SC JUNTOS</span>
                                                </span>
                                            ) : (
                                                <span className={cn(
                                                    "inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0 print:hidden",
                                                    activeRomaneio.tipo === 'CM'
                                                        ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800"
                                                        : (activeRomaneio.tipo || 'PR') === 'SC'
                                                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                                                            : "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800"
                                                )}>
                                                    {activeRomaneio.tipo === 'CM' ? (
                                                        <><FlagCM className="w-4 h-2.5" /><span>CAMPINAS (CM)</span></>
                                                    ) : (activeRomaneio.tipo || 'PR') === 'SC' ? (
                                                        <>
                                                            <FlagSC className="w-4 h-2.5" />
                                                            <span>SANTA CATARINA (SC)</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <FlagPR className="w-4 h-2.5" />
                                                            <span>PARANÁ (PR)</span>
                                                        </>
                                                    )}
                                                </span>
                                            )
                                        )}
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
                        <StockFreshness pr={stockUpdatedPR} sc={tipoFilter === 'CM' ? stockUpdatedCM : stockUpdatedSC} scAvailable={tipoFilter === 'CM' ? cmStockAvailable : scStockAvailable} origin={foreignOrigin} />
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1 print:hidden">
                            <div className="relative w-full sm:flex-1">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Buscar codigo ou descricao..."
                                    aria-label="Buscar no romaneio"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full h-10 sm:h-11 pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <select aria-label="Filtrar estoque do romaneio" value={stockFilter} onChange={event => setStockFilter(event.target.value as StockFilter)} className="w-full sm:w-auto max-w-full h-10 sm:h-11 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                                <option value="all">Todos os estoques</option><option value="sc">Com estoque {foreignOrigin}</option><option value="pr">Com estoque PR</option><option value="none">Sem estoque PR e {foreignOrigin}</option>
                            </select>

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
                                                            <col className="w-52 sm:w-56" />
                                                            <col className="w-32 sm:w-36" />
                                                            <col className="w-32 sm:w-36" />
                                                        </colgroup>
                                                        <thead className="text-slate-500 dark:text-slate-400 font-black uppercase tracking-wider text-xs">
                                                            <tr>
                                                                <th className="py-2.5 px-5 text-left">DESCRIÇÃO</th>
                                                                <th className="py-2.5 px-4 text-center">QUANTIDADE CAMINHÃO</th>
                                                                {tipoFilter === 'PR' ? (
                                                                    <th className="py-2.5 px-3 text-center">LOCAL</th>
                                                                ) : (
                                                                    <th className="py-2.5 px-3 text-center text-emerald-600 dark:text-emerald-400">ESTOQUE {foreignOrigin}</th>
                                                                )}
                                                                <th className="py-2.5 px-3 text-center text-blue-600 dark:text-blue-400">ESTOQUE PR</th>
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
                                                            {/* Topo: Foto Circular + Descrição Destaque + Badges de Origem */}
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
                                                                    {/* BADGE DE ORIGEM NO MODO VER OS 2 JUNTOS */}
                                                                    {tipoFilter === 'TODOS' && (
                                                                        <div className="mb-1">
                                                                            {it.origemEstado === 'PR' && (
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                                                    <FlagPR className="w-3 h-2" />
                                                                                    <span>Carga PR</span>
                                                                                </span>
                                                                            )}
                                                                            {it.origemEstado === 'SC' && (
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                                                    <FlagSC className="w-3 h-2" />
                                                                                    <span>Carga SC</span>
                                                                                </span>
                                                                            )}
                                                                            {it.origemEstado === 'AMBOS' && (
                                                                                <div className="inline-flex items-center gap-1 flex-wrap">
                                                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                                                        <FlagPR className="w-3 h-2" />
                                                                                        <span>PR: {it.qtdPR} un</span>
                                                                                    </span>
                                                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                                                        <FlagSC className="w-3 h-2" />
                                                                                        <span>SC: {it.qtdSC} un</span>
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    <h4 className="font-black text-slate-900 dark:text-white text-sm sm:text-base leading-snug break-words">
                                                                        {it.descricao || it.codigo}
                                                                    </h4>
                                                                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                                                                        CÓD: {it.codigo}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Quantidade e estoques por estado */}
                                                                <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-xl p-2.5 space-y-2 border border-slate-200/60 dark:border-slate-800/60">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                                                            <Truck className="w-3.5 h-3.5" />
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block leading-tight">
                                                                                Quantidade Caminhão
                                                                            </span>
                                                                            <span className="font-black text-sm text-slate-900 dark:text-white leading-tight block">
                                                                                {it.boxInfo.displayQtd}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/40">
                                                                        {tipoFilter === 'PR' ? (
                                                                            <div className="flex items-center gap-1.5 p-1.5 min-w-0">
                                                                                <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                                                                <div className="min-w-0">
                                                                                    <span className="text-[9px] font-black uppercase text-slate-500 block leading-tight">Local</span>
                                                                                    <span className="font-mono font-bold text-xs text-slate-900 dark:text-white break-words block">{it.local || 'SEM LOCAL'}</span>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                        <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                                                                            <div className="w-6 h-6 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                                                                <Database className="w-3 h-3" />
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-300 block leading-tight">Estoque {foreignOrigin}</span>
                                                                                <span className="font-black text-xs text-emerald-900 dark:text-emerald-100 leading-tight block">
                                                                                    {it.estoqueSC === null ? 'Indisponível' : `${it.estoqueSC} un`}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        )}

                                                                        <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
                                                                            <div className="w-6 h-6 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                                                                <Database className="w-3 h-3" />
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-[9px] font-black uppercase text-blue-700 dark:text-blue-300 block leading-tight">
                                                                                    Estoque PR
                                                                                </span>
                                                                                <span className="font-black text-xs text-blue-900 dark:text-blue-100 leading-tight block">
                                                                                    {it.estoquePR} un
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                        </div>
                                                    ))}
                                                </div>

                                                {/* VISÃO DESKTOP & TABLET (>= md): TABELA AMPLIADA */}
                                                <div className="hidden md:block print:block w-full overflow-x-auto print:overflow-visible">
                                                    <table className="w-full text-left text-[14px] table-fixed print:text-[12px]">
                                                        <colgroup>
                                                            <col className="w-auto" />
                                                            <col className="w-52 sm:w-56 print:w-36" />
                                                            <col className="w-32 sm:w-36 print:w-24" />
                                                            <col className="w-32 sm:w-36 print:w-24" />
                                                        </colgroup>
                                                        {/* Thead apenas para impressão em papel para repetir cabeçalhos entre páginas */}
                                                        <thead className="hidden print:table-header-group">
                                                            <tr className="print:bg-slate-100 print:text-slate-900 print:text-[11px] print:border-b print:border-slate-300">
                                                                <th className="print:py-1.5 print:px-2 text-left">DESCRIÇÃO</th>
                                                                <th className="print:py-1.5 print:px-1.5 text-center">QTD NO CAMINHÃO</th>
                                                                <th className="print:py-1.5 print:px-1 text-center">{tipoFilter === 'PR' ? 'LOCAL' : `ESTOQUE ${foreignOrigin}`}</th>
                                                                <th className="print:py-1.5 print:px-1 text-center">ESTOQUE PR</th>
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
                                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                                    <span className="font-black text-slate-900 dark:text-white text-base sm:text-[17px] block leading-snug print:text-[13px] print:font-bold print:leading-snug">
                                                                                        {it.descricao || it.codigo}
                                                                                    </span>

                                                                                    {/* MOSTRAR QUAL É DO PARANÁ E QUAL É DE SC NO MODO VER OS 2 JUNTOS */}
                                                                                    {tipoFilter === 'TODOS' && (
                                                                                        <div className="inline-flex items-center gap-1.5 print:inline-block print:text-[10px] print:font-black">
                                                                                            {it.origemEstado === 'PR' && (
                                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                                                                    <FlagPR className="w-3.5 h-2.5 print:hidden" />
                                                                                                    <span>Carga PR</span>
                                                                                                </span>
                                                                                            )}
                                                                                            {it.origemEstado === 'SC' && (
                                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                                                                    <FlagSC className="w-3.5 h-2.5 print:hidden" />
                                                                                                    <span>Carga SC</span>
                                                                                                </span>
                                                                                            )}
                                                                                            {it.origemEstado === 'AMBOS' && (
                                                                                                <div className="inline-flex items-center gap-1">
                                                                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                                                                        <FlagPR className="w-3 h-2 print:hidden" />
                                                                                                        <span>PR: {it.qtdPR}</span>
                                                                                                    </span>
                                                                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                                                                        <FlagSC className="w-3 h-2 print:hidden" />
                                                                                                        <span>SC: {it.qtdSC}</span>
                                                                                                    </span>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </div>

                                                                                {/* CÓDIGO OCULTO NO PRINT */}
                                                                                <div className="flex items-center gap-2 mt-1 print:hidden">
                                                                                    <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/80 dark:border-slate-700/60 inline-block">
                                                                                        CÓD: {it.codigo}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </td>

                                                                    {/* QUANTIDADE NO CAMINHÃO */}
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
                                                                            {tipoFilter === 'TODOS' && it.origemEstado === 'AMBOS' && (
                                                                                <div className="text-[10px] font-extrabold flex items-center gap-1 mt-0.5 print:hidden">
                                                                                    <span className="text-blue-600 dark:text-blue-400">PR: {it.qtdPR}</span>
                                                                                    <span className="text-slate-300">•</span>
                                                                                    <span className="text-emerald-600 dark:text-emerald-400">SC: {it.qtdSC}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </td>

                                                                    {/* Estoques por estado */}
                                                                    {tipoFilter === 'PR' ? (
                                                                        <td className="py-3.5 px-3 text-center print:py-1 print:px-1">
                                                                            <span className="font-mono font-black text-xs sm:text-sm text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 inline-block break-words max-w-full print:p-0 print:bg-transparent print:border-none print:text-[11.5px]">
                                                                                {it.local || 'SEM LOCAL'}
                                                                            </span>
                                                                        </td>
                                                                    ) : (
                                                                        <>
                                                                            {/* ESTOQUE SC */}
                                                                            <td className="py-3.5 px-3 text-center print:py-1 print:px-1">
                                                                                <span className="inline-flex items-center justify-center min-w-[50px] px-2.5 py-1 rounded-xl text-xs sm:text-sm font-black border shadow-2xs bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-emerald-200/90 dark:border-emerald-900/40 print:min-w-0 print:p-0 print:bg-transparent print:border-none print:text-[11.5px] print:font-black print:shadow-none print:text-slate-800">
                                                                                    {it.estoqueSC === null ? 'Indisponível' : `${it.estoqueSC} un`}
                                                                                </span>
                                                                            </td>
                                                                        </>
                                                                    )}

                                                                            {/* ESTOQUE PR */}
                                                                            <td className="py-3.5 px-3 text-center print:py-1 print:px-1">
                                                                                <span className="inline-flex items-center justify-center min-w-[50px] px-2.5 py-1 rounded-xl text-xs sm:text-sm font-black border shadow-2xs bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 border-blue-200/90 dark:border-blue-900/40 print:min-w-0 print:p-0 print:bg-transparent print:border-none print:text-[11.5px] print:font-black print:shadow-none print:text-slate-800">
                                                                                    {it.estoquePR} un
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
