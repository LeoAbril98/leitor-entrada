import { useEffect, useState } from 'react';
import { Clock, TriangleAlert } from 'lucide-react';

export function StockFreshness({ pr, sc, scAvailable }: {
    pr: string | null; sc: string | null; scAvailable: boolean;
}) {
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 60000);
        return () => window.clearInterval(timer);
    }, []);
    return <div aria-label="Atualizacao dos estoques" className="flex flex-wrap gap-x-6 gap-y-2 py-3 text-xs print:hidden">
        {(['PR', 'SC'] as const).map(uf => {
            const value = uf === 'PR' ? pr : sc;
            const date = value ? new Date(value) : null;
            const valid = date && Number.isFinite(date.getTime());
            const stale = !!valid && now - date.getTime() > 24 * 60 * 60 * 1000;
            const unavailable = uf === 'SC' && !scAvailable;
            const Icon = stale ? TriangleAlert : Clock;
            return <div key={uf} className={`flex items-center gap-1.5 min-w-0 ${stale ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span><strong>Estoque {uf}: </strong>{unavailable ? 'indisponivel' : valid ? <>
                    <time dateTime={value!}>{date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
                    {stale && <span className="font-semibold"> · Mais de 24h sem atualizar</span>}
                </> : 'atualizacao nao informada'}</span>
            </div>;
        })}
    </div>;
}
