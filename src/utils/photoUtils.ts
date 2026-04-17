import photoMap from '../data/photoMap.json';

export const finishMapping: Record<string, string> = {
  'PRETO DIAMANTADO': 'BD',
  'BLACK DIAMOND': 'BD',
  'FACE BLACK DIAMOND': 'FBD',
  'LIP BLACK F': 'LBF',
  'PRETO': 'B',
  'BLACK': 'B',
  'PRETO FOSCO': 'BF',
  'BRONZE FOSCO': 'BF',
  'PRETA FOSCO DIAM': 'BFD',
  'PRATA': 'SS',
  'PRATA DIAM': 'SS',
  'PRATA DIAMANTAD': 'SS',
  'SILVER STAR': 'SS',
  'GRAFITE BRILHANT': 'GB',
  'GRAPHITE BRILHANT': 'GB',
  'GRAPHITE BRILHANTE': 'GB',
  'GRAFITE FOSC': 'GF',
  'GRAPHITE FOSCO': 'GF',
  'GRAPHITE FOSCO F.L': 'GF',
  'GRAPHITE DIAM': 'GD',
  'GRAPHITE DIAMANTAD': 'GD',
  'GRAPHITE DIAM F.L': 'GD',
  'GRAPHITE DIAM FL': 'GD',
  'GRAF DIAM. F.L': 'GD',
  'GRAPHITE FOSCO DIAM': 'GFD',
  'GRAPHITE FOS DIAM': 'GFD',
  'GRAPHITE FOSCO DIA': 'GFD',
  'GRAPHITE FOSCO DI': 'GFD',
  'OURO VELHO': 'OURO',
  'OURO VELHO F': 'OURO',
  'OURO BORDA DIAM.': 'OURO',
  'OURO V DIAMANTADO': 'OURO',
  'POLIDA': 'POLIDA',
  'BRUTA': 'BRUTA',
  'DIAMOND': 'D',
  'DOURADA DIAMANTADA': 'DD',
  'HYPER DIAM': 'HD',
  'HYPER DIA.*R.C': 'HD',
  'HYPER DIAM R.C': 'HD',
  'HD': 'HD',
  'HYPER GLOSS': 'HG',
  'HYPER GLOSS F.L': 'HG',
  'HYPER GLOS': 'HG',
  'HYPER GL': 'HG',
  'GLOSS': 'GL',
  'GLOSS SHADOW': 'GS',
  'GL SHADOW': 'GS',
  'GLOS SHADOW': 'GS',
  'INOX': 'INOX',
  'CROMADA': 'CROMADA',
  'FGF': 'FGF',
  'VERM BORDA DIAM': 'LVD',
  'VERM. C/BORDA DIA': 'LVD',
  'VERM.. C/BORDA DIAM': 'LVD',
  'VERM BORD DIAM': 'LVD',
  'VERM. C/ BORDA DIAM': 'LVD',
  'VERM. BORDA DIA': 'LVD',
  'VER BOR DIAM': 'LVD',
  'GOLD BLACK LIP': 'GBL',
  'GOLD BLACK LI': 'GBL',
  'OURO': 'OURO',
  ' BD ': 'BD',
  ' SS ': 'SS',
  ' GB ': 'GB',
  ' B ': 'B',
  ' BF ': 'BF',
  ' GF ': 'GF',
  ' GD ': 'GD',
  ' GFD ': 'GFD',
  ' DD ': 'DD',
  ' HD ': 'HD',
  ' HG ': 'HG',
  ' GL ': 'GL',
  ' GS ': 'GS',
  ' FGF ': 'FGF',
  ' LVD ': 'LVD',
  ' GBL ': 'GBL',
};

export const sortedFinishKeys = Object.keys(finishMapping).sort((a, b) => b.length - a.length);

/**
 * Resolve a URL da foto de uma roda baseada na sua descrição.
 * Transforma caminhos locais do photoMap em URLs públicas do Supabase Storage.
 */
export function getWheelPhotoUrl(description: string): string {
    const placeholder = "https://placehold.co/150x150/e2e8f0/64748b?text=FOTO";
    if (!description) return placeholder;

    const descUpper = description.toUpperCase();
    const modelCode = descUpper.split(' ')[0];
    const modelPhotos = (photoMap as Record<string, Record<string, string>>)[modelCode] || {};
    
    let finishAbbr: string | undefined;
    for (const key of sortedFinishKeys) {
        if (descUpper.includes(key)) {
            finishAbbr = finishMapping[key];
            break;
        }
    }

    const rawPath = (finishAbbr && modelPhotos[finishAbbr]) 
        ? modelPhotos[finishAbbr] 
        : (Object.values(modelPhotos)[0] || "");

    if (!rawPath) return placeholder;

    // Se já for uma URL completa, retorna ela
    if (rawPath.startsWith('http')) return rawPath;

    // Transformar caminho local (/fotos/LINHA C/...) em URL do Supabase
    // O script de upload remove /public e normaliza o nome
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) return rawPath; // Fallback para local se não houver URL do Supabase

    // 1. Extrair caminho relativo (remove /fotos/ se existir)
    let relativePath = rawPath.replace(/^\/fotos\//, '');
    
    // 2. Trocar extensão para .webp
    relativePath = relativePath.substring(0, relativePath.lastIndexOf('.')) + '.webp';
    
    // 3. Normalizar (mesmo processo do upload-photos.mjs)
    // Remove acentos e caracteres especiais
    let normalizedPath = relativePath.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    normalizedPath = normalizedPath.replace(/[^\w\s\/\.\-]/g, '');

    // 4. Montar URL pública (bucket 'fotos')
    // O URL do Supabase geralmente termina em .co ou .net
    const publicBaseUrl = `${supabaseUrl}/storage/v1/object/public/fotos/`;
    
    // Precisamos codificar os espaços para a URL (mas não as barras)
    const finalUrl = publicBaseUrl + normalizedPath.split('/').map(part => encodeURIComponent(part)).join('/');

    return finalUrl;
}
