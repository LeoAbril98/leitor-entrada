import React from 'react';
import { motion } from 'motion/react';
import { ClipboardList, LayoutGrid, ArrowLeft, LogOut, Settings2, Clock, CheckCircle2, History as HistoryIcon } from 'lucide-react';

interface AdminDashboardProps {
    onSelectModule: (module: 'pendencies' | 'complete') => void;
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

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Option 1: Pendência Atual */}
                    <motion.button
                        whileHover={{ y: -8 }}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => onSelectModule('pendencies')}
                        className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 md:p-12 text-left transition-all hover:border-indigo-500 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden"
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

                    {/* Option 2: Gerar Pendência Completo (EM BREVE) */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="group relative bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 rounded-[2.5rem] p-8 md:p-12 text-left grayscale opacity-70 cursor-not-allowed overflow-hidden"
                    >
                        <div className="absolute top-4 right-8 bg-amber-500 text-white text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full shadow-lg">
                            Em Breve
                        </div>

                        <div className="w-20 h-20 bg-slate-200 dark:bg-slate-800 text-slate-400 rounded-3xl flex items-center justify-center mb-8">
                            <LayoutGrid className="w-10 h-10" />
                        </div>

                        <div>
                            <h2 className="text-3xl font-black text-slate-400 dark:text-slate-500 mb-4">
                                Pendência Completo
                            </h2>
                            <p className="text-slate-400 dark:text-slate-600 text-lg leading-relaxed">
                                Futura ferramenta para gerar relatórios consolidados de múltiplas fábricas e períodos de forma automatizada.
                            </p>
                            
                            <div className="mt-8 flex items-center gap-2 text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                                <Settings2 className="w-4 h-4 animate-spin-slow" /> Módulo em desenvolvimento
                            </div>
                        </div>
                    </motion.div>
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
