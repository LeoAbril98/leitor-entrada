import React, { forwardRef } from 'react';
import { Barcode } from 'lucide-react';

interface ScannerInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
}

export const ScannerInput = forwardRef<HTMLInputElement, ScannerInputProps>(
    ({ value, onChange, onSubmit }, ref) => {
        return (
            <form onSubmit={onSubmit} className="relative">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Barcode className="w-6 h-6" />
                </div>
                <input
                    ref={ref}
                    type="text"
                    inputMode="numeric"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Leia ou digite o código..."
                    className="w-full h-16 pl-14 pr-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl text-xl font-mono scanner-input transition-all shadow-sm"
                    autoComplete="off"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <kbd className="hidden sm:inline-flex h-8 items-center gap-1 rounded border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 font-mono text-[10px] font-medium text-slate-500 dark:text-slate-400 opacity-100">
                        <span className="text-xs">ENTER</span>
                    </kbd>
                </div>
            </form>
        );
    }
);
ScannerInput.displayName = 'ScannerInput';
