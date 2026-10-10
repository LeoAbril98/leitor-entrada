import assert from 'node:assert/strict';
import { createRomaneioEmailHandler, normalizeRecipients } from '../server/romaneioEmail.js';

const id = 'ca2c1ac4-bcaa-4a16-923c-93130634ca98';
const order = { id, origem: 'CM', carga_numero: 'CM-TESTE', itens: [{ quantidade: 2, quantidadeCarga: 4 }],
    pdf_path: `pedidos-rodas-cm/arquivos/${id}/pedido-cm.pdf`, excel_path: `pedidos-rodas-cm/arquivos/${id}/pedido-cm.xlsx` };
const env = { ROMANEIO_EMAIL_ADMIN_PASSWORD: 'test-only-admin-password', GMAIL_APP_PASSWORD: 'test-only-app-password' };
function fixture() {
    const state = { settings: { origem: 'CM', ativo: true, destinatarios: ['destinatario@example.com'] },
        order: structuredClone(order), delivery: null, failDownload: false, failRecord: false, mailError: null, messages: [] };
    const db = {
        from(table) {
            let operation = 'select', payload;
            const query = {
                select() { return query; }, eq() { return query; },
                upsert(value) { operation = 'upsert'; payload = value; return query; },
                update(value) { operation = 'update'; payload = value; return query; },
                single() { return query; }, maybeSingle() { return query; },
                then(resolve, reject) {
                    const result = (() => {
                        if (table === 'pedidos_romaneio') return { data: state.order, error: null };
                        if (table === 'romaneio_email_config') {
                            if (operation === 'upsert') state.settings = payload;
                            return { data: state.settings, error: null };
                        }
                        if (state.failRecord) return { data: null, error: { message: 'simulated database failure' } };
                        state.delivery = { ...state.delivery, ...payload };
                        return { data: null, error: null };
                    })();
                    return Promise.resolve(result).then(resolve, reject);
                }
            };
            return query;
        },
        async rpc() {
            if (state.delivery && state.delivery.estado !== 'falhou') return { data: { reservado: false, estado: state.delivery.estado }, error: null };
            if (!state.settings.ativo) return { data: { reservado: false, estado: 'desativado' }, error: null };
            state.delivery = { estado: 'enviando' };
            return { data: { reservado: true, estado: 'enviando', destinatarios: state.settings.destinatarios }, error: null };
        },
        storage: { from() { return { async download(path) {
            if (state.failDownload) return { error: { message: 'missing file' }, data: null };
            return { error: null, data: new Blob([path.endsWith('.pdf') ? '%PDF-test' : 'excel-test']) };
        } }; } }
    };
    const transport = { async sendMail(message) {
        state.messages.push(message);
        if (state.mailError) throw state.mailError;
        return { accepted: message.to, rejected: [], messageId: message.messageId };
    } };
    const handler = createRomaneioEmailHandler({ env, db, transport });
    const call = async body => {
        let value;
        const res = { statusCode: 200, setHeader() {}, end(raw) { value = JSON.parse(raw); } };
        await handler({ method: 'POST', headers: { 'content-type': 'application/json' }, body }, res);
        return { status: res.statusCode, ...value };
    };
    return { state, call, db };
}

assert.deepEqual(normalizeRecipients([' A@example.com ', 'a@example.com']), ['a@example.com']);
assert.throws(() => normalizeRecipients(['a@example.com\nb@example.com']));
const settings = fixture();
assert.equal((await settings.call({ action: 'read-settings', origem: 'CM', password: 'wrong' })).status, 401);
assert.equal((await settings.call({ action: 'save-settings', origem: 'CM', password: env.ROMANEIO_EMAIL_ADMIN_PASSWORD, ativo: true, destinatarios: [] })).status, 400);
assert.equal((await settings.call({ action: 'save-settings', origem: 'CM', password: env.ROMANEIO_EMAIL_ADMIN_PASSWORD, ativo: true, destinatarios: [' NEW@example.com '] })).status, 200);
assert.deepEqual(settings.state.settings.destinatarios, ['new@example.com']);

const sent = fixture();
const results = await Promise.all([sent.call({ action: 'send', pedidoId: id }), sent.call({ action: 'send', pedidoId: id })]);
assert.ok(results.some(result => result.estado === 'enviado'));
assert.equal(sent.state.messages.length, 1);
const message = sent.state.messages[0];
assert.deepEqual(message.to, ['destinatario@example.com']);
assert.equal(message.attachments.length, 2);
assert.match(message.attachments[0].filename, /\.pdf$/);
assert.match(message.attachments[1].filename, /\.xlsx$/);
assert.equal(message.attachments[0].content.toString(), '%PDF-test');
assert.equal((await sent.call({ action: 'send', pedidoId: id, destinatarios: ['intruso@example.com'] })).estado, 'enviado');
assert.equal(sent.state.messages.length, 1);

const invalid = fixture();
invalid.state.order.pdf_path = 'sync/romaneios_data.json';
assert.equal((await invalid.call({ action: 'send', pedidoId: id })).status, 400);
assert.equal(invalid.state.messages.length, 0);
const missingFile = fixture();
missingFile.state.failDownload = true;
assert.equal((await missingFile.call({ action: 'send', pedidoId: id })).estado, 'falhou');
assert.equal(missingFile.state.messages.length, 0);
missingFile.state.failDownload = false;
assert.equal((await missingFile.call({ action: 'send', pedidoId: id })).estado, 'enviado');

const smtpAuth = fixture();
smtpAuth.state.mailError = Object.assign(new Error('test credential rejected'), { code: 'EAUTH' });
assert.equal((await smtpAuth.call({ action: 'send', pedidoId: id })).estado, 'falhou');
const ambiguous = fixture();
ambiguous.state.mailError = Object.assign(new Error('test timeout after DATA'), { code: 'ETIMEDOUT', command: 'DATA' });
assert.equal((await ambiguous.call({ action: 'send', pedidoId: id })).estado, 'incerto');
await ambiguous.call({ action: 'send', pedidoId: id });
assert.equal(ambiguous.state.messages.length, 1);
const recordFailure = fixture();
recordFailure.state.failRecord = true;
assert.equal((await recordFailure.call({ action: 'send', pedidoId: id })).estado, 'incerto');
await recordFailure.call({ action: 'send', pedidoId: id });
assert.equal(recordFailure.state.messages.length, 1);
const disabled = fixture();
disabled.state.settings.ativo = false;
assert.equal((await disabled.call({ action: 'send', pedidoId: id })).estado, 'desativado');
assert.equal(disabled.state.messages.length, 0);
console.log('PASS: configuracao protegida, destinatarios fixos, dois anexos, envio unico, falha recuperavel e bloqueio de repeticao incerta. Nenhum e-mail real enviado.');
