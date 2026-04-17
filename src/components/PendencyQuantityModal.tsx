import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Minus, Plus, X } from 'lucide-react';
import { StockItem } from '../types';
import { NumericKeypad } from './NumericKeypad';
import { cn } from '../utils';

interface PendencyQuantityModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: StockItem | null;
    factory: string;
    photoUrl?: string;
    stockQty: number;
    pendencyQty: number;
    currentQty: number;
    onConfirm: (newQty: number) => void;
}

export function PendencyQuantityModal({ isOpen, onClose, item, factory, photoUrl, stockQty, pendencyQty, currentQty, onConfirm }: PendencyQuantityModalProps) {
    const [quantity, setQuantity] = useState(0);

    useEffect(() => {
        if (isOpen) {
            setQuantity(currentQty);
        }
    }, [isOpen, currentQty]);

    if (!isOpen || !item) return null;

    const increaseQty = () => setQuantity(prev => prev + 1);
    const decreaseQty = () => setQuantity(prev => (prev > 0 ? prev - 1 : 0));

    const handleKeyPress = (digit: string) => {
        setQuantity(prev => {
            const currentStr = String(prev);
            if (currentStr.length >= 4) return prev;
            const newStr = prev === 0 ? digit : currentStr + digit;
            return parseInt(newStr, 10) || 0;
        });
    };

    const handleBackspace = () => {
        setQuantity(prev => {
            const currentStr = String(prev);
            if (currentStr.length <= 1) return 0;
            return parseInt(currentStr.slice(0, -1), 10) || 0;
        });
    };

    const handleClear = () => setQuantity(0);

    const handleConfirm = () => {
        onConfirm(quantity);
        onClose();
    };

    const getFactoryDetails = (fac: string) => {
        switch (fac) {
            case 'MK':
                return { state: 'PR', name: 'Paraná', flag: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Bandeira_do_Paran%C3%A1.svg' };
            case 'MOLERI':
                return { state: 'SC', name: 'Santa Catarina', flag: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Bandeira_de_Santa_Catarina.svg' };
            case 'CM':
                return { state: 'SP', name: 'São Paulo', flag: 'https://upload.wikimedia.org/wikipedia/commons/2/2b/Bandeira_do_estado_de_S%C3%A3o_Paulo.svg' };
            case 'OLIMPO':
                return { state: 'RS', name: 'Rio Grande do Sul', flag: 'https://upload.wikimedia.org/wikipedia/commons/6/63/Bandeira_do_Rio_Grande_do_Sul.svg' };
            default:
                return { state: '', name: '', flag: '' };
        }
    };

    const details = getFactoryDetails(factory);

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pb-20 sm:pb-6">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="relative w-full max-w-lg md:max-w-4xl bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl flex flex-col overflow-hidden transition-all duration-300"
                >
                    {/* Banner de Topo - Compacto e Elegante */}
                    <div className="bg-amber-500 p-4 flex items-center justify-between text-white shadow-md relative z-20">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg border border-white/30 bg-white">
                                <img src={details.flag} alt={`Bandeira ${details.name}`} className="w-full h-full object-cover" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-tighter leading-none">
                                    {factory}
                                </h2>
                                <p className="text-[10px] font-bold opacity-90 uppercase tracking-widest leading-none mt-1">{details.name}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-all active:scale-90"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex flex-col md:flex-row">
                        {/* LADO ESQUERDO: FOTO E INFO */}
                        <div className="w-full md:w-[45%] flex flex-col items-center bg-slate-50 dark:bg-slate-950/20 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800">
                            {/* Imagem da Roda */}
                            <div className="flex items-center justify-center p-6 relative">
                                <motion.img 
                                    layoutId={`photo-${item.codigo}`}
                                    src={photoUrl || "https://placehold.co/400x400/e2e8f0/64748b?text=FOTO"} 
                                    alt={`Foto ${item.codigo}`} 
                                    className="w-40 h-40 md:w-64 md:h-64 object-contain rounded-full bg-white shadow-xl border-4 border-white dark:border-slate-800"
                                />
                            </div>

                            <div className="p-6 pt-0 w-full flex flex-col gap-4">
                                <div className="bg-white dark:bg-slate-800/40 p-5 rounded-3xl border border-slate-200 dark:border-slate-700/50 text-center shadow-sm">
                                    <h3 className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-100 leading-tight mb-4">
                                        {item.descricao}
                                    </h3>
                                    
                                    <div className="flex items-center justify-center gap-4">
                                        <div className="flex flex-col items-center bg-slate-50 dark:bg-slate-900 px-4 py-2 rounded-2xl border border-slate-100 dark:border-slate-800 w-28">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Estoque</span>
                                            <span className="text-lg font-bold text-slate-700 dark:text-slate-200">{stockQty}</span>
                                        </div>
                                        <div className="flex flex-col items-center bg-slate-50 dark:bg-slate-900 px-4 py-2 rounded-2xl border border-slate-100 dark:border-slate-800 w-28">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pendência</span>
                                            <span className="text-lg font-bold text-slate-700 dark:text-slate-200">{pendencyQty}</span>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                        <span className="font-mono text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">CÓDIGO: {item.codigo}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* LADO DIREITO: CONTROLES E TECLADO */}
                        <div className="w-full md:w-[55%] p-6 flex flex-col gap-6 bg-white dark:bg-slate-900">
                            <div className="flex flex-col items-center gap-4">
                                <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Quantidade do Pedido</span>
                                
                                <div className="flex items-center gap-6">
                                    <button
                                        type="button"
                                        onClick={decreaseQty}
                                        className="w-14 h-14 flex items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-400 dark:hover:border-amber-500/50 active:scale-95 transition-all"
                                    >
                                        <Minus className="w-6 h-6" />
                                    </button>

                                    <div className="w-32 h-20 flex items-center justify-center bg-white dark:bg-slate-900 border-4 border-amber-500/20 dark:border-amber-500/10 rounded-3xl shadow-inner group">
                                        <span className={cn(
                                            "text-5xl font-black transition-all",
                                            quantity === 0 ? "text-slate-300 dark:text-slate-700" : "text-amber-600 dark:text-amber-400"
                                        )}>
                                            {quantity}
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={increaseQty}
                                        className="w-14 h-14 flex items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-400 dark:hover:border-amber-500/50 active:scale-95 transition-all"
                                    >
                                        <Plus className="w-6 h-6" />
                                    </button>
                                </div>

                                {/* Quick Adds */}
                                <div className="flex gap-2 w-full max-w-xs transition-all">
                                    <button 
                                        type="button"
                                        onClick={() => setQuantity(prev => prev + 4)} 
                                        className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-black border-2 border-transparent hover:border-slate-300 dark:hover:border-slate-600 transition-all active:scale-95"
                                    >
                                        +4
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setQuantity(prev => prev + 12)} 
                                        className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-black border-2 border-transparent hover:border-slate-300 dark:hover:border-slate-600 transition-all active:scale-95"
                                    >
                                        +12
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setQuantity(prev => prev + 100)} 
                                        className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-black border-2 border-transparent hover:border-slate-300 dark:hover:border-slate-600 transition-all active:scale-95"
                                    >
                                        +100
                                    </button>
                                </div>
                            </div>

                            {/* Teclado Numérico customizado para Tablet/Mobile */}
                            <div className="w-full max-w-xs mx-auto">
                                <NumericKeypad 
                                    onPress={handleKeyPress}
                                    onBackspace={handleBackspace}
                                    onClear={handleClear}
                                />
                            </div>

                            <button
                                type="button"
                                onClick={handleConfirm}
                                className="w-full h-16 mt-2 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-base shadow-xl shadow-amber-200 dark:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-wider"
                            >
                                CONFIRMAR PEDIDO
                                <Check className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
