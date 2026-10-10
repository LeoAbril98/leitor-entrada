import { createHash, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

const sender = 'leoabril98@gmail.com';
const origins = ['SC', 'CM'];
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const checked = result => {
    if (result.error) throw fail('Nao foi possivel acessar a configuracao de e-mail.', 503);
    return result.data;
};
export function normalizeRecipients(values) {
    if (!Array.isArray(values) || values.length > 20) throw fail('Informe ate 20 destinatarios.');
    const recipients = [...new Set(values.map(value => typeof value === 'string' ? value.trim().toLowerCase() : ''))];
    if (recipients.some(value => value.length > 254 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(value))) {
        throw fail('Confira os enderecos de e-mail.');
    }
    return recipients;
}

export function createRomaneioEmailHandler({ env = process.env, db: providedDb, transport: providedTransport } = {}) {
    return async (req, res) => {
        const reply = (body, status = 200) => {
            res.statusCode = status;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(JSON.stringify(body));
        };
        try {
            if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return reply({ message: 'Metodo invalido.' }, 405); }
            if (!String(req.headers['content-type'] || '').includes('application/json')) throw fail('Envie dados JSON.', 415);
            let body = req.body;
            if (body === undefined) {
                let raw = '';
                for await (const chunk of req) {
                    raw += chunk;
                    if (Buffer.byteLength(raw) > 8192) throw fail('Solicitacao muito grande.', 413);
                }
                try { body = JSON.parse(raw); } catch { throw fail('Solicitacao invalida.'); }
            }
            if (typeof body === 'string') { try { body = JSON.parse(body); } catch { throw fail('Solicitacao invalida.'); } }
            if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail('Solicitacao invalida.');
            const { action, origem } = body;
            if (!['read-settings', 'save-settings', 'test-gmail', 'send'].includes(action)) throw fail('Acao invalida.');
            if (!providedDb && (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)) throw fail('Servidor de e-mail ainda nao configurado.', 503);
            const db = providedDb || createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
            if (action !== 'send') {
                if (!origins.includes(origem)) throw fail('Origem invalida.');
                if (!env.ROMANEIO_EMAIL_ADMIN_PASSWORD) throw fail('A senha de configuracao ainda nao foi definida no servidor.', 503);
                const expected = createHash('sha256').update(env.ROMANEIO_EMAIL_ADMIN_PASSWORD).digest();
                const actual = createHash('sha256').update(typeof body.password === 'string' ? body.password : '').digest();
                if (!timingSafeEqual(expected, actual)) throw fail('Senha de configuracao incorreta.', 401);
                if (action === 'test-gmail') {
                    if (!env.GMAIL_APP_PASSWORD && !providedTransport) throw fail('A senha de app do Gmail ainda nao foi cadastrada.', 503);
                    const pdf = new jsPDF();
                    pdf.setFontSize(16);
                    pdf.text(`TESTE DE ENVIO - PEDIDO ${origem}`, 14, 20);
                    pdf.setFontSize(10);
                    pdf.text('Documento ficticio. Nao representa um pedido de rodas.', 14, 30);
                    pdf.text('CODIGO: TESTE | DESCRICAO: Roda de teste | QUANTIDADE: 1', 14, 42);
                    const workbook = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
                        { Codigo: 'TESTE', Descricao: 'Roda ficticia - nao e um pedido', Quantidade: 1 }
                    ]), 'Teste');
                    const transport = providedTransport || nodemailer.createTransport({
                        host: 'smtp.gmail.com', port: 465, secure: true,
                        auth: { user: sender, pass: env.GMAIL_APP_PASSWORD.replace(/\s/g, '') },
                        connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000
                    });
                    try {
                        const result = await transport.sendMail({
                            from: `Pedidos de Rodas <${sender}>`, to: [sender],
                            subject: `TESTE - Envio dos pedidos de rodas ${origem}`,
                            text: 'Teste da conexao com o Gmail. Os anexos PDF e Excel sao ficticios e nao representam um pedido.',
                            attachments: [
                                { filename: 'teste-pedido.pdf', content: Buffer.from(pdf.output('arraybuffer')), contentType: 'application/pdf' },
                                { filename: 'teste-pedido.xlsx', content: Buffer.from(XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })), contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
                            ],
                            disableFileAccess: true, disableUrlAccess: true
                        });
                        if (!result.accepted?.length) throw new Error('Envio nao aceito');
                    } catch (error) {
                        throw fail(error.code === 'EAUTH' ? 'O Gmail recusou a senha de app. Confira a configuracao na Vercel.' : 'Nao foi possivel confirmar o teste. Confira o Gmail antes de repetir.', 503);
                    }
                    return reply({ enviado: true, destinatario: sender });
                }
                if (action === 'save-settings') {
                    const recipients = normalizeRecipients(body.destinatarios);
                    if (typeof body.ativo !== 'boolean' || (body.ativo && !recipients.length)) throw fail('Adicione pelo menos um destinatario para ativar.');
                    checked(await db.from('romaneio_email_config').upsert({ origem, ativo: body.ativo, destinatarios: recipients, atualizado_em: new Date().toISOString() }));
                }
                const settings = checked(await db.from('romaneio_email_config').select('origem,ativo,destinatarios').eq('origem', origem).single());
                return reply({ ...settings, remetente: sender, pronto: Boolean(env.GMAIL_APP_PASSWORD) });
            }
            if (typeof body.pedidoId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.pedidoId)) throw fail('Pedido invalido.');
            if (!env.GMAIL_APP_PASSWORD && !providedTransport) return reply({ estado: 'nao_configurado', mensagem: 'Pedido salvo. O envio pelo Gmail ainda nao foi ativado.' });
            const order = checked(await db.from('pedidos_romaneio').select('id,origem,carga_numero,itens,pdf_path,excel_path').eq('id', body.pedidoId).maybeSingle());
            if (!order) throw fail('Pedido nao encontrado.', 404);
            const root = `pedidos-rodas-${String(order.origem).toLowerCase()}/arquivos/${order.id}/pedido-${String(order.origem).toLowerCase()}`;
            if (!origins.includes(order.origem) || order.pdf_path !== `${root}.pdf` || order.excel_path !== `${root}.xlsx` ||
                !Array.isArray(order.itens) || !order.itens.length || order.itens.length > 1000 || order.itens.some(item =>
                    !Number.isSafeInteger(item.quantidade) || item.quantidade <= 0 || !Number.isSafeInteger(item.quantidadeCarga) || item.quantidade > item.quantidadeCarga)) {
                throw fail('Os dados ou arquivos do pedido sao invalidos.');
            }
            const reservation = checked(await db.rpc('reservar_email_romaneio', { p_pedido: order.id }));
            if (!reservation?.reservado) return reply({ estado: reservation?.estado || 'falhou' });
            let contactedGmail = false;
            let acceptedByGmail = false;
            try {
                const attachments = [];
                for (const [path, extension, type] of [
                    [order.pdf_path, 'pdf', 'application/pdf'],
                    [order.excel_path, 'xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
                ]) {
                    const { data, error } = await db.storage.from('fotos').download(path);
                    if (error || !data || data.size > 8 * 1024 * 1024) throw fail('Nao foi possivel obter os anexos do pedido.', 503);
                    attachments.push({ filename: `pedido-${order.origem.toLowerCase()}-${order.id.slice(0, 8)}.${extension}`, content: Buffer.from(await data.arrayBuffer()), contentType: type });
                }
                const transport = providedTransport || nodemailer.createTransport({
                    host: 'smtp.gmail.com', port: 465, secure: true,
                    auth: { user: sender, pass: env.GMAIL_APP_PASSWORD.replace(/\s/g, '') },
                    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000
                });
                const loadNumber = String(order.carga_numero).replace(/[\r\n]/g, ' ').slice(0, 150);
                contactedGmail = true;
                const result = await transport.sendMail({
                    from: `Pedidos de Rodas <${sender}>`, to: reservation.destinatarios,
                    subject: `Pedido de rodas ${order.origem} - Carga ${loadNumber}`,
                    text: `Pedido de rodas ${order.origem}\nCarga: ${loadNumber}\nPedido: ${order.id}\n\nSeguem o PDF e o Excel com as rodas solicitadas.`,
                    messageId: `<romaneio-${order.id}@gmail.com>`, attachments,
                    disableFileAccess: true, disableUrlAccess: true
                });
                acceptedByGmail = Boolean(result.accepted?.length);
                if (!acceptedByGmail) throw fail('O Gmail nao aceitou o envio.', 503);
                const partial = Boolean(result.rejected?.length);
                checked(await db.from('romaneio_email_envios').update({
                    estado: partial ? 'incerto' : 'enviado', enviado_em: new Date().toISOString(), message_id: result.messageId,
                    mensagem: partial ? 'Alguns destinatarios foram recusados. Confira o Gmail.' : null
                }).eq('pedido_id', order.id));
                return reply({ estado: partial ? 'incerto' : 'enviado' });
            } catch (error) {
                // SMTP has no idempotency API: ambiguous acceptance must not trigger an automatic resend.
                const safeToRetry = !acceptedByGmail && (!contactedGmail || error.code === 'EAUTH' || error.command === 'CONN' || Number(error.responseCode) >= 400);
                const estado = safeToRetry ? 'falhou' : 'incerto';
                const mensagem = safeToRetry ? 'Pedido salvo. O e-mail nao foi enviado. Tente novamente na gestao.' : 'Pedido salvo. Confirme o envio no Gmail antes de tentar novamente.';
                await db.from('romaneio_email_envios').update({ estado, mensagem }).eq('pedido_id', order.id);
                return reply({ estado, mensagem });
            }
        } catch (error) {
            return reply({ message: error.status ? error.message : 'Nao foi possivel concluir a operacao de e-mail.' }, error.status || 503);
        }
    };
}

