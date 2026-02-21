import React from 'react';
import { ArrowLeft, RotateCcw, Trash2, Download } from 'lucide-react';
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
    lastReading
}: HeaderProps) {
    return (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
            <div className="max-w-5xl mx-auto px-4 py-4">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onReset}
                            className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div>
                            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Origem</h2>
                            <div className="flex items-center gap-2">
                                <p className="text-xl font-bold text-slate-800">{origin}</p>
                                {origin === 'DEVOLUÇÃO' && client && (
                                    <>
                                        <span className="text-slate-300">/</span>
                                        <p className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                                            {client}
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onUndo}
                            disabled={readingsCount === 0}
                            className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 disabled:opacity-50 transition-colors"
                            title="Desfazer última"
                        >
                            <RotateCcw className="w-6 h-6" />
                        </button>
                        <button
                            onClick={onClear}
                            disabled={readingsCount === 0}
                            className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 disabled:opacity-50 transition-colors"
                            title="Limpar tudo"
                        >
                            <Trash2 className="w-6 h-6" />
                        </button>
                        <button
                            onClick={onExport}
                            disabled={readingsCount === 0}
                            className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                            title="Exportar Excel e Imagem"
                        >
                            <Download className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Total Leituras</span>
                        <span className="text-2xl font-mono font-bold text-indigo-600">{readingsCount}</span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Cód. Únicos</span>
                        <span className="text-2xl font-mono font-bold text-indigo-600">{uniqueCount}</span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Volumes</span>
                        <span className="text-2xl font-mono font-bold text-indigo-600">{totalVolumes}</span>
                    </div>
                    <div className="bg-indigo-600 p-3 rounded-2xl shadow-md shadow-indigo-100">
                        <span className="text-[10px] font-bold text-indigo-200 uppercase block mb-1">Último Lido</span>
                        <span className="text-lg font-mono font-bold text-white truncate block">{lastReading}</span>
                    </div>
                </div>
            </div>
        </header>
    );
}
