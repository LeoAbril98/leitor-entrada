import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, History, Package, MapPin, Hash, Barcode, X, Box, Trash2 } from 'lucide-react';
import { cn } from '../utils';
import { GroupedReading } from '../types';

interface ResultsListProps {
    groupedData: GroupedReading[];
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    onRemoveGroup: (codigo: string) => void;
}

export function ResultsList({ groupedData, searchTerm, setSearchTerm, onRemoveGroup }: ResultsListProps) {
    return (
        <>
            <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <History className="w-5 h-5 text-indigo-500" />
                    Resultado da Contagem
                </h3>

                {/* 1. MELHORIA NA BUSCA: Adicionado botão X para limpar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Filtrar lista..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none w-44 sm:w-64 transition-all"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-colors"
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
                                        "bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-4 transition-colors",
                                        !item.found && "border-red-200 bg-red-50"
                                    )}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className={cn(
                                                "font-bold truncate",
                                                !item.found ? "text-red-900" : "text-slate-900"
                                            )} title={item.descricao}>
                                                {item.descricao}
                                            </span>
                                            {!item.found && (
                                                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-extrabold rounded-full uppercase flex-shrink-0 border border-red-200">
                                                    Não encontrado
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                                            {/* 3. MELHORIA VISUAL: Ícones ficam vermelhos se o item não existir na base */}
                                            <div className={cn("flex items-center gap-1 text-xs", !item.found ? "text-red-500" : "text-slate-500")}>
                                                <Barcode className="w-3 h-3" />
                                                <span className="font-mono font-medium">{item.codigo}</span>
                                            </div>
                                            <div className={cn("flex items-center gap-1 text-xs", !item.found ? "text-red-500" : "text-slate-500")}>
                                                <MapPin className="w-3 h-3" />
                                                <span className="font-medium">{item.local}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Módulo de Quantidade + Volumes + Lixeira */}
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Lido</span>
                                            <div className="flex items-center gap-1.5">
                                                <Hash className={cn("w-4 h-4", !item.found ? "text-red-400" : "text-indigo-500")} />
                                                <span className={cn("text-2xl font-mono font-black", !item.found ? "text-red-950" : "text-slate-800")}>
                                                    {item.quantidade}
                                                </span>
                                            </div>

                                            {/* Badge de Volume (Caixas) */}
                                            <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                                <Box className="w-3 h-3" />
                                                {itemVolumes} {itemVolumes === 1 ? 'cx' : 'cxs'}
                                            </div>
                                        </div>

                                        <div className="h-10 w-px bg-slate-200"></div>

                                        <button
                                            onClick={() => onRemoveGroup(item.codigo)}
                                            className="p-2 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors"
                                            title="Remover item da contagem"
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
                            className="py-16 flex flex-col items-center justify-center text-slate-400 bg-white rounded-3xl border-2 border-dashed border-slate-200"
                        >
                            {searchTerm ? (
                                <>
                                    <Search className="w-12 h-12 mb-3 text-slate-300" />
                                    <p className="font-medium">Nenhum resultado para "{searchTerm}"</p>
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="mt-3 text-sm text-indigo-500 font-bold hover:text-indigo-600"
                                    >
                                        Limpar filtro
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Barcode className="w-12 h-12 mb-3 text-slate-300" />
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