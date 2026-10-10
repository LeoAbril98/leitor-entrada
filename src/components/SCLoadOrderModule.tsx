import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Pencil, Plus, RefreshCw, Search, Send, ShoppingCart, Trash2, Truck, X } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { getInventoryWithStateStock } from '../lib/supabase';
import { fetchAndSyncRomaneios, getRomaneios, type Romaneio } from '../services/romaneioService';
import { getSCLoadItems, sendSCLoadOrder, type LoadOrderOrigin, type SCOrderItem } from '../services/scLoadOrderService';
import { getWheelPhotoUrl } from '../utils/photoUtils';
import { SCOrderQuantityModal } from './SCOrderQuantityModal';
import { FlagSC } from './StateFlags';
import { StockFreshness } from './StockFreshness';
import { OrderSentConfirmation } from './OrderSentConfirmation';
import { matchesStockFilter, type StockFilter } from '../utils/stockFilters';

import { useLoadOrderDraft } from '../hooks/useLoadOrderDraft';

export function SCLoadOrderModule({ onBack, origem = 'SC' }: { onBack: () => void; origem?: LoadOrderOrigin }) {
    const { draft, setDraft, status: draftStatus, restoring, retry: retryDraft } = useLoadOrderDraft(origem);
    const [loads, setLoads] = useState<Romaneio[]>(() => getRomaneios().filter(load => load.tipo === origem));
    const [selectedId, setSelectedId] = useState(() => draft?.cargaId || '');
    const [stockPR, setStockPR] = useState(new Map<string, number>());
    const [stockSC, setStockSC] = useState(new Map<string, number>());
    const [scStockAvailable, setSCStockAvailable] = useState(false);
    const [stockUpdatedPR, setStockUpdatedPR] = useState<string | null>(null);
    const [stockUpdatedSC, setStockUpdatedSC] = useState<string | null>(null);
    const [stockFilter, setStockFilter] = useState<StockFilter>('all');
    const [onlyOrdered, setOnlyOrdered] = useState(false);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeItem, setActiveItem] = useState<SCOrderItem | null>(null);
    const [reviewing, setReviewing] = useState(false);
    const [sending, setSending] = useState(false);
    const [sentLoadNumber, setSentLoadNumber] = useState<string | null>(null);
    const [resumeChoiceMade, setResumeChoiceMade] = useState(false);
    const sendingRef = useRef(false);
    const resumeButton = useRef<HTMLButtonElement>(null);
    const needsResumeChoice = !restoring && !resumeChoiceMade && !!draft?.itens.length;

    const refresh = async () => {
        setLoading(true); setError('');
        try {
            const [romaneios, stock] = await Promise.all([fetchAndSyncRomaneios(), getInventoryWithStateStock()]);
            const scLoads = romaneios.filter(load => load.tipo === origem);
            setLoads(scLoads);
            setSelectedId(current => scLoads.some(item => item.id === current) || draft?.itens.length ? current : scLoads[0]?.id || '');
            setStockPR(stock.prMap); setStockSC(origem === 'CM' ? stock.cmMap : stock.scMap);
            setSCStockAvailable(origem === 'CM' ? stock.cmStockAvailable : stock.scStockAvailable);
            setStockUpdatedPR(stock.stockUpdatedPR); setStockUpdatedSC(origem === 'CM' ? stock.stockUpdatedCM : stock.stockUpdatedSC);
        } catch {
            setError('Nao foi possivel atualizar as cargas e os estoques.');
        } finally { setLoading(false); }
    };
    useEffect(() => { void refresh(); }, []);
    useEffect(() => { if (draft?.cargaId) setSelectedId(draft.cargaId); }, [draft?.cargaId]);
    useEffect(() => {
        if (!restoring && !draft?.itens.length) setResumeChoiceMade(true);
    }, [restoring, draft?.itens.length]);
    useEffect(() => { if (needsResumeChoice) resumeButton.current?.focus(); }, [needsResumeChoice]);

    const load = loads.find(item => item.id === selectedId);
    const items = useMemo(() => load ? getSCLoadItems(load) : [], [load]);
    const total = draft?.itens.reduce((sum, item) => sum + item.quantidade, 0) || 0;
    const quantityFor = (codigo: string) => draft?.itens.find(item => item.codigo === codigo)?.quantidade || 0;
    const visibleItems = items.filter(item => `${item.codigo} ${item.descricao}`.toLowerCase().includes(search.trim().toLowerCase()) &&
        matchesStockFilter(stockFilter, stockPR.get(item.codigo) ?? 0, scStockAvailable ? stockSC.get(item.codigo) ?? 0 : null) &&
        (!onlyOrdered || quantityFor(item.codigo) > 0));

    const changeQuantity = (item: SCOrderItem, quantity: number) => {
        if (!Number.isSafeInteger(quantity) || quantity < 0 || sendingRef.current || restoring || needsResumeChoice) return false;
        const currentItem = items.find(row => row.codigo === item.codigo) || item;
        if (quantity > currentItem.quantidadeCarga) {
            toast.error(`Esta roda tem apenas ${currentItem.quantidadeCarga} unidades no caminhão.`);
            return false;
        }
        if (!load && !draft) return false;
        setDraft(current => {
            const remaining = current?.itens.filter(row => row.codigo !== item.codigo) || [];
            const next = quantity > 0 ? [...remaining, { ...currentItem, quantidade: quantity }] : remaining;
            if (!next.length) return null;
            return {
                id: crypto.randomUUID(), dataCriacao: new Date().toISOString(), origem,
                cargaId: current?.cargaId || load!.id,
                cargaNumero: current?.cargaNumero || load!.numero,
                itens: next.sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR', { numeric: true }))
            };
        });
        return true;
    };
    const send = async () => {
        if (!draft?.itens.length || sendingRef.current || restoring || needsResumeChoice) return;
        if (load && draft.itens.some(item => item.quantidade > (items.find(row => row.codigo === item.codigo)?.quantidadeCarga ?? 0))) {
            toast.error('A quantidade na carga mudou. Revise as quantidades pedidas antes de enviar.');
            return;
        }
        sendingRef.current = true; setSending(true);
        try {
            const order = await sendSCLoadOrder(draft);
            if (order.email?.estado === 'enviado') toast.success('Pedido salvo e e-mail enviado.');
            else if (order.email && order.email.estado !== 'desativado') {
                toast(order.email.mensagem || 'Pedido salvo. Confira o envio por e-mail na gestao.', { duration: 8000 });
            }
            toast.dismiss('sc-order-send-error');
            setDraft(null); setReviewing(false);
            setSentLoadNumber(draft.cargaNumero);
        } catch (err) {
            toast.error(`${err instanceof Error ? err.message : 'Falha no envio.'} Seu pedido continua salvo neste aparelho.`, { duration: 6000, id: 'sc-order-send-error' });
        } finally { sendingRef.current = false; setSending(false); }
    };
    const photo = (item: SCOrderItem) => (
        <img src={getWheelPhotoUrl(item.descricao, item.codigo)} alt={item.descricao}
            className="w-14 h-14 object-contain shrink-0 bg-white rounded-lg"
            onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/logo 2.svg'; }} />
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-28">
            <Toaster position="top-center" />
            <header className="sticky top-0 z-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-6xl mx-auto px-4 py-4 md:h-[72px] flex items-center gap-3">
                    <button onClick={onBack} disabled={sending} title="Voltar ao romaneio" aria-label="Voltar ao romaneio" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"><ArrowLeft className="w-5 h-5" /></button>
                    {origem === 'SC' ? <FlagSC className="w-7 h-5 shrink-0" /> : <span className="font-bold text-rose-700 dark:text-rose-400">CM</span>}
                    <h1 className="text-lg sm:text-xl font-bold flex-1">Pedir Rodas de {origem}</h1>
                    <button onClick={refresh} disabled={loading || sending} title="Atualizar carga e estoque" aria-label="Atualizar carga e estoque" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"><RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></button>
                </div>
            </header>
            <main className="max-w-6xl mx-auto px-4">
                <div className="py-5 flex flex-col sm:flex-row sm:items-end gap-4 border-b border-slate-200 dark:border-slate-800">
                    <label className="flex-1 min-w-0 text-sm font-semibold">Carga {origem}
                        <select aria-label={`Carga ${origem}`} value={selectedId} disabled={!!draft?.itens.length || sending || loading || restoring} onChange={event => setSelectedId(event.target.value)} className="block mt-1.5 w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg p-2.5 font-normal disabled:opacity-70">
                            {!load && <option value={selectedId}>{draft?.cargaNumero || 'Selecione uma carga'}</option>}
                            {loads.map(item => <option key={item.id} value={item.id}>{item.numero} - {item.titulo}</option>)}
                        </select>
                    </label>
                    <div className="relative sm:w-72">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                        <input aria-label="Buscar roda" placeholder="Buscar roda ou codigo" value={search} onChange={event => setSearch(event.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
                    </div>
                </div>
                <StockFreshness pr={stockUpdatedPR} sc={stockUpdatedSC} scAvailable={scStockAvailable} origin={origem} />
                <div role="status" className={`flex flex-wrap items-center gap-2 pb-3 text-xs ${draftStatus === 'offline' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500'}`}>
                    {draftStatus === 'loading' ? 'Recuperando pedido salvo...' : draftStatus === 'saving' ? 'Salvando pedido na nuvem...' : draftStatus === 'offline' ? 'Copia local salva. Nuvem pendente.' : draft ? 'Pedido salvo na nuvem' : 'Rascunho sincronizado'}
                    {draftStatus === 'offline' && <button onClick={retryDraft} title="Tentar salvar na nuvem" aria-label="Tentar salvar na nuvem" className="p-1"><RefreshCw className="w-3.5 h-3.5" /></button>}
                </div>
                <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800 text-sm">
                    <select aria-label="Filtrar estoque" value={stockFilter} onChange={event => setStockFilter(event.target.value as StockFilter)} className="max-w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2">
                        <option value="all">Todos os estoques</option><option value="sc">Com estoque {origem}</option><option value="pr">Com estoque PR</option><option value="none">Sem estoque PR e {origem}</option>
                    </select>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={onlyOrdered} onChange={event => setOnlyOrdered(event.target.checked)} className="accent-emerald-700 w-4 h-4" />Somente no pedido</label>
                    <span className="text-xs text-slate-500 sm:ml-auto">{visibleItems.length} de {items.length} modelos</span>
                </div>
                {error && <p role="alert" className="py-3 text-sm text-red-600">{error}</p>}
                {loading && <div role="status" className="py-12 flex justify-center gap-2 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /> Carregando cargas e estoques...</div>}
                {!loading && !load && <p className="py-12 text-center text-slate-500">{draft ? 'A carga deste pedido nao esta mais disponivel. O pedido salvo pode ser revisado.' : `Nenhuma carga de ${origem === 'CM' ? 'Campinas' : 'Santa Catarina'} disponivel.`}</p>}
                {!loading && load && (
                    <>
                        <div className="hidden md:grid sticky top-[73px] z-10 bg-slate-50 dark:bg-slate-950 grid-cols-[minmax(0,1fr)_125px_100px_100px_120px] items-center gap-3 py-3 text-xs font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800 shadow-sm">
                            <span>Roda</span><span className="text-center">Quantidade Caminhão</span><span className="text-center">Estoque {origem}</span><span className="text-center">Estoque PR</span><span className="text-center">Pedido</span>
                        </div>
                        {visibleItems.map(item => {
                            const quantity = quantityFor(item.codigo);
                            return (
                                <div key={item.codigo} className="py-4 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_125px_100px_100px_120px] items-center gap-3">
                                    <div className="flex gap-3 items-center min-w-0">{photo(item)}<div className="min-w-0"><p className="font-semibold text-sm break-words">{item.descricao}</p><p className="font-mono text-xs text-slate-500 mt-1 break-all">{item.codigo}</p></div></div>
                                    <div className="grid grid-cols-3 md:contents text-center">
                                        <div><span className="md:hidden text-[10px] uppercase text-slate-500 block">Qtd. Caminhão</span><strong className="text-lg">{item.quantidadeCarga}</strong></div>
                                        <div><span className="md:hidden text-[10px] uppercase text-slate-500 block">Estoque {origem}</span><strong className="text-lg text-emerald-700 dark:text-emerald-400">{scStockAvailable ? stockSC.get(item.codigo) ?? 0 : '-'}</strong></div>
                                        <div><span className="md:hidden text-[10px] uppercase text-slate-500 block">Estoque PR</span><strong className="text-lg text-blue-700 dark:text-blue-400">{stockPR.get(item.codigo) ?? 0}</strong></div>
                                    </div>
                                    <button disabled={sending || restoring} onClick={() => setActiveItem(item)} className={`w-full h-10 px-3 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold border disabled:opacity-50 ${quantity ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700'}`}>
                                        {quantity ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{quantity ? `${quantity} pedidas` : 'Pedir'}
                                    </button>
                                </div>
                            );
                        })}
                        {!visibleItems.length && <p className="py-12 text-center text-slate-500">Nenhuma roda encontrada.</p>}
                    </>
                )}
            </main>
            <button onClick={() => setReviewing(true)} disabled={sending || restoring || needsResumeChoice || !draft?.itens.length}
                style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
                className="fixed right-4 sm:right-6 z-30 max-w-[calc(100%-2rem)] flex items-center gap-3 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-5 py-3 rounded-lg shadow-lg">
                <ShoppingCart className="w-5 h-5 shrink-0" /><span className="text-left"><strong className="block text-sm">Enviar pedido</strong><span className="text-xs">{draft?.itens.length || 0} {draft?.itens.length === 1 ? 'modelo' : 'modelos'} · {total} un</span></span><Send className="w-4 h-4 shrink-0" />
            </button>
            {needsResumeChoice && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <section role="dialog" aria-modal="true" aria-labelledby="resume-order-title" aria-describedby="resume-order-summary"
                        onKeyDown={event => {
                            if (event.key !== 'Tab') return;
                            const buttons = event.currentTarget.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
                            if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1]?.focus(); }
                            else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0]?.focus(); }
                        }}
                        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-lg shadow-xl">
                        <div className="flex items-center gap-3 p-4 border-b border-slate-200 dark:border-slate-800">
                            <ShoppingCart className="w-5 h-5 shrink-0 text-emerald-700" />
                            <h2 id="resume-order-title" className="font-bold">Continuar pedido de {origem}?</h2>
                        </div>
                        <div id="resume-order-summary" className="p-4 space-y-2 text-sm">
                            <p className="text-slate-500">Existe um pedido em andamento.</p>
                            <p className="font-semibold break-words">{draft?.cargaNumero}</p>
                            <p>{draft?.itens.length} {draft?.itens.length === 1 ? 'modelo' : 'modelos'} · {total} unidades</p>
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-end gap-3">
                            <button onClick={() => { setDraft(null); setOnlyOrdered(false); setResumeChoiceMade(true); }}
                                className="px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800">Começar do zero</button>
                            <button ref={resumeButton} onClick={() => setResumeChoiceMade(true)}
                                className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-sm font-semibold">Continuar pedido</button>
                        </div>
                    </section>
                </div>
            )}
            {reviewing && (
                <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-3">
                    <section role="dialog" aria-modal="true" aria-labelledby="sc-review-title" className="w-full max-w-xl max-h-[90dvh] bg-white dark:bg-slate-900 rounded-lg shadow-xl flex flex-col">
                        <div className="flex items-center gap-3 p-4 border-b border-slate-200 dark:border-slate-800"><Truck className="w-5 h-5 text-emerald-600" /><h2 id="sc-review-title" className="font-bold flex-1">Pedido de Rodas {origem}</h2><button disabled={sending} onClick={() => setReviewing(false)} title="Fechar" aria-label="Fechar revisao" className="p-2"><X className="w-5 h-5" /></button></div>
                        <div aria-label="Resumo do pedido" className="px-4 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 grid grid-cols-2 gap-3 shrink-0">
                            <p className="col-span-2 text-sm text-slate-500">Carga: <strong className="text-slate-900 dark:text-slate-100 break-all">{draft?.cargaNumero || load?.numero}</strong></p>
                            <div><span className="block text-xs text-slate-500">Modelos</span><strong className="text-2xl">{draft?.itens.length || 0}</strong></div>
                            <div><span className="block text-xs text-slate-500">Total de rodas</span><strong className="text-2xl text-emerald-700 dark:text-emerald-400">{total} unidades</strong></div>
                        </div>
                        <div className="overflow-y-auto px-4 flex-1 min-h-0">
                            {draft?.itens.map(item => <div key={item.codigo} className="flex gap-3 items-center py-3 border-t border-slate-200 dark:border-slate-800">{photo(item)}<div className="flex-1 min-w-0"><p className="text-sm font-semibold break-words">{item.descricao}</p><p className="text-xs text-slate-500 break-all">{item.codigo}</p><p className="text-sm mt-1"><strong>{item.quantidade} pedidas</strong><span className="text-xs text-slate-500 ml-2">Na carga: {item.quantidadeCarga}</span></p></div><button disabled={sending || restoring} onClick={() => setActiveItem(item)} title="Alterar quantidade" aria-label={`Alterar ${item.codigo}`} className="p-2"><Pencil className="w-4 h-4" /></button><button disabled={sending} onClick={() => changeQuantity(item, 0)} title="Remover roda" aria-label={`Remover ${item.codigo}`} className="p-2 text-red-600"><Trash2 className="w-4 h-4" /></button></div>)}
                            {!draft?.itens.length && <p className="py-8 text-center text-slate-500">Seu pedido esta vazio.</p>}
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-end gap-3 shrink-0"><button disabled={sending} onClick={() => setReviewing(false)} className="px-3 py-2.5 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Continuar pedido</button><button onClick={send} disabled={sending || restoring || !draft?.itens.length} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 text-white rounded-lg font-semibold text-sm disabled:opacity-50">{sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{sending ? 'Enviando...' : 'Enviar pedido'}</button></div>
                    </section>
                </div>
            )}
            {sentLoadNumber !== null && <OrderSentConfirmation loadNumber={sentLoadNumber} onClose={() => setSentLoadNumber(null)} />}
            <SCOrderQuantityModal origem={origem} item={activeItem ? items.find(row => row.codigo === activeItem.codigo) || activeItem : null} onClose={() => setActiveItem(null)}
                estoqueSC={scStockAvailable ? stockSC.get(activeItem?.codigo || '') || 0 : null} estoquePR={stockPR.get(activeItem?.codigo || '') || 0}
                currentQty={quantityFor(activeItem?.codigo || '')} onConfirm={quantity => activeItem ? changeQuantity(activeItem, quantity) : false} />
        </div>
    );
}
