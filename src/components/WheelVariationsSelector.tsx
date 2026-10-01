import React, { useMemo } from 'react';
import { Layers } from 'lucide-react';
import { StockItem } from '../types';
import { 
    getModelVariations, 
    findBestVariationMatch 
} from '../utils/wheelVariations';

interface WheelVariationsSelectorProps {
    currentItem: StockItem;
    allStock: StockItem[];
    onSelectVariation: (item: StockItem) => void;
}

export const WheelVariationsSelector: React.FC<WheelVariationsSelectorProps> = ({
    currentItem,
    allStock,
    onSelectVariation
}) => {
    const modelData = useMemo(() => {
        return getModelVariations(currentItem, allStock);
    }, [currentItem, allStock]);

    if (!modelData || modelData.totalVariations <= 1) {
        return null;
    }

    const { 
        model, 
        totalVariations, 
        currentVariation, 
        allVariations, 
        availableAros, 
        availableFuracoes, 
        availableAcabamentos 
    } = modelData;

    const handleSelectAro = (aro: string) => {
        if (aro === currentVariation.aro) return;
        const match = findBestVariationMatch(allVariations, { aro }, currentVariation);
        if (match) onSelectVariation(match);
    };

    const handleSelectFuracao = (furacao: string) => {
        if (furacao === currentVariation.furacao) return;
        const match = findBestVariationMatch(allVariations, { furacao }, currentVariation);
        if (match) onSelectVariation(match);
    };

    const handleSelectAcabamento = (acabamento: string) => {
        if (acabamento === currentVariation.acabamento) return;
        const match = findBestVariationMatch(allVariations, { acabamento }, currentVariation);
        if (match) onSelectVariation(match);
    };

    return (
        <div className="bg-gradient-to-br from-indigo-50/50 via-slate-50 to-white dark:from-slate-900/90 dark:via-slate-800/60 dark:to-slate-900 p-3.5 sm:p-4 rounded-3xl border-2 border-indigo-200/70 dark:border-indigo-900/50 mb-4 shadow-sm relative overflow-hidden">
            {/* CABEÇALHO */}
            <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-indigo-100 dark:border-slate-700/60">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                        <Layers className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black uppercase tracking-wider text-indigo-950 dark:text-indigo-200">
                            Variações do Modelo
                        </span>
                        <span className="px-2 py-0.2 rounded-full bg-indigo-600 text-white font-mono font-black text-[11px]">
                            {model}
                        </span>
                    </div>
                </div>

                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                    {totalVariations} variações
                </span>
            </div>

            {/* SELETORES E-COMMERCE */}
            <div className="space-y-2.5">
                {/* 1. SELETOR DE ARO */}
                {availableAros.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Aro
                            </span>
                            {currentVariation.aro && (
                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                                    {currentVariation.aro}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {availableAros.map(aro => {
                                const isCurrent = aro === currentVariation.aro;
                                return (
                                    <button
                                        key={aro}
                                        type="button"
                                        onClick={() => handleSelectAro(aro)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-tight transition-all active:scale-95 ${
                                            isCurrent
                                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-600/30'
                                                : 'bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                                        }`}
                                    >
                                        {aro}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 2. SELETOR DE FURAÇÃO (APENAS AS QUE EXISTEM NO ARO SELECIONADO) */}
                {availableFuracoes.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Furação {currentVariation.aro ? `(Aro ${currentVariation.aro})` : ''}
                            </span>
                            {currentVariation.furacao && (
                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                                    {currentVariation.furacao}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {availableFuracoes.map(furacao => {
                                const isCurrent = furacao === currentVariation.furacao;
                                return (
                                    <button
                                        key={furacao}
                                        type="button"
                                        onClick={() => handleSelectFuracao(furacao)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-tight transition-all active:scale-95 ${
                                            isCurrent
                                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-600/30'
                                                : 'bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                                        }`}
                                    >
                                        {furacao}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 3. SELETOR DE ACABAMENTO (APENAS OS QUE EXISTEM NO ARO SELECIONADO) */}
                {availableAcabamentos.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Acabamento {currentVariation.aro ? `(Aro ${currentVariation.aro})` : ''}
                            </span>
                            {currentVariation.acabamento && (
                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                                    {currentVariation.acabamento}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {availableAcabamentos.map(acabamento => {
                                const isCurrent = acabamento === currentVariation.acabamento;
                                return (
                                    <button
                                        key={acabamento}
                                        type="button"
                                        onClick={() => handleSelectAcabamento(acabamento)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-tight transition-all active:scale-95 ${
                                            isCurrent
                                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-600/30'
                                                : 'bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                                        }`}
                                    >
                                        {acabamento}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
