import { supabase } from '../lib/supabase';
import type { LoadOrderOrigin } from './scLoadOrderService';

export type OrderEmailState = 'enviando' | 'enviado' | 'falhou' | 'incerto' | 'desativado' | 'nao_configurado' | 'limite';
export interface OrderEmailResult { estado: OrderEmailState; mensagem?: string }
export interface OrderEmailSettings {
    origem: LoadOrderOrigin;
    ativo: boolean;
    destinatarios: string[];
    remetente: string;
    pronto: boolean;
}
export interface OrderEmailStatus { pedido_id: string; estado: OrderEmailState; iniciado_em?: string; enviado_em: string | null; mensagem: string | null }

async function emailRequest<T>(body: Record<string, unknown>): Promise<T> {
    const response = await fetch('/api/romaneio-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        signal: AbortSignal.timeout(65000)
    });
    let data: any;
    try { data = await response.json(); } catch { throw new Error('O servidor de e-mail ainda nao esta disponivel.'); }
    if (!response.ok) throw new Error(data.message || 'Nao foi possivel acessar o envio de e-mail.');
    return data;
}

export const readOrderEmailSettings = (origem: LoadOrderOrigin, password: string) =>
    emailRequest<OrderEmailSettings>({ action: 'read-settings', origem, password });
export const saveOrderEmailSettings = (origem: LoadOrderOrigin, password: string, ativo: boolean, destinatarios: string[]) =>
    emailRequest<OrderEmailSettings>({ action: 'save-settings', origem, password, ativo, destinatarios });

export async function sendOrderEmail(pedidoId: string): Promise<OrderEmailResult> {
    try { return await emailRequest<OrderEmailResult>({ action: 'send', pedidoId }); }
    catch (error) {
        return { estado: 'incerto', mensagem: `Pedido salvo na gestao. ${error instanceof Error ? error.message : 'Nao foi possivel confirmar o e-mail.'}` };
    }
}

export async function getOrderEmailStatuses(ids: string[]): Promise<OrderEmailStatus[]> {
    if (!ids.length) return [];
    const rows: OrderEmailStatus[] = [];
    for (let offset = 0; offset < ids.length; offset += 100) {
        const { data, error } = await supabase.from('romaneio_email_envios')
            .select('pedido_id,estado,iniciado_em,enviado_em,mensagem').in('pedido_id', ids.slice(offset, offset + 100));
        if (error) throw new Error('Nao foi possivel conferir os envios por e-mail.');
        rows.push(...(data || []).map(row => row.estado === 'enviando' && Date.now() - Date.parse(row.iniciado_em) > 120000
            ? { ...row, estado: 'incerto', mensagem: 'Confira o Gmail antes de tentar outro envio.' }
            : row) as OrderEmailStatus[]);
    }
    return rows;
}

export const orderEmailLabel = (estado?: OrderEmailState) => ({
    enviando: 'E-mail em envio', enviado: 'Enviado ao Gmail', falhou: 'E-mail nao enviado',
    incerto: 'Conferir envio no Gmail', desativado: 'Envio desativado',
    nao_configurado: 'Gmail ainda nao configurado', limite: 'Limite diario de envios atingido'
}[estado || ''] || 'Sem envio por e-mail');
