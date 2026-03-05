import React, { useEffect, useState } from 'react';
import { ArrowLeft, RotateCcw, Trash2, Download, Moon, Sun } from 'lucide-react';
import { Origin } from '../types';

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
    onBackToMenu
}: HeaderProps) {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return document.documentElement.classList.contains('dark');
        }
        return false;
    });

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDarkMode]);

    const toggleTheme = () => setIsDarkMode(!isDarkMode);

    return (
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 shadow-sm transition-colors">
            <div className="max-w-5xl mx-auto px-4 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                    <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                        <button
                            onClick={onReset}
                            className="p-2 shrink-0 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500 dark:text-slate-400"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div className="min-w-0 flex-1">
                            <h2 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Origem</h2>
                            <div className="flex items-center gap-2 min-w-0">
                                <p className="text-xl font-bold text-slate-800 dark:text-slate-100 shrink-0">{origin}</p>
                                {origin === 'DEVOLUÇÃO' && client && (
                                    <>
                                        <span className="text-slate-300 dark:text-slate-600 shrink-0">/</span>
                                        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-800/50 truncate">
                                            {client}
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto justify-end mt-4 sm:mt-0">
                        <button
                            onClick={onBackToMenu}
                            className="p-2 shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm font-bold flex items-center justify-center gap-2"
                            title="Voltar ao Menu"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span className="hidden sm:inline">Menu</span>
                        </button>
                        <div className="flex gap-2">
                            <button
                                onClick={toggleTheme}
                                className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                title="Alternar Tema"
                            >
                                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                            </button>
                            <button
                                onClick={onUndo}
                                disabled={readingsCount === 0}
                                className="p-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/50 disabled:opacity-50 transition-colors"
                                title="Desfazer última"
                            >
                                <RotateCcw className="w-6 h-6" />
                            </button>
                            <button
                                onClick={onClear}
                                disabled={readingsCount === 0}
                                className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors"
                                title="Limpar tudo"
                            >
                                <Trash2 className="w-6 h-6" />
                            </button>
                            <button
                                onClick={onExport}
                                disabled={readingsCount === 0}
                                className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/50 disabled:opacity-50 transition-colors"
                                title="Exportar Excel e Imagem"
                            >
                                <Download className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mt-6">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Total Leituras</span>
                        <span className="text-2xl font-mono font-bold text-indigo-600 dark:text-indigo-400">{readingsCount}</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Cód. Únicos</span>
                        <span className="text-2xl font-mono font-bold text-indigo-600 dark:text-indigo-400">{uniqueCount}</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Volumes</span>
                        <span className="text-2xl font-mono font-bold text-indigo-600 dark:text-indigo-400">{totalVolumes}</span>
                    </div>
                    <div className="bg-indigo-600 dark:bg-indigo-500 p-3 rounded-2xl shadow-md shadow-indigo-100 dark:shadow-none min-w-0">
                        <span className="text-[10px] font-bold text-indigo-200 dark:text-indigo-100 uppercase block mb-1">Último Lido</span>
                        <span className="text-lg font-mono font-bold text-white truncate block">{lastReading}</span>
                    </div>
                </div>
            </div>
        </header>
    );
}
