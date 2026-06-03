import React from 'react';
import { motion } from 'motion/react';
import { ClipboardList, LayoutGrid, ArrowLeft, LogOut, Settings2, Clock, CheckCircle2, History as HistoryIcon } from 'lucide-react';

interface AdminDashboardProps {
    onSelectModule: (module: 'pendencies' | 'complete' | 'settings') => void;
    onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onSelectModule, onLogout }) => {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Settings2 className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                Painel Administrativo
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 font-medium tracking-tight">
                                Bem-vindo, Administrador! Gerencie os processos da expedição.
                            </p>
                        </div>
                    </div>

                    <button 
                        onClick={onLogout}
                        className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-600 dark:text-slate-300 font-bold hover:text-red-500 hover:border-red-200 transition-all shadow-sm active:scale-95 self-start md:self-center"
                    >
                        <LogOut className="w-4 h-4" />
                        Sair do Painel
                    </button>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Coluna 1: Pendência Atual e Configurações */}
                    <div className="flex flex-col gap-6">
                        {/* Option 1: Pendência Atual */}
                        <motion.button
                            whileHover={{ y: -6 }}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            onClick={() => onSelectModule('pendencies')}
                            className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 md:p-12 text-left transition-all hover:border-indigo-500 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden flex-1"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[60px] -mr-16 -mt-16" />
                            
                            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                                <ClipboardList className="w-10 h-10" />
                            </div>

                            <div className="relative">
                                <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-4 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                    Pendência Atual
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 text-lg leading-relaxed mb-8">
                                    Acesse a tabela de pendências da semana, importe novos dados, exporte relatórios e controle as anotações.
                                </p>
                                
                                <div className="flex items-center gap-4 py-4 px-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-black uppercase tracking-widest">
                                        <CheckCircle2 className="w-4 h-4" /> Ativo
                                    </div>
                                    <div className="w-px h-4 bg-slate-300 dark:bg-slate-700" />
                                    <div className="flex items-center gap-2 text-slate-500 text-sm font-bold">
                                        <Clock className="w-4 h-4" /> Pronto para uso
                                    </div>
                                </div>
                            </div>
                        </motion.button>

                        {/* Option 2: Configurações (Abaixo da Pendência Atual) */}
                        <motion.button
                            whileHover={{ y: -4 }}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            onClick={() => onSelectModule('settings')}
                            className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 text-left transition-all hover:border-indigo-500 shadow-lg shadow-slate-200/30 dark:shadow-none overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-[40px] -mr-12 -mt-12" />
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                                    <Settings2 className="w-7 h-7" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                        Configurações
                                    </h3>
                                    <p className="text-slate-550 dark:text-slate-450 text-sm font-medium truncate mt-0.5">
                                        Ajuste de fotos, tags globais e mídias do catálogo.
                                    </p>
                                </div>
                                <div className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-xl shrink-0">
                                    Acessar
                                </div>
                            </div>
                        </motion.button>
                    </div>

                    {/* Coluna 2: Pendência Completo */}
                    <div className="flex flex-col">
                        <motion.button
                            whileHover={{ y: -6 }}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                            onClick={() => onSelectModule('complete')}
                            className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 md:p-12 text-left transition-all hover:border-indigo-500 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden h-full flex flex-col justify-between text-left"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[60px] -mr-16 -mt-16" />
                            
                            <div className="absolute top-4 right-8 bg-indigo-650 text-white text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full shadow-lg">
                                Em Breve
                            </div>

                            <div>
                                <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                                    <LayoutGrid className="w-10 h-10" />
                                </div>

                                <div>
                                    <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-4 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                        Pendência Completo
                                    </h2>
                                    <p className="text-slate-500 dark:text-slate-400 text-lg leading-relaxed mb-8">
                                        Console consolidado para gerar relatórios de múltiplas fábricas e períodos de forma automatizada.
                                    </p>
                                </div>
                            </div>
                            
                            <div className="mt-8 flex items-center gap-2 text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                                <Settings2 className="w-4 h-4 animate-spin-slow" /> Módulo em desenvolvimento
                            </div>
                        </motion.button>
                    </div>
                </div>

                {/* Footer Decorativo */}
                <footer className="mt-16 pt-8 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-slate-400">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                        Sistema Ativo - v2.0
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest">
                        MKR Rodas - Expedição 2026
                    </div>
                </footer>
            </div>
        </div>
    );
};
