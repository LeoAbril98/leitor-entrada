import React, { useEffect, useState } from 'react';
import { ChevronRight, Download, FileSpreadsheet, FileText, Loader2, Mail, Package, RefreshCw, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { deleteSCLoadOrder, downloadSCOrderFile, getSCLoadOrders, type SCLoadOrder, type LoadOrderOrigin } from '../services/scLoadOrderService';
import { getOrderEmailStatuses, orderEmailLabel, sendOrderEmail, type OrderEmailStatus } from '../services/romaneioEmailService';
import { OrderEmailSettings } from './OrderEmailSettings';

export function SCLoadOrdersAdmin({ origem = 'SC' }: { origem?: LoadOrderOrigin }) {
    const [orders, setOrders] = useState<SCLoadOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [downloading, setDownloading] = useState('');
    const [open, setOpen] = useState(false);
    const [toDelete, setToDelete] = useState<SCLoadOrder | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [emailStatuses, setEmailStatuses] = useState<Record<string, OrderEmailStatus>>({});
    const [emailError, setEmailError] = useState('');
    const [emailSending, setEmailSending] = useState('');
    const refresh = async () => {
        setLoading(true); setError('');
        try {
            const received = await getSCLoadOrders(origem);
            setOrders(received); setEmailError('');
            try {
                const statuses = await getOrderEmailStatuses(received.map(order => order.id));
                setEmailStatuses(Object.fromEntries(statuses.map(status => [status.pedido_id, status])));
            } catch { setEmailError('Nao foi possivel conferir os envios por e-mail.'); setEmailStatuses({}); }
        }
        catch { setError(`Nao foi possivel carregar os pedidos de rodas ${origem}.`); }
        finally { setLoading(false); }
    };
    useEffect(() => {
        void refresh();
        const handleUpdate = () => { void refresh(); };
        window.addEventListener(`mkr_${origem.toLowerCase()}_orders_updated`, handleUpdate);
        return () => window.removeEventListener(`mkr_${origem.toLowerCase()}_orders_updated`, handleUpdate);
    }, [origem]);
    const download = async (order: SCLoadOrder, type: 'pdf' | 'excel') => {
        const key = `${order.id}:${type}`;
        setDownloading(key);
        try { await downloadSCOrderFile(order, type); }
        catch (err) { toast.error(err instanceof Error ? err.message : 'Falha ao baixar arquivo.'); }
        finally { setDownloading(''); }
    };
    const busy = !!downloading || deleting || !!emailSending;
    const retryEmail = async (order: SCLoadOrder) => {
        if (busy) return;
        setEmailSending(order.id);
        try {
            const result = await sendOrderEmail(order.id);
            setEmailStatuses(current => ({ ...current, [order.id]: { pedido_id: order.id, estado: result.estado, enviado_em: null, mensagem: result.mensagem || null } }));
            if (result.estado === 'enviado') toast.success('E-mail enviado.');
            else toast(result.mensagem || orderEmailLabel(result.estado), { duration: 6000 });
        } finally { setEmailSending(''); }
    };
    useEffect(() => {
        if (!open) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !busy) {
                if (toDelete) setToDelete(null);
                else setOpen(false);
            }
        };
        window.addEventListener('keydown', escape);
        return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', escape); };
    }, [open, busy, toDelete]);
    const remove = async () => {
        if (!toDelete || busy) return;
        setDeleting(true);
        try {
            await deleteSCLoadOrder(toDelete);
            setOrders(current => current.filter(order => order.id !== toDelete.id));
            setToDelete(null);
            toast.success('Pedido apagado.');
        } catch (err) { toast.error(err instanceof Error ? err.message : 'Falha ao apagar pedido.'); }
        finally { setDeleting(false); }
    };
    return (
        <>
            <div className="flex justify-end">
                <button onClick={() => { setOpen(true); void refresh(); }} className="inline-flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold text-sm hover:border-emerald-500 transition-colors">
                    <Package className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />Pedidos de Rodas {origem}
                    <span className="min-w-6 text-center text-xs text-slate-500">{loading ? '...' : error ? '-' : orders.length}</span><ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
            </div>
            {open && (
                <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-3 sm:p-6" onClick={event => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
                    <section role="dialog" aria-modal="true" aria-labelledby={`orders-admin-title-${origem}`} className="w-full max-w-4xl max-h-[90dvh] bg-white dark:bg-slate-900 rounded-lg shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-slate-100">
                        <header className="px-4 sm:px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex gap-3 items-center">
                            <Package className="w-6 h-6 text-emerald-700 dark:text-emerald-400 shrink-0" />
                            <div className="flex-1 min-w-0"><h2 id={`orders-admin-title-${origem}`} className="font-bold text-lg">Pedidos de Rodas {origem}</h2><p className="text-xs text-slate-500 mt-1">{orders.length} {orders.length === 1 ? 'pedido recebido' : 'pedidos recebidos'}</p></div>
                            <button onClick={refresh} disabled={loading || busy} title={`Atualizar pedidos ${origem}`} aria-label={`Atualizar pedidos ${origem}`} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
                            <button onClick={() => setOpen(false)} disabled={busy} title="Fechar" aria-label={`Fechar pedidos ${origem}`} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X className="w-5 h-5" /></button>
                        </header>
                        <div className="px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex justify-end"><OrderEmailSettings origem={origem} /></div>
                        <div className="overflow-y-auto flex-1 px-4 sm:px-6">
                            {emailError && <p role="status" className="py-3 text-sm text-amber-700 dark:text-amber-400">{emailError}</p>}
                            {loading && <p role="status" className="py-8 flex items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" />Carregando pedidos...</p>}
                            {error && <p role="alert" className="py-6 text-sm text-red-600">{error}</p>}
                            {!loading && !error && !orders.length && <div className="py-16 text-center"><Package className="w-10 h-10 mx-auto mb-3 text-slate-300" /><p className="text-sm text-slate-500">Nenhum pedido recebido.</p></div>}
                            {orders.map(order => (
                                <article key={order.id} className="py-5 border-b last:border-b-0 border-slate-200 dark:border-slate-800">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-base break-words">Carga {order.cargaNumero}</h3>
                                            <p className="text-xs text-slate-500 mt-1">{new Date(order.dataCriacao).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
                                            <p className="text-sm mt-2"><strong>{order.itens.reduce((sum, item) => sum + item.quantidade, 0)} unidades</strong><span className="text-slate-400 mx-2">·</span><span className="text-slate-500">{order.itens.length} {order.itens.length === 1 ? 'modelo' : 'modelos'}</span></p>
                                            <p className={`text-xs mt-2 ${emailStatuses[order.id]?.estado === 'enviado' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500'}`}>{emailError ? 'Status de e-mail indisponivel' : orderEmailLabel(emailStatuses[order.id]?.estado)}</p>
                                            {emailStatuses[order.id]?.mensagem && <p className="text-xs mt-1 text-amber-700 dark:text-amber-400">{emailStatuses[order.id].mensagem}</p>}
                                        </div>
                                        <div className="flex items-center gap-2 w-full sm:w-auto">
                                            {(['pdf', 'excel'] as const).map(type => (
                                                <button key={type} onClick={() => download(order, type)} disabled={busy} className="inline-flex items-center justify-center gap-1.5 sm:gap-2 h-10 px-2 sm:px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-semibold whitespace-nowrap hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50">
                                                    {downloading === `${order.id}:${type}` ? <Loader2 className="w-4 h-4 animate-spin" /> : type === 'pdf' ? <FileText className="w-4 h-4 text-rose-600" /> : <FileSpreadsheet className="w-4 h-4 text-emerald-700" />}
                                                    {type === 'pdf' ? 'Baixar PDF' : 'Baixar Excel'}<Download className="w-3.5 h-3.5 text-slate-400" />
                                                </button>
                                            ))}
                                            <button onClick={() => setToDelete(order)} disabled={busy} title="Apagar pedido" aria-label={`Apagar pedido da carga ${order.cargaNumero}`} className="w-10 h-10 ml-auto sm:ml-0 shrink-0 inline-flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                    {!emailError && !['enviado', 'enviando', 'incerto'].includes(emailStatuses[order.id]?.estado || '') && <button onClick={() => retryEmail(order)} disabled={busy} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400 disabled:opacity-50">{emailSending === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}{emailStatuses[order.id]?.estado === 'falhou' ? 'Tentar e-mail novamente' : 'Enviar por e-mail'}</button>}
                                    <details className="mt-4 text-sm">
                                        <summary className="cursor-pointer text-slate-500 font-medium w-fit">Ver rodas pedidas</summary>
                                        <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                                            {order.itens.map(item => <div key={item.codigo} className="py-2 flex items-start gap-3"><div className="flex-1 min-w-0"><p className="text-sm break-words">{item.descricao}</p><p className="text-xs text-slate-500 break-all">{item.codigo}</p></div><div className="text-right shrink-0"><strong>{item.quantidade} un</strong><p className="text-[11px] text-slate-500">Carga: {item.quantidadeCarga}</p></div></div>)}
                                        </div>
                                    </details>
                                </article>
                            ))}
                        </div>
                        <footer className="px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end"><button onClick={() => setOpen(false)} disabled={busy} className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700">Fechar</button></footer>
                    </section>
                    {toDelete && (
                        <div className="absolute inset-0 bg-slate-950/50 flex items-center justify-center p-4">
                            <section role="alertdialog" aria-modal="true" aria-labelledby={`orders-delete-title-${origem}`} className="max-w-sm w-full bg-white dark:bg-slate-900 rounded-lg p-5 shadow-xl">
                                <h3 id={`orders-delete-title-${origem}`} className="text-lg font-bold text-slate-900 dark:text-white">Apagar pedido?</h3>
                                <p className="text-sm text-slate-500 mt-2">O pedido da carga {toDelete.cargaNumero} e seus arquivos PDF e Excel serão apagados.</p>
                                <div className="flex justify-end gap-2 mt-5"><button onClick={() => setToDelete(null)} disabled={busy} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200">Cancelar</button><button onClick={remove} disabled={busy} className="inline-flex gap-2 items-center px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50">{deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}Apagar pedido</button></div>
                            </section>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
