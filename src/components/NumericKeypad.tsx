import React from 'react';
import { Delete } from 'lucide-react';
import { cn } from '../utils';

interface NumericKeypadProps {
    onPress: (digit: string) => void;
    onClear: () => void;
    onBackspace: () => void;
    className?: string;
}

export function NumericKeypad({ onPress, onClear, onBackspace, className }: NumericKeypadProps) {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'DEL'];

    return (
        <div className={cn("grid grid-cols-3 gap-2", className)}>
            {keys.map((key) => {
                const isClear = key === 'C';
                const isDelete = key === 'DEL';
                
                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => {
                            if (isClear) onClear();
                            else if (isDelete) onBackspace();
                            else onPress(key);
                        }}
                        className={cn(
                            "h-14 sm:h-16 rounded-2xl text-xl font-black transition-all active:scale-90 flex items-center justify-center shadow-sm border-2",
                            isClear ? "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30 hover:bg-rose-100" :
                            isDelete ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200" :
                            "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 hover:border-amber-400 dark:hover:border-amber-500/50 hover:bg-amber-50 dark:hover:bg-amber-900/10"
                        )}
                    >
                        {isDelete ? <Delete className="w-6 h-6" /> : key}
                    </button>
                );
            })}
        </div>
    );
}
