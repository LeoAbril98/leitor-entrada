const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('dotenv').config({ path: '.env.local', quiet: true });
const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

(async () => {
    const bucket = db.storage.from('fotos');
    for (const origin of ['sc', 'cm']) {
        const folder = `pedidos-rodas-${origin}/verificacao-${randomUUID()}`;
        const path = `${folder}/teste.txt`;
        let uploaded = false;
        try {
            const upload = await bucket.upload(path, 'verificacao de permissao', { contentType: 'text/plain' });
            assert.equal(upload.error, null, upload.error?.message);
            uploaded = true;
            const update = await bucket.update(path, 'verificacao concluida', { contentType: 'text/plain' });
            assert.equal(update.error, null, update.error?.message);
            const download = await bucket.download(path);
            assert.equal(download.error, null, download.error?.message);
            assert.equal(await download.data.text(), 'verificacao concluida');
            const list = await bucket.list(folder);
            assert.equal(list.error, null, list.error?.message);
            assert.ok(list.data.some(file => file.name === 'teste.txt'));
        } finally {
            if (uploaded) {
                const removal = await bucket.remove([path]);
                assert.equal(removal.error, null, removal.error?.message);
                const remaining = await bucket.list(folder);
                assert.equal(remaining.error, null, remaining.error?.message);
                assert.equal(remaining.data.length, 0);
            }
        }
    }
    console.log('PASS: envio, atualizacao, leitura e exclusao SC/CM com chave publica. Arquivos de teste removidos.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
