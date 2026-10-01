import React from 'react';
import { Home, Search, ScanBarcode, RotateCcw, Download } from 'lucide-react';

interface CountingBottomNavProps {
    onGoHome: () => void;
    onOpenSearch: () => void;
    onOpenScanner: () => void;
    onUndo: () => void;
    onExport: () => void;
    readingsCount: number;
    canUndo: boolean;
    isSearchOpen?: boolean;
}

export const CountingBottomNav: React.FC<CountingBottomNavProps> = ({
    onGoHome,
    onOpenSearch,
    onOpenScanner,
    onUndo,
    onExport,
    readingsCount,
    canUndo,
    isSearchOpen = false,
}) => {
    return (
        <nav
            aria-label="Navegação do Módulo de Contagem"
            className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 rounded-t-[28px] shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-10px_35px_rgba(0,0,0,0.45)] px-3 pt-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-colors"
        >
            <div className="max-w-md mx-auto grid grid-cols-5 items-center relative">
                {/* 1. HOME */}
                <button
                    onClick={onGoHome}
                    type="button"
                    className="flex flex-col items-center justify-center py-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 active:text-blue-600 dark:active:text-blue-400 transition-colors group select-none"
                    title="Voltar ao Início"
                >
                    <div className="p-1 rounded-xl transition-all group-active:scale-90">
                        <Home className="w-5 h-5 text-slate-500 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200" />
                    </div>
                    <span className="text-[10px] font-semibold tracking-wide text-slate-500 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200">
                        Início
                    </span>
                </button>

                {/* 2. BUSCAR MANUAL */}
                <button
                    onClick={onOpenSearch}
                    type="button"
                    className={`flex flex-col items-center justify-center py-1 transition-colors group select-none ${
                        isSearchOpen
                            ? 'text-blue-600 dark:text-blue-400 font-bold'
                            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 active:text-blue-600 dark:active:text-blue-400'
                    }`}
                    title="Buscar e Inserir Peça Manualmente"
                >
                    <div className="p-1 rounded-xl transition-all group-active:scale-90">
                        <Search
                            className={`w-5 h-5 transition-colors ${
                                isSearchOpen ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200'
                            }`}
                        />
                    </div>
                    <span
                        className={`text-[10px] font-semibold tracking-wide ${
                            isSearchOpen ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200'
                        }`}
                    >
                        Buscar
                    </span>
                </button>

                {/* 3. ESCANEAR COM CÂMERA (FAB ELEVADO CENTRAL) */}
                <div className="flex flex-col items-center justify-center relative">
                    <button
                        onClick={onOpenScanner}
                        type="button"
                        className="relative -translate-y-5 flex items-center justify-center group focus:outline-none select-none"
                        title="Escanear com a Câmera"
                        aria-label="Escanear código de barras com a câmera"
                    >
                        <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 via-blue-500 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 active:scale-90 transition-all duration-150 flex items-center justify-center text-white shadow-xl shadow-blue-500/40 ring-4 ring-white dark:ring-slate-900">
                            <ScanBarcode className="w-7 h-7 text-white drop-shadow-sm" />
                        </div>
                    </button>
                </div>

                {/* 4. DESFAZER ÚLTIMA LEITURA */}
                <button
                    onClick={onUndo}
                    disabled={!canUndo}
                    type="button"
                    className={`flex flex-col items-center justify-center py-1 transition-colors group select-none ${
                        canUndo
                            ? 'text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 active:scale-95'
                            : 'text-slate-300 dark:text-slate-600 opacity-60 cursor-not-allowed'
                    }`}
                    title={canUndo ? 'Desfazer último bipe' : 'Nenhuma leitura para desfazer'}
                >
                    <div className="p-1 rounded-xl transition-all group-active:scale-90">
                        <RotateCcw className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-semibold tracking-wide">
                        Desfazer
                    </span>
                </button>

                {/* 5. EXPORTAR */}
                <button
                    onClick={onExport}
                    disabled={readingsCount === 0}
                    type="button"
                    className={`flex flex-col items-center justify-center py-1 transition-colors group select-none ${
                        readingsCount > 0
                            ? 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 active:scale-95'
                            : 'text-slate-300 dark:text-slate-600 opacity-60 cursor-not-allowed'
                    }`}
                    title={readingsCount > 0 ? 'Exportar relatório Excel / Imagem' : 'Nenhuma leitura realizada'}
                >
                    <div className="relative p-1 rounded-xl transition-all group-active:scale-90">
                        <Download className="w-5 h-5" />
                        {readingsCount > 0 && (
                            <span className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-1 bg-emerald-500 text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
                                {readingsCount > 99 ? '99+' : readingsCount}
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] font-semibold tracking-wide">
                        Exportar
                    </span>
                </button>
            </div>
        </nav>
    );
};
