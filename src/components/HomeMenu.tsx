import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ScanBarcode, MapPin, PackageOpen, RefreshCw } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { getInventory, getLastUpdate } from '../lib/supabase';
import { cn } from '../utils';

interface HomeMenuProps {
    onSelectMode: (mode: 'counting' | 'locator') => void;
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
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 transition-colors">
            <Toaster position="top-center" />
            <div className="max-w-3xl w-full">
                <div className="text-center mb-12">
                    <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.5, type: 'spring' }}
                        className="mx-auto mb-8 flex justify-center"
                    >
                        <img
                            src="/logo.PNG"
                            alt="MKR Rodas Exclusivas"
                            className="h-24 md:h-28 lg:h-32 object-contain mix-blend-multiply dark:invert dark:mix-blend-screen"
                        />
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-3xl md:text-4xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight"
                    >
                        Expedição
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-slate-500 dark:text-slate-400 mt-2 text-lg mb-8"
                    >
                        Selecione o módulo que deseja acessar
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm mx-auto max-w-md"
                    >
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            {supabaseUpdate
                                ? `🛜 Última Sincronização: ${new Date(supabaseUpdate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                                : '🟢 Conectado ao Supabase'}<br />
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold">{defaultStockCount} itens</span> na base de dados.
                        </p>

                        <button
                            onClick={handleUpdateInventory}
                            disabled={isUpdating || updatesToday >= 2}
                            className="mt-4 w-full flex items-center justify-center gap-2 h-12 text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <RefreshCw className={cn("w-5 h-5", isUpdating && "animate-spin")} />
                            {isUpdating ? 'Atualizando (pode demorar)...' : 'Buscar dados do MK'}
                            <span className="bg-white dark:bg-slate-900 text-xs px-2 py-0.5 rounded-full ml-1 font-bold shadow-sm">
                                {2 - updatesToday} / 2
                            </span>
                        </button>
                    </motion.div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        onClick={() => onSelectMode('counting')}
                        className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 hover:border-indigo-600 dark:hover:border-indigo-500 hover:shadow-2xl hover:shadow-indigo-100 dark:hover:shadow-none transition-all text-left flex flex-col items-start gap-4 active:scale-95"
                    >
                        <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <ScanBarcode className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                                Contagem
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                                Realize conferências de estoque através da pistola bipadora ou buscas manuais e gere exportações.
                            </p>
                        </div>
                    </motion.button>

                    <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        onClick={() => onSelectMode('locator')}
                        className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 hover:border-emerald-600 dark:hover:border-emerald-500 hover:shadow-2xl hover:shadow-emerald-100 dark:hover:shadow-none transition-all text-left flex flex-col items-start gap-4 active:scale-95"
                    >
                        <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <MapPin className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                                Localização
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                                Faça buscas rápidas por códigos de barras para descobrir instantaneamente a posição e quantidade do item no estoque.
                            </p>
                        </div>
                    </motion.button>
                </div>
            </div>
        </div >
    );
};
