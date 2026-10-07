const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const XLSX = require('xlsx');

const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3010';
const output = path.resolve(process.env.TEST_OUTPUT_DIR || path.join(require('node:os').tmpdir(), 'leitor-sc-load-order-test'));
fs.mkdirSync(output, { recursive: true });
const photoFile = path.resolve('public/fotos/LINHA C/C10/C10 15X10  4F BD.png');
const photo = fs.readFileSync(fs.existsSync(photoFile) ? photoFile : 'public/pwa-192x192.png');
const load = {
    id: 'test-sc-load', numero: 'SC-TEST', titulo: 'Carga Santa Catarina', tipo: 'SC',
    dataCriacao: '2026-10-07T00:00:00Z', dataAtualizacao: '2026-10-07T00:00:00Z',
    status: 'pendente', totalItens: 3, totalPecas: 36, totalConferido: 0, arquivos: [],
    itens: [
        { id: 'a', codigo: ' C10-A ', descricao: 'C10 15X10 4X100 BLACK DIAMOND', quantidade: 20, local: 'A-01', estoqueDb: 99, conferido: 0 },
        { id: 'b', codigo: 'c10-a', descricao: 'C10 15X10 4X100 BLACK DIAMOND', quantidade: 4, local: 'A-01', estoqueDb: 99, conferido: 0 },
        { id: 'c', codigo: 'C10-B', descricao: 'C10 15X7 5X114 BLACK DIAMOND', quantidade: 12, local: 'B-01', estoqueDb: 99, conferido: 0 }
    ]
};
const sqlLoad = {
    id: load.id, numero: load.numero, titulo: load.titulo, tipo: 'SC',
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
        let failExcel = true;
        let uploadCount = 0;
        await context.route('**/*', async route => {
            const req = route.request(), url = new URL(req.url()), pathname = decodeURIComponent(url.pathname);
            const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } });
            if (url.origin === baseURL) return route.continue();
            if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
            if (pathname.includes('/rest/v1/')) {
                const table = pathname.split('/rest/v1/')[1];
                if (table === 'romaneios') return json([sqlLoad]);
                if (table === 'inventario_itens') return json(stock.map(item => ({ ...item, inventario_id: 'test-pr-inventory', est_moleri: 555, est_sc: 555 })));
                if (table === 'inventarios') return json([{ criado_em: new Date(Date.now() - 48 * 3600000).toISOString() }]);
                if (table === 'romaneio_estoque_sc') return json(stock.map(item => ({ codigo: item.codigo, quantidade: item.est_moleri, atualizado_em: new Date().toISOString() })));
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
                if (pathname.includes('/public/fotos/') && !key?.startsWith('pedidos-rodas-sc/')) {
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
        assert.equal(await page.getByRole('button', { name: 'Pedir Rodas de SC', exact: true }).count(), 0, 'Pendencias must not contain the new entry');
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
        await page.getByRole('button', { name: 'Pedir Rodas de SC', exact: true }).click();
        await page.getByRole('button', { name: 'Pedir', exact: true }).first().waitFor();
        assert.equal(await page.getByRole('button', { name: 'Pedir', exact: true }).count(), 2, 'Duplicate codes must be grouped within a load');
        assert.match(await page.locator('main').innerText(), /24/);
        assert.match(await page.locator('main').innerText(), /18/);
        assert.doesNotMatch(await page.locator('main').innerText(), /\b999\b/, 'Romaneio must not use balances imported into Pendencias');
        assert.doesNotMatch(await page.locator('main').innerText(), /\b555\b/, 'SC stock must come exclusively from romaneio_estoque_sc');
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
        await page.getByLabel('Somente no pedido', { exact: true }).check();
        assert.equal(await page.getByRole('button', { name: 'Pedir', exact: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: '4 pedidas', exact: true }).count(), 1);
        await page.getByLabel('Somente no pedido', { exact: true }).uncheck();
        await page.getByRole('button', { name: 'Pedir', exact: true }).click();
        await page.getByRole('button', { name: '+12', exact: true }).click();
        await page.getByRole('button', { name: 'Confirmar pedido', exact: true }).click();
        await page.getByRole('button', { name: /Enviar pedido/ }).click();
        await page.getByRole('button', { name: 'Alterar C10-A' }).click();
        await page.getByRole('button', { name: '+4', exact: true }).click();
        await page.getByRole('button', { name: 'Confirmar pedido', exact: true }).click();
        await page.getByRole('button', { name: 'Remover C10-B' }).click();
        assert.match(await page.getByRole('dialog').innerText(), /8 unidades/);
        assert.match(await page.getByLabel('Resumo do pedido').innerText(), /SC-TEST/);
        assert.match(await page.getByLabel('Resumo do pedido').innerText(), /Modelos\s*1/);
        await page.screenshot({ path: path.join(output, 'review-desktop.png') });
        await page.getByRole('button', { name: 'Fechar revisao' }).click();
        await page.reload();
        await page.getByRole('heading', { name: 'Romaneio', exact: true }).click();
        await page.getByRole('button', { name: 'Pedir Rodas de SC', exact: true }).click();
        await page.getByRole('button', { name: /Enviar pedido/ }).waitFor();
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
        await page.getByRole('button', { name: 'Enviar ao administrador', exact: true }).click();
        await page.getByText(/Nao foi possivel enviar os arquivos/).waitFor({ timeout: 30000 });
        assert.equal([...storage.keys()].some(key => key.includes('/registros/')), false, 'Partial uploads must not publish orders');
        assert.ok(await page.evaluate(() => localStorage.getItem('mkr_pedido_rodas_sc_rascunho_v1')), 'Failure must preserve draft');
        assert.equal(await page.getByRole('dialog', { name: 'Pedido enviado!', exact: true }).count(), 0, 'Failure must not show the success animation');
        failExcel = false;
        await page.getByRole('button', { name: 'Enviar ao administrador', exact: true }).click();
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
        assert.equal(await page.evaluate(() => localStorage.getItem('mkr_pedido_rodas_sc_rascunho_v1')), null);
        const recordKey = [...storage.keys()].find(key => key.includes('/registros/'));
        const order = JSON.parse(storage.get(recordKey).body.toString());
        assert.equal(order.itens.length, 1);
        assert.equal(order.itens[0].quantidade, 8);
        assert.equal(order.itens[0].quantidadeCarga, 24);
        fs.writeFileSync(path.join(output, 'pedido-sc.pdf'), storage.get(order.pdfPath).body);
        fs.writeFileSync(path.join(output, 'pedido-sc.xlsx'), storage.get(order.excelPath).body);
        const sheet = XLSX.read(storage.get(order.excelPath).body).Sheets['Pedido SC'];
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
        await page.getByRole('button', { name: /Pedidos de Rodas SC/ }).click();
        const section = page.getByRole('dialog', { name: 'Pedidos de Rodas SC', exact: true });
        await section.getByText('Carga SC-TEST', { exact: true }).waitFor();
        await section.getByRole('button', { name: 'Baixar PDF', exact: true }).waitFor();
        const downloadEvent = page.waitForEvent('download');
        await section.getByRole('button', { name: 'Baixar Excel', exact: true }).click();
        const download = await downloadEvent;
        assert.ok(download.suggestedFilename().endsWith('.xlsx'));
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.screenshot({ path: path.join(output, 'admin.png'), fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: path.join(output, 'admin-mobile.png') });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await section.getByRole('button', { name: 'Apagar pedido da carga SC-TEST', exact: true }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
        assert.ok(storage.has(recordKey), 'Cancel deletion must preserve order');
        await section.getByRole('button', { name: 'Apagar pedido da carga SC-TEST', exact: true }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: 'Apagar pedido', exact: true }).click();
        await section.getByText('Nenhum pedido recebido.', { exact: true }).waitFor();
        assert.equal(storage.has(recordKey), false);
        assert.equal(storage.has(order.pdfPath), false);
        assert.equal(storage.has(order.excelPath), false);
        assert.deepEqual(pageErrors, []);
        console.log('PASS: Romaneio entry, selection, edit/remove, persistent draft, desktop/mobile, failed send, retry, paginated PDF/Excel, admin receipt/download/delete.');
        await context.close();
    } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
