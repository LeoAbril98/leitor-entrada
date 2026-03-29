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

                {/* 1. MELHORIA NA BUSCA: Adicionado botão X para limpar */}
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
                            // 2. MELHORIA DE NEGÓCIO: Calcula o volume individual para mostrar no card
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
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className={cn(
                                                "font-bold truncate",
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

                                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                                            {/* 3. MELHORIA VISUAL: Ícones ficam vermelhos se o item não existir na base */}
                                            <div className={cn("flex items-center gap-1 text-xs", !item.found ? "text-red-500 dark:text-red-400" : "text-slate-500 dark:text-slate-400")}>
                                                <Barcode className="w-3 h-3" />
                                                <span className="font-mono font-medium">{item.codigo}</span>
                                            </div>
                                            <div className={cn("flex items-center gap-1 text-xs", !item.found ? "text-red-500 dark:text-red-400" : "text-slate-500 dark:text-slate-400")}>
                                                <MapPin className="w-3 h-3" />
                                                <span className="font-medium">{item.local}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Módulo de Quantidade + Volumes + Lixeira */}
                                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 pt-3 sm:pt-0 mt-1 sm:mt-0 w-full sm:w-auto">

                                        <div className="flex items-center gap-4">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-0.5">Lido</span>
                                                <div className="flex items-center gap-1.5">
                                                    <Hash className={cn("w-4 h-4", !item.found ? "text-red-400" : "text-indigo-500 dark:text-indigo-400")} />
                                                    <span className={cn("text-2xl font-mono font-black", !item.found ? "text-red-950 dark:text-red-400" : "text-slate-800 dark:text-slate-100")}>
                                                        {item.quantidade}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Badge de Volume (Caixas) */}
                                            <div className="flex flex-col items-start sm:items-end justify-center">
                                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-0.5 hidden sm:block">Volumes</span>
                                                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
                                                    <Box className="w-3.5 h-3.5" />
                                                    {itemVolumes} {itemVolumes === 1 ? 'cx' : 'cxs'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 sm:gap-4">
                                            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>

                                            {/* Botões rápidos de Quantidade */}
                                            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
                                                <button
                                                    onClick={() => onEditQuantity(item.codigo, item.quantidade - 1, false)}
                                                    className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                                    title="Diminuir"
                                                >
                                                    <Minus className="w-4 h-4" />
                                                </button>
                                                <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                                                <button
                                                    onClick={() => onEditQuantity(item.codigo, item.quantidade + 1, false)}
                                                    className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                                    title="Aumentar"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <button
                                                onClick={() => onEditQuantity(item.codigo, item.quantidade, true)}
                                                className="p-2 text-indigo-400 dark:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-colors shrink-0"
                                                title="Digitar quantidade"
                                            >
                                                <Pencil className="w-5 h-5" />
                                            </button>

                                            <button
                                                onClick={() => onRemoveGroup(item.codigo)}
                                                className="p-2 text-red-400 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-colors shrink-0"
                                                title="Remover item da contagem"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
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
