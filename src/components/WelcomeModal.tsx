import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Cloud, 
    Mic, 
    PenTool, 
    Tag, 
    Archive, 
    FileSpreadsheet, 
    CheckCircle2, 
    X,
    Sparkles
} from 'lucide-react';
import { cn } from '../utils';

interface WelcomeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const updates = [
    {
        icon: <Cloud className="w-6 h-6 text-blue-500" />,
        title: "Nuvem Ativa",
        description: "Sincronização em tempo real entre todos os dispositivos. O que você faz no celular, aparece no PC instantaneamente."
    },
    {
        icon: <Mic className="w-6 h-6 text-red-500" />,
        title: "Mensagens de Áudio",
        description: "Grave observações por voz em cada item. Mais agilidade para reportar detalhes sem precisar digitar."
    },
    {
        icon: <PenTool className="w-6 h-6 text-amber-500" />,
        title: "Post-it Visual",
        description: "Faça rabiscos e anotações visuais rápidas sobre o modelo. Ideal para marcar detalhes específicos."
    },
    {
        icon: <Tag className="w-6 h-6 text-emerald-500" />,
        title: "Etiquetas Cloud",
        description: "Organize seus itens com tags (ex: URGENTE, RESERVADO). Elas ficam salvas e sincronizadas na nuvem."
    },
    {
        icon: <Archive className="w-6 h-6 text-indigo-500" />,
        title: "Histórico Snapshot",
        description: "Ao 'Zerar Semana', tudo (incluindo áudios e desenhos) é arquivado com segurança para consultas futuras."
    },
    {
        icon: <FileSpreadsheet className="w-6 h-6 text-emerald-600" />,
        title: "Relatórios Inteligentes",
        description: "Exportação Excel aprimorada com indicadores de anotações e etiquetas integradas."
    }
];

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
                    >
                        {/* Header com Gradiente */}
                        <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-8 text-white relative">
                            <Sparkles className="absolute top-4 right-4 w-12 h-12 opacity-20 animate-pulse" />
                            <h2 className="text-3xl font-black mb-2 flex items-center gap-3">
                                Bem-vindo à Nova Era! 🚀
                            </h2>
                            <p className="text-amber-50 /80 font-medium">
                                Transformamos o sistema de Pendências em uma ferramenta 100% Cloud e Multimídia.
                            </p>
                        </div>

                        {/* Corpo com Grid de Novidades */}
                        <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6 px-1">
                                O que há de novo na versão 2.0
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {updates.map((update, index) => (
                                    <motion.div 
                                        key={index}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 + 0.2 }}
                                        className="flex gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 hover:border-amber-200 dark:hover:border-amber-900/50 transition-colors group"
                                    >
                                        <div className="shrink-0 w-12 h-12 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                            {update.icon}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
                                                {update.title}
                                            </h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                {update.description}
                                            </p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* Footer / Ação */}
                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                            <div className="flex -space-x-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-4">
                                    Supabase Cloud Ativo
                                </span>
                            </div>
                            
                            <button
                                onClick={onClose}
                                className="px-8 py-3 bg-slate-900 dark:bg-amber-600 text-white rounded-xl font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-2 group"
                            >
                                Vamos Começar!
                                <CheckCircle2 className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
