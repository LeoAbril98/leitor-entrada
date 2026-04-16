import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, Minus, X, PackageOpen, Check, Hash } from 'lucide-react';
import { StockItem } from '../types';
import { cn } from '../utils';

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

    const searchInputRef = useRef<HTMLInputElement>(null);

    // Reset state when opened
    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setSelectedItem(null);
            setQuantity(0);
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    }, [isOpen]);

    const filteredStock = useMemo(() => {
        if (!searchTerm.trim()) return [];

        // Ignorar vírgulas, pontos e transformar em array de palavras limpas
        const terms = searchTerm
            .toLowerCase()
            .replace(/[,.]/g, '')
            .split(/\s+/)
            .filter(Boolean);

        return stock.filter(item => {
            const codeClean = item.codigo.toLowerCase().replace(/[,.]/g, '');
            const descClean = item.descricao.toLowerCase().replace(/[,.]/g, '');
            const searchSource = `${codeClean} ${descClean}`;

            // Cada palavra pesquisada precisa estar em algum lugar da string (código OU descrição)
            return terms.every(t => searchSource.includes(t));
        }).slice(0, 50); // limit to 50 results for performance
    }, [searchTerm, stock]);

    const handleConfirm = () => {
        if (!selectedItem || quantity < 1) return;
        onAdd(selectedItem.codigo, quantity);
        onClose();
    };

    const increaseQty = () => setQuantity(prev => prev + 1);
    const decreaseQty = () => setQuantity(prev => (prev > 1 ? prev - 1 : 1));

    if (!isOpen) return null;

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
                    className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                                <PackageOpen className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                                {mode === 'search' ? 'Busca Manual' : 'Adição Manual'}
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 pb-8 space-y-6">
                        {/* Search Input */}
                        {!selectedItem && (
                            <div className="space-y-4">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder="Buscar por descrição ou código..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full h-14 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-700 rounded-2xl pl-12 pr-4 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-900 transition-all font-medium"
                                    />
                                </div>

                                {/* Results */}
                                {searchTerm.trim() && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-1 uppercase tracking-wider">
                                            Resultados ({filteredStock.length})
                                        </p>

                                        {filteredStock.length === 0 ? (
                                            <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 border-dashed">
                                                Nenhum item encontrado no estoque
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-1">
                                                {filteredStock.map((item, index) => (
                                                    <button
                                                        key={`${item.codigo}-${index}`}
                                                        onClick={() => {
                                                            if (mode === 'search') {
                                                                onAdd(item.codigo, 1);
                                                                onClose();
                                                            } else {
                                                                setSelectedItem(item);
                                                            }
                                                        }}
                                                        className="text-left w-full p-4 flex flex-col gap-2 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-md transition-all group"
                                                    >
                                                        {/* 1. Código em cima */}
                                                        <div className="flex items-center gap-1.5 font-mono text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 w-fit px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                                            <Hash className="w-3.5 h-3.5" />
                                                            {item.codigo}
                                                        </div>

                                                        {/* 2. Descrição no meio */}
                                                        <h3 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                            {item.descricao}
                                                        </h3>

                                                        {/* 3. Quantidade | Local embaixo */}
                                                        <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                                                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                                                Qtd: {item.quantidade}
                                                            </span>
                                                            <span className="text-slate-300 dark:text-slate-600">|</span>
                                                            <span>
                                                                Local: {item.local || 'N/A'}
                                                            </span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {!searchTerm.trim() && (
                                    <div className="p-8 text-center flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 border-dashed">
                                        <Search className="w-8 h-8 opacity-50" />
                                        <p>Digite para buscar um modelo<br />e {mode === 'search' ? 'localizá-lo' : 'adicionar sua quantidade'} manualmente.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Quantity Selector Section */}
                        {selectedItem && mode === 'add' && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="space-y-6"
                            >
                                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">Item Selecionado</p>
                                            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">
                                                {selectedItem.descricao}
                                            </h3>
                                            <div className="flex items-center gap-4 mt-2 text-sm text-slate-600 dark:text-slate-300">
                                                <span className="font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg shadow-sm border border-indigo-100/50 dark:border-indigo-800/30">
                                                    {selectedItem.codigo}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSelectedItem(null)}
                                            className="text-indigo-600 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900/50 p-2 rounded-xl text-sm font-semibold transition-colors"
                                        >
                                            Trocar
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col items-center gap-4 py-4">
                                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Quantos adicionar à contagem?</p>
                                    <div className="flex items-center gap-6">
                                        <button
                                            onClick={decreaseQty}
                                            className="w-14 h-14 flex items-center justify-center rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition-all"
                                        >
                                            <Minus className="w-6 h-6" />
                                        </button>

                                        <div className="w-24 h-20 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-3xl">
                                            <span className="text-4xl font-black text-slate-800 dark:text-slate-100 leading-none">
                                                {quantity}
                                            </span>
                                        </div>

                                        <button
                                            onClick={increaseQty}
                                            className="w-14 h-14 flex items-center justify-center rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition-all"
                                        >
                                            <Plus className="w-6 h-6" />
                                        </button>
                                    </div>

                                    {/* Quick Adds */}
                                    <div className="flex gap-2 w-full max-w-[200px] mt-2">
                                        <button onClick={() => setQuantity(prev => prev + 4)} className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700">+4</button>
                                        <button onClick={() => setQuantity(prev => prev + 10)} className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700">+10</button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleConfirm}
                                    className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    Confirmar Adição
                                    <Check className="w-5 h-5" />
                                </button>
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
