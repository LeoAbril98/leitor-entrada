import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import {
    ArrowLeft,
    MapPin,
    Search,
    Package2,
    RefreshCcw,
    Camera,
    Maximize2,
    X,
    Copy,
    Check,
    Barcode,
    Layers,
    History,
    Truck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ScannerInput } from './ScannerInput';
import { ManualAddModal } from './ManualAddModal';
import { CameraScannerModal } from './CameraScannerModal';
import { WheelVariationsSelector } from './WheelVariationsSelector';
import { LocatorBottomNav } from './LocatorBottomNav';
import { LocatorHistoryModal, LocatorHistoryItem } from './LocatorHistoryModal';
import { getInventory } from '../lib/supabase';
import { StockItem } from '../types';
import { getWheelPhotoUrl } from '../utils/photoUtils';
import { getRomaneios, fetchAndSyncRomaneios, Romaneio } from '../services/romaneioService';

interface LocatorModuleProps {
    onBackToMenu: () => void;
}

export const LocatorModule: React.FC<LocatorModuleProps> = ({ onBackToMenu }) => {
    const [inputValue, setInputValue] = useState('');
    const [stock, setStock] = useState<StockItem[]>([]);
    const [scannedItem, setScannedItem] = useState<StockItem | null>(null);
    const [scanError, setScanError] = useState(false);
    const [isManualAddOpen, setIsManualAddOpen] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isPhotoZoomOpen, setIsPhotoZoomOpen] = useState(false);
    const [copiedCode, setCopiedCode] = useState(false);
    const [history, setHistory] = useState<LocatorHistoryItem[]>([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [romaneios, setRomaneios] = useState<Romaneio[]>([]);

    const inputRef = useRef<HTMLInputElement>(null);

    // Audio refs
    const successSound = useRef<HTMLAudioElement | null>(null);
    const errorSound = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        successSound.current = new Audio('/sounds/success.mp3');
        errorSound.current = new Audio('/sounds/error.mp3');
        if (successSound.current) successSound.current.load();
        if (errorSound.current) errorSound.current.load();

        // Carregar histórico local limitado aos últimos 10 itens
        try {
            const savedHistory = localStorage.getItem('@LOCATOR_HISTORY');
            if (savedHistory) {
                const parsed = JSON.parse(savedHistory);
                setHistory(Array.isArray(parsed) ? parsed.slice(0, 10) : []);
            }
        } catch (e) {
            console.error('Erro ao ler histórico de localização', e);
        }

        const fetchStock = async () => {
            try {
                const data = await getInventory();
                if (data && data.length > 0) {
                    setStock(data as StockItem[]);
                }
            } catch (err) {
                console.error('Erro ao buscar do Supabase', err);
            }
        };
        fetchStock();

        // Carregar romaneios para checar se item está no caminhão
        try {
            setRomaneios(getRomaneios());
            fetchAndSyncRomaneios().then((list) => {
                if (list && list.length > 0) {
                    setRomaneios(list);
                }
            }).catch(() => { });
        } catch (e) {
            console.error('Erro ao ler romaneios no localizador:', e);
        }
    }, []);

    useEffect(() => {
        if (!isManualAddOpen && !isPhotoZoomOpen && !isHistoryOpen && !isCameraOpen) {
            const focusInput = () => {
                if (document.activeElement?.tagName !== 'INPUT' || document.activeElement === inputRef.current) {
                    inputRef.current?.focus({ preventScroll: true });
                }
            };
            focusInput();
            const interval = setInterval(focusInput, 1000);
            return () => clearInterval(interval);
        }
    }, [isManualAddOpen, isPhotoZoomOpen, isHistoryOpen, isCameraOpen]);

    const addToHistory = (item: StockItem) => {
        setHistory((prev) => {
            const filtered = prev.filter(h => h.codigo !== item.codigo);
            const updated: LocatorHistoryItem[] = [
                {
                    id: `${item.codigo}-${Date.now()}`,
                    codigo: item.codigo,
                    descricao: item.descricao,
                    local: item.local || '---',
                    quantidade: item.quantidade ?? 0,
                    timestamp: Date.now(),
                },
                ...filtered,
            ].slice(0, 10);
            try {
                localStorage.setItem('@LOCATOR_HISTORY', JSON.stringify(updated));
            } catch (e) {
                console.error('Erro ao gravar histórico', e);
            }
            return updated;
        });
    };

    const handleClearHistory = () => {
        setHistory([]);
        try {
            localStorage.removeItem('@LOCATOR_HISTORY');
            toast.success('Histórico limpo');
        } catch (e) {
            console.error(e);
        }
    };

    const handleResetQuery = () => {
        if (scannedItem) {
            setScannedItem(null);
            setInputValue('');
            toast.success('Pronto para nova consulta');
        } else {
            setInputValue('');
        }
        inputRef.current?.focus();
    };

    // Verificar se o item pesquisado está no romaneio do caminhão
    const romaneioMatch = useMemo(() => {
        if (!scannedItem || romaneios.length === 0) return null;

        const targetCode = String(scannedItem.codigo).trim().toUpperCase();
        const cleanNum = (str: string) => str.replace(/^0+/, '');
        const cleanTargetCode = cleanNum(targetCode);

        let totalQtd = 0;
        let romaneioTitulo = '';
        let foundAny = false;

        for (const r of romaneios) {
            const matches = (r.itens || []).filter(it => {
                const itCode = String(it.codigo).trim().toUpperCase();
                const itOrig = it.codigoOriginal ? String(it.codigoOriginal).trim().toUpperCase() : '';
                return (
                    itCode === targetCode ||
                    cleanNum(itCode) === cleanTargetCode ||
                    itOrig === targetCode ||
                    cleanNum(itOrig) === cleanTargetCode
                );
            });

            if (matches.length > 0) {
                foundAny = true;
                if (!romaneioTitulo) romaneioTitulo = r.titulo || r.numero || 'Carga Atual';
                for (const m of matches) {
                    totalQtd += Number(m.quantidade) || 0;
                }
            }
        }

        if (!foundAny || totalQtd <= 0) return null;

        const textoBase = `${scannedItem.descricao || ''} ${targetCode}`.toUpperCase();
        const isCaixaDupla = textoBase.includes('13X') || textoBase.includes('14X') || textoBase.includes('15X6');
        const caixas = isCaixaDupla ? Math.ceil(totalQtd / 2) : totalQtd;

        return {
            quantidade: totalQtd,
            caixas,
            romaneioTitulo,
        };
    }, [scannedItem, romaneios]);

    const getTruckQtdForItem = (item: StockItem | null): number => {
        if (!item || romaneios.length === 0) return 0;
        const targetCode = String(item.codigo).trim().toUpperCase();
        const cleanNum = (str: string) => str.replace(/^0+/, '');
        const cleanTargetCode = cleanNum(targetCode);

        let totalQtd = 0;
        for (const r of romaneios) {
            const matches = (r.itens || []).filter(it => {
                const itCode = String(it.codigo).trim().toUpperCase();
                const itOrig = it.codigoOriginal ? String(it.codigoOriginal).trim().toUpperCase() : '';
                return (
                    itCode === targetCode ||
                    cleanNum(itCode) === cleanTargetCode ||
                    itOrig === targetCode ||
                    cleanNum(itOrig) === cleanTargetCode
                );
            });
            for (const m of matches) {
                totalQtd += Number(m.quantidade) || 0;
            }
        }
        return totalQtd;
    };



    const handleSearch = (e?: React.FormEvent) => {
        e?.preventDefault();
        const code = inputValue.trim();
        if (!code) return;

        const found = stock.find(item => item.codigo === code);

        if (found) {
            setScannedItem(found);
            addToHistory(found);
            setInputValue('');
            if (successSound.current) {
                successSound.current.currentTime = 0;
                successSound.current.play().catch(() => { });
            }
            toast.success('Item localizado');
        } else {
            setScannedItem(null);
            setScanError(true);
            setTimeout(() => setScanError(false), 400);

            if (errorSound.current) {
                errorSound.current.currentTime = 0;
                errorSound.current.play().catch(() => { });
            }
            toast.error(`Código não encontrado: ${code}`);
            setInputValue('');
        }
    };

    const handleManualSearch = (codigo: string) => {
        const found = stock.find(item => item.codigo === codigo);
        if (found) {
            setScannedItem(found);
            addToHistory(found);
            setInputValue('');
            if (successSound.current) {
                successSound.current.currentTime = 0;
                successSound.current.play().catch(() => { });
            }
            toast.success('Item localizado');
        } else {
            setScannedItem(null);
            setScanError(true);
            setTimeout(() => setScanError(false), 400);

            if (errorSound.current) {
                errorSound.current.currentTime = 0;
                errorSound.current.play().catch(() => { });
            }
            toast.error(`Código não encontrado: ${codigo}`);
            setInputValue('');
        }
    };

    const handleCopyCode = (codigo: string) => {
        navigator.clipboard.writeText(codigo);
        setCopiedCode(true);
        toast.success(`Código #${codigo} copiado!`);
        setTimeout(() => setCopiedCode(false), 2000);
    };

    return (
        <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors pb-28 sm:pb-32 md:pb-12 ${scanError ? "bg-red-500/20 dark:bg-red-900/40" : ""}`}>
            {scanError && (
                <div className="fixed inset-0 z-50 pointer-events-none border-8 border-red-500/50 animate-pulse" />
            )}
            <Toaster position="top-center" />

            {/* HEADER */}
            <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-20 shadow-sm transition-colors">
                <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onBackToMenu}
                            className="p-2 shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-bold flex items-center gap-2 shadow-sm"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span className="hidden sm:inline text-sm">Menu</span>
                        </button>
                        <h1 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <span className="p-1.5 bg-emerald-50 dark:bg-emerald-950/60 rounded-lg text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                                <MapPin className="w-4 h-4" />
                            </span>
                            Localização
                        </h1>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Botão de Histórico visível no desktop */}
                        <button
                            onClick={() => setIsHistoryOpen(true)}
                            className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700 transition-colors shadow-sm"
                            title="Histórico de Consultas"
                        >
                            <History className="w-3.5 h-3.5 text-blue-500" />
                            <span>Histórico</span>
                            {history.length > 0 && (
                                <span className="ml-0.5 px-1.5 py-0.2 bg-blue-500 text-white text-[10px] rounded-full font-black">
                                    {history.length}
                                </span>
                            )}
                        </button>

                        {stock.length > 0 && (
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-full border border-slate-200/50 dark:border-slate-700/50">
                                <Layers className="w-3.5 h-3.5 text-emerald-500" />
                                <span>{stock.length.toLocaleString('pt-BR')} itens</span>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 mt-3 sm:mt-6">
                {/* BARRA DE PESQUISA & AÇÕES */}
                <section className="mb-3 sm:mb-4">
                    <div className="flex gap-2 items-center">
                        <div className="flex-1 min-w-0">
                            <ScannerInput
                                ref={inputRef}
                                value={inputValue}
                                onChange={setInputValue}
                                onSubmit={handleSearch}
                            />
                        </div>
                        {/* Botões visíveis em telas médias/desktop. No mobile, ficam acessíveis na Bottom Navigation Bar */}
                        <button
                            onClick={() => setIsCameraOpen(true)}
                            className="hidden sm:flex h-16 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/10 active:scale-95 shrink-0"
                            title="Ler com Câmera"
                        >
                            <Camera className="w-5 h-5" />
                            <span className="text-xs">Câmera</span>
                        </button>
                        <button
                            onClick={() => setIsManualAddOpen(true)}
                            className="hidden sm:flex h-16 px-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl font-black text-xs uppercase tracking-wider items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95 shrink-0"
                            title="Busca Manual"
                        >
                            <Search className="w-5 h-5 text-slate-400" />
                            <span className="text-xs">Busca</span>
                        </button>
                    </div>
                </section>

                <AnimatePresence mode="wait">
                    {scannedItem ? (
                        /* CARD HERO — RESPONSIVO: 1 col mobile, 2 col desktop */
                        <motion.div
                            key={scannedItem.codigo}
                            initial={{ opacity: 0, y: 15, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-800 relative overflow-hidden"
                        >
                            {/* GRID 1 coluna mobile / 2 colunas desktop */}
                            <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x md:divide-slate-100 md:dark:divide-slate-800">

                                {/* ── COLUNA ESQUERDA: Produto + Estoque + Localização ── */}
                                <div className="p-4 sm:p-5 flex flex-col gap-4">

                                    {/* Foto + Descrição */}
                                    <div className="flex items-center gap-3.5">
                                        <div
                                            onClick={() => setIsPhotoZoomOpen(true)}
                                            className="cursor-pointer relative w-24 h-24 sm:w-28 sm:h-28 shrink-0 bg-gradient-to-b from-slate-100 to-slate-200/60 dark:from-slate-800 dark:to-slate-950 rounded-2xl p-2 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center shadow-md group hover:border-emerald-400 transition-all"
                                        >
                                            <img
                                                src={getWheelPhotoUrl(scannedItem.descricao, scannedItem.codigo)}
                                                alt={scannedItem.descricao}
                                                className="w-full h-full object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-200"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = "https://placehold.co/150x150/e2e8f0/64748b?text=SEM+FOTO";
                                                }}
                                            />
                                            <span className="absolute bottom-1 right-1 p-1 bg-white/90 dark:bg-slate-900/90 rounded-md text-slate-500 shadow-sm opacity-80 group-hover:opacity-100">
                                                <Maximize2 className="w-3 h-3" />
                                            </span>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                <button
                                                    onClick={() => handleCopyCode(scannedItem.codigo)}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs font-mono font-bold text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700 transition-all active:scale-95"
                                                >
                                                    {copiedCode ? (
                                                        <>
                                                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                                                            <span className="text-emerald-600 dark:text-emerald-400">Copiado!</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Barcode className="w-3.5 h-3.5 text-slate-400" />
                                                            <span>#{scannedItem.codigo}</span>
                                                            <Copy className="w-3 h-3 text-slate-400 ml-0.5 opacity-70" />
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                            <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight leading-snug line-clamp-2">
                                                {scannedItem.descricao}
                                            </h2>
                                        </div>
                                    </div>

                                    {/* Estoque + Localização lado a lado no desktop, empilhados no mobile */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* CARD ESTOQUE */}
                                        <div className="bg-slate-50 dark:bg-slate-800/70 p-4 rounded-2xl border-2 border-slate-200/80 dark:border-slate-700/60">
                                            <div className="flex items-center gap-2 mb-1.5 text-slate-600 dark:text-slate-300">
                                                <Package2 className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                                                <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                                    Estoque
                                                </span>
                                            </div>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                                                    {scannedItem.quantidade}
                                                </span>
                                                <span className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase">
                                                    {scannedItem.quantidade === 1 ? "un" : "un"}
                                                </span>
                                            </div>
                                        </div>

                                        {/* CARD LOCALIZAÇÃO */}
                                        <div className="bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent dark:from-emerald-950/50 dark:via-emerald-900/20 dark:to-transparent p-4 rounded-2xl border-2 border-emerald-500/30 dark:border-emerald-500/20">
                                            <div className="flex items-center gap-2 mb-1.5 text-emerald-800 dark:text-emerald-300">
                                                <MapPin className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                                <span className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                                                    Localização
                                                </span>
                                            </div>
                                            <p className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight break-words font-mono leading-none">
                                                {scannedItem.local || '---'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* BLOCO RODA NO CAMINHÃO (QUANDO HOUVER NO ROMANEIO) */}
                                    {romaneioMatch && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/5 dark:from-amber-950/40 dark:via-amber-900/20 dark:to-transparent p-3.5 sm:p-4 rounded-2xl border-2 border-amber-500/40 dark:border-amber-500/30 shadow-xs relative overflow-hidden"
                                        >
                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 dark:bg-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-2xs">
                                                        <Truck className="w-4 h-4" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-950 dark:text-amber-200 block leading-tight">
                                                            Roda no Caminhão
                                                        </span>
                                                        <span className="text-[10px] sm:text-[11px] font-bold text-amber-700 dark:text-amber-400 block leading-tight truncate max-w-[190px] sm:max-w-xs">
                                                            Chegando: {romaneioMatch.romaneioTitulo}
                                                        </span>
                                                    </div>
                                                </div>

                                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-500/20 dark:bg-amber-500/30 text-amber-900 dark:text-amber-200 border border-amber-400/50 shrink-0">
                                                    Na Carga
                                                </span>
                                            </div>

                                            <div className="flex items-baseline justify-between pt-2 border-t border-amber-300/40 dark:border-amber-800/40">
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className="text-3xl sm:text-4xl font-black text-amber-950 dark:text-amber-100 tracking-tight leading-none">
                                                        {romaneioMatch.quantidade}
                                                    </span>
                                                    <span className="text-xs font-black uppercase text-amber-700 dark:text-amber-400">
                                                        un chegando
                                                    </span>
                                                </div>

                                                <span className="text-xs sm:text-sm font-bold text-amber-800 dark:text-amber-300">
                                                    ({romaneioMatch.caixas} {romaneioMatch.caixas === 1 ? 'cx' : 'cx'})
                                                </span>
                                            </div>
                                        </motion.div>
                                    )}
                                </div>

                                {/* ── COLUNA DIREITA: Variações + botão (desktop) ── */}
                                <div className="p-4 sm:p-5 flex flex-col gap-4 bg-slate-50/50 dark:bg-slate-800/20 md:bg-transparent md:dark:bg-transparent">
                                    {/* SELETOR DE VARIAÇÕES */}
                                    <WheelVariationsSelector
                                        currentItem={scannedItem}
                                        allStock={stock}
                                        onSelectVariation={(item) => {
                                            setScannedItem(item);
                                            addToHistory(item);
                                            if (successSound.current) {
                                                successSound.current.currentTime = 0;
                                                successSound.current.play().catch(() => { });
                                            }
                                        }}
                                    />

                                    {/* Botão Nova Consulta — visível só no desktop */}
                                    <button
                                        onClick={handleResetQuery}
                                        className="hidden md:flex w-full h-12 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl font-black text-xs uppercase tracking-wider items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md shadow-slate-900/10 dark:shadow-none mt-auto"
                                    >
                                        <RefreshCcw className="w-4 h-4" />
                                        <span>Nova Consulta</span>
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        /* EMPTY STATE COMPACTO */
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center flex flex-col items-center justify-center min-h-[240px] relative overflow-hidden"
                        >
                            {/* Anéis de Pulso Radar */}
                            <div className="relative mb-3">
                                <div className="absolute inset-0 rounded-full bg-emerald-500/10 dark:bg-emerald-400/10 animate-ping" />
                                <div className="w-16 h-16 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/60 dark:to-emerald-900/30 border border-emerald-200 dark:border-emerald-800/50 rounded-full flex items-center justify-center shadow-inner relative z-10">
                                    <Barcode className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                                </div>
                            </div>

                            <h3 className="text-base font-black text-slate-800 dark:text-slate-100 mb-1">
                                Pronto para Bipagem
                            </h3>
                            <p className="text-slate-400 dark:text-slate-500 text-xs max-w-xs mx-auto leading-relaxed">
                                Aponte o leitor de código de barras ou use a câmera para visualizar imediatamente a localização e quantidade.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* MODAL DE ZOOM DA FOTO */}
            <AnimatePresence>
                {isPhotoZoomOpen && scannedItem && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsPhotoZoomOpen(false)}
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center cursor-zoom-out"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative cursor-default"
                        >
                            <button
                                onClick={() => setIsPhotoZoomOpen(false)}
                                className="absolute top-4 right-4 p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="w-full aspect-square bg-slate-50 dark:bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center p-4 mb-4 border border-slate-100 dark:border-slate-800">
                                <img
                                    src={getWheelPhotoUrl(scannedItem.descricao, scannedItem.codigo)}
                                    alt={scannedItem.descricao}
                                    className="w-full h-full object-contain drop-shadow-xl"
                                />
                            </div>

                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 text-center">
                                {scannedItem.descricao}
                            </h3>
                            <p className="text-sm font-mono text-center text-slate-400 mt-1">
                                #{scannedItem.codigo}
                            </p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <ManualAddModal
                isOpen={isManualAddOpen}
                onClose={() => setIsManualAddOpen(false)}
                stock={stock}
                onAdd={handleManualSearch}
                mode="search"
            />

            <CameraScannerModal
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onScan={handleManualSearch}
            />

            {/* BARRA DE NAVEGAÇÃO INFERIOR MOBILE */}
            <div className="md:hidden">
                <LocatorBottomNav
                    onGoHome={onBackToMenu}
                    onOpenSearch={() => setIsManualAddOpen(true)}
                    onOpenScanner={() => setIsCameraOpen(true)}
                    onOpenHistory={() => setIsHistoryOpen(true)}
                    onResetQuery={handleResetQuery}
                    hasScannedItem={!!scannedItem}
                    historyCount={history.length}
                    isSearchOpen={isManualAddOpen}
                    isHistoryOpen={isHistoryOpen}
                />
            </div>

            {/* MODAL DE HISTÓRICO DE CONSULTAS RECENTES */}
            <LocatorHistoryModal
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                history={history}
                onSelectItem={handleManualSearch}
                onClearHistory={handleClearHistory}
            />
        </div>
    );
};
