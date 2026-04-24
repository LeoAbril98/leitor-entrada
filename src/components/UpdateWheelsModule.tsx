import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { 
    ArrowLeft, MapPin, RefreshCcw, Save, Trash2, CheckCircle2, 
    Download, History, Barcode, Search, Eraser, X, 
    Volume2, VolumeX, Eye, ClipboardCheck, Clock9, Image as ImageIcon,
    Filter, ListChecks, ArrowUpDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { ScannerInput } from './ScannerInput';
import { ManualAddModal } from './ManualAddModal';
import { WheelLocationReading, ConsolidatedWheel, StockItem } from '../types';
import { getInventory } from '../lib/supabase';
import { getWheelPhotoUrl } from '../utils/photoUtils';
import { cn } from '../utils';

interface UpdateWheelsModuleProps {
    onBackToMenu: () => void;
}

interface UpdateHistoryEntry {
    id: string;
    timestamp: number;
    data: ConsolidatedWheel[];
    locationCount: number;
    itemCount: number;
}

export const UpdateWheelsModule: React.FC<UpdateWheelsModuleProps> = ({ onBackToMenu }) => {
    const [view, setView] = useState<'scanning' | 'consolidated' | 'history'>('scanning');
    const [tab, setTab] = useState<'all' | 'audit'>('all');
    const [readings, setReadings] = useState<WheelLocationReading[]>(() => {
        const saved = localStorage.getItem('@MK_WHEEL_LOCATION_READINGS');
        return saved ? JSON.parse(saved) : [];
    });
    const [currentLocation, setCurrentLocation] = useState(() => {
        return localStorage.getItem('@MK_LAST_LOCATION') || '';
    });
    const [inputValue, setInputValue] = useState('');
    const [stock, setStock] = useState<StockItem[]>([]);
    const [isManualAddOpen, setIsManualAddOpen] = useState(false);
    const [isMuted, setIsMuted] = useState(() => localStorage.getItem('@MK_UPDATE_MUTED') === 'true');
    const [includeDescriptionInExport, setIncludeDescriptionInExport] = useState(false);
    const [history, setHistory] = useState<UpdateHistoryEntry[]>(() => {
        const saved = localStorage.getItem('@MK_WHEEL_UPDATE_HISTORY');
        return saved ? JSON.parse(saved) : [];
    });

    const inputRef = useRef<HTMLInputElement>(null);
    const localRef = useRef<HTMLInputElement>(null);
    const successSound = useRef<HTMLAudioElement | null>(null);
    const errorSound = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        successSound.current = new Audio('/sounds/success.mp3');
        errorSound.current = new Audio('/sounds/error.mp3');
        if (successSound.current) successSound.current.load();
        if (errorSound.current) errorSound.current.load();

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
    }, []);

    useEffect(() => {
        localStorage.setItem('@MK_WHEEL_LOCATION_READINGS', JSON.stringify(readings));
    }, [readings]);

    useEffect(() => {
        localStorage.setItem('@MK_LAST_LOCATION', currentLocation);
    }, [currentLocation]);

    useEffect(() => {
        localStorage.setItem('@MK_UPDATE_MUTED', String(isMuted));
    }, [isMuted]);

    useEffect(() => {
        localStorage.setItem('@MK_WHEEL_UPDATE_HISTORY', JSON.stringify(history));
    }, [history]);

    useEffect(() => {
        if (view === 'scanning' && currentLocation && !isManualAddOpen) {
            const focusInput = () => {
                if (document.activeElement?.tagName !== 'INPUT' || document.activeElement === inputRef.current) {
                    inputRef.current?.focus();
                }
            };
            focusInput();
            const interval = setInterval(focusInput, 1000);
            return () => clearInterval(interval);
        } else if (view === 'scanning' && !currentLocation && !isManualAddOpen) {
            localRef.current?.focus();
        }
    }, [view, currentLocation, isManualAddOpen]);

    const playSound = (type: 'success' | 'error') => {
        if (isMuted) return;
        const sound = type === 'success' ? successSound.current : errorSound.current;
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(() => { });
        }
    };

    const handleAddReading = (e?: React.FormEvent) => {
        e?.preventDefault();
        const code = inputValue.trim().toUpperCase();
        if (!code) return;

        if (!currentLocation.trim()) {
            toast.error('Informe o LOCAL antes de bipar');
            localRef.current?.focus();
            playSound('error');
            return;
        }

        const newReading: WheelLocationReading = {
            id: crypto.randomUUID(),
            roda: code,
            local: currentLocation.toUpperCase().trim(),
            timestamp: Date.now(),
        };

        setReadings(prev => [newReading, ...prev]);
        setInputValue('');
        playSound('success');
        toast.success(`Registrado: ${code} em ${currentLocation}`);
    };

    const handleManualSearch = (codigo: string) => {
        if (!currentLocation.trim()) {
            toast.error('Informe o LOCAL antes de selecionar a roda');
            localRef.current?.focus();
            return;
        }

        const newReading: WheelLocationReading = {
            id: crypto.randomUUID(),
            roda: codigo.toUpperCase(),
            local: currentLocation.toUpperCase().trim(),
            timestamp: Date.now(),
        };

        setReadings(prev => [newReading, ...prev]);
        playSound('success');
        toast.success(`Adicionado: ${codigo} em ${currentLocation}`);
    };

    const removeReading = (id: string) => {
        setReadings(prev => prev.filter(r => r.id !== id));
        toast.success('Leitura removida');
    };

    const clearAll = () => {
        if (window.confirm('Deseja limpar todas as leituras atuais?')) {
            setReadings([]);
            toast.success('Lista limpa');
        }
    };

    const handleClearLocal = () => {
        setCurrentLocation('');
        localRef.current?.focus();
    };

    const consolidatedData = useMemo(() => {
        const groups: Record<string, Set<string>> = {};
        readings.forEach(r => {
            if (!groups[r.roda]) groups[r.roda] = new Set();
            groups[r.roda].add(r.local);
        });

        return Object.entries(groups)
            .map(([roda, locaisSet]): ConsolidatedWheel => ({
                roda,
                locais: Array.from(locaisSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
            }))
            .sort((a, b) => a.roda.localeCompare(b.roda));
    }, [readings]);

    const expectedWheels = useMemo(() => {
        if (!currentLocation || currentLocation.trim().length < 2) return [];
        const search = currentLocation.trim().toUpperCase();
        return stock.filter(item => {
            if (!item.local) return false;
            const itemLocal = item.local.toUpperCase();
            // Verifica se o local digitado está contido no local do banco (ex: "8E" em "8E/C2")
            // ou se são idênticos
            return itemLocal.includes(search);
        });
    }, [stock, currentLocation]);

    const auditData = useMemo(() => {
        return expectedWheels.map(item => {
            const isScanned = consolidatedData.some(c => c.roda === item.codigo && c.locais.includes(currentLocation));
            return {
                ...item,
                isScanned
            };
        }).sort((a, b) => Number(a.isScanned) - Number(b.isScanned));
    }, [expectedWheels, consolidatedData, currentLocation]);

    const handleExportExcel = () => {
        const worksheetData = consolidatedData.map(item => {
            const base = { 'Roda': item.roda, 'Locais': item.locais.join(', ') };
            if (includeDescriptionInExport) {
                const dbItem = stock.find(s => s.codigo === item.roda);
                return { ...base, 'Descrição': dbItem?.descricao || '---' };
            }
            return base;
        });

        const ws = XLSX.utils.json_to_sheet(worksheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Atualização Rodas");
        const fileName = `atualizacao_rodas_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        // Save to History
        const newEntry: UpdateHistoryEntry = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            data: consolidatedData,
            locationCount: Array.from(new Set(readings.map(r => r.local))).length,
            itemCount: consolidatedData.length
        };
        setHistory(prev => [newEntry, ...prev].slice(0, 20)); // Keep last 20

        toast.success('Excel exportado e salvo no histórico!');
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors pb-20">
            <Toaster position="top-center" />

            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 shadow-sm transition-colors">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={onBackToMenu} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 shadow-sm font-bold flex items-center gap-2 transition-all">
                            <ArrowLeft className="w-5 h-5" /> <span className="hidden sm:inline">Menu</span>
                        </button>
                        <h1 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <RefreshCcw className="text-indigo-500 w-6 h-6" /> ATUALIZAR RODAS
                        </h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsMuted(!isMuted)} 
                            className={cn(
                                "p-3 rounded-xl transition-all",
                                isMuted ? "bg-red-50 text-red-500 dark:bg-red-900/20" : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                            )}
                            title={isMuted ? "Desativar Mudo" : "Ativar Mudo"}
                        >
                            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </button>

                        <button 
                            onClick={() => setView(view === 'history' ? 'scanning' : 'history')} 
                            className={cn(
                                "p-3 rounded-xl transition-all",
                                view === 'history' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                            )}
                            title="Histórico de Exportações"
                        >
                            <Clock9 className="w-5 h-5" />
                        </button>

                        {view === 'scanning' ? (
                            <button onClick={() => setView('consolidated')} disabled={readings.length === 0} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-100 dark:shadow-none transition-all active:scale-95">
                                <CheckCircle2 className="w-5 h-5" /> Finalizar ({readings.length})
                            </button>
                        ) : (
                            <button onClick={() => setView('scanning')} className="px-6 py-2.5 bg-slate-800 text-white dark:bg-slate-700 rounded-xl font-black flex items-center gap-2 shadow-lg transition-all active:scale-95">
                                <Barcode className="w-5 h-5" /> Voltar
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 mt-8">
                <AnimatePresence mode="wait">
                    {view === 'scanning' ? (
                        <motion.div key="scanning" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                            {/* Local Input Section */}
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center gap-6">
                                <div className="flex-1 w-full">
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Onde as rodas estão?</label>
                                    <div className="relative group">
                                        <MapPin className={cn("absolute left-5 top-1/2 -translate-y-1/2 w-7 h-7 transition-colors", currentLocation ? "text-indigo-500" : "text-slate-400")} />
                                        <input
                                            ref={localRef}
                                            type="text"
                                            value={currentLocation}
                                            onChange={(e) => {
                                                setCurrentLocation(e.target.value.toUpperCase());
                                                setTab('all');
                                            }}
                                            placeholder="Digite o Local (Ex: RUA 10)"
                                            className="w-full h-20 pl-16 pr-16 bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-[28px] text-3xl font-black focus:border-indigo-500 outline-none transition-all"
                                        />
                                        {currentLocation && (
                                            <button onClick={handleClearLocal} className="absolute right-6 top-1/2 -translate-y-1/2 p-2 bg-slate-200 dark:bg-slate-800 rounded-full hover:text-red-500 transition-all">
                                                <Eraser className="w-6 h-6" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="hidden md:flex h-20 w-px bg-slate-100 dark:bg-slate-800 mx-2" />
                                <div className="text-center md:text-left min-w-[180px]">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status da Auditoria</p>
                                    {currentLocation ? (
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-xl leading-none">
                                                {currentLocation}
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase">{expectedWheels.length} rodas esperadas aqui</p>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-slate-300 font-black text-lg animate-pulse">
                                            ESPERANDO...
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] shadow-sm border border-slate-200 dark:border-slate-800">
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Leitura de Código</h3>
                                    </div>
                                    <button onClick={() => setIsManualAddOpen(true)} className="text-indigo-600 font-black flex items-center gap-2 px-6 py-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl border-2 border-indigo-100 dark:border-indigo-800 transition-all hover:bg-indigo-100">
                                        <Search className="w-5 h-5" /> Busca Manual
                                    </button>
                                </div>
                                <ScannerInput ref={inputRef} value={inputValue} onChange={setInputValue} onSubmit={handleAddReading} />
                            </div>

                            <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                                    <div className="flex items-center gap-4">
                                        <button onClick={() => setTab('all')} className={cn("px-4 py-2 rounded-xl text-xs font-black uppercase transition-all", tab === 'all' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-500 hover:bg-slate-100")}>
                                            Todas as Leituras ({consolidatedData.length})
                                        </button>
                                        {currentLocation && (
                                            <button onClick={() => setTab('audit')} className={cn("px-4 py-2 rounded-xl text-xs font-black uppercase transition-all", tab === 'audit' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-500 hover:bg-slate-100")}>
                                                Auditoria {currentLocation}
                                            </button>
                                        )}
                                    </div>
                                    <button onClick={clearAll} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Limpar Tudo">
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                                
                                <div className="max-h-[600px] overflow-y-auto">
                                    {tab === 'all' ? (
                                        <table className="w-full text-left">
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {consolidatedData.map((item) => {
                                                    const dbItem = stock.find(s => s.codigo === item.roda);
                                                    return (
                                                        <tr key={item.roda} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 shrink-0 shadow-sm">
                                                                        <img src={getWheelPhotoUrl(dbItem?.descricao || '')} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                                    </div>
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase line-clamp-1 mb-1">{dbItem?.descricao || 'DESCRIÇÃO NÃO ENCONTRADA'}</span>
                                                                        <span className="font-mono text-base text-slate-400 dark:text-slate-500 mb-2">{item.roda}</span>
                                                                        <div className="flex gap-3">
                                                                            <span className="text-[10px] font-black text-slate-400 bg-slate-100 dark:bg-slate-900/30 px-2.5 py-1 rounded-lg uppercase border border-slate-200 dark:border-slate-800">Antigo: {dbItem?.local || '---'}</span>
                                                                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-lg uppercase">Estoque: {dbItem?.quantidade ?? 0}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-wrap gap-2">
                                                                    {item.locais.map((l, i) => (
                                                                        <span key={i} className="group/loc inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white dark:bg-indigo-600 rounded-xl text-sm font-black shadow-sm">
                                                                            {l}
                                                                            <button onClick={() => setReadings(prev => prev.filter(r => !(r.roda === item.roda && r.local === l)))} className="p-0.5 bg-white/20 rounded hover:bg-white/40 transition-colors">
                                                                                <X className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <button onClick={() => setReadings(prev => prev.filter(r => r.roda !== item.roda))} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all">
                                                                    <Trash2 className="w-6 h-6" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-center justify-between px-2">
                                                <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest">Conferência {currentLocation}</h4>
                                                <div className="text-xs font-bold text-slate-400">
                                                    {auditData.filter(a => a.isScanned).length} de {auditData.length} encontrados
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {auditData.map(item => (
                                                    <button 
                                                        key={item.codigo} 
                                                        onClick={() => { if (!item.isScanned) { setInputValue(item.codigo); handleAddReading(); } }}
                                                        className={cn(
                                                            "p-4 rounded-[24px] border-2 flex items-center gap-4 transition-all text-left group",
                                                            item.isScanned 
                                                                ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800" 
                                                                : "bg-white border-slate-100 hover:border-indigo-300 dark:bg-slate-800 dark:border-slate-700"
                                                        )}
                                                    >
                                                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border", item.isScanned ? "bg-emerald-500 text-white border-emerald-400" : "bg-slate-50 text-slate-400 border-slate-100 dark:bg-slate-900 dark:border-slate-700")}>
                                                            {item.isScanned ? <CheckCircle2 className="w-6 h-6" /> : <ImageIcon className="w-6 h-6" />}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className={cn("font-black text-sm uppercase line-clamp-1 mb-0.5", item.isScanned ? "text-emerald-700 dark:text-emerald-400" : "text-slate-800 dark:text-slate-100")}>{item.descricao}</p>
                                                            <p className="font-mono text-[10px] text-slate-400 dark:text-slate-500 mb-2">{item.codigo}</p>
                                                            <div className="flex gap-2">
                                                                <span className="text-[9px] font-black text-slate-400 bg-slate-100 dark:bg-slate-900/50 px-1.5 py-0.5 rounded uppercase border border-slate-200 dark:border-slate-700">Loc: {item.local}</span>
                                                                <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded uppercase border border-emerald-100 dark:border-emerald-800/30">Est: {item.quantidade ?? 0}</span>
                                                            </div>
                                                        </div>
                                                        {!item.isScanned && <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ) : view === 'consolidated' ? (
                        <motion.div key="consolidated" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                             <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
                                <div><h2 className="text-4xl font-black text-slate-800 dark:text-slate-100 leading-tight">Resultado Final</h2><p className="text-slate-500">Confira o resumo geral e exporte sua planilha.</p></div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Resumo</p>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{consolidatedData.length} Itens | {Array.from(new Set(readings.map(r => r.local))).length} Locais</p>
                                    </div>
                                    <div className="w-px h-10 bg-slate-100 dark:bg-slate-800 mx-2 hidden sm:block" />
                                    <button onClick={handleExportExcel} className="h-20 px-10 bg-emerald-600 text-white rounded-3xl font-black text-xl shadow-xl hover:bg-emerald-700 transition-all active:scale-95 flex items-center gap-4"><Download className="w-7 h-7" /> EXPORTAR EXCEL</button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                <div className="lg:col-span-8">
                                    <div className="bg-white dark:bg-slate-900 rounded-[40px] shadow-xl border border-slate-200 overflow-hidden">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 dark:bg-slate-800 text-xs font-black uppercase tracking-[0.2em] text-slate-500"><tr className="divide-x divide-slate-100"><th className="px-10 py-6">Roda e Descrição</th><th className="px-10 py-6">Locais Registrados</th></tr></thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {consolidatedData.map((item) => (
                                                    <tr key={item.roda} className="hover:bg-slate-50 group">
                                                        <td className="px-10 py-8 border-r border-slate-50"><span className="font-mono font-black text-2xl text-slate-800 mb-1 block">{item.roda}</span><p className="text-sm font-bold text-slate-400 group-hover:text-indigo-600 transition-colors uppercase">{stock.find(s => s.codigo === item.roda)?.descricao || '---'}</p></td>
                                                        <td className="px-10 py-8"><div className="flex flex-wrap gap-2">{item.locais.map((l, i) => (<span key={i} className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-black border border-indigo-100">{l}</span>))}</div></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="lg:col-span-4 space-y-6">
                                    <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Resumo Global</p>
                                        <div className="grid grid-cols-1 gap-4">
                                            <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                                <div><p className="text-3xl font-black text-slate-800 dark:text-slate-100 leading-none mb-1">{consolidatedData.length}</p><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Rodas Únicas</p></div>
                                                <ImageIcon className="w-8 h-8 text-slate-200" />
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                                <div><p className="text-3xl font-black text-indigo-600 leading-none mb-1">{Array.from(new Set(readings.map(r => r.local))).length}</p><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Locais Diferentes</p></div>
                                                <MapPin className="w-8 h-8 text-indigo-100" />
                                            </div>
                                        </div>

                                        <div className="p-6 bg-slate-900 dark:bg-indigo-900/30 rounded-3xl text-white space-y-4 shadow-xl">
                                            <h4 className="font-black text-xs uppercase tracking-widest border-b border-white/10 pb-3 mb-4">Ajustes Finais</h4>
                                            <label className="flex items-center justify-between cursor-pointer group">
                                                <span className="text-xs font-bold text-indigo-100 group-hover:text-white transition-colors">Incluir descrições no Excel</span>
                                                <input type="checkbox" className="w-5 h-5 rounded accent-indigo-500" checked={includeDescriptionInExport} onChange={() => setIncludeDescriptionInExport(!includeDescriptionInExport)} />
                                            </label>
                                            <button onClick={handleExportExcel} className="w-full py-5 bg-white text-slate-900 rounded-2xl font-black text-sm hover:bg-slate-100 transition-all shadow-lg mt-4">GERAR ARQUIVO AGORA</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="history" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="max-w-4xl mx-auto space-y-8">
                            <div className="text-center space-y-2 mb-12">
                                <Clock9 className="w-16 h-16 text-indigo-500 mx-auto mb-4" />
                                <h2 className="text-4xl font-black text-slate-800 dark:text-slate-100">Histórico de Exportações</h2>
                                <p className="text-slate-500">Últimas planilhas geradas no seu dispositivo.</p>
                            </div>

                            <div className="grid gap-4">
                                {history.length === 0 ? (
                                    <div className="p-20 text-center bg-white dark:bg-slate-900 rounded-[40px] border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 italic">Nenhuma exportação registrada ainda.</div>
                                ) : (
                                    history.map((h) => (
                                        <div key={h.id} className="bg-white dark:bg-slate-900 p-6 rounded-[32px] shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between group hover:shadow-lg transition-all">
                                            <div className="flex items-center gap-6">
                                                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-[22px] flex items-center justify-center border-2 border-emerald-100">
                                                    <Download className="w-7 h-7" />
                                                </div>
                                                <div>
                                                    <p className="text-xl font-black text-slate-800 dark:text-slate-100 mb-0.5">{new Date(h.timestamp).toLocaleDateString('pt-BR')} às {new Date(h.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                                    <div className="flex gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                                        <span>{h.itemCount} Itens</span>
                                                        <span>•</span>
                                                        <span>{h.locationCount} Locais</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    const ws = XLSX.utils.json_to_sheet(h.data.map(item => ({ 'Roda': item.roda, 'Locais': item.locais.join(', ') })));
                                                    const wb = XLSX.utils.book_new();
                                                    XLSX.utils.book_append_sheet(wb, ws, "Histórico Atualização");
                                                    XLSX.writeFile(wb, `historico_rodas_${new Date(h.timestamp).toISOString()}.xlsx`);
                                                    toast.success('Histórico exportado!');
                                                }}
                                                className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-2xl font-black flex items-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                Baixar Novamente
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            <ManualAddModal isOpen={isManualAddOpen} onClose={() => setIsManualAddOpen(false)} stock={stock} onAdd={handleManualSearch} mode="search" />
        </div>
    );
};

const ChevronRight = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="9 5l7 7-7 7" />
    </svg>
);
