const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generate() {
    console.log('Iniciando geração de ícones PWA...');

    // 1. Carregar logo 2.svg
    const logoSvgContent = fs.readFileSync(path.join(__dirname, '../public/logo 2.svg'), 'utf8');

    // Extrair o conteúdo interno do svg (defs e g)
    const innerContent = logoSvgContent
        .replace(/<svg[^>]*>/i, '')
        .replace(/<\/svg>/i, '');

    // Construir SVG de 512x512 com fundo branco puro (#ffffff) e logo centralizado
    // O viewBox original é 20 172 800 244 (largura 800, altura 244)
    // Para caber com margem segura perfeita no 512x512 (área maskable):
    // Largura do logo = 410, Altura = 410 * (244 / 800) = 125.05
    // x = (512 - 410) / 2 = 51
    // y = (512 - 125.05) / 2 = 193.475
    const svg512 = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#ffffff" />
  <svg x="46" y="188" width="420" height="128" viewBox="20 172 800 244" preserveAspectRatio="xMidYMid meet">
    ${innerContent}
  </svg>
</svg>`;

    const svg192 = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="192" height="192" viewBox="0 0 192 192">
  <rect width="192" height="192" fill="#ffffff" />
  <svg x="16" y="70" width="160" height="49" viewBox="20 172 800 244" preserveAspectRatio="xMidYMid meet">
    ${innerContent}
  </svg>
</svg>`;

    // Salvar arquivos SVG atualizados
    fs.writeFileSync(path.join(__dirname, '../public/pwa-icon.svg'), svg512, 'utf8');
    fs.writeFileSync(path.join(__dirname, '../public/pwa-192x192.svg'), svg192, 'utf8');
    console.log('✓ SVGs gerados com sucesso!');

    // 2. Gerar PNGs de alta qualidade com sharp a partir do SVG
    const svgBuffer = Buffer.from(svg512);

    await sharp(svgBuffer)
        .resize(512, 512)
        .png({ quality: 100 })
        .toFile(path.join(__dirname, '../public/pwa-512x512.png'));
    console.log('✓ pwa-512x512.png gerado!');

    await sharp(svgBuffer)
        .resize(192, 192)
        .png({ quality: 100 })
        .toFile(path.join(__dirname, '../public/pwa-192x192.png'));
    console.log('✓ pwa-192x192.png gerado!');

    await sharp(svgBuffer)
        .resize(180, 180)
        .png({ quality: 100 })
        .toFile(path.join(__dirname, '../public/apple-touch-icon.png'));
    console.log('✓ apple-touch-icon.png gerado!');

    await sharp(svgBuffer)
        .resize(32, 32)
        .png({ quality: 100 })
        .toFile(path.join(__dirname, '../public/favicon-32x32.png'));
    console.log('✓ favicon-32x32.png gerado!');

    await sharp(svgBuffer)
        .resize(16, 16)
        .png({ quality: 100 })
        .toFile(path.join(__dirname, '../public/favicon-16x16.png'));
    console.log('✓ favicon-16x16.png gerado!');

    console.log('Todos os ícones PWA e Favicons foram gerados com sucesso!');
}

generate().catch(err => {
    console.error('Erro ao gerar ícones:', err);
    process.exit(1);
});
