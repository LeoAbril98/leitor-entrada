import { useEffect, useRef, useState } from 'react';
import Lottie, { type LottieRefCurrentProps } from 'lottie-react';
import { X } from 'lucide-react';
import animation from '../assets/order-sent.json';

export function OrderSentConfirmation({ loadNumber, onClose }: {
    loadNumber: string; onClose: () => void;
}) {
    const lottie = useRef<LottieRefCurrentProps>(null);
    const [reducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    useEffect(() => {
        const previousFocus = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', keydown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', keydown);
            previousFocus?.focus();
        };
    }, [onClose]);
    return <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="order-sent-title" aria-describedby="order-sent-description" className="relative w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-lg bg-white dark:bg-slate-900 px-6 pb-6 pt-4 text-center shadow-xl">
            <button onClick={onClose} title="Fechar" aria-label="Fechar confirmacao" className="absolute top-3 right-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
            <div data-testid="order-sent-animation" aria-hidden="true" className="w-48 h-48 max-w-full mx-auto">
                <Lottie lottieRef={lottie} animationData={animation} loop={false} autoplay={!reducedMotion}
                    onDOMLoaded={() => { if (reducedMotion) lottie.current?.goToAndStop(animation.op - animation.ip - 1, true); }} />
            </div>
            <h2 id="order-sent-title" className="text-xl font-bold">Pedido enviado!</h2>
            <p className="mt-2 text-sm font-semibold break-all">Carga {loadNumber}</p>
            <p id="order-sent-description" className="mt-2 text-sm text-slate-500 dark:text-slate-400">PDF e Excel salvos no Romaneio do administrador.</p>
            <button autoFocus onClick={onClose} className="mt-6 w-full py-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold">Concluir</button>
        </section>
    </div>;
}
