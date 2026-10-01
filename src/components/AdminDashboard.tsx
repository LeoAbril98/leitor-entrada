import React from 'react';
import { motion } from 'motion/react';
import { LayoutGrid, LogOut, Settings2, Clock, CheckCircle2, Truck, FileSpreadsheet, Plus } from 'lucide-react';

interface AdminDashboardProps {
    onSelectModule: (module: 'pendencies' | 'complete' | 'settings' | 'romaneio') => void;
    onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onSelectModule, onLogout }) => {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Settings2 className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                Painel Administrativo
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 font-medium tracking-tight">
                                Bem-vindo, Administrador! Gerencie os processos e cargas da expedição.
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Option 1: Romaneio de Carga (NOVO) */}
                    <motion.button
                        whileHover={{ y: -6 }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => onSelectModule('romaneio')}
                        className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.2rem] p-7 md:p-8 text-left transition-all hover:border-rose-500 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden h-full flex flex-col justify-between"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 blur-[50px] -mr-16 -mt-16" />
                        
                        <div>
                            <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm">
                                <Truck className="w-8 h-8" />
                            </div>

                            <div>
                                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-3 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                                    Romaneios de Carga
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
                                    Adicione arquivos Excel (.xlsx) para extrair códigos e quantidades, criando as tabelas de conferência que aparecem na Home.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 py-3 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 text-xs font-black uppercase tracking-wider">
                                <FileSpreadsheet className="w-3.5 h-3.5" /> Importar Excel
                            </div>
                            <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />
                            <div className="text-slate-400 text-xs font-bold">
                                Home Integrada
                            </div>
                        </div>
                    </motion.button>

                    {/* Option 2: Pendência Completo (Módulo Principal) */}
                    <motion.button
                        whileHover={{ y: -6 }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        onClick={() => onSelectModule('complete')}
                        className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.2rem] p-7 md:p-8 text-left transition-all hover:border-indigo-500 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden h-full flex flex-col justify-between"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[50px] -mr-16 -mt-16" />
                        
                        <div>
                            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm">
                                <LayoutGrid className="w-8 h-8" />
                            </div>

                            <div>
                                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                    Pendência Completo
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
                                    Console consolidado para gerenciar saldos das 4 fábricas, relatórios, vínculos de códigos e ordens de produção.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 py-3 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase tracking-wider">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
                            </div>
                            <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />
                            <div className="flex items-center gap-1 text-slate-400 text-xs font-bold">
                                <Clock className="w-3.5 h-3.5" /> Principal
                            </div>
                        </div>
                    </motion.button>

                    {/* Option 3: Configurações */}
                    <motion.button
                        whileHover={{ y: -6 }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        onClick={() => onSelectModule('settings')}
                        className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.2rem] p-7 md:p-8 text-left transition-all hover:border-indigo-500 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden h-full flex flex-col justify-between"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[50px] -mr-16 -mt-16" />
                        
                        <div>
                            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm">
                                <Settings2 className="w-8 h-8" />
                            </div>

                            <div>
                                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                    Configurações
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
                                    Ajuste de fotos do modelo/acabamento, cadastro de etiquetas (tags) globais e mídias do catálogo.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 py-3 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-wider">
                                Acessar Módulo
                            </div>
                        </div>
                    </motion.button>
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
