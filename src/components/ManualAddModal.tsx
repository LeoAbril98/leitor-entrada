import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, Minus, X, PackageOpen, Check, Hash, Star, Clock, RefreshCcw } from 'lucide-react';
import { StockItem } from '../types';
import { cn } from '../utils';
import { getWheelPhotoUrl } from '../utils/photoUtils';

interface ManualAddModalProps {
    isOpen: boolean;
    onClose: () => void;
    stock: StockItem[];
    onAdd: (codigo: string, quantity: number) => void;
    mode?: 'add' | 'search';
}

export function ManualAddModal({ isOpen, onClose, stock, onAdd, mode = 'add' }: ManualAddModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [recents, setRecents] = useState<StockItem[]>([]);

    const searchInputRef = useRef<HTMLInputElement>(null);

    // Carregar itens recentes
    useEffect(() => {
        const saved = localStorage.getItem(`@MK_MANUAL_ADDS_RECENTS_${mode}`);
        if (saved) {
            try {
                setRecents(JSON.parse(saved));
            } catch (e) {
                console.error('Falha ao carregar recentes');
            }
        }
    }, [isOpen, mode]);

    // Reset state when opened
    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setSelectedItem(null);
            setQuantity(1);
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    }, [isOpen]);

    const filteredStock = useMemo(() => {
        if (!searchTerm.trim()) return [];

        const terms = searchTerm
            .toLowerCase()
            .replace(/[,.]/g, '')
            .split(/\s+/)
            .filter(Boolean);

        return stock.filter(item => {
            const codeClean = (item.codigo || '').toLowerCase().replace(/[,.]/g, '');
            const descClean = (item.descricao || '').toLowerCase().replace(/[,.]/g, '');
            const searchSource = `${codeClean} ${descClean}`;
            return terms.every(t => searchSource.includes(t));
        }).slice(0, 50);
    }, [searchTerm, stock]);

    const handleConfirm = (item: StockItem, qty: number) => {
        onAdd(item.codigo, qty);
        
        // Salvar nos recentes
        setRecents(prev => {
            const filtered = prev.filter(r => r.codigo !== item.codigo);
            const updated = [item, ...filtered].slice(0, 6);
            localStorage.setItem(`@MK_MANUAL_ADDS_RECENTS_${mode}`, JSON.stringify(updated));
            return updated;
        });

        onClose();
    };

    const handleItemClick = (item: StockItem) => {
        if (mode === 'search') {
            handleConfirm(item, 1);
        } else {
            setSelectedItem(item);
        }
    };

    const increaseQty = () => setQuantity(prev => prev + 1);
    const decreaseQty = () => setQuantity(prev => (prev > 1 ? prev - 1 : 1));

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 pb-20 sm:pb-6">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 30 }}
                    className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-800"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-800/20">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
                                <Search className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-tight">
                                    {mode === 'search' ? 'Busca de Roda' : 'Adição Manual'}
                                </h2>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Encontre pelo nome ou código</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {!selectedItem && (
                            <>
                                <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 pb-2">
                                    <div className="relative group">
                                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                            <Search className="w-6 h-6" />
                                        </div>
                                        <input
                                            ref={searchInputRef}
                                            type="text"
                                            placeholder="Ex: Roda Scorro, VR... ou 00123"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full h-20 bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-[24px] pl-16 pr-16 text-2xl font-bold text-slate-800 dark:text-slate-100 placeholder-slate-300 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-sm"
                                        />
                                        {searchTerm && (
                                            <button
                                                onClick={() => {
                                                    setSearchTerm('');
                                                    searchInputRef.current?.focus();
                                                }}
                                                className="absolute right-5 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-red-500 transition-colors"
                                            >
                                                <X className="w-6 h-6" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {searchTerm.trim() ? (
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center px-1">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Resultados da Busca
                                            </p>
                                            <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                                                {filteredStock.length} encontrados
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto pr-1">
                                            {filteredStock.map((item, index) => (
                                                <button
                                                    key={`${item.codigo}-${index}`}
                                                    onClick={() => handleItemClick(item)}
                                                    className="text-left w-full p-4 flex items-center gap-4 rounded-3xl border-2 border-slate-50 dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-indigo-500 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none transition-all active:scale-[0.98] group"
                                                >
                                                    <div className="w-16 h-16 shrink-0 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-700">
                                                        <img 
                                                            src={getWheelPhotoUrl(item.descricao)} 
                                                            alt={item.descricao}
                                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                            loading="lazy"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).src = "https://placehold.co/150x150/e2e8f0/64748b?text=FOTO";
                                                            }}
                                                        />
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-black text-sm text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 transition-colors mb-1">
                                                            {item.descricao}
                                                        </h3>
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[10px] font-bold text-slate-400 font-mono italic">#{item.codigo}</span>
                                                            <div className="flex items-center gap-2 text-[10px] font-black uppercase">
                                                                <span className="text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">Est: {item.quantidade}</span>
                                                                <span className="text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded">{item.local || '---'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                            {filteredStock.length === 0 && (
                                                <div className="col-span-full p-12 text-center text-slate-400 italic bg-slate-50 dark:bg-slate-800/30 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                                                    Nenhum modelo compatível encontrado.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {recents.length > 0 && (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                                    <Clock className="w-3 h-3" /> Adicionados Recentemente
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {recents.map((item) => (
                                                        <button 
                                                            key={item.codigo}
                                                            onClick={() => handleItemClick(item)}
                                                            className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-300 transition-all text-left"
                                                        >
                                                            <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                                                                <img src={getWheelPhotoUrl(item.descricao)} alt="" className="w-full h-full object-cover" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">{item.descricao}</p>
                                                                <p className="text-[9px] font-mono font-bold text-slate-400">{item.codigo}</p>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="p-12 text-center flex flex-col items-center gap-6 text-slate-400">
                                            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700">
                                                <PackageOpen className="w-10 h-10 opacity-20" />
                                            </div>
                                            <div className="space-y-2">
                                                <h3 className="text-xl font-black text-slate-800 dark:text-slate-200">Pronto para buscar?</h3>
                                                <p className="text-sm font-medium">Digite qualquer parte do nome ou código da roda para localizar no estoque.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {selectedItem && mode === 'add' && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="space-y-8 py-4"
                            >
                                <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-100 dark:border-indigo-800/50 rounded-[32px] flex items-center gap-6">
                                    <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-white dark:border-slate-800 shadow-xl shrink-0">
                                        <img 
                                            src={getWheelPhotoUrl(selectedItem.descricao)} 
                                            alt={selectedItem.descricao}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Item Selecionado</p>
                                        <h3 className="font-black text-slate-800 dark:text-slate-100 text-2xl leading-tight truncate">
                                            {selectedItem.descricao}
                                        </h3>
                                        <p className="font-mono font-bold text-slate-500 mt-1">#{selectedItem.codigo}</p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedItem(null)}
                                        className="p-3 bg-white dark:bg-slate-800 text-indigo-600 rounded-2xl shadow-sm border border-indigo-100 transition-all hover:bg-indigo-50"
                                    >
                                        <RefreshCcw className="w-6 h-6" />
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    <div className="text-center space-y-2">
                                        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Informar Quantidade</p>
                                        <div className="flex items-center justify-center gap-8 py-6">
                                            <button
                                                onClick={decreaseQty}
                                                className="w-20 h-20 flex items-center justify-center rounded-[28px] bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-indigo-600 hover:border-indigo-500 transition-all active:scale-90 shadow-sm"
                                            >
                                                <Minus className="w-10 h-10" />
                                            </button>
                                            <div className="w-32 h-28 flex items-center justify-center bg-slate-50 dark:bg-slate-950 rounded-[40px] border-4 border-white dark:border-slate-800 shadow-inner">
                                                <span className="text-6xl font-black text-slate-800 dark:text-slate-100 tracking-tighter">{quantity}</span>
                                            </div>
                                            <button
                                                onClick={increaseQty}
                                                className="w-20 h-20 flex items-center justify-center rounded-[28px] bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-indigo-600 hover:border-indigo-500 transition-all active:scale-90 shadow-sm"
                                            >
                                                <Plus className="w-10 h-10" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Quick Adds */}
                                    <div className="grid grid-cols-3 gap-3">
                                        {[4, 10, 40].map(v => (
                                            <button 
                                                key={v}
                                                onClick={() => setQuantity(prev => prev + v)}
                                                className="py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black hover:bg-indigo-600 hover:text-white transition-all active:scale-95"
                                            >
                                                +{v}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleConfirm(selectedItem, quantity)}
                                    className="w-full h-20 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[28px] font-black text-xl shadow-2xl shadow-indigo-200 dark:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                                >
                                    CONFIRMAR ADIÇÃO
                                    <Check className="w-8 h-8" />
                                </button>
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
