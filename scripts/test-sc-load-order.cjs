const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const XLSX = require('xlsx');

const origin = process.env.TEST_ORDER_ORIGIN || 'SC';
const root = `pedidos-rodas-${origin.toLowerCase()}`;
const draftKey = `mkr_pedido_rodas_${origin.toLowerCase()}_rascunho_v1`;
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3010';
const output = path.resolve(process.env.TEST_OUTPUT_DIR || path.join(require('node:os').tmpdir(), 'leitor-sc-load-order-test'));
fs.mkdirSync(output, { recursive: true });
const photoFile = path.resolve('public/fotos/LINHA C/C10/C10 15X10  4F BD.png');
const photo = fs.readFileSync(fs.existsSync(photoFile) ? photoFile : 'public/pwa-192x192.png');
const load = {
    id: `test-${origin.toLowerCase()}-load`, numero: `${origin}-TEST`, titulo: origin === 'CM' ? 'Carga Campinas' : 'Carga Santa Catarina', tipo: origin,
    dataCriacao: '2026-10-07T00:00:00Z', dataAtualizacao: '2026-10-07T00:00:00Z',
    status: 'pendente', totalItens: 3, totalPecas: 36, totalConferido: 0, arquivos: [],
    itens: [
        { id: 'a', codigo: ' C10-A ', descricao: 'C10 15X10 4X100 BLACK DIAMOND', quantidade: 20, local: 'A-01', estoqueDb: 99, conferido: 0 },
        { id: 'b', codigo: 'c10-a', descricao: 'C10 15X10 4X100 BLACK DIAMOND', quantidade: 4, local: 'A-01', estoqueDb: 99, conferido: 0 },
        { id: 'c', codigo: 'C10-B', descricao: 'C10 15X7 5X114 BLACK DIAMOND', quantidade: 12, local: 'B-01', estoqueDb: 99, conferido: 0 }
    ]
};
const sqlLoad = {
    id: load.id, numero: load.numero, titulo: load.titulo, tipo: origin,
    data_criacao: load.dataCriacao, data_atualizacao: load.dataAtualizacao,
    status: load.status, total_itens: 3, total_pecas: 36, total_conferido: 0,
    itens: load.itens, arquivos: []
};
const stock = [
    { codigo: 'C10-A', descricao: load.itens[0].descricao, quantidade: 18, est_mk: 18, est_moleri: 4 },
    { codigo: 'C10-B', descricao: load.itens[2].descricao, quantidade: 0, est_mk: 0, est_moleri: 6 }
];

(async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
    try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference' });
        const storage = new Map();
        const cloudDrafts = new Map();
        const receivedOrders = new Map();
        const uploadedLoads = new Map([[sqlLoad.id, sqlLoad]]);
        let failCloud = false;
        let failExcel = true;
        let uploadCount = 0;
        const emailStatuses = new Map();
        const emailSettings = new Map();
        await context.route('**/*', async route => {
            const req = route.request(), url = new URL(req.url()), pathname = decodeURIComponent(url.pathname);
            const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } });
            if (pathname === '/api/romaneio-email') {
                const body = req.postDataJSON();
                if (body.action === 'send') {
                    emailStatuses.set(body.pedidoId, { pedido_id: body.pedidoId, estado: 'enviado', enviado_em: new Date().toISOString(), mensagem: null });
                    return json({ estado: 'enviado' });
                }
                if (body.password !== 'email-test') return json({ message: 'Senha de configuracao incorreta.' }, 401);
                if (body.action === 'save-settings') emailSettings.set(body.origem, { origem: body.origem, ativo: body.ativo, destinatarios: body.destinatarios });
                return json({ ...(emailSettings.get(body.origem) || { origem: body.origem, ativo: false, destinatarios: [] }), remetente: 'mkrrodascuritiba@gmail.com', pronto: true });
            }
            if (url.origin === baseURL) return route.continue();
            if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
            if (pathname.includes('/rest/v1/')) {
                const table = pathname.split('/rest/v1/')[1];
                if (table === 'romaneio_email_envios') return json([...emailStatuses.values()]);
                if (table === 'rpc/ler_rascunho_romaneio') {
                    const body = req.postDataJSON(), row = cloudDrafts.get(`${body.p_dispositivo}:${body.p_origem}`);
                    return json(row ? [row] : []);
                }
                if (table === 'rpc/salvar_rascunho_romaneio') {
                    if (failCloud) return json({ message: 'Falha de nuvem simulada' }, 500);
                    const body = req.postDataJSON(), key = `${body.p_dispositivo}:${body.p_origem}`;
                    const previous = cloudDrafts.get(key);
                    if (!previous || body.p_versao > previous.versao) cloudDrafts.set(key, { rascunho: body.p_rascunho, versao: body.p_versao });
                    return json(cloudDrafts.get(key).versao);
                }
                if (table === 'pedidos_romaneio') {
                    if (req.method() === 'POST') {
                        const payload = req.postDataJSON();
                        for (const row of Array.isArray(payload) ? payload : [payload]) receivedOrders.set(row.id, row);
                        return json([]);
                    }
                    if (req.method() === 'DELETE') {
                        receivedOrders.delete(url.searchParams.get('id')?.replace(/^eq\./, ''));
                        return json([]);
                    }
                    const uf = url.searchParams.get('origem')?.replace(/^eq\./, '');
                    const id = url.searchParams.get('id')?.replace(/^eq\./, '');
                    return json([...receivedOrders.values()].filter(row => (!uf || row.origem === uf) && (!id || row.id === id)));
                }
                if (table === 'romaneios') {
                    if (req.method() === 'POST') {
                        const payload = req.postDataJSON();
                        for (const row of Array.isArray(payload) ? payload : [payload]) uploadedLoads.set(row.id, row);
                    }
                    return json([...uploadedLoads.values()]);
                }
                if (table === 'inventario_itens') return json(stock.map(item => ({ ...item, inventario_id: 'test-pr-inventory', est_moleri: 555, est_sc: 555 })));
                if (table === 'inventarios') return json([{ criado_em: new Date(Date.now() - 48 * 3600000).toISOString() }]);
                if (table === 'romaneio_estoque_cm') return json(stock.map(item => ({ codigo: item.codigo, quantidade: origin === 'CM' ? item.est_moleri : 777, atualizado_em: new Date().toISOString() })));
                if (table === 'romaneio_estoque_sc') return json(stock.map(item => ({ codigo: item.codigo, quantidade: origin === 'SC' ? item.est_moleri : 888, atualizado_em: new Date().toISOString() })));
                if (table === 'pendencias_estoque') return json(stock.map(item => ({ ...item, quantidade: 999, est_mk: 999, est_moleri: 999 })));
                return json([]);
            }
            if (pathname.includes('/storage/v1/object/list/fotos')) {
                const { prefix, offset = 0, limit = 100 } = req.postDataJSON();
                return json([...storage.keys()].filter(key => key.startsWith(`${prefix}/`)).map(key => ({ name: key.slice(prefix.length + 1) })).slice(offset, offset + limit));
            }
            if (pathname.includes('/storage/v1/object/')) {
                if (req.method() === 'DELETE') {
                    const { prefixes } = req.postDataJSON();
                    prefixes.forEach(key => storage.delete(key));
                    return json(prefixes.map(name => ({ name })));
                }
                const key = pathname.split('/fotos/')[1];
                if (pathname.includes('/public/fotos/') && !key?.startsWith(`${root}/`)) {
                    if (key?.endsWith('.json')) return json({});
                    return route.fulfill({ contentType: 'image/png', body: photo, headers: { 'access-control-allow-origin': '*' } });
                }
                if (req.method() === 'POST' || req.method() === 'PUT') {
                    if (key.endsWith('.xlsx') && failExcel) return json({ statusCode: '500', error: 'TestFailure', message: 'Falha simulada no Excel' }, 500);
                    const form = await new Request('https://example.test', { method: 'POST', headers: req.headers(), body: req.postDataBuffer() }).formData();
                    const file = form.get('');
                    storage.set(key, { body: Buffer.from(await file.arrayBuffer()), type: file.type });
                    uploadCount++;
                    return json({ Key: key });
                }
                const file = storage.get(key);
                return file ? route.fulfill({ status: 200, contentType: file.type, body: file.body, headers: { 'access-control-allow-origin': '*' } }) : json({ statusCode: '404', error: 'not_found', message: 'Object not found' }, 404);
            }
            if (/\.(png|webp|jpg|svg)$/.test(pathname)) return route.fulfill({ contentType: 'image/png', body: photo, headers: { 'access-control-allow-origin': '*' } });
            return json([]);
        });
        const page = await context.newPage();
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(err.message));
        await page.goto(`${baseURL}/pendencias`);
        await page.getByRole('heading', { name: /Pendências/ }).waitFor();
        assert.equal(await page.getByRole('button', { name: `Pedir Rodas de ${origin}`, exact: true }).count(), 0, 'Pendencias must not contain the new entry');
        await page.goto(baseURL);
        await page.getByRole('heading', { name: 'Romaneio', exact: true }).click();
        await page.getByLabel('Atualizacao dos estoques').locator('time').first().waitFor();
        await page.getByLabel('Filtrar estoque do romaneio').selectOption('none');
        await page.getByText('Nenhuma roda encontrada para os filtros aplicados.', { exact: true }).waitFor();
        await page.getByLabel('Filtrar estoque do romaneio').selectOption('all');
        await page.getByLabel('Buscar no romaneio').fill('CODIGO-INEXISTENTE');
        await page.getByText('Nenhuma roda encontrada para os filtros aplicados.', { exact: true }).waitFor();
        await page.getByLabel('Buscar no romaneio').fill('');
        await page.screenshot({ path: path.join(output, 'romaneio-desktop.png'), fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Romaneio filters must fit mobile');
        await page.screenshot({ path: path.join(output, 'romaneio-mobile.png'), fullPage: true });
        await page.setViewportSize({ width: 1280, height: 900 });
        const unknownStock = await page.evaluate(async () => {
            const { matchesStockFilter } = await import('/src/utils/stockFilters.ts');
            return [matchesStockFilter('none', 0, null), matchesStockFilter('sc', 0, null), matchesStockFilter('pr', 2, null)];
        });
        assert.deepEqual(unknownStock, [false, false, true], 'Unavailable SC stock must not be treated as zero');
        await page.getByRole('button', { name: `Pedir Rodas de ${origin}`, exact: true }).click();
        await page.getByRole('button', { name: 'Pedir', exact: true }).first().waitFor();
        assert.equal(await page.getByRole('button', { name: 'Pedir', exact: true }).count(), 2, 'Duplicate codes must be grouped within a load');
        assert.match(await page.locator('main').innerText(), /24/);
        assert.match(await page.locator('main').innerText(), /18/);
        assert.doesNotMatch(await page.locator('main').innerText(), /\b999\b/, 'Romaneio must not use balances imported into Pendencias');
        assert.doesNotMatch(await page.locator('main').innerText(), /\b555\b|\b777\b|\b888\b/, 'State stock must come exclusively from its dedicated table');
        assert.match(await page.getByLabel('Atualizacao dos estoques').innerText(), /Mais de 24h sem atualizar/);
        assert.equal(await page.getByLabel('Atualizacao dos estoques').locator('time').count(), 2);
        await page.getByLabel('Filtrar estoque', { exact: true }).selectOption('pr');
        assert.equal(await page.getByRole('button', { name: 'Pedir', exact: true }).count(), 1);
        await page.getByLabel('Filtrar estoque', { exact: true }).selectOption('none');
        await page.getByText('Nenhuma roda encontrada.', { exact: true }).waitFor();
        await page.getByLabel('Filtrar estoque', { exact: true }).selectOption('sc');
        assert.equal(await page.getByRole('button', { name: 'Pedir', exact: true }).count(), 2);
        await page.getByLabel('Filtrar estoque', { exact: true }).selectOption('all');
        await page.getByLabel('Buscar roda', { exact: true }).fill('C10-B');
        assert.equal(await page.getByRole('button', { name: 'Pedir', exact: true }).count(), 1);
        await page.getByLabel('Buscar roda', { exact: true }).fill('');
        await page.setViewportSize({ width: 768, height: 1024 });
        assert.equal(await page.getByRole('button', { name: /Enviar pedido/ }).isVisible(), true, 'Empty tablet order must still show the send button');
        assert.equal(await page.getByRole('button', { name: /Enviar pedido/ }).isDisabled(), true, 'Empty orders cannot be sent');
        await page.screenshot({ path: path.join(output, 'tablet-empty.png') });
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
        await page.getByText('C10-A', { exact: true }).locator('..').locator('..').locator('..').getByRole('button', { name: 'Pedir', exact: true }).click();
        await page.getByRole('spinbutton', { name: 'Quantidade pedida' }).fill('999');
        assert.equal(await page.getByRole('spinbutton', { name: 'Quantidade pedida' }).inputValue(), '24');
        assert.equal(await page.getByRole('button', { name: 'Aumentar quantidade', exact: true }).isDisabled(), true);
        assert.equal(await page.getByRole('button', { name: '+4', exact: true }).isDisabled(), true);
        await page.getByRole('button', { name: 'C', exact: true }).click();
        await page.getByRole('button', { name: '9', exact: true }).click();
        await page.getByRole('button', { name: '9', exact: true }).click();
        assert.equal(await page.getByRole('spinbutton', { name: 'Quantidade pedida' }).inputValue(), '24');
        await page.screenshot({ path: path.join(output, 'desktop-modal.png') });
        await page.getByRole('button', { name: 'C', exact: true }).click();
        await page.getByRole('button', { name: '+4', exact: true }).click();
        await page.getByRole('button', { name: 'Confirmar pedido', exact: true }).click();
        await page.getByRole('button', { name: /Enviar pedido/ }).waitFor();
        await page.getByText('Pedido salvo na nuvem', { exact: true }).waitFor();
        const savedCloud = [...cloudDrafts.values()].find(row => row.rascunho?.origem === origin);
        assert.equal(savedCloud.rascunho.itens[0].quantidade, 4);
        await page.evaluate(key => { localStorage.removeItem(key); localStorage.removeItem(`${key}:versao`); }, draftKey);
        await page.reload();
        await page.getByRole('heading', { name: 'Romaneio', exact: true }).click();
        await page.getByRole('button', { name: `Pedir Rodas de ${origin}`, exact: true }).click();
        await page.getByRole('button', { name: '4 pedidas', exact: true }).waitFor();
        const resumeDialog = page.getByRole('dialog', { name: `Continuar pedido de ${origin}?`, exact: true });
        await resumeDialog.waitFor();
        assert.match(await resumeDialog.innerText(), /4 unidades/);
        await page.screenshot({ path: path.join(output, 'resume-desktop.png') });
        await resumeDialog.getByRole('button', { name: 'Continuar pedido', exact: true }).click();
        await page.getByText('Pedido salvo na nuvem', { exact: true }).waitFor();
        await page.getByLabel('Somente no pedido', { exact: true }).check();
        assert.equal(await page.getByRole('button', { name: 'Pedir', exact: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: '4 pedidas', exact: true }).count(), 1);
        await page.getByLabel('Somente no pedido', { exact: true }).uncheck();
        failCloud = true;
        await page.getByRole('button', { name: '4 pedidas', exact: true }).click();
        await page.getByRole('spinbutton', { name: 'Quantidade pedida' }).fill('8');
        await page.getByRole('button', { name: 'Confirmar pedido', exact: true }).click();
        await page.getByText('Copia local salva. Nuvem pendente.', { exact: true }).waitFor();
        await page.reload();
        await page.getByRole('heading', { name: 'Romaneio', exact: true }).click();
        await page.getByRole('button', { name: `Pedir Rodas de ${origin}`, exact: true }).click();
        await page.getByRole('button', { name: '8 pedidas', exact: true }).waitFor();
        await resumeDialog.getByRole('button', { name: 'Continuar pedido', exact: true }).click();
        await page.getByText('Copia local salva. Nuvem pendente.', { exact: true }).waitFor();
        failCloud = false;
        await page.getByRole('button', { name: 'Tentar salvar na nuvem' }).click();
        await page.getByText('Pedido salvo na nuvem', { exact: true }).waitFor();
        assert.equal([...cloudDrafts.values()].find(row => row.rascunho?.origem === origin).rascunho.itens[0].quantidade, 8);
        await page.getByRole('button', { name: '8 pedidas', exact: true }).click();
        await page.getByRole('spinbutton', { name: 'Quantidade pedida' }).fill('4');
        await page.getByRole('button', { name: 'Confirmar pedido', exact: true }).click();
        await page.getByRole('button', { name: 'Pedir', exact: true }).click();
        await page.getByRole('button', { name: '+12', exact: true }).click();
        await page.getByRole('button', { name: 'Confirmar pedido', exact: true }).click();
        await page.getByRole('button', { name: /Enviar pedido/ }).click();
        await page.getByRole('button', { name: 'Alterar C10-A' }).click();
        await page.getByRole('button', { name: '+4', exact: true }).click();
        await page.getByRole('button', { name: 'Confirmar pedido', exact: true }).click();
        await page.getByRole('button', { name: 'Remover C10-B' }).click();
        assert.match(await page.getByRole('dialog').innerText(), /8 unidades/);
        assert.match(await page.getByLabel('Resumo do pedido').innerText(), new RegExp(`${origin}-TEST`));
        assert.match(await page.getByLabel('Resumo do pedido').innerText(), /Modelos\s*1/);
        await page.screenshot({ path: path.join(output, 'review-desktop.png') });
        await page.getByRole('button', { name: 'Fechar revisao' }).click();
        await page.reload();
        await page.getByRole('heading', { name: 'Romaneio', exact: true }).click();
        await page.getByRole('button', { name: `Pedir Rodas de ${origin}`, exact: true }).click();
        await resumeDialog.waitFor();
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: path.join(output, 'resume-mobile.png') });
        const abandonedId = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).id, draftKey);
        await resumeDialog.getByRole('button', { name: 'Começar do zero', exact: true }).click();
        await page.getByText('Rascunho sincronizado', { exact: true }).waitFor();
        assert.equal(await page.evaluate(key => localStorage.getItem(key), draftKey), null, 'Starting over must clear the local draft');
        assert.equal([...cloudDrafts.values()].filter(row => row.rascunho?.origem === origin).length, 0, 'Starting over must clear the cloud draft');
        assert.equal(receivedOrders.size, 0, 'Starting over must not publish an order');
        await page.getByText('C10-A', { exact: true }).locator('..').locator('..').locator('..').getByRole('button', { name: 'Pedir', exact: true }).click();
        await page.getByRole('spinbutton', { name: 'Quantidade pedida' }).fill('8');
        await page.getByRole('button', { name: 'Confirmar pedido', exact: true }).click();
        assert.notEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).id, draftKey), abandonedId, 'New order must have a new ID');
        await page.getByRole('button', { name: /Enviar pedido/ }).waitFor();
        for (const viewport of [{ width: 768, height: 1024 }, { width: 820, height: 1180 }]) {
            await page.setViewportSize(viewport);
            const sendButton = page.getByRole('button', { name: /Enviar pedido/ });
            assert.equal(await sendButton.isEnabled(), true, 'Tablet send button must be enabled with items');
            await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
            const box = await sendButton.boundingBox();
            assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, 'Tablet send button must stay inside the viewport after scrolling');
            await page.screenshot({ path: path.join(output, `tablet-portrait-${viewport.width}.png`) });
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByRole('button', { name: '8 pedidas', exact: true }).waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Mobile must not overflow');
        await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
        await page.getByRole('button', { name: '8 pedidas', exact: true }).click();
        await page.screenshot({ path: path.join(output, 'mobile-modal.png') });
        await page.getByRole('button', { name: 'Confirmar pedido', exact: true }).click();
        await page.getByRole('button', { name: /Enviar pedido/ }).click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Review must fit mobile');
        await page.screenshot({ path: path.join(output, 'review-mobile.png') });
        await page.getByRole('button', { name: 'Enviar pedido', exact: true }).click();
        await page.getByText(/Nao foi possivel enviar os arquivos/).waitFor({ timeout: 30000 });
        assert.equal([...storage.keys()].some(key => key.includes('/registros/')), false, 'Partial uploads must not publish orders');
        assert.ok(await page.evaluate(key => localStorage.getItem(key), draftKey), 'Failure must preserve draft');
        assert.equal(await page.getByRole('dialog', { name: 'Pedido enviado!', exact: true }).count(), 0, 'Failure must not show the success animation');
        assert.equal(receivedOrders.size, 0, 'Failed send must not create a received order in the table');
        failExcel = false;
        await page.getByRole('button', { name: 'Enviar pedido', exact: true }).click();
        await page.getByText(/Pedido enviado!/).waitFor({ timeout: 30000 });
        const success = page.getByRole('dialog', { name: 'Pedido enviado!', exact: true });
        const successAnimation = success.getByTestId('order-sent-animation').locator('svg');
        await successAnimation.waitFor();
        assert.ok(await successAnimation.locator('path').count(), 'Success animation must contain rendered paths');
        const animationBefore = await successAnimation.innerHTML();
        await page.waitForFunction(before => document.querySelector('[data-testid="order-sent-animation"] svg')?.innerHTML !== before, animationBefore, { timeout: 5000 });
        assert.notEqual(await successAnimation.innerHTML(), animationBefore, 'Success animation must move');
        await page.waitForTimeout(2300);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Success confirmation must fit mobile');
        await page.screenshot({ path: path.join(output, 'success-mobile.png') });
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.screenshot({ path: path.join(output, 'success-desktop.png') });
        await page.getByRole('button', { name: 'Concluir', exact: true }).click();
        assert.equal(await success.count(), 0, 'Concluir must dismiss the success confirmation');
        assert.equal(await page.evaluate(key => localStorage.getItem(key), draftKey), null);
        assert.equal(receivedOrders.size, 1, 'Successful send must publish the received order table');
        await page.getByText('Rascunho sincronizado', { exact: true }).waitFor();
        assert.equal([...cloudDrafts.values()].filter(row => row.rascunho?.origem === origin).length, 0, 'Sending must clear the cloud draft');
        const recordKey = [...storage.keys()].find(key => key.includes('/registros/'));
        const order = JSON.parse(storage.get(recordKey).body.toString());
        await page.evaluate(({ key, saved }) => {
            localStorage.setItem(key, JSON.stringify(saved));
            localStorage.setItem(`${key}:versao`, String(Date.now() + 100));
        }, { key: draftKey, saved: order });
        await page.reload();
        await page.getByRole('heading', { name: 'Romaneio', exact: true }).click();
        await page.getByRole('button', { name: `Pedir Rodas de ${origin}`, exact: true }).click();
        await page.getByText('Rascunho sincronizado', { exact: true }).waitFor();
        assert.equal(await resumeDialog.count(), 0, 'Completed orders must not show the resume dialog');
        assert.equal(await page.evaluate(key => localStorage.getItem(key), draftKey), null, 'Completed drafts must be cleared during restoration');
        assert.equal(receivedOrders.size, 1, 'Clearing a completed draft must preserve the received order');
        assert.equal(order.itens.length, 1);
        assert.equal(order.itens[0].quantidade, 8);
        assert.equal(order.itens[0].quantidadeCarga, 24);
        fs.writeFileSync(path.join(output, 'pedido-sc.pdf'), storage.get(order.pdfPath).body);
        fs.writeFileSync(path.join(output, 'pedido-sc.xlsx'), storage.get(order.excelPath).body);
        const sheet = XLSX.read(storage.get(order.excelPath).body).Sheets[`Pedido ${origin}`];
        assert.deepEqual(XLSX.utils.sheet_to_json(sheet), [{ Codigo: 'C10-A', Descricao: load.itens[0].descricao, Quantidade: 8 }]);
        const beforeRetry = uploadCount;
        const exceeded = await page.evaluate(async saved => {
            const { sendSCLoadOrder } = await import('/src/services/scLoadOrderService.ts');
            try {
                await sendSCLoadOrder({ ...saved, itens: [{ ...saved.itens[0], quantidade: 25 }] });
                return false;
            } catch (error) { return error.message.includes('maior que a quantidade no caminhão'); }
        }, order);
        assert.equal(exceeded, true, 'Send must reject quantities exceeding the truck load');
        assert.equal(uploadCount, beforeRetry);
        await page.evaluate(async saved => {
            const { sendSCLoadOrder } = await import('/src/services/scLoadOrderService.ts');
            await sendSCLoadOrder(saved);
        }, order);
        assert.equal(uploadCount, beforeRetry, 'Retry of a received order must not upload duplicates');
        const multipageBytes = await page.evaluate(async saved => {
            const { generateSCOrderFiles } = await import('/src/services/scLoadOrderService.ts');
            const { pdf } = await generateSCOrderFiles({
                ...saved,
                itens: Array.from({ length: 40 }, (_, index) => ({
                    ...saved.itens[0], codigo: `CODIGO-${index + 1}`,
                    descricao: `C10 15X10 4X100 BLACK DIAMOND - modelo ${index + 1} com descricao longa para verificar quebra de linhas e paginacao do relatorio`,
                    quantidade: index + 1
                }))
            });
            return Array.from(new Uint8Array(await pdf.arrayBuffer()));
        }, order);
        const multipage = Buffer.from(multipageBytes);
        assert.ok((multipage.toString('latin1').match(/\/Type \/Page\b/g) || []).length > 1, 'Large orders must paginate');
        fs.writeFileSync(path.join(output, 'pedido-sc-multipage.pdf'), multipage);
        await page.goto(`${baseURL}/admin`);
        await page.locator('input[type=password]').fill('admin123');
        await page.getByRole('button', { name: /Entrar/ }).click();
        await page.getByRole('button', { name: /Romaneio/ }).click();
        await page.getByRole('button', { name: new RegExp(`Pedidos de Rodas ${origin}`) }).click();
        const section = page.getByRole('dialog', { name: `Pedidos de Rodas ${origin}`, exact: true });
        await section.getByText(`Carga ${origin}-TEST`, { exact: true }).waitFor();
        await section.getByRole('button', { name: 'Baixar PDF', exact: true }).waitFor();
        await section.getByText('Enviado ao Gmail', { exact: true }).waitFor();
        await section.getByRole('button', { name: 'Destinatarios', exact: true }).click();
        const emailDialog = page.getByRole('dialog', { name: `E-mail dos pedidos ${origin}`, exact: true });
        await emailDialog.getByLabel('Senha de configuracao', { exact: true }).fill('email-test');
        await emailDialog.getByRole('button', { name: 'Abrir configuracao' }).click();
        await emailDialog.getByLabel('Destinatario', { exact: true }).fill(`${origin.toLowerCase()}@example.com`);
        await emailDialog.getByRole('button', { name: 'Adicionar destinatario', exact: true }).click();
        await emailDialog.getByLabel('Enviar pedidos por e-mail', { exact: true }).check();
        await emailDialog.getByRole('button', { name: 'Salvar destinatarios', exact: true }).click();
        await page.getByText(`Destinatarios de ${origin} salvos.`, { exact: true }).waitFor();
        assert.deepEqual(emailSettings.get(origin).destinatarios, [`${origin.toLowerCase()}@example.com`]);
        await page.screenshot({ path: path.join(output, 'email-settings-desktop.png') });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: path.join(output, 'email-settings-mobile.png') });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Email settings must fit mobile');
        await page.setViewportSize({ width: 1280, height: 900 });
        await emailDialog.getByRole('button', { name: 'Fechar destinatarios', exact: true }).click();
        const downloadEvent = page.waitForEvent('download');
        await section.getByRole('button', { name: 'Baixar Excel', exact: true }).click();
        const download = await downloadEvent;
        assert.ok(download.suggestedFilename().endsWith('.xlsx'));
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.screenshot({ path: path.join(output, 'admin.png'), fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: path.join(output, 'admin-mobile.png') });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await section.getByRole('button', { name: `Apagar pedido da carga ${origin}-TEST`, exact: true }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
        assert.ok(storage.has(recordKey), 'Cancel deletion must preserve order');
        await section.getByRole('button', { name: `Apagar pedido da carga ${origin}-TEST`, exact: true }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: 'Apagar pedido', exact: true }).click();
        await section.getByText('Nenhum pedido recebido.', { exact: true }).waitFor();
        assert.equal(storage.has(recordKey), false);
        assert.equal(storage.has(order.pdfPath), false);
        assert.equal(storage.has(order.excelPath), false);
        assert.equal(receivedOrders.size, 0, 'Deletion must also remove the received-order table row');
        await section.getByRole('button', { name: 'Fechar', exact: true }).click();
        await page.setViewportSize({ width: 1280, height: 900 });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
            { Codigo: 'C10-A', Descricao: load.itens[0].descricao, Quantidade: 10 }
        ]), 'Carga');
        const cmFileChooser = page.waitForEvent('filechooser');
        await page.getByRole('button', { name: /Upload Carga Campinas/ }).click();
        await (await cmFileChooser).setFiles({
            name: 'carga-cm-teste.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            buffer: XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })
        });
        await page.getByText('Consolidar & Publicar Romaneio', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Campinas (CM)', exact: true }).waitFor();
        await page.screenshot({ path: path.join(output, 'upload-cm-desktop.png') });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'CM upload must fit mobile');
        await page.screenshot({ path: path.join(output, 'upload-cm-mobile.png') });
        const uploadDone = page.waitForResponse(response => response.url().includes('/rest/v1/romaneios') && response.request().method() === 'POST');
        await page.getByRole('button', { name: 'Confirmar e Publicar na Home', exact: true }).click();
        await uploadDone;
        assert.ok([...uploadedLoads.values()].some(row => row.numero.startsWith('ROM-CM-') && row.tipo === 'CM'));
        assert.deepEqual(pageErrors, []);
        console.log(`PASS ${origin}: stock isolation, cloud/local drafts, offline recovery, send/retry, PDF/Excel, admin receipt/delete and CM upload on desktop/mobile.`);
        await context.close();
    } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
