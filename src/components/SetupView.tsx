import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    ScanBarcode,
    Check,
    RotateCcw,
    ArrowLeft,
    ArrowRight,
    User,
    Database
} from 'lucide-react';
import { cn } from '../utils';
import { ORIGINS } from '../constants';
import { Origin } from '../types';

interface SetupViewProps {
    origin: Origin | null;
    setOrigin: (origin: Origin) => void;
    client: string;
    setClient: (client: string) => void;
    onStartCounting: () => void;
    defaultStockCount: number;
    onBackToMenu: () => void;
}

// Mini bandeiras vetoriais de alta definição
const FlagSC: React.FC<{ className?: string }> = ({ className = "w-5 h-3.5" }) => (
    <svg className={cn("rounded-[3px] shadow-sm overflow-hidden shrink-0", className)} viewBox="0 0 20 14" fill="none">
        <rect width="20" height="14" fill="#E52222" />
        <rect y="4.66" width="20" height="4.68" fill="#FFFFFF" />
        <polygon points="10,2 16,7 10,12 4,7" fill="#009B3A" />
    </svg>
);

const FlagRS: React.FC<{ className?: string }> = ({ className = "w-5 h-3.5" }) => (
    <svg className={cn("rounded-[3px] shadow-sm overflow-hidden shrink-0", className)} viewBox="0 0 20 14" fill="none">
        <polygon points="0,0 20,0 0,9" fill="#009B3A" />
        <polygon points="0,9 20,0 20,5 0,14" fill="#EF2B2D" />
        <polygon points="0,14 20,5 20,14" fill="#FEDF00" />
        <ellipse cx="10" cy="7" rx="3.2" ry="2.4" fill="#FFFFFF" />
    </svg>
);

const FlagSP: React.FC<{ className?: string }> = ({ className = "w-5 h-3.5" }) => (
    <svg className={cn("rounded-[3px] shadow-sm overflow-hidden shrink-0", className)} viewBox="0 0 20 14" fill="none">
        {/* 13 listras alternadas preto e branco */}
        <rect width="20" height="14" fill="#000000" />
        <rect y="1.08" width="20" height="1.08" fill="#FFFFFF" />
        <rect y="3.24" width="20" height="1.08" fill="#FFFFFF" />
        <rect y="5.40" width="20" height="1.08" fill="#FFFFFF" />
        <rect y="7.56" width="20" height="1.08" fill="#FFFFFF" />
        <rect y="9.72" width="20" height="1.08" fill="#FFFFFF" />
        <rect y="11.88" width="20" height="1.08" fill="#FFFFFF" />
        {/* Cantão vermelho superior esquerdo */}
        <rect width="7.5" height="5.5" fill="#DE2010" />
        {/* Círculo branco */}
        <circle cx="3.75" cy="2.75" r="1.7" fill="#FFFFFF" />
        {/* Globo azul interno */}
        <circle cx="3.75" cy="2.75" r="1.1" fill="#002776" />
        {/* 4 estrelinhas amarelas */}
        <circle cx="1.2" cy="1.2" r="0.4" fill="#FEDF00" />
        <circle cx="6.3" cy="1.2" r="0.4" fill="#FEDF00" />
        <circle cx="1.2" cy="4.3" r="0.4" fill="#FEDF00" />
        <circle cx="6.3" cy="4.3" r="0.4" fill="#FEDF00" />
    </svg>
);

const ORIGIN_CONFIG: Record<Origin, {
    code: string;
    title: string;
    subtitle: string;
    gradient: string;
    shadow: string;
    activeRing: string;
    activeBg: string;
    flag?: React.ComponentType<{ className?: string }>;
}> = {
    'DEVOLUÇÃO': {
        code: 'DEV',
        title: 'Devolução',
        subtitle: 'Retorno de cliente',
        gradient: 'from-amber-500 to-orange-600',
        shadow: 'shadow-orange-500/25',
        activeRing: 'border-orange-500 dark:border-orange-400 ring-2 ring-orange-500/20',
        activeBg: 'bg-orange-50/70 dark:bg-orange-950/20',
    },
    'SC': {
        code: 'SC',
        title: 'SC',
        subtitle: 'Santa Catarina',
        gradient: 'from-sky-500 to-blue-600',
        shadow: 'shadow-sky-500/25',
        activeRing: 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/20',
        activeBg: 'bg-sky-50/70 dark:bg-sky-950/20',
        flag: FlagSC,
    },
    'RS': {
        code: 'RS',
        title: 'RS',
        subtitle: 'Rio Grande do Sul',
        gradient: 'from-emerald-500 to-teal-600',
        shadow: 'shadow-emerald-500/25',
        activeRing: 'border-emerald-500 dark:border-emerald-400 ring-2 ring-emerald-500/20',
        activeBg: 'bg-emerald-50/70 dark:bg-emerald-950/20',
        flag: FlagRS,
    },
    'CM': {
        code: 'CM',
        title: 'CM',
        subtitle: 'Campinas - SP',
        gradient: 'from-violet-500 to-indigo-600',
        shadow: 'shadow-purple-500/25',
        activeRing: 'border-purple-500 dark:border-purple-400 ring-2 ring-purple-500/20',
        activeBg: 'bg-purple-50/70 dark:bg-purple-950/20',
        flag: FlagSP,
    }
};

export function SetupView({
    origin,
    setOrigin,
    client,
    setClient,
    onStartCounting,
    defaultStockCount,
    onBackToMenu
}: SetupViewProps) {
    const isReady = !!origin && (origin !== 'DEVOLUÇÃO' || client.trim().length > 0);

    return (
        <div className="min-h-[100dvh] bg-[#F4F7FE] dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-8 antialiased select-none transition-colors overflow-x-hidden">
            {/* CABEÇALHO SUPERIOR (Desktop & Mobile) */}
            <header className="w-full max-w-5xl mx-auto flex items-center justify-between gap-4 pt-2 sm:pt-4">
                {onBackToMenu ? (
                    <button
                        onClick={onBackToMenu}
                        className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs sm:text-sm hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm active:scale-95 group"
                    >
                        <ArrowLeft className="w-4 h-4 stroke-[2.2] group-hover:-translate-x-0.5 transition-transform" />
                        <span>Voltar ao Menu</span>
                    </button>
                ) : (
                    <div className="w-24" />
                )}

                <img
                    src="/logo 2.svg"
                    alt="MKR Rodas"
                    className="h-10 sm:h-12 md:h-14 w-auto object-contain mix-blend-multiply dark:invert dark:mix-blend-screen transition-transform hover:scale-105"
                />

                {/* Badge de catálogo no canto direito do header */}
                <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-200/60 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 text-xs font-semibold">
                    <Database className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{defaultStockCount.toLocaleString('pt-BR')} itens prontos</span>
                </div>
            </header>

            {/* CONTEÚDO PRINCIPAL (CARD CENTRALIZADO) */}
            <main className="flex-1 flex items-center justify-center py-6 sm:py-8 w-full">
                <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="w-full max-w-lg md:max-w-2xl lg:max-w-3xl bg-white dark:bg-slate-900 rounded-[28px] sm:rounded-[34px] shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-6 sm:p-8 md:p-10 border border-slate-100/90 dark:border-slate-800/80"
                >
                    {/* Topo do Card com Ícone iOS Squircle */}
                    <div className="flex flex-col items-center text-center mb-6 sm:mb-8">
                        <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-[20px] sm:rounded-[22px] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 mb-3 sm:mb-4">
                            <ScanBarcode className="w-8 h-8 sm:w-9 sm:h-9 stroke-[2.2]" />
                        </div>
                        <h1 className="text-2xl sm:text-3xl md:text-[32px] font-black text-slate-900 dark:text-white tracking-tight">
                            Nova Contagem
                        </h1>
                        <p className="text-slate-400 dark:text-slate-500 text-xs sm:text-sm md:text-[15px] font-medium mt-1 max-w-sm">
                            Selecione a origem da mercadoria para iniciar o balanço
                        </p>
                    </div>

                    {/* Grid de Origens (Mobile: 2 colunas | Desktop: 4 colunas) */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                        {ORIGINS.map((opt) => {
                            const config = ORIGIN_CONFIG[opt];
                            const isSelected = origin === opt;

                            return (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setOrigin(opt)}
                                    className={cn(
                                        "relative p-3.5 sm:p-4 rounded-[22px] sm:rounded-[24px] border-2 transition-all duration-200 flex flex-col items-center text-center cursor-pointer active:scale-95 group",
                                        isSelected
                                            ? cn(config.activeRing, config.activeBg, "shadow-md")
                                            : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                                    )}
                                >
                                    {isSelected && (
                                        <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                                            <Check className="w-3 h-3 stroke-[3]" />
                                        </span>
                                    )}

                                    {/* Container de Ícone / Sigla com Bandeira */}
                                    <div className="relative mb-2.5">
                                        <div className={cn(
                                            "w-13 h-13 sm:w-14 sm:h-14 rounded-[18px] sm:rounded-[20px] bg-gradient-to-br flex items-center justify-center text-white transition-transform group-hover:scale-105 shadow-md",
                                            config.gradient,
                                            config.shadow
                                        )}>
                                            {opt === 'DEVOLUÇÃO' ? (
                                                <RotateCcw className="w-6 h-6 stroke-[2.4]" />
                                            ) : (
                                                <span className="text-[19px] sm:text-[21px] font-black tracking-wider drop-shadow-sm font-sans select-none">
                                                    {config.code}
                                                </span>
                                            )}
                                        </div>

                                        {/* Selo com a bandeira ou badge na ponta do ícone */}
                                        {config.flag && (
                                            <div className="absolute -bottom-1 -right-1 ring-2 ring-white dark:ring-slate-900 rounded-[4px] overflow-hidden shadow-sm">
                                                <config.flag className="w-5 h-3.5" />
                                            </div>
                                        )}
                                        {opt === 'DEVOLUÇÃO' && (
                                            <div className="absolute -bottom-1 -right-1 ring-2 ring-white dark:ring-slate-900 rounded-[4px] bg-amber-500 text-white text-[8px] font-black px-1 h-3.5 flex items-center justify-center shadow-sm">
                                                DEV
                                            </div>
                                        )}
                                    </div>

                                    {/* Título e Subtítulo com Mini Bandeira */}
                                    <div className="flex items-center justify-center gap-1.5">
                                        <h3 className="font-extrabold text-slate-900 dark:text-white text-[15px] sm:text-[16px] tracking-tight">
                                            {config.title}
                                        </h3>
                                    </div>
                                    <p className="text-[11px] sm:text-[12px] text-slate-400 dark:text-slate-500 font-medium leading-tight mt-0.5">
                                        {config.subtitle}
                                    </p>
                                </button>
                            );
                        })}
                    </div>

                    {/* Campo condicional para Devolução */}
                    <AnimatePresence>
                        {origin === 'DEVOLUÇÃO' && (
                            <motion.div
                                initial={{ opacity: 0, height: 0, y: -10 }}
                                animate={{ opacity: 1, height: 'auto', y: 0 }}
                                exit={{ opacity: 0, height: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="mb-6 text-left overflow-hidden"
                            >
                                <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                                    <User className="w-4 h-4 text-orange-500" />
                                    <span>Nome do Cliente ou Transportadora</span>
                                    <span className="text-rose-500 font-bold">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: Auto Center Modelo, Transportadora Alfa..."
                                    value={client}
                                    onChange={(e) => setClient(e.target.value)}
                                    className="w-full h-12 sm:h-13 px-4 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 font-medium transition-all text-sm sm:text-base"
                                    autoFocus
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Botão de Ação: Iniciar Contagem */}
                    <div className="space-y-3">
                        <button
                            onClick={onStartCounting}
                            disabled={!isReady}
                            className={cn(
                                "w-full h-14 sm:h-15 rounded-2xl font-bold text-base sm:text-lg transition-all duration-200 flex items-center justify-center gap-2.5 active:scale-[0.98]",
                                !isReady
                                    ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200/50 dark:border-slate-800"
                                    : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/35 cursor-pointer"
                            )}
                        >
                            <span>Iniciar Contagem</span>
                            <ArrowRight className="w-5 h-5 stroke-[2.2]" />
                        </button>
                    </div>
                </motion.div>
            </main>

            {/* RODAPÉ SUTIL */}
            <footer className="w-full text-center pb-2 text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 font-medium">
                MKR Rodas • Sistema de Balanço de Estoque
            </footer>
        </div>
    );
}