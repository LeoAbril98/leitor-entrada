import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    X,
    Volume2,
    VolumeX,
    Sparkles,
    Play,
    Square,
    Check,
    Radio,
    Info,
    Gauge
} from 'lucide-react';
import {
    getPortugueseVoices,
    getVoiceBadge,
    scoreVoiceQuality
} from '../utils/speechVoiceUtils';

interface VoiceSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    voices: SpeechSynthesisVoice[];
    selectedVoiceURI: string;
    onSelectVoice: (uri: string) => void;
    voiceRate: number;
    onChangeRate: (rate: number) => void;
    isVoiceEnabled: boolean;
    onToggleVoice: () => void;
    onTestVoice: () => void;
    isSpeaking: boolean;
}

export const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({
    isOpen,
    onClose,
    voices,
    selectedVoiceURI,
    onSelectVoice,
    voiceRate,
    onChangeRate,
    isVoiceEnabled,
    onToggleVoice,
    onTestVoice,
    isSpeaking
}) => {
    const ptVoices = React.useMemo(() => {
        const list = getPortugueseVoices(voices);
        // Ordena com as mais fluidas/naturais no topo
        return [...list].sort((a, b) => scoreVoiceQuality(b) - scoreVoiceQuality(a));
    }, [voices]);

    if (!isOpen) return null;

    const speedOptions = [
        { label: '0.9x', desc: 'Pausada', value: 0.9 },
        { label: '1.0x', desc: 'Natural ⭐', value: 1.0 },
        { label: '1.15x', desc: 'Ágil', value: 1.15 },
    ];

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center cursor-default overflow-y-auto"
            >
                <motion.div
                    initial={{ scale: 0.92, opacity: 0, y: 16 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.92, opacity: 0, y: 16 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/80 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-2xs">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">
                                    Voz Sintetizada Fluida
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Escolha a voz mais natural para ler os estoques
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                            title="Fechar"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="mt-4 space-y-5">
                        {/* 1. Ativar / Desativar voz */}
                        <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/70 dark:border-slate-800">
                            <div className="flex items-center gap-2.5">
                                {isVoiceEnabled ? (
                                    <Volume2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                ) : (
                                    <VolumeX className="w-5 h-5 text-slate-400" />
                                )}
                                <div>
                                    <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 block">
                                        Feedback por Voz ao Bipar
                                    </span>
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                                        {isVoiceEnabled ? 'Ativo (fala rua, estoque e caminhão)' : 'Desativado'}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={onToggleVoice}
                                type="button"
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                    isVoiceEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                                }`}
                            >
                                <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                        isVoiceEnabled ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                />
                            </button>
                        </div>

                        {/* 2. Seleção de Voz */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                    <Radio className="w-3.5 h-3.5 text-indigo-500" />
                                    Voz do Navegador / Sistema
                                </label>
                                <span className="text-[11px] font-bold text-slate-400">
                                    {ptVoices.length} {ptVoices.length === 1 ? 'disponível' : 'disponíveis'}
                                </span>
                            </div>

                            {ptVoices.length === 0 ? (
                                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                                    <span>
                                        O navegador ainda está carregando as vozes do sistema ou seu dispositivo possui apenas a voz padrão.
                                    </span>
                                </div>
                            ) : (
                                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                                    {ptVoices.map((voice) => {
                                        const badge = getVoiceBadge(voice);
                                        const isSelected = selectedVoiceURI === voice.voiceURI;

                                        return (
                                            <button
                                                key={voice.voiceURI}
                                                type="button"
                                                onClick={() => onSelectVoice(voice.voiceURI)}
                                                className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                                                    isSelected
                                                        ? 'bg-indigo-50/80 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 shadow-2xs'
                                                        : 'bg-white dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                                }`}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className={`text-xs sm:text-sm font-black truncate block ${
                                                                isSelected
                                                                    ? 'text-indigo-950 dark:text-indigo-200'
                                                                    : 'text-slate-800 dark:text-slate-200'
                                                            }`}
                                                        >
                                                            {voice.name}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span
                                                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black border ${badge.color}`}
                                                        >
                                                            {badge.label}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">
                                                            {voice.lang}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div
                                                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                                                        isSelected
                                                            ? 'bg-indigo-600 border-indigo-600 text-white'
                                                            : 'border-slate-300 dark:border-slate-700'
                                                    }`}
                                                >
                                                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* 3. Velocidade / Ritmo da fala */}
                        <div>
                            <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-2">
                                <Gauge className="w-3.5 h-3.5 text-indigo-500" />
                                Ritmo da Fala (Velocidade)
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {speedOptions.map((opt) => {
                                    const isSelected = Math.abs(voiceRate - opt.value) < 0.05;
                                    return (
                                        <button
                                            key={opt.label}
                                            type="button"
                                            onClick={() => onChangeRate(opt.value)}
                                            className={`py-2 px-3 rounded-xl border text-center transition-all ${
                                                isSelected
                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm font-black'
                                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 font-bold'
                                            }`}
                                        >
                                            <span className="text-xs block">{opt.label}</span>
                                            <span
                                                className={`text-[10px] block opacity-80 ${
                                                    isSelected ? 'text-indigo-100' : 'text-slate-400'
                                                }`}
                                            >
                                                {opt.desc}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 4. Botão de Demonstração / Teste */}
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={onTestVoice}
                                className={`w-full py-3 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md ${
                                    isSpeaking
                                        ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20 animate-pulse'
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                                }`}
                            >
                                {isSpeaking ? (
                                    <>
                                        <Square className="w-4 h-4 fill-current" />
                                        <span>Falando Demonstração... (Clique para parar)</span>
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-4 h-4 fill-current" />
                                        <span>Ouvir Demonstração com esta Voz</span>
                                    </>
                                )}
                            </button>
                            <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 mt-2">
                                Exemplo: &quot;Rua 15 D, 60 unidades em estoque, e 24 chegando no caminhão.&quot;
                            </p>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
