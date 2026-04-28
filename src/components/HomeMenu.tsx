import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ScanBarcode, MapPin, RefreshCw, ClipboardList, RotateCcw, Lock, Database, ChevronRight } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { getInventory, getLastUpdate, clearLocalInventoryCache } from '../lib/supabase';
import { cn } from '../utils';

interface HomeMenuProps {
    onSelectMode: (mode: 'counting' | 'locator' | 'pendencies' | 'update-wheels' | 'admin-login') => void;
}

export const HomeMenu: React.FC<HomeMenuProps> = ({ onSelectMode }) => {
    const [isUpdating, setIsUpdating] = useState(false);
    const [updatesToday, setUpdatesToday] = useState(0);
    const [defaultStockCount, setDefaultStockCount] = useState(0);
    const [supabaseUpdate, setSupabaseUpdate] = useState<string | null>(null);

    useEffect(() => {
        // Fetch last update from Supabase DB
        getLastUpdate().then(dateString => {
            if (dateString) {
                setSupabaseUpdate(dateString);
            }
        });
        const storedUpdates = localStorage.getItem('inventory_updates');
        if (storedUpdates) {
            try {
                const parsed = JSON.parse(storedUpdates);
                const today = new Date().toISOString().split('T')[0];
                if (parsed.date === today) {
                    setUpdatesToday(parsed.count || 0);
                }
            } catch (e) {
                console.error(e);
            }
        }

        const cached = localStorage.getItem('@MK_INVENTORY_CACHE');
        if (cached) {
            try {
                setDefaultStockCount(JSON.parse(cached).length);
            } catch (e) { }
        }
    }, []);

    const incrementUpdatesToday = () => {
        const today = new Date().toISOString().split('T')[0];
        const newCount = updatesToday + 1;
        localStorage.setItem('inventory_updates', JSON.stringify({
            date: today,
            count: newCount
        }));
        setUpdatesToday(newCount);
    };

    const handleUpdateInventory = async () => {
        let webhookUrl = import.meta.env.VITE_UPDATE_WEBHOOK_URL;

        if (updatesToday >= 2) {
            toast.error('Limite de 2 atualizações por dia atingido.');
            return;
        }

        if (!webhookUrl) {
            toast.error('URL do webhook de atualização não configurada (.env.local).');
            return;
        }

        if (!webhookUrl.endsWith('/atualizar')) {
            webhookUrl = webhookUrl.replace(/\/$/, '') + '/atualizar';
        }

        setIsUpdating(true);
        const toastId = toast.loading('Atualizando inventário do MK... Isso pode levar alguns minutos.');

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deposito: "almox",
                    headless: true
                })
            });

            if (!response.ok) {
                throw new Error('Falha ao acionar webhook. Status: ' + response.status);
            }

            incrementUpdatesToday();

            toast.success('Inventário atualizado com sucesso do MK!', { id: toastId, duration: 5000 });

            // Recarregar os dados do Supabase
            const data = await getInventory();
            if (data && data.length) {
                setDefaultStockCount(data.length);
            }
            const dateString = await getLastUpdate();
            if (dateString) {
                setSupabaseUpdate(dateString);
            }

        } catch (error) {
            console.error(error);
            toast.error('Erro ao atualizar. Verifique sua conexão e a URL do Webhook.', { id: toastId });
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors flex flex-col items-center">
            <Toaster position="top-center" />

            {/* Header Mínimo e Direto */}
            <header className="w-full max-w-[90rem] mx-auto px-6 py-2 flex justify-end items-center bg-transparent relative z-10">
                <motion.button
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    onClick={() => onSelectMode('admin-login')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 dark:bg-slate-800 border border-slate-700 text-white rounded-[1rem] shadow-lg hover:bg-slate-900 transition-all active:scale-95 text-sm font-bold group"
                >
                    <Lock className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span className="hidden sm:inline">Acesso</span> Admin
                </motion.button>
            </header>

            {/* Area Central Super Focada */}
            <main className="w-full max-w-[90rem] mx-auto px-4 md:px-6 flex-1 flex flex-col items-center justify-start pb-4">
                
                {/* Logo Gigante Centralizada */}
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-0">
                    <img
                        src="/logo 2.svg"
                        alt="MKR Rodas Exclusivas"
                        className="h-[90px] sm:h-[120px] md:h-[180px] lg:h-[220px] object-contain mix-blend-multiply dark:invert dark:mix-blend-screen"
                    />
                </motion.div>

                {/* Títulos e Sincronização centralizados */}
                <div className="flex flex-col items-center mb-4 gap-3">
                    <div className="text-center">
                        <motion.h1
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tight"
                        >
                            Expedição
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-slate-500 dark:text-slate-400 mt-1 text-base font-medium"
                        >
                            Selecione o módulo que deseja acessar hoje
                        </motion.p>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 flex flex-col sm:flex-row sm:items-center gap-4 shadow-xl shadow-slate-200/50 dark:shadow-none"
                    >
                        <div className="px-5 py-2 sm:py-0 flex flex-col justify-center">
                            <div className="flex items-center justify-center sm:justify-start gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                                <Database className="w-3 h-3 text-indigo-500" /> Sincronização Server
                            </div>
                            <div className="flex items-center justify-center sm:justify-start gap-3 text-sm text-slate-600 dark:text-slate-300 font-bold whitespace-nowrap">
                                <span><span className="text-indigo-600 dark:text-indigo-400">{defaultStockCount}</span> no banco</span>
                                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                                <span>{supabaseUpdate ? new Date(supabaseUpdate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '--/--'}</span>
                            </div>
                        </div>

                        <button
                            onClick={handleUpdateInventory}
                            disabled={isUpdating || updatesToday >= 2}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-500/20 disabled:opacity-50 transition-colors"
                        >
                            <RefreshCw className={cn("w-4 h-4", isUpdating && "animate-spin")} />
                            {isUpdating ? 'Puxando do MK...' : 'Atualizar Dados'}
                            <span className="bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-500/20 text-xs px-2 py-0.5 rounded-full ml-1 min-w-[2.5rem] text-center shadow-sm">
                                {2 - updatesToday}/2
                            </span>
                        </button>
                    </motion.div>
                </div>

                {/* Grid 4 Cards Larga (Evita Scroll Vertical no PC/Tablet) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 xl:gap-5 w-full">
                    <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        onClick={() => onSelectMode('counting')}
                        className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 xl:p-6 hover:border-indigo-600 dark:hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/10 dark:hover:shadow-none transition-all text-left flex flex-row sm:flex-col items-center sm:items-start gap-4 sm:gap-3 active:scale-95"
                    >
                        <div className="w-12 h-12 min-w-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <ScanBarcode className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-base sm:text-lg lg:text-xl font-black text-slate-800 dark:text-slate-100 mb-0.5 sm:mb-1">
                                Contagem
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-[11px] sm:text-xs md:text-sm leading-snug font-medium">
                                Realize conferências de estoque e gere exportações.
                            </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 shrink-0 ml-auto sm:hidden" />
                    </motion.button>

                    <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        onClick={() => onSelectMode('locator')}
                        className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 xl:p-6 hover:border-emerald-600 dark:hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/10 dark:hover:shadow-none transition-all text-left flex flex-row sm:flex-col items-center sm:items-start gap-4 sm:gap-3 active:scale-95"
                    >
                        <div className="w-12 h-12 min-w-12 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <MapPin className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-base sm:text-lg lg:text-xl font-black text-slate-800 dark:text-slate-100 mb-0.5 sm:mb-1">
                                Localização
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-[11px] sm:text-xs md:text-sm leading-snug font-medium">
                                Buscas rápidas para descobrir posição e quantidade instantaneamente.
                            </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 shrink-0 ml-auto sm:hidden" />
                    </motion.button>

                    <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        onClick={() => onSelectMode('pendencies')}
                        className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 xl:p-6 hover:border-amber-600 dark:hover:border-amber-500 hover:shadow-xl hover:shadow-amber-500/10 dark:hover:shadow-none transition-all text-left flex flex-row sm:flex-col items-center sm:items-start gap-4 sm:gap-3 active:scale-95"
                    >
                        <div className="w-12 h-12 min-w-12 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <ClipboardList className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-base sm:text-lg lg:text-xl font-black text-slate-800 dark:text-slate-100 mb-0.5 sm:mb-1">
                                Pendências
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-[11px] sm:text-xs md:text-sm leading-snug font-medium">
                                Gerencie pendências e crie relatórios sobre as fábricas de forma inteligente.
                            </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 shrink-0 ml-auto sm:hidden" />
                    </motion.button>

                    <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        onClick={() => onSelectMode('update-wheels')}
                        className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 xl:p-6 hover:border-violet-600 dark:hover:border-violet-500 hover:shadow-xl hover:shadow-violet-500/10 dark:hover:shadow-none transition-all text-left flex flex-row sm:flex-col items-center sm:items-start gap-4 sm:gap-3 active:scale-95"
                    >
                        <div className="w-12 h-12 min-w-12 bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <RefreshCw className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-base sm:text-lg lg:text-xl font-black text-slate-800 dark:text-slate-100 mb-0.5 sm:mb-1">
                                Atualizar Locais
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-[11px] sm:text-xs md:text-sm leading-snug font-medium">
                                Sincronize locais escaneando itens de ruas e prateleiras.
                            </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 shrink-0 ml-auto sm:hidden" />
                    </motion.button>
                </div>
            </main>

            {/* Rodapé Invisível / Ferramenta Técnica Oculta mas Acessível */}
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
                className="pb-2 mt-auto"
            >
                <button
                    onClick={() => {
                        if (window.confirm("Deseja limpar todo o cache local e recarregar o App? Isso resolve problemas de dados misturados entre tabelas.")) {
                            clearLocalInventoryCache();
                        }
                    }}
                    className="flex items-center justify-center w-10 h-10 text-slate-300 dark:text-slate-800 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-500 rounded-full transition-all group"
                    title="Limpar Cache e Resetar App"
                >
                    <RotateCcw className="w-4 h-4 group-hover:-rotate-180 transition-transform duration-500" />
                </button>
            </motion.div>
        </div >
    );
};
