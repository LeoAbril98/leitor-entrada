const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3014';
const output = process.env.TEST_OUTPUT_DIR || path.join(require('node:os').tmpdir(), 'locator-other-stock');
fs.mkdirSync(output, { recursive: true });
const photoPath = 'public/fotos/LINHA C/C10/C10 15X10  4F BD.png';
const photo = fs.readFileSync(fs.existsSync(photoPath) ? photoPath : 'public/pwa-192x192.png');

(async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
    try {
        const page = await browser.newPage();
        const requests = [];
        let failCM = false;
        await page.route('**/*', async route => {
            const req = route.request(), url = new URL(req.url());
            if (url.origin === base) return route.continue();
            const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data), headers: { 'access-control-allow-origin': '*' } });
            if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
            if (url.pathname.endsWith('/inventario_itens')) return json([
                { codigo: 'TEST-A', descricao: 'C10 15X7 BLACK DIAMOND', quantidade: 20, local: 'A-01' },
                { codigo: 'TEST-B', descricao: 'C11 17X7 SILVER', quantidade: 9, local: 'B-02' }
            ]);
            if (/romaneio_estoque_(sc|cm)$/.test(url.pathname)) {
                requests.push(url);
                if (failCM && url.pathname.endsWith('_cm')) return json({ message: 'Falha simulada' }, 503);
                if (url.searchParams.get('codigo') === 'eq.TEST-B') return json(null);
                return json({ quantidade: url.pathname.endsWith('_sc') ? 12 : 0 });
            }
            if (/\.(png|jpg|webp|svg)$/.test(url.pathname)) return route.fulfill({ contentType: 'image/png', body: photo, headers: { 'access-control-allow-origin': '*' } });
            if (url.pathname.includes('/storage/')) return json([]);
            return json([]);
        });
        await page.goto(base, { timeout: 120000 });
        await page.getByRole('heading', { name: 'Localização', exact: true }).click();
        const input = page.getByPlaceholder('Leia ou digite o código...');
        await input.fill('TEST-A');
        await input.press('Enter');
        const toggle = page.locator('summary').filter({ hasText: 'Estoque em outras filiais' });
        await toggle.waitFor();
        assert.equal(requests.length, 0, 'Do not query other stocks before expanding');
        assert.equal(await page.locator('details').getAttribute('open'), null);
        await toggle.click();
        const panel = page.getByLabel('Estoque em outras filiais', { exact: true });
        await panel.getByText('12 un', { exact: true }).waitFor();
        assert.match(await panel.innerText(), /Campinas\s+0 un/);
        assert.equal(requests.length, 2);
        assert.ok(requests.every(url => url.searchParams.get('codigo') === 'eq.TEST-A'));
        for (const viewport of [{ width: 1440, height: 1000 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
            await page.setViewportSize(viewport);
            await toggle.scrollIntoViewIfNeeded();
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            await page.screenshot({ path: path.join(output, `expanded-${viewport.width}.png`) });
        }
        await toggle.click();
        await page.screenshot({ path: path.join(output, 'collapsed-mobile.png') });
        assert.equal(await panel.count(), 0);
        failCM = true;
        await toggle.click();
        await panel.getByText('Indisponível', { exact: true }).waitFor();
        assert.equal(await panel.getByText('12 un', { exact: true }).count(), 1, 'SC must remain available if CM fails');
        failCM = false;
        await panel.getByRole('button', { name: 'Tentar novamente' }).click();
        await panel.getByText('0 un', { exact: true }).waitFor();
        await input.fill('TEST-B');
        await input.press('Enter');
        await page.getByText('C11 17X7 SILVER', { exact: true }).waitFor();
        await page.waitForFunction(() => document.querySelector('details') && !document.querySelector('details').open);
        assert.equal(await panel.count(), 0, 'Changing the wheel must collapse other stocks');
        await toggle.click();
        await panel.getByText('Sem registro', { exact: true }).first().waitFor();
        assert.equal(await panel.getByText('Sem registro', { exact: true }).count(), 2);
        assert.doesNotMatch(await panel.innerText(), /12 un/, 'No stale quantities from previous wheel');
        console.log('PASS: lazy SC/CM lookup, collapsed default, zero/missing/error/retry states, wheel change and desktop/tablet/mobile layout. No live data changed.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
