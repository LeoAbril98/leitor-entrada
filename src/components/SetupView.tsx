import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { Toaster, toast } from 'react-hot-toast';
import { Barcode, CheckCircle2, Plus, FileSpreadsheet, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../utils';
import { ORIGINS } from '../constants';
import { Origin, StockItem } from '../types';

interface SetupViewProps {
    origin: Origin | null;
    setOrigin: (origin: Origin) => void;
    client: string;
    setClient: (client: string) => void;
    onStartCounting: () => void;
    defaultStockCount: number;
}

export function SetupView({
    origin,
    setOrigin,
    client,
    setClient,
    onStartCounting,
    defaultStockCount,
}: SetupViewProps) {

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 transition-colors">
            <Toaster position="top-center" />
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none p-8 border border-slate-100 dark:border-slate-800"
            >
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-indigo-600 dark:bg-indigo-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-200 dark:shadow-none">
                        <Barcode className="text-white w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Nova Contagem</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Selecione a origem para iniciar</p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                    {ORIGINS.map((opt) => (
                        <button
                            key={opt}
                            onClick={() => setOrigin(opt)}
                            className={cn(
                                "h-24 rounded-2xl border-2 transition-all duration-200 flex flex-col items-center justify-center gap-2 font-bold text-lg",
                                origin === opt
                                    ? "border-indigo-600 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 shadow-sm"
                                    : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            )}
                        >
                            {opt}
                            {origin === opt && <CheckCircle2 className="w-5 h-5" />}
                        </button>
                    ))}
                </div>

                <div className="space-y-3">
                    {origin === 'DEVOLUÇÃO' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-4"
                        >
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Nome do Cliente</label>
                            <input
                                type="text"
                                placeholder="Digite o nome do cliente..."
                                value={client}
                                onChange={(e) => setClient(e.target.value)}
                                className="w-full h-12 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl px-4 text-slate-700 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:focus:ring-indigo-500/20 transition-all"
                            />
                        </motion.div>
                    )}

                    <button
                        onClick={onStartCounting}
                        disabled={!origin || (origin === 'DEVOLUÇÃO' && !client.trim())}
                        className="w-full h-14 bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-400 disabled:bg-indigo-300 dark:disabled:bg-indigo-800 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        Iniciar contagem
                        <Plus className="w-5 h-5" />
                    </button>

                    <div className="relative pt-2 text-center">
                        <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 mt-2 bg-slate-100 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                            🟢 Conectado ao Supabase<br />
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold">{defaultStockCount} itens</span> sincronizados em tempo real.
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}