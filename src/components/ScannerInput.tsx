import React, { forwardRef, useState } from 'react';
import { Barcode, Camera } from 'lucide-react';
import { CameraScannerModal } from './CameraScannerModal';

interface ScannerInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
}

export const ScannerInput = forwardRef<HTMLInputElement, ScannerInputProps>(
    ({ value, onChange, onSubmit }, ref) => {
        const [isCameraOpen, setIsCameraOpen] = useState(false);

        const handleScan = (code: string) => {
            onChange(code);
            // Wait for state to update, then submit
            setTimeout(() => {
                const formEvent = new Event('submit', { bubbles: true, cancelable: true }) as unknown as React.FormEvent;
                onSubmit(formEvent);
            }, 50);
        };

        return (
            <>
                <form onSubmit={onSubmit} className="relative flex gap-2">
                    <div className="relative flex-1">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                            <Barcode className="w-6 h-6" />
                        </div>
                        <input
                            ref={ref}
                            type="text"
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder="Leia ou digite o código..."
                            className="w-full h-16 pl-14 pr-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl text-xl font-mono scanner-input transition-all shadow-sm"
                            autoComplete="off"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsCameraOpen(true)}
                        className="h-16 w-16 shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl flex items-center justify-center transition-colors shadow-lg shadow-indigo-200 dark:shadow-none active:scale-95"
                        title="Ler com Câmera"
                    >
                        <Camera className="w-6 h-6" />
                    </button>
                </form>

                <CameraScannerModal
                    isOpen={isCameraOpen}
                    onClose={() => setIsCameraOpen(false)}
                    onScan={handleScan}
                />
            </>
        );
    }
);
ScannerInput.displayName = 'ScannerInput';
