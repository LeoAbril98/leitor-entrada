import React, { useState, useEffect, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { ArrowLeft, MapPin, Search, Package2, RefreshCcw, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ScannerInput } from './ScannerInput';
import { ManualAddModal } from './ManualAddModal';
import { getInventory } from '../lib/supabase';
import { StockItem } from '../types';
import { getWheelPhotoUrl } from '../utils/photoUtils';

interface LocatorModuleProps {
    onBackToMenu: () => void;
}

export const LocatorModule: React.FC<LocatorModuleProps> = ({ onBackToMenu }) => {
    const [inputValue, setInputValue] = useState('');
    const [stock, setStock] = useState<StockItem[]>([]);
    const [scannedItem, setScannedItem] = useState<StockItem | null>(null);
    const [scanError, setScanError] = useState(false);
    const [isManualAddOpen, setIsManualAddOpen] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);

    // Audio refs
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
        if (!isManualAddOpen) {
            const focusInput = () => {
                if (document.activeElement?.tagName !== 'INPUT' || document.activeElement === inputRef.current) {
                    inputRef.current?.focus();
                }
            };
            focusInput();
            const interval = setInterval(focusInput, 1000);
            return () => clearInterval(interval);
        }
    }, [isManualAddOpen]);

    const handleSearch = (e?: React.FormEvent) => {
        e?.preventDefault();
        const code = inputValue.trim();
        if (!code) return;

        const found = stock.find(item => item.codigo === code);

        if (found) {
            setScannedItem(found);
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

    return (
        <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors ${scanError ? "bg-red-500/20 dark:bg-red-900/40" : ""}`}>
            {scanError && (
                <div className="fixed inset-0 z-50 pointer-events-none border-8 border-red-500/50 animate-pulse" />
            )}
            <Toaster position="top-center" />

            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 shadow-sm transition-colors">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
                    <button
                        onClick={onBackToMenu}
                        className="p-2 shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm font-bold flex items-center justify-center gap-2"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="hidden sm:inline">Menu</span>
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <MapPin className="text-emerald-500 w-6 h-6" /> Localização
                        </h1>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 mt-8">
                <section className="mb-8 flex gap-3">
                    <div className="flex-1 bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
                        <h2 className="text-slate-500 dark:text-slate-400 font-semibold mb-4 flex items-center gap-2">
                            <Search className="w-5 h-5" /> Bipar código de barras
                        </h2>
                        <ScannerInput
                            ref={inputRef}
                            value={inputValue}
                            onChange={setInputValue}
                            onSubmit={handleSearch}
                        />
                    </div>
                    <button
                        onClick={() => setIsManualAddOpen(true)}
                        className="h-auto w-32 sm:w-auto px-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-3xl font-bold flex flex-col sm:flex-row items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all shadow-sm shrink-0"
                    >
                        <Search className="w-6 h-6" />
                        <span className="sm:hidden text-xs mt-1">Busca<br />Manual</span>
                        <span className="hidden sm:inline">Busca Manual</span>
                    </button>
                </section>

                <AnimatePresence mode="wait">
                    {scannedItem ? (
                        <motion.div
                            key={scannedItem.codigo}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl border border-emerald-100 dark:border-emerald-900/30 overflow-hidden relative"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 dark:bg-emerald-900/20 rounded-bl-full -z-10" />

                            <div className="flex gap-4 mb-8">
                                <div className="w-20 h-20 shrink-0 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-md">
                                    <img 
                                        src={getWheelPhotoUrl(scannedItem.descricao)} 
                                        alt={scannedItem.descricao}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = "https://placehold.co/150x150/e2e8f0/64748b?text=FOTO";
                                        }}
                                    />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase leading-tight tracking-tight">
                                        {scannedItem.descricao}
                                    </h3>
                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-mono mt-1 text-sm bg-slate-100 dark:bg-slate-800 w-fit px-2 py-0.5 rounded-lg">
                                        <Hash className="w-3.5 h-3.5" /> {scannedItem.codigo}
                                    </div>
                                </div>
                            </div>

                            {/* GRID INVERTIDO: Quantidade Primeiro, Local Depois */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 shadow-sm">
                                    <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em] mb-2">Quantidade</p>
                                    <p className="text-4xl font-black text-emerald-700 dark:text-emerald-300">
                                        {scannedItem.quantidade}
                                    </p>
                                </div>
                                
                                <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2">Localização</p>
                                    <p className="text-4xl font-black text-slate-800 dark:text-slate-100">
                                        {scannedItem.local || '---'}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => setScannedItem(null)}
                                className="mt-8 w-full h-14 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-black flex items-center justify-center gap-3 hover:opacity-90 transition-all active:scale-[0.98] shadow-lg shadow-slate-200 dark:shadow-none"
                            >
                                <RefreshCcw className="w-5 h-5" /> NOVA CONSULTA
                            </button>
                        </motion.div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="bg-transparent border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[300px]"
                        >
                            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4">
                                <MapPin className="w-10 h-10 text-slate-300 dark:text-slate-700" />
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 font-bold text-xl">
                                Aguardando bipagem...
                            </p>
                            <p className="text-slate-400 dark:text-slate-600 text-sm mt-2">
                                Insira o código para ver o estoque e local.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

            </main>

            <ManualAddModal
                isOpen={isManualAddOpen}
                onClose={() => setIsManualAddOpen(false)}
                stock={stock}
                onAdd={handleManualSearch}
                mode="search"
            />
        </div>
    );
};
