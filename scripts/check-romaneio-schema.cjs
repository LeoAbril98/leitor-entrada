const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('dotenv').config({ path: '.env.local', quiet: true });
const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

(async () => {
    for (const [table, columns] of [
        ['inventario_itens', 'codigo,quantidade'],
        ['pendencias_estoque', 'codigo'],
        ['romaneio_estoque_cm', 'codigo,descricao,quantidade,atualizado_em'],
        ['pedidos_romaneio', 'id,origem,carga_id,carga_numero,itens,pdf_path,excel_path,data_criacao']
    ]) {
        const { error } = await db.from(table).select(columns).limit(1);
        assert.equal(error, null, `${table}: ${error?.message}`);
    }
    const loads = await db.from('romaneios').select('id,tipo,itens').limit(1);
    if (loads.error) {
        assert.equal(loads.error.code, 'PGRST205');
        const mirror = await db.storage.from('fotos').download('sync/romaneios_data.json');
        assert.equal(mirror.error, null, 'Espelho dos romaneios deve continuar acessivel');
        assert.ok(Array.isArray(JSON.parse(await mirror.data.text())));
    }
    const read = await db.rpc('ler_rascunho_romaneio', { p_dispositivo: randomUUID(), p_origem: 'CM' });
    assert.equal(read.error, null);
    assert.deepEqual(read.data, []);
    const denied = await db.from('romaneio_pedido_rascunhos').select('*').limit(1);
    assert.equal(denied.error?.code, '42501', 'Rascunhos nao podem ser listados publicamente');
    // Uma chamada invalida testa o acesso a funcao sem criar nenhum registro.
    const save = await db.rpc('salvar_rascunho_romaneio', {
        p_dispositivo: null, p_origem: 'CM', p_versao: 1, p_rascunho: null
    });
    assert.equal(save.error?.code, 'P0001');
    const emailStatus = await db.from('romaneio_email_envios').select('pedido_id,estado,enviado_em,mensagem').limit(1);
    assert.equal(emailStatus.error, null);
    const emailSettings = await db.from('romaneio_email_config').select('*').limit(1);
    assert.equal(emailSettings.error?.code, '42501', 'Destinatarios precisam ficar privados');
    const recipients = await db.from('romaneio_email_envios').select('destinatarios').limit(1);
    assert.equal(recipients.error?.code, '42501', 'Destinatarios do envio precisam ficar privados');
    const reservation = await db.rpc('reservar_email_romaneio', { p_pedido: randomUUID() });
    assert.equal(reservation.error?.code, '42501', 'Somente o servidor pode reservar envios');
    console.log('PASS: tabelas CM/pedidos e funcoes de rascunho disponiveis; listagem privada bloqueada. Nenhum dado alterado.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
