import React from 'react';
import { Home, Search, History, RefreshCcw, ScanBarcode } from 'lucide-react';

interface LocatorBottomNavProps {
    onGoHome: () => void;
    onOpenSearch: () => void;
    onOpenScanner: () => void;
    onOpenHistory: () => void;
    onResetQuery: () => void;
    hasScannedItem: boolean;
    historyCount: number;
    isSearchOpen?: boolean;
    isHistoryOpen?: boolean;
}

export const LocatorBottomNav: React.FC<LocatorBottomNavProps> = ({
    onGoHome,
    onOpenSearch,
    onOpenScanner,
    onOpenHistory,
    onResetQuery,
    hasScannedItem,
    historyCount,
    isSearchOpen = false,
    isHistoryOpen = false,
}) => {
    return (
        <nav
            aria-label="Navegação do Localizador"
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

                {/* 2. BUSCA MANUAL */}
                <button
                    onClick={onOpenSearch}
                    type="button"
                    className={`flex flex-col items-center justify-center py-1 transition-colors group select-none ${
                        isSearchOpen
                            ? 'text-blue-600 dark:text-blue-400 font-bold'
                            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 active:text-blue-600 dark:active:text-blue-400'
                    }`}
                    title="Busca Manual de Peças"
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

                {/* 4. HISTÓRICO */}
                <button
                    onClick={onOpenHistory}
                    type="button"
                    className={`flex flex-col items-center justify-center py-1 transition-colors group select-none ${
                        isHistoryOpen
                            ? 'text-blue-600 dark:text-blue-400 font-bold'
                            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 active:text-blue-600 dark:active:text-blue-400'
                    }`}
                    title="Histórico de Consultas"
                >
                    <div className="relative p-1 rounded-xl transition-all group-active:scale-90">
                        <History
                            className={`w-5 h-5 transition-colors ${
                                isHistoryOpen ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200'
                            }`}
                        />
                        {historyCount > 0 && (
                            <span className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-1 bg-blue-600 text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
                                {historyCount}
                            </span>
                        )}
                    </div>
                    <span
                        className={`text-[10px] font-semibold tracking-wide ${
                            isHistoryOpen ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200'
                        }`}
                    >
                        Histórico
                    </span>
                </button>

                {/* 5. NOVA CONSULTA / LIMPAR */}
                <button
                    onClick={onResetQuery}
                    type="button"
                    className={`flex flex-col items-center justify-center py-1 transition-colors group select-none ${
                        hasScannedItem
                            ? 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'
                            : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400'
                    }`}
                    title={hasScannedItem ? 'Limpar e iniciar nova consulta' : 'Pronto para leitura'}
                >
                    <div className="relative p-1 rounded-xl transition-all group-active:scale-90">
                        <RefreshCcw
                            className={`w-5 h-5 transition-all ${
                                hasScannedItem
                                    ? 'text-blue-600 dark:text-blue-400 group-hover:rotate-180 duration-300'
                                    : 'text-slate-400 dark:text-slate-500'
                            }`}
                        />
                        {hasScannedItem && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full animate-ping ring-2 ring-white dark:ring-slate-900" />
                        )}
                    </div>
                    <span
                        className={`text-[10px] font-semibold tracking-wide ${
                            hasScannedItem
                                ? 'text-blue-600 dark:text-blue-400 font-bold'
                                : 'text-slate-400 dark:text-slate-500'
                        }`}
                    >
                        Nova Busca
                    </span>
                </button>
            </div>
        </nav>
    );
};
