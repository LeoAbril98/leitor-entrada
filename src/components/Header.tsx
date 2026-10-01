import React from 'react';
import { ArrowLeft, RotateCcw, Trash2, Download, RefreshCcw } from 'lucide-react';
import { Origin } from '../types';
import { cn } from '../utils';

interface HeaderProps {
    origin: Origin | null;
    client?: string;
    onReset: () => void;
    onUndo: () => void;
    onClear: () => void;
    onExport: () => void;
    readingsCount: number;
    uniqueCount: number;
    totalVolumes: number;
    lastReading: string;
    onBackToMenu: () => void;
    onSync?: () => void;
    isSyncing?: boolean;
}

export function Header({
    origin,
    client,
    onReset,
    onUndo,
    onClear,
    onExport,
    readingsCount,
    uniqueCount,
    totalVolumes,
    lastReading,
    onBackToMenu,
    onSync,
    isSyncing
}: HeaderProps) {
    return (
        <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 shadow-sm transition-colors">
            <div className="max-w-5xl mx-auto px-4 py-2.5 sm:py-3.5">
                {/* Linha única: Origem na esquerda e Ações na direita (sem quebra de linha no mobile) */}
                <div className="flex items-center justify-between gap-2.5 mb-2.5 sm:mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <button
                            onClick={onReset}
                            className="p-1.5 shrink-0 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500 dark:text-slate-400 active:scale-95"
                            title="Trocar Origem"
                        >
                            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>
                        <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] sm:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                Origem:
                            </span>
                            <span className="text-base sm:text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight shrink-0">
                                {origin}
                            </span>
                            {origin === 'DEVOLUÇÃO' && client && (
                                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-800/50 truncate max-w-[120px] sm:max-w-none">
                                    {client}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {/* Botão Voltar ao Menu visível apenas no desktop (no mobile está na navbar inferior) */}
                        <button
                            onClick={onBackToMenu}
                            className="hidden md:flex p-2 shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm font-bold items-center justify-center gap-2 text-xs"
                            title="Voltar ao Menu"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Menu</span>
                        </button>

                        {/* Desfazer: visível no desktop (no mobile fica na barra inferior) */}
                        <button
                            onClick={onUndo}
                            disabled={readingsCount === 0}
                            className="hidden md:flex p-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/50 disabled:opacity-50 transition-colors"
                            title="Desfazer última leitura"
                        >
                            <RotateCcw className="w-5 h-5" />
                        </button>

                        {/* Exportar: visível no desktop (no mobile fica na barra inferior) */}
                        <button
                            onClick={onExport}
                            disabled={readingsCount === 0}
                            className="hidden md:flex p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/50 disabled:opacity-50 transition-colors"
                            title="Exportar Excel e Imagem"
                        >
                            <Download className="w-5 h-5" />
                        </button>

                        {/* Limpar contagem: visível sempre */}
                        <button
                            onClick={onClear}
                            disabled={readingsCount === 0}
                            className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors active:scale-95 shadow-sm"
                            title="Limpar toda a contagem"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>

                        {onSync && (
                            <button
                                onClick={onSync}
                                className={cn(
                                    "p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all active:scale-95 shadow-sm",
                                    isSyncing && "animate-spin"
                                )}
                                title="Sincronizar com a Nuvem"
                            >
                                <RefreshCcw className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Dashboard Strip de Métricas: 3 colunas amplas + Linha de Último Lido */}
                <div className="bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-sm">
                    {/* 3 Métricas com espaçamento generoso */}
                    <div className="grid grid-cols-3 divide-x divide-slate-200/80 dark:divide-slate-700/60 text-center pb-2">
                        <div className="px-1 sm:px-2">
                            <span className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider block mb-0.5">
                                Leituras
                            </span>
                            <span className="text-xl sm:text-2xl font-mono font-black text-indigo-600 dark:text-indigo-400 leading-none">
                                {readingsCount}
                            </span>
                        </div>
                        <div className="px-1 sm:px-2">
                            <span className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider block mb-0.5">
                                Cód. Únicos
                            </span>
                            <span className="text-xl sm:text-2xl font-mono font-black text-slate-800 dark:text-slate-100 leading-none">
                                {uniqueCount}
                            </span>
                        </div>
                        <div className="px-1 sm:px-2">
                            <span className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider block mb-0.5">
                                Volumes
                            </span>
                            <span className="text-xl sm:text-2xl font-mono font-black text-emerald-600 dark:text-emerald-400 leading-none">
                                {totalVolumes}
                            </span>
                        </div>
                    </div>

                    {/* Faixa elegante de Último Lido com código sem corte */}
                    <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between gap-2 px-1">
                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-bold shrink-0">
                            <span className={cn(
                                "w-2 h-2 rounded-full",
                                lastReading !== '---' ? "bg-emerald-500 animate-pulse" : "bg-slate-300 dark:bg-slate-600"
                            )} />
                            <span className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold">
                                Último Lido:
                            </span>
                        </div>
                        <span className="font-mono font-black text-xs sm:text-sm text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 px-2.5 py-0.5 rounded-lg shadow-sm truncate max-w-[200px] sm:max-w-none text-right">
                            {lastReading !== '---' ? `#${lastReading}` : '---'}
                        </span>
                    </div>
                </div>
            </div>
        </header>
    );
}
