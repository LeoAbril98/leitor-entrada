import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    ScanBarcode,
    MapPin,
    RefreshCw,
    ClipboardList,
    RotateCcw,
    Lock,
    Database,
    ChevronRight,
    Check,
    ClipboardCheck,
    Sun,
    Moon,
    Home,
    CheckSquare,
    Settings,
    User,
    X,
    Shield,
    Sparkles,
    Truck,
    ListTodo
} from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { getInventory, getLastUpdate, clearLocalInventoryCache } from '../lib/supabase';
import { cn } from '../utils';

interface HomeMenuProps {
    onSelectMode: (mode: 'counting' | 'locator' | 'pendencies' | 'update-wheels' | 'conference' | 'admin-login' | 'romaneio') => void;
}

const SYNC_STEPS = [
    { id: 1, label: "Iniciando conexão segura com servidor" },
    { id: 2, label: "Acessando portal MK e autenticando" },
    { id: 3, label: "Extraindo relatórios de inventário" },
    { id: 4, label: "Baixando arquivos e decodificando dados" },
    { id: 5, label: "Gravando novos saldos nas tabelas Cloud" }
];

export const HomeMenu: React.FC<HomeMenuProps> = ({ onSelectMode }) => {
    const [isUpdating, setIsUpdating] = useState(false);
    const [updatesToday, setUpdatesToday] = useState(0);
    const [supabaseUpdate, setSupabaseUpdate] = useState<string | null>(null);
    const [activeStepIndex, setActiveStepIndex] = useState(0);
    const [activeModal, setActiveModal] = useState<'none' | 'ajustes' | 'perfil'>('none');

    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('theme');
            if (saved === 'dark') return true;
            if (saved === 'light') return false;
            return document.documentElement.classList.contains('dark');
        }
        return false;
    });

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    const toggleTheme = () => setIsDarkMode(prev => !prev);

    useEffect(() => {
        getLastUpdate().then(res => {
            if (res && res.date) {
                setSupabaseUpdate(res.date);
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
    }, []);

    useEffect(() => {
        if (!isUpdating) {
            setActiveStepIndex(0);
            return;
        }

        const intervals = [6000, 16000, 30000, 45000, 60000];
        const timers: NodeJS.Timeout[] = [];

        SYNC_STEPS.forEach((_, index) => {
            if (index === 0) return;
            const timer = setTimeout(() => {
                setActiveStepIndex(index);
            }, intervals[index - 1]);
            timers.push(timer);
        });

        return () => {
            timers.forEach(t => clearTimeout(t));
        };
    }, [isUpdating]);

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

            const res = await getLastUpdate();
            if (res && res.date) {
                setSupabaseUpdate(res.date);
            }

        } catch (error) {
            console.error(error);
            toast.error('Erro ao atualizar. Verifique sua conexão e a URL do Webhook.', { id: toastId });
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="h-[100dvh] max-h-[100dvh] bg-[#F4F7FE] dark:bg-slate-950 text-slate-800 dark:text-slate-100 antialiased w-full flex justify-center overflow-hidden transition-colors select-none">
            <Toaster position="top-center" />

            {/* Container Principal adaptável (Mobile até Desktop) */}
            <main className="w-full max-w-md md:max-w-4xl lg:max-w-5xl xl:max-w-6xl h-full flex flex-col justify-between relative overflow-hidden px-4 sm:px-6 md:px-8">

                {/* HEADER (Logo Centralizada com Botões de Ajustes/Perfil no Desktop) */}
                <header className="flex-shrink-0 pt-6 sm:pt-8 md:pt-10 pb-2 md:pb-4 relative flex justify-center items-center">
                    <img
                        src="/logo 2.svg"
                        alt="MKR Rodas"
                        className="h-16 sm:h-20 md:h-24 lg:h-28 w-auto max-w-[320px] md:max-w-[420px] object-contain mix-blend-multiply dark:invert dark:mix-blend-screen transition-transform hover:scale-105"
                    />

                    {/* Ações no Desktop (Ajustes e Perfil) */}
                    <div className="hidden md:flex items-center gap-2.5 absolute right-0">
                        <button
                            onClick={() => setActiveModal('ajustes')}
                            className={cn(
                                "group h-10 px-3.5 rounded-2xl border text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-2 active:scale-95 shadow-xs hover:shadow-md hover:-translate-y-0.5 cursor-pointer",
                                activeModal === 'ajustes'
                                    ? "bg-indigo-600 text-white border-indigo-600 shadow-indigo-500/25"
                                    : "bg-white/90 dark:bg-slate-900/90 backdrop-blur border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800/80 hover:text-indigo-600 dark:hover:text-indigo-400"
                            )}
                            title="Abrir Ajustes"
                        >
                            <Settings className="w-4 h-4 stroke-[2.2] transition-transform duration-500 ease-out group-hover:rotate-90 group-hover:scale-110" />
                            <span>Ajustes</span>
                        </button>

                        <button
                            onClick={() => setActiveModal('perfil')}
                            className={cn(
                                "group h-10 px-3.5 rounded-2xl border text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-2 active:scale-95 shadow-xs hover:shadow-md hover:-translate-y-0.5 cursor-pointer",
                                activeModal === 'perfil'
                                    ? "bg-indigo-600 text-white border-indigo-600 shadow-indigo-500/25"
                                    : "bg-white/90 dark:bg-slate-900/90 backdrop-blur border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800/80 hover:text-indigo-600 dark:hover:text-indigo-400"
                            )}
                            title="Abrir Perfil"
                        >
                            <User className="w-4 h-4 stroke-[2.2] transition-transform duration-200 ease-out group-hover:scale-115 group-hover:-translate-y-0.5" />
                            <span>Perfil</span>
                        </button>
                    </div>
                </header>

                {/* GRID DE MÓDULOS (Mobile: 2 colunas | Desktop: 4 colunas com ícones lado a lado) */}
                <section className="flex-1 pb-3 flex flex-col justify-center min-h-0">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-4 lg:gap-6 w-full">

                        {/* 1. Módulo: Contagem */}
                        <div
                            onClick={() => onSelectMode('counting')}
                            className="col-span-1 bg-white dark:bg-slate-900 rounded-[24px] sm:rounded-[26px] p-4 sm:p-5 md:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] border border-slate-100/90 dark:border-slate-800/80 flex flex-col items-center text-center cursor-pointer active:scale-[0.96] transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                        >
                            <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 rounded-[18px] sm:rounded-[20px] md:rounded-[22px] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 mb-2.5 sm:mb-3">
                                <ScanBarcode className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 stroke-[2.2]" />
                            </div>
                            <h3 className="font-bold text-slate-900 dark:text-white text-[15px] sm:text-[16px] md:text-[17px] tracking-tight leading-tight">
                                Contagem
                            </h3>
                            <p className="text-[11px] sm:text-[12px] md:text-[13px] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug line-clamp-1 font-medium">
                                Entrada de estoque
                            </p>
                        </div>

                        {/* 2. Módulo: Romaneio */}
                        <div
                            onClick={() => onSelectMode('romaneio')}
                            className="col-span-1 bg-white dark:bg-slate-900 rounded-[24px] sm:rounded-[26px] p-4 sm:p-5 md:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] border border-slate-100/90 dark:border-slate-800/80 flex flex-col items-center text-center cursor-pointer active:scale-[0.96] transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 relative group"
                        >
                            <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 rounded-[18px] sm:rounded-[20px] md:rounded-[22px] bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/25 mb-2.5 sm:mb-3 transition-transform group-hover:scale-105">
                                <Truck className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 stroke-[2.2]" />
                            </div>
                            <h3 className="font-bold text-slate-900 dark:text-white text-[15px] sm:text-[16px] md:text-[17px] tracking-tight leading-tight">
                                Romaneio
                            </h3>
                            <p className="text-[11px] sm:text-[12px] md:text-[13px] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug line-clamp-1 font-medium">
                                Cargas e expedição
                            </p>
                        </div>

                        {/* 3. Módulo: Localização */}
                        <div
                            onClick={() => onSelectMode('locator')}
                            className="col-span-1 bg-white dark:bg-slate-900 rounded-[24px] sm:rounded-[26px] p-4 sm:p-5 md:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] border border-slate-100/90 dark:border-slate-800/80 flex flex-col items-center text-center cursor-pointer active:scale-[0.96] transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                        >
                            <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 rounded-[18px] sm:rounded-[20px] md:rounded-[22px] bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 mb-2.5 sm:mb-3">
                                <MapPin className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 stroke-[2.2]" />
                            </div>
                            <h3 className="font-bold text-slate-900 dark:text-white text-[15px] sm:text-[16px] md:text-[17px] tracking-tight leading-tight">
                                Localização
                            </h3>
                            <p className="text-[11px] sm:text-[12px] md:text-[13px] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug line-clamp-1 font-medium">
                                Buscar posição
                            </p>
                        </div>

                        {/* 4. Módulo: Pendências */}
                        <div
                            onClick={() => onSelectMode('pendencies')}
                            className="col-span-1 bg-white dark:bg-slate-900 rounded-[24px] sm:rounded-[26px] p-4 sm:p-5 md:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] border border-slate-100/90 dark:border-slate-800/80 flex flex-col items-center text-center cursor-pointer active:scale-[0.96] transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                        >
                            <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 rounded-[18px] sm:rounded-[20px] md:rounded-[22px] bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/25 mb-2.5 sm:mb-3">
                                <ListTodo className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 stroke-[2.2]" />
                            </div>
                            <h3 className="font-bold text-slate-900 dark:text-white text-[15px] sm:text-[16px] md:text-[17px] tracking-tight leading-tight">
                                Pendências
                            </h3>
                            <p className="text-[11px] sm:text-[12px] md:text-[13px] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug line-clamp-1 font-medium">
                                Gestão de pedidos
                            </p>
                        </div>

                        {/* 5. Módulo: Conferência (Mobile: full width | Desktop: 2 colunas lado a lado) */}
                        <div
                            onClick={() => onSelectMode('conference')}
                            className="col-span-2 md:col-span-2 bg-white dark:bg-slate-900 rounded-[20px] sm:rounded-[22px] px-4 py-3.5 md:py-4 shadow-[0_4px_24px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] border border-slate-100/90 dark:border-slate-800/80 flex items-center gap-3.5 cursor-pointer active:scale-[0.98] transition-all hover:shadow-lg hover:-translate-y-0.5"
                        >
                            <div className="w-11 h-11 sm:w-12 sm:h-12 md:w-13 md:h-13 rounded-[14px] bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white shadow-md shadow-sky-500/25 shrink-0">
                                <ClipboardCheck className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
                            </div>
                            <div className="flex-1 text-left min-w-0">
                                <h3 className="font-bold text-slate-900 dark:text-white text-[14px] sm:text-[15px] md:text-[16px] tracking-tight leading-tight">
                                    Conferência
                                </h3>
                                <p className="text-[11px] sm:text-[12px] md:text-[13px] text-slate-400 dark:text-slate-500 leading-none mt-1 truncate font-medium">
                                    Verificar e validar sistema
                                </p>
                            </div>
                            <ChevronRight className="text-slate-300 dark:text-slate-600 w-5 h-5 shrink-0" />
                        </div>

                        {/* 6. Módulo: Sincronização de Locais (Mobile: full width | Desktop: 2 colunas lado a lado) */}
                        <div
                            onClick={() => onSelectMode('update-wheels')}
                            className="col-span-2 md:col-span-2 bg-white dark:bg-slate-900 rounded-[20px] sm:rounded-[22px] px-4 py-3.5 md:py-4 shadow-[0_4px_24px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] border border-slate-100/90 dark:border-slate-800/80 flex items-center gap-3.5 cursor-pointer active:scale-[0.98] transition-all hover:shadow-lg hover:-translate-y-0.5"
                        >
                            <div className="w-11 h-11 sm:w-12 sm:h-12 md:w-13 md:h-13 rounded-[14px] bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-purple-500/25 shrink-0">
                                <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
                            </div>
                            <div className="flex-1 text-left min-w-0">
                                <h3 className="font-bold text-slate-900 dark:text-white text-[14px] sm:text-[15px] md:text-[16px] tracking-tight leading-tight">
                                    Sincronizar Locais
                                </h3>
                                <p className="text-[11px] sm:text-[12px] md:text-[13px] text-slate-400 dark:text-slate-500 leading-none mt-1 truncate font-medium">
                                    Atualizar locais e ruas
                                </p>
                            </div>
                            <ChevronRight className="text-slate-300 dark:text-slate-600 w-5 h-5 shrink-0" />
                        </div>

                    </div>

                    {/* Detalhe da Última Atualização */}
                    <div className="mt-3.5 sm:mt-5 md:mt-6 flex items-center justify-center gap-1.5 text-slate-400 dark:text-slate-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <span className="text-[11px] sm:text-xs md:text-sm font-medium">
                            Última sincronização:{' '}
                            <span className="font-semibold text-slate-600 dark:text-slate-300">
                                {supabaseUpdate && !isNaN(new Date(supabaseUpdate).getTime())
                                    ? `${new Date(supabaseUpdate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${new Date(supabaseUpdate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                                    : '--/--, --:--'}
                            </span>
                        </span>
                    </div>
                </section>

                {/* BOTTOM NAVIGATION (Apenas no Mobile - No desktop os atalhos ficam no cabeçalho) */}
                <div className="md:hidden flex-shrink-0 w-full flex justify-center pb-safe sm:pb-3">
                    <nav className="w-full max-w-md md:max-w-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/80 shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] rounded-[28px] px-8 py-2.5 flex justify-around items-center z-10 transition-all">
                        <button
                            onClick={() => setActiveModal('none')}
                            className={cn(
                                "group flex flex-col items-center gap-1 transition-all duration-200 w-20 active:scale-95 hover:-translate-y-0.5",
                                activeModal === 'none' ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            )}
                        >
                            <Home className="w-5 h-5 stroke-[2.2] transition-transform duration-200 group-hover:scale-110" />
                            <span className="text-[10px] font-semibold">Início</span>
                        </button>

                        <button
                            onClick={() => setActiveModal('ajustes')}
                            className={cn(
                                "group flex flex-col items-center gap-1 transition-all duration-200 w-20 active:scale-95 hover:-translate-y-0.5",
                                activeModal === 'ajustes' ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            )}
                        >
                            <Settings className="w-5 h-5 stroke-[2.2] transition-transform duration-500 ease-out group-hover:rotate-90 group-hover:scale-110" />
                            <span className="text-[10px] font-semibold">Ajustes</span>
                        </button>

                        <button
                            onClick={() => setActiveModal('perfil')}
                            className={cn(
                                "group flex flex-col items-center gap-1 transition-all duration-200 w-20 active:scale-95 hover:-translate-y-0.5",
                                activeModal === 'perfil' ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            )}
                        >
                            <User className="w-5 h-5 stroke-[2.2] transition-transform duration-200 ease-out group-hover:scale-120 group-hover:-translate-y-0.5" />
                            <span className="text-[10px] font-semibold">Perfil</span>
                        </button>
                    </nav>
                </div>
            </main>

            {/* MODAIS CUSTOMIZADOS (Ajustes, Perfil) */}
            <AnimatePresence>
                {activeModal !== 'none' && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setActiveModal('none')}
                            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 transition-opacity"
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-[24px] shadow-2xl p-6 z-50 border border-slate-100 dark:border-slate-800"
                        >

                            {/* Modal: AJUSTES */}
                            {activeModal === 'ajustes' && (
                                <div>
                                    <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 mx-auto">
                                        <Settings className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-base font-bold text-center text-slate-900 dark:text-white mb-1">
                                        Ajustes do Aplicativo
                                    </h3>
                                    <p className="text-xs text-center text-slate-400 mb-4">
                                        Preferências e manutenção do terminal
                                    </p>

                                    <div className="flex flex-col gap-2.5 mb-5">
                                        {/* Bloco Banco de Dados MK */}
                                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex flex-col gap-2.5">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                                        <Database className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block leading-none">
                                                            Banco MK
                                                        </span>
                                                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Conectado
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block leading-none mb-0.5">Última Att.</span>
                                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                        {supabaseUpdate && !isNaN(new Date(supabaseUpdate).getTime())
                                                            ? `${new Date(supabaseUpdate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${new Date(supabaseUpdate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                                                            : '--/--, --:--'}
                                                    </span>
                                                </div>
                                            </div>

                                            <button
                                                onClick={handleUpdateInventory}
                                                disabled={isUpdating || updatesToday >= 2}
                                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-[10px] py-2.5 shadow-sm shadow-indigo-600/20 flex justify-center items-center gap-2 text-xs transition-all active:scale-[0.98] disabled:opacity-50"
                                            >
                                                <RefreshCw className={cn("w-3.5 h-3.5", isUpdating && "animate-spin")} />
                                                <span>{isUpdating ? 'Sincronizando...' : 'Sincronizar Agora'}</span>
                                                <span className="text-[10px] opacity-80 font-mono">({2 - updatesToday}/2)</span>
                                            </button>

                                            {/* Checklist do Robô MK quando ativo */}
                                            <AnimatePresence>
                                                {isUpdating && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="border-t border-slate-200 dark:border-slate-700/60 pt-2 mt-1"
                                                    >
                                                        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                                                            Progresso do Robô MK
                                                        </h4>
                                                        <div className="flex flex-col gap-1.5">
                                                            {SYNC_STEPS.map((step, index) => {
                                                                const isCompleted = activeStepIndex > index;
                                                                const isActive = activeStepIndex === index;
                                                                return (
                                                                    <div key={step.id} className="flex items-center gap-2 text-xs">
                                                                        <div className={cn(
                                                                            "h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0",
                                                                            isCompleted ? "bg-emerald-500 text-white" : isActive ? "bg-indigo-600 text-white animate-pulse" : "bg-slate-200 dark:bg-slate-800 text-slate-400"
                                                                        )}>
                                                                            {isCompleted ? <Check className="w-2.5 h-2.5" /> : step.id}
                                                                        </div>
                                                                        <span className={cn(
                                                                            "truncate text-[11px]",
                                                                            isCompleted ? "text-emerald-600 dark:text-emerald-400 line-through opacity-80" : isActive ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-400"
                                                                        )}>
                                                                            {step.label}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        {/* Alternador de Tema */}
                                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Tema do Aplicativo</span>
                                            <button
                                                onClick={toggleTheme}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-bold shadow-sm"
                                            >
                                                {isDarkMode ? (
                                                    <>
                                                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                                                        <span>Claro</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Moon className="w-3.5 h-3.5 text-slate-600" />
                                                        <span>Escuro</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        {/* Redefinir Cache */}
                                        <button
                                            onClick={() => {
                                                if (window.confirm("Deseja limpar todo o cache local e recarregar o App? Isso resolve problemas de dados desatualizados.")) {
                                                    clearLocalInventoryCache();
                                                }
                                            }}
                                            className="flex items-center justify-between p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 text-left transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <RotateCcw className="w-4 h-4" />
                                                <span className="text-xs font-semibold">Redefinir Cache Local</span>
                                            </div>
                                            <span className="text-[10px] uppercase font-bold opacity-75">Limpar</span>
                                        </button>

                                        {/* Info Versão */}
                                        <div className="text-center pt-2">
                                            <span className="text-[11px] text-slate-400 font-mono">
                                                MKR Expedição v2.4 • PWA
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setActiveModal('none')}
                                        className="w-full bg-slate-900 dark:bg-slate-800 text-white font-semibold rounded-xl py-2.5 text-xs hover:bg-slate-800 transition-colors"
                                    >
                                        Concluir
                                    </button>
                                </div>
                            )}

                            {/* Modal: PERFIL */}
                            {activeModal === 'perfil' && (
                                <div>
                                    <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 mx-auto">
                                        <User className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-base font-bold text-center text-slate-900 dark:text-white mb-1">
                                        Perfil do Operador
                                    </h3>
                                    <p className="text-xs text-center text-slate-400 mb-4">
                                        Terminal de Expedição & Estoque
                                    </p>

                                    <div className="flex flex-col gap-2.5 mb-5">
                                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
                                            <div className="text-slate-400 text-[10px] uppercase font-bold">Unidade</div>
                                            <div className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">MKR Rodas - Almoxarifado Central</div>
                                        </div>

                                        <button
                                            onClick={() => { setActiveModal('none'); onSelectMode('admin-login'); }}
                                            className="w-full flex items-center justify-center gap-2 p-3 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                                        >
                                            <Lock className="w-4 h-4 text-emerald-400" />
                                            <span>Acessar Painel Administrativo</span>
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => setActiveModal('none')}
                                        className="w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl py-2.5 text-xs hover:bg-slate-200 transition-colors"
                                    >
                                        Fechar
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};
