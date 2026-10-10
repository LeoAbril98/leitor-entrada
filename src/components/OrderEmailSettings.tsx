import { useEffect, useState } from 'react';
import { Loader2, LockKeyhole, Mail, Plus, Save, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { readOrderEmailSettings, saveOrderEmailSettings, type OrderEmailSettings as EmailSettings } from '../services/romaneioEmailService';
import type { LoadOrderOrigin } from '../services/scLoadOrderService';

export function OrderEmailSettings({ origem }: { origem: LoadOrderOrigin }) {
    const [open, setOpen] = useState(false);
    const [password, setPassword] = useState('');
    const [settings, setSettings] = useState<EmailSettings | null>(null);
    const [address, setAddress] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const close = () => { if (!busy) { setOpen(false); setPassword(''); setSettings(null); setAddress(''); setError(''); } };
    useEffect(() => { setOpen(false); setPassword(''); setSettings(null); }, [origem]);
    useEffect(() => {
        if (!open) return;
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopImmediatePropagation(); close(); } };
        window.addEventListener('keydown', escape, true);
        return () => window.removeEventListener('keydown', escape, true);
    }, [open, busy]);
    const load = async () => {
        setBusy(true); setError('');
        try { setSettings(await readOrderEmailSettings(origem, password)); }
        catch (err) { setError(err instanceof Error ? err.message : 'Falha ao carregar destinatarios.'); }
        finally { setBusy(false); }
    };
    const add = () => {
        const email = address.trim().toLowerCase();
        if (!settings || !email) return;
        if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) || email.length > 254) { setError('Informe um e-mail valido.'); return; }
        if (settings.destinatarios.length >= 20) { setError('Limite de 20 destinatarios.'); return; }
        setSettings({ ...settings, destinatarios: [...new Set([...settings.destinatarios, email])] });
        setAddress(''); setError('');
    };
    const save = async () => {
        if (!settings) return;
        if (address.trim()) { setError('Adicione o e-mail digitado antes de salvar.'); return; }
        setBusy(true); setError('');
        try {
            setSettings(await saveOrderEmailSettings(origem, password, settings.ativo, settings.destinatarios));
            toast.success(`Destinatarios de ${origem} salvos.`);
        } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao salvar destinatarios.'); }
        finally { setBusy(false); }
    };
    return <>
        <button onClick={() => setOpen(true)} title={`Configurar destinatarios ${origem}`} className="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"><Mail className="w-4 h-4" />Destinatarios</button>
        {open && <div className="fixed inset-0 z-[60] bg-slate-950/60 flex items-center justify-center p-4" onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) close(); }}>
            <section role="dialog" aria-modal="true" aria-labelledby={`email-settings-${origem}`} className="w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-white dark:bg-slate-900 rounded-lg shadow-2xl text-slate-900 dark:text-slate-100">
                <header className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3"><Mail className="w-5 h-5 text-emerald-700" /><h3 id={`email-settings-${origem}`} className="font-bold flex-1">E-mail dos pedidos {origem}</h3><button onClick={close} disabled={busy} title="Fechar destinatarios" aria-label="Fechar destinatarios" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X className="w-5 h-5" /></button></header>
                <div className="p-4 space-y-4">
                    <p className="text-sm text-slate-500 break-all">Remetente: leoabril98@gmail.com</p>
                    {!settings ? <form onSubmit={event => { event.preventDefault(); void load(); }} className="space-y-3">
                        <label className="block text-sm font-semibold">Senha de configuracao<input type="password" autoFocus autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} className="block mt-2 w-full h-11 border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3" /></label>
                        <button disabled={busy || !password} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 text-white font-semibold text-sm disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LockKeyhole className="w-4 h-4" />}Abrir configuracao</button>
                    </form> : <>
                        {!settings.pronto && <p role="status" className="text-sm text-amber-700 dark:text-amber-400">A conexao com o Gmail ainda precisa ser ativada.</p>}
                        <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={settings.ativo} disabled={busy} onChange={event => setSettings({ ...settings, ativo: event.target.checked })} className="w-4 h-4 accent-emerald-700" />Enviar pedidos por e-mail</label>
                        <form onSubmit={event => { event.preventDefault(); add(); }} className="flex items-end gap-2">
                            <label className="block flex-1 min-w-0 text-sm font-semibold">Destinatario<input type="email" autoFocus value={address} onChange={event => setAddress(event.target.value)} disabled={busy} placeholder="nome@empresa.com.br" className="block mt-2 w-full h-11 border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 font-normal" /></label>
                            <button disabled={busy || !address.trim()} title="Adicionar destinatario" aria-label="Adicionar destinatario" className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-lg bg-emerald-700 text-white disabled:opacity-50"><Plus className="w-5 h-5" /></button>
                        </form>
                        <ul className="divide-y divide-slate-200 dark:divide-slate-800">{settings.destinatarios.map(email => <li key={email} className="flex items-center gap-2 py-2 text-sm"><span className="flex-1 min-w-0 break-all">{email}</span><button disabled={busy} onClick={() => setSettings({ ...settings, destinatarios: settings.destinatarios.filter(value => value !== email) })} title="Remover destinatario" aria-label={`Remover ${email}`} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg"><Trash2 className="w-4 h-4" /></button></li>)}</ul>
                        {!settings.destinatarios.length && <p className="text-sm text-slate-500">Nenhum destinatario cadastrado.</p>}
                    </>}
                    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
                </div>
                {settings && <footer className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end"><button onClick={save} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Salvar destinatarios</button></footer>}
            </section>
        </div>}
    </>;
}
