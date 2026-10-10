import React, { useEffect, useState } from 'react';
import { Check, Minus, Plus, X } from 'lucide-react';
import type { SCOrderItem } from '../services/scLoadOrderService';
import { getWheelPhotoUrl } from '../utils/photoUtils';
import { NumericKeypad } from './NumericKeypad';
import { motion } from 'motion/react';
import { FlagSC } from './StateFlags';

interface Props {
    origem?: 'SC' | 'CM';
    item: SCOrderItem | null;
    currentQty: number;
    estoqueSC: number | null;
    estoquePR: number;
    onClose: () => void;
    onConfirm: (quantity: number) => boolean;
}

export function SCOrderQuantityModal({ item, currentQty, estoqueSC, estoquePR, onClose, onConfirm, origem = 'SC' }: Props) {
    const [quantity, setQuantity] = useState(currentQty);
    const limit = Math.max(0, Math.floor(item?.quantidadeCarga || 0));
    useEffect(() => { setQuantity(Math.min(currentQty, limit)); }, [item?.codigo, currentQty, limit]);
    useEffect(() => {
        if (!item) return;
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', escape);
        return () => window.removeEventListener('keydown', escape);
    }, [item, onClose]);
    if (!item) return null;
    const adjust = (value: number) => setQuantity(Math.max(0, Math.min(limit, value)));
    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
            <motion.section initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} role="dialog" aria-modal="true" aria-labelledby="sc-quantity-title" className="max-w-lg md:max-w-4xl w-full max-h-[94dvh] bg-white dark:bg-slate-900 rounded-2xl md:rounded-[2rem] shadow-2xl text-slate-900 dark:text-slate-100 flex flex-col overflow-hidden">
                <header className="bg-amber-500 px-3 py-3 md:p-4 flex items-center gap-3 text-white shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-white overflow-hidden flex items-center justify-center border border-white/30 shadow-lg">{origem === 'SC' ? <FlagSC className="w-full h-full" /> : <span className="text-rose-700 font-bold">CM</span>}</div>
                    <div className="flex-1"><h2 id="sc-quantity-title" className="text-lg md:text-xl font-black uppercase leading-tight">Rodas de {origem}</h2><p className="text-[10px] font-bold uppercase mt-0.5">{origem === 'CM' ? 'Campinas' : 'Santa Catarina'}</p></div>
                    <button onClick={onClose} title="Fechar" aria-label="Fechar quantidade" className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30"><X className="w-4 h-4" /></button>
                </header>
                <div className="flex flex-col md:flex-row overflow-y-auto">
                    <div className="w-full md:w-[45%] bg-slate-50 dark:bg-slate-950/20 p-3 md:p-6 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800">
                        <img src={getWheelPhotoUrl(item.descricao, item.codigo)} alt={item.descricao} className="w-24 h-24 sm:w-32 sm:h-32 md:w-64 md:h-64 mx-auto object-contain bg-white rounded-full shadow-xl border-4 border-white dark:border-slate-800" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/logo 2.svg'; }} />
                        <p className="font-black text-sm md:text-xl text-center break-words mt-3 md:mt-5">{item.descricao}</p>
                        <p className="font-mono text-[10px] md:text-xs text-slate-500 text-center mt-2 break-all">CÓDIGO: {item.codigo}</p>
                    <div className="grid grid-cols-3 text-center py-3 mt-3 border-t border-slate-200 dark:border-slate-800 text-sm">
                        <div><span className="block text-xs text-slate-500">Na carga</span><strong className="text-lg">{item.quantidadeCarga}</strong></div>
                        <div><span className="block text-xs text-slate-500">Estoque {origem}</span><strong className="text-lg text-emerald-700 dark:text-emerald-400">{estoqueSC ?? '-'}</strong></div>
                        <div><span className="block text-xs text-slate-500">Estoque PR</span><strong className="text-lg text-blue-700 dark:text-blue-400">{estoquePR}</strong></div>
                    </div>
                    </div>
                    <div className="w-full md:w-[55%] p-3 md:p-6">
                        <p className="text-xs font-black uppercase text-slate-400 text-center mb-3 md:mb-4">Quantidade do pedido</p>
                        <div className="max-w-xs mx-auto flex gap-3 items-center mb-2">
                            <button onClick={() => adjust(quantity - 1)} disabled={quantity === 0} title="Diminuir quantidade" aria-label="Diminuir quantidade" className="w-11 h-11 md:w-14 md:h-14 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0 disabled:opacity-40"><Minus className="w-5 h-5" /></button>
                            <input aria-label="Quantidade pedida" type="number" inputMode="numeric" min="0" max={limit} step="1" value={quantity} onChange={event => adjust(Math.trunc(Number(event.target.value) || 0))} className="min-w-0 w-full h-16 md:h-20 border-4 border-amber-500/20 rounded-2xl md:rounded-3xl text-center text-4xl md:text-5xl font-black text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-900" />
                            <button onClick={() => adjust(quantity + 1)} disabled={quantity >= limit} title="Aumentar quantidade" aria-label="Aumentar quantidade" className="w-11 h-11 md:w-14 md:h-14 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0 disabled:opacity-40"><Plus className="w-5 h-5" /></button>
                        </div>
                        <p className="text-xs text-slate-500 text-center mb-3">Máximo na carga: {limit} un</p>
                        <div className="max-w-xs mx-auto flex gap-2 mb-3">{[4, 12, 100].map(value => <button key={value} disabled={quantity + value > limit} onClick={() => adjust(quantity + value)} className="flex-1 py-2 md:py-3 text-sm font-black rounded-xl bg-slate-100 dark:bg-slate-800 disabled:opacity-40">+{value}</button>)}</div>
                        <div className="max-w-[260px] md:max-w-xs mx-auto"><NumericKeypad onPress={digit => adjust(Number(`${quantity === 0 ? '' : quantity}${digit}`))} onClear={() => setQuantity(0)} onBackspace={() => setQuantity(Math.floor(quantity / 10))} className="[&>button]:h-11 md:[&>button]:h-16 [&>button]:rounded-xl md:[&>button]:rounded-2xl [&>button]:text-lg md:[&>button]:text-xl" /></div>
                        <button onClick={() => { if (quantity <= limit && onConfirm(quantity)) onClose(); }} className="w-full mt-3 md:mt-5 h-12 md:h-16 rounded-xl md:rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black uppercase flex justify-center items-center gap-3 text-sm md:text-base"><Check className="w-5 h-5" />Confirmar pedido</button>
                    </div>
                </div>
            </motion.section>
        </div>
    );
}
