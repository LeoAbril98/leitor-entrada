import React, { useEffect, useState } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

type BranchStock = { origem: string; quantidade: number | null; unavailable: boolean };

export const OtherBranchStock: React.FC<{ codigo: string }> = ({ codigo }) => {
    const [open, setOpen] = useState(false);
    const [stocks, setStocks] = useState<BranchStock[] | null>(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        let cancelled = false;
        setStocks(null);
        void Promise.all(['SC', 'CM'].map(async origem => {
            try {
                const { data, error } = await supabase.from(`romaneio_estoque_${origem.toLowerCase()}`)
                    .select('quantidade').eq('codigo', String(codigo).trim().toUpperCase())
                    .abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(10000)])).maybeSingle();
                if (error) throw error;
                return { origem, quantidade: data?.quantidade ?? null, unavailable: false };
            } catch {
                return { origem, quantidade: null, unavailable: true };
            }
        })).then(result => { if (!cancelled) setStocks(result); });
        return () => { cancelled = true; controller.abort(); };
    }, [open, codigo, attempt]);

    return (
        <details className="group mt-3 border-t border-slate-200 dark:border-slate-700 pt-2"
            onToggle={event => setOpen(event.currentTarget.open)}>
            <summary className="flex items-center gap-1.5 list-none cursor-pointer text-[11px] leading-snug text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-emerald-600 [&::-webkit-details-marker]:hidden">
                <ChevronDown aria-hidden="true" className="w-3.5 h-3.5 shrink-0 transition-transform group-open:rotate-180" />
                <span>Estoque em outras filiais</span>
            </summary>
            {open && <div className="mt-2 text-xs" aria-label="Estoque em outras filiais" aria-live="polite">
                {stocks ? <>
                    <dl className="space-y-2">
                        {stocks.map(stock => <div key={stock.origem} className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                            <dt className="text-slate-500 dark:text-slate-400">{stock.origem === 'SC' ? 'SC' : 'Campinas'}</dt>
                            <dd className="font-semibold text-slate-700 dark:text-slate-200">{stock.unavailable ? 'Indisponível' : stock.quantidade === null ? 'Sem registro' : `${stock.quantidade.toLocaleString('pt-BR')} un`}</dd>
                        </div>)}
                    </dl>
                    {stocks.some(stock => stock.unavailable) && <button type="button" onClick={() => setAttempt(value => value + 1)}
                        className="flex items-center gap-1 mt-3 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200" title="Consultar estoques novamente">
                        <RefreshCw aria-hidden="true" className="w-3 h-3" />Tentar novamente
                    </button>}
                </> : <p role="status" className="text-slate-500">Consultando estoques...</p>}
            </div>}
        </details>
    );
}
