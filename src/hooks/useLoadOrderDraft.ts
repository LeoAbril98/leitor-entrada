import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getOrderDraftKey, type LoadOrderDraft, type LoadOrderOrigin } from '../services/scLoadOrderService';

const DEVICE_KEY = 'mkr_romaneio_draft_device_v1';
function deviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEVICE_KEY, id); }
    return id;
}
function readLocal(origin: LoadOrderOrigin) {
    const key = getOrderDraftKey(origin);
    let draft: LoadOrderDraft | null = null;
    try {
        const saved = JSON.parse(localStorage.getItem(key) || 'null');
        if (saved?.id && saved?.cargaId && Array.isArray(saved.itens) && (!saved.origem || saved.origem === origin)) draft = { ...saved, origem: origin };
    } catch { /* O rascunho da nuvem ainda pode ser restaurado. */ }
    let version = Number(localStorage.getItem(`${key}:versao`)) || 0;
    if (draft && !version) { version = Date.now(); localStorage.setItem(`${key}:versao`, String(version)); }
    return { draft, version };
}
function writeLocal(origin: LoadOrderOrigin, draft: LoadOrderDraft | null, version: number) {
    const key = getOrderDraftKey(origin);
    if (draft) localStorage.setItem(key, JSON.stringify(draft));
    else localStorage.removeItem(key);
    localStorage.setItem(`${key}:versao`, String(version));
}

export function useLoadOrderDraft(origin: LoadOrderOrigin) {
    const [initial] = useState(() => readLocal(origin));
    const [draft, setState] = useState(initial.draft);
    const [restoring, setRestoring] = useState(true);
    const [status, setStatus] = useState<'loading' | 'saved' | 'saving' | 'offline'>('loading');
    const current = useRef(initial);
    const queue = useRef<Promise<void>>(Promise.resolve());
    const active = useRef(true);

    const save = useCallback((value: typeof initial) => {
        if (active.current) setStatus('saving');
        queue.current = queue.current.catch(() => {}).then(async () => {
            const { data, error } = await supabase.rpc('salvar_rascunho_romaneio', {
                p_dispositivo: deviceId(), p_origem: origin,
                p_versao: value.version, p_rascunho: value.draft
            }).abortSignal(AbortSignal.timeout(15000));
            if (error || Number(data) !== value.version) throw error || new Error('Rascunho alterado em outra janela.');
            if (active.current && current.current.version === value.version) setStatus('saved');
        }).catch(error => {
            console.warn('Rascunho mantido no aparelho:', error);
            if (active.current && current.current.version === value.version) setStatus('offline');
        });
        return queue.current;
    }, [origin]);

    useEffect(() => {
        active.current = true;
        let cancelled = false;
        const restore = async () => {
            try {
                const { data, error } = await supabase.rpc('ler_rascunho_romaneio', {
                    p_dispositivo: deviceId(), p_origem: origin
                }).abortSignal(AbortSignal.timeout(15000));
                if (error) throw error;
                if (cancelled) return;
                const cloud = data?.[0];
                if (cloud && Number(cloud.versao) > current.current.version) {
                    const value = { draft: cloud.rascunho as LoadOrderDraft | null, version: Number(cloud.versao) };
                    writeLocal(origin, value.draft, value.version);
                    current.current = value;
                    setState(value.draft);
                    setStatus('saved');
                } else if (current.current.version > Number(cloud?.versao || 0)) {
                    void save(current.current);
                } else setStatus('saved');
                // A completed order must not return if the browser closed before clearing its draft.
                const restoredDraft = current.current.draft;
                if (restoredDraft?.itens.length) {
                    const received = await supabase.from('pedidos_romaneio').select('id')
                        .eq('id', restoredDraft.id).eq('origem', origin).limit(1)
                        .abortSignal(AbortSignal.timeout(5000));
                    if (cancelled) return;
                    if (!received.error && received.data?.some(order => order.id === restoredDraft.id)) {
                        const value = { draft: null, version: Math.max(Date.now(), current.current.version + 1, readLocal(origin).version + 1) };
                        writeLocal(origin, null, value.version);
                        current.current = value;
                        setState(null);
                        void save(value);
                    }
                }
            } catch (error) {
                console.warn('Nao foi possivel restaurar o rascunho da nuvem:', error);
                if (!cancelled) setStatus('offline');
            } finally { if (!cancelled) setRestoring(false); }
        };
        void restore();
        const retry = () => { if (current.current.version) void save(current.current); else void restore(); };
        window.addEventListener('online', retry);
        return () => { cancelled = true; active.current = false; window.removeEventListener('online', retry); };
    }, [origin, save]);

    const setDraft = useCallback((update: LoadOrderDraft | null | ((draft: LoadOrderDraft | null) => LoadOrderDraft | null)) => {
        const next = typeof update === 'function' ? update(current.current.draft) : update;
        const storedVersion = readLocal(origin).version;
        const value = { draft: next, version: Math.max(Date.now(), current.current.version + 1, storedVersion + 1) };
        // Salva localmente antes de atualizar a tela; a rede nunca bloqueia esta copia.
        writeLocal(origin, next, value.version);
        current.current = value;
        setState(next);
        void save(value);
    }, [origin, save]);
    const retry = useCallback(() => { if (current.current.version) void save(current.current); }, [save]);
    return { draft, setDraft, status, restoring, retry };
}
