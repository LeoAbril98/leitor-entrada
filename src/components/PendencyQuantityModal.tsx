import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Minus, Plus, PackageOpen, X, Hash } from 'lucide-react';
import { StockItem } from '../types';

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
                    className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl flex flex-col overflow-hidden"
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

                    {/* Imagem da Roda (Tamanho Equilibrado) */}
                    <div className="bg-slate-50 dark:bg-slate-950/20 flex items-center justify-center p-6 border-b border-slate-100 dark:border-slate-800 relative">
                        <motion.img 
                            layoutId={`photo-${item.codigo}`}
                            src={photoUrl || "https://placehold.co/400x400/e2e8f0/64748b?text=FOTO"} 
                            alt={`Foto ${item.codigo}`} 
                            className="w-48 h-48 object-contain rounded-full bg-white shadow-xl border-4 border-white dark:border-slate-800"
                        />
                    </div>
                    <div className="p-6 flex flex-col gap-5">
                        <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 text-center shadow-inner">
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 leading-tight mb-3">
                                {item.descricao}
                            </h3>
                            
                            {/* Indicadores de Inventário */}
                            <div className="flex items-center justify-center gap-4">
                                <div className="flex flex-col items-center bg-white dark:bg-slate-900 px-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 w-24">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Estoque</span>
                                    <span className="text-base font-bold text-slate-700 dark:text-slate-200">{stockQty}</span>
                                </div>
                                <div className="flex flex-col items-center bg-white dark:bg-slate-900 px-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 w-24">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pendência</span>
                                    <span className="text-base font-bold text-slate-700 dark:text-slate-200">{pendencyQty}</span>
                                </div>
                            </div>
                        </div>

                    <div className="flex flex-col items-center gap-4">
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Quantidade do Pedido:</p>
                        
                        <div className="flex items-center gap-6">
                            <button
                                onClick={decreaseQty}
                                className="w-14 h-14 flex items-center justify-center rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 active:scale-95 transition-all"
                            >
                                <Minus className="w-6 h-6" />
                            </button>

                            <input
                                type="number"
                                value={quantity}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                                className="w-24 h-20 text-center text-4xl font-black text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-3xl outline-none focus:ring-2 focus:ring-amber-500/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />

                            <button
                                onClick={increaseQty}
                                className="w-14 h-14 flex items-center justify-center rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 active:scale-95 transition-all"
                            >
                                <Plus className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Quick Adds */}
                        <div className="flex gap-2 w-full mt-2">
                            <button onClick={() => setQuantity(prev => prev + 4)} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">+4</button>
                            <button onClick={() => setQuantity(prev => prev + 12)} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">+12</button>
                            <button onClick={() => setQuantity(prev => prev + 100)} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">+100</button>
                        </div>
                    </div>

                        <button
                            onClick={handleConfirm}
                            className="w-full h-14 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-sm shadow-lg shadow-amber-200/50 dark:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            CONFIRMAR PEDIDO
                            <Check className="w-5 h-5" />
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
