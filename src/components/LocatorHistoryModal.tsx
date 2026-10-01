import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { History, X, Trash2, MapPin, Package2, ArrowRight, Barcode } from 'lucide-react';
import { getWheelPhotoUrl } from '../utils/photoUtils';

export interface LocatorHistoryItem {
    id: string;
    codigo: string;
    descricao: string;
    local: string;
    quantidade: number;
    timestamp: number;
}

interface LocatorHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    history: LocatorHistoryItem[];
    onSelectItem: (codigo: string) => void;
    onClearHistory: () => void;
}

const formatRelativeTime = (timestamp: number): string => {
    const diffSeconds = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSeconds < 60) return 'Agora mesmo';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `Há ${diffMinutes} min`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Há ${diffHours} h`;
    return new Date(timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export const LocatorHistoryModal: React.FC<LocatorHistoryModalProps> = ({
    isOpen,
    onClose,
    history,
    onSelectItem,
    onClearHistory,
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Dialog Container */}
                    <motion.div
                        initial={{ y: '100%', opacity: 0.5 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: '100%', opacity: 0 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-[28px] sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 z-10 max-h-[85vh] flex flex-col overflow-hidden"
                    >
                        {/* Pull Bar (Mobile) */}
                        <div className="pt-3 pb-1 flex justify-center sm:hidden">
                            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
                        </div>

                        {/* Header */}
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-blue-50 dark:bg-blue-950/60 rounded-xl text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/50">
                                    <History className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
                                        Histórico de Consultas
                                    </h2>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                                        {history.length === 0
                                            ? 'Nenhuma consulta'
                                            : `${history.length} de 10 recentes`}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                                {history.length > 0 && (
                                    <button
                                        onClick={onClearHistory}
                                        className="px-2.5 py-1.5 text-xs font-bold text-red-500 hover:text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors flex items-center gap-1"
                                        title="Limpar Histórico"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Limpar</span>
                                    </button>
                                )}
                                <button
                                    onClick={onClose}
                                    className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* List Content */}
                        <div className="flex-1 overflow-y-auto p-3 sm:p-4 divide-y divide-slate-100 dark:divide-slate-800/70">
                            {history.length === 0 ? (
                                <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
                                    <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3 shadow-inner">
                                        <History className="w-7 h-7" />
                                    </div>
                                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
                                        Nenhuma consulta recente
                                    </h3>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">
                                        As últimas 10 peças que você consultar por código de barras, busca ou câmera ficarão gravadas aqui para acesso rápido.
                                    </p>
                                </div>
                            ) : (
                                history.map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => {
                                            onSelectItem(item.codigo);
                                            onClose();
                                        }}
                                        className="py-3 px-2 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-2xl cursor-pointer transition-all group active:scale-[0.99]"
                                    >
                                        {/* Foto */}
                                        <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 p-1.5 shrink-0 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center overflow-hidden group-hover:border-blue-400 transition-colors">
                                            <img
                                                src={getWheelPhotoUrl(item.descricao, item.codigo)}
                                                alt={item.descricao}
                                                className="w-full h-full object-contain"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = "https://placehold.co/100x100/e2e8f0/64748b?text=SEM+FOTO";
                                                }}
                                            />
                                        </div>

                                        {/* Detalhes */}
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 uppercase truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                {item.descricao}
                                            </h4>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                                                    <Barcode className="w-3 h-3 text-slate-400" />
                                                    #{item.codigo}
                                                </span>
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                                    • {formatRelativeTime(item.timestamp)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Badges Localização + Estoque */}
                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-xs border border-emerald-200/50 dark:border-emerald-800/40">
                                                <MapPin className="w-3 h-3" />
                                                {item.local || '---'}
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                                <Package2 className="w-3 h-3 text-slate-400" />
                                                {item.quantidade} un
                                            </span>
                                        </div>

                                        <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
