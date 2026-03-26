import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, History, Package, MapPin, Hash, Barcode, X, Box, Trash2, Plus, Minus, Pencil } from 'lucide-react';
import { cn } from '../utils';
import { GroupedReading } from '../types';

interface ResultsListProps {
    groupedData: GroupedReading[];
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    onRemoveGroup: (codigo: string) => void;
    onEditQuantity: (codigo: string, currentQty: number, promptUser?: boolean) => void;
}

export function ResultsList({ groupedData, searchTerm, setSearchTerm, onRemoveGroup, onEditQuantity }: ResultsListProps) {
    return (
        <>
            <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <History className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                    Resultado da Contagem
                </h3>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <input
                        type="text"
                        placeholder="Filtrar lista..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none w-44 sm:w-64 transition-all text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-full transition-colors"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                    {groupedData.length > 0 ? (
                        groupedData.map((item) => {
                            const textoBase = `${item.descricao} ${item.codigo}`.toUpperCase();
                            const isCaixaDupla = textoBase.includes('13X') || textoBase.includes('14X') || textoBase.includes('15X6');
                            const itemVolumes = isCaixaDupla ? Math.ceil(item.quantidade / 2) : item.quantidade;

                            return (
                                <motion.div
                                    key={item.codigo}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className={cn(
                                        "bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 transition-colors",
                                        !item.found && "border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10"
                                    )}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={cn(
                                                "font-bold text-base truncate",
                                                !item.found ? "text-red-900 dark:text-red-400" : "text-slate-900 dark:text-slate-100"
                                            )} title={item.descricao}>
                                                {item.descricao}
                                            </span>
                                            {!item.found && (
                                                <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 text-[10px] font-extrabold rounded-full uppercase flex-shrink-0 border border-red-200 dark:border-red-800/50">
                                                    Não encontrado
                                                </span>
                                            )}
                                        </div>

                                        {/* FOCO: Quantidade depois Local */}
                                        <div className="flex flex-wrap items-center gap-3">
                                            {/* 1. QUANTIDADE (DESTAQUE) */}
                                            <div className={cn(
                                                "flex items-center gap-1.5 px-3 py-1 rounded-xl", 
                                                !item.found ? "bg-red-100 text-red-700" : "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300"
                                            )}>
                                                <Hash className="w-4 h-4" />
                                                <span className="text-lg font-black font-mono leading-none">
                                                    {item.quantidade}
                                                </span>
                                            </div>

                                            {/* 2. LOCAL */}
                                            <div className={cn(
                                                "flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700",
                                                !item.found ? "text-red-500" : "text-slate-600 dark:text-slate-400"
                                            )}>
                                                <MapPin className="w-4 h-4" />
                                                <span className="text-sm font-bold uppercase tracking-wide">
                                                    {item.local}
                                                </span>
                                            </div>

                                            {/* 3. VOLUMES (INLINE) */}
                                            <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                                <Box className="w-3.5 h-3.5" />
                                                {itemVolumes} {itemVolumes === 1 ? 'cx' : 'cxs'}
                                            </div>
                                        </div>
                                        
                                        {/* Código de barras menor e discreto embaixo */}
                                        <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                                            <Barcode className="w-3 h-3" />
                                            {item.codigo}
                                        </div>
                                    </div>

                                    {/* Ações de Edição */}
                                    <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 pt-3 sm:pt-0">
                                        
                                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
                                            <button
                                                onClick={() => onEditQuantity(item.codigo, item.quantidade - 1, false)}
                                                className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all"
                                                title="Diminuir"
                                            >
                                                <Minus className="w-4 h-4" />
                                            </button>
                                            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                                            <button
                                                onClick={() => onEditQuantity(item.codigo, item.quantidade + 1, false)}
                                                className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all"
                                                title="Aumentar"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => onEditQuantity(item.codigo, item.quantidade, true)}
                                            className="p-2.5 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-colors"
                                            title="Digitar quantidade"
                                        >
                                            <Pencil className="w-5 h-5" />
                                        </button>

                                        <button
                                            onClick={() => onRemoveGroup(item.codigo)}
                                            className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors"
                                            title="Remover item"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="py-16 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800"
                        >
                            {searchTerm ? (
                                <>
                                    <Search className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-600" />
                                    <p className="font-medium">Nenhum resultado para "{searchTerm}"</p>
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="mt-3 text-sm text-indigo-500 dark:text-indigo-400 font-bold hover:text-indigo-600 dark:hover:text-indigo-300"
                                    >
                                        Limpar filtro
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Barcode className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-600" />
                                    <p className="font-medium">Aguardando primeira leitura...</p>
                                </>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
}
