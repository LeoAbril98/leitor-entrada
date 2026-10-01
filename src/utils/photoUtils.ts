export { default as photoMap } from '../data/photoMap.json';
import photoMap from '../data/photoMap.json';

// Small 1x1 transparent PNG as a safe fallback that never triggers network requests
export const NO_PHOTO_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

export function hasMapping(description: string | null | undefined): boolean {
    if (!description) return false;
    const modelCode = description.toUpperCase().split(' ')[0];
    const modelPhotos = (photoMap as any)[modelCode];
    return !!modelPhotos && Object.keys(modelPhotos).length > 0;
}

export const finishMapping: Record<string, string> = {
  // --- LIP BLACK ---
  'LIP BLACK DIAMOND': 'LBD',
  'LIP BLACK DIAMON': 'LBD',
  'LIP BLACK DIA': 'LBD',
  'LIP BLACK FOSCO': 'LBF',
  'LIP BLACK F': 'LBF',
  'GOLD BLACK LIP': 'GBL',
  'GOLD BLACK LI': 'GBL',

  // --- BLACK DIAMOND & SMOKE ---
  'BLACK DIAMOND SMOKE': 'BDS',
  'BLACK DIA SMOKE': 'BDS',
  'BLACK DIAMOND S': 'BDS',
  'PRETO DIAM FUME': 'BDS',
  'PRETO DIAMANTADO': 'BD',
  'BLACK DIAMOND': 'BD',
  'FACE BLACK DIAMOND': 'FBD',
  'PRETO D. SEM REB': 'BDSR',
  'PRETO BORDA DIAM': 'BBD',

  // --- BLACK FOSCO / GLOSS / STANDARD ---
  'PRETO FOSCO BORDA DIAMANTADA': 'BFBD',
  'PRETO FOSCO BORDA': 'BFBD',
  'PRETO FOSCO B DI': 'BFBD',
  'PRETO FOSCO B D': 'BFBD',
  'BLACK FOSCO DIAMOND': 'BFD',
  'PRETA FOSCO DIAM': 'BFD',
  'PRETO FOSCO DIAM': 'BFD',
  'PRETO FOS DIA': 'BFD',
  'PRETO FOSCO D': 'BFD',
  'PRETO FOSCO': 'BF',
  'BLACK FOSCO': 'BF',
  'BLACK GLOSS': 'BG',
  'PRETO': 'B',
  'BLACK': 'B',

  // --- PRATA / SILVER ---
  'SILVER DIAMOND': 'SD',
  'PRATA DIAMANTAD': 'SD',
  'PRATA DIAMANT': 'SD',
  'PRATA DIAM': 'SD',
  'DIAM PRATA': 'DP',
  'PRATA': 'SS',
  'SILVER STAR': 'SS',

  // --- GRAFITE / GRAPHITE ---
  'GRAFITE BRILHO BORDA': 'GBBD',
  'GRAFITE BRI BORDA': 'GBBD',
  'GRAFITE BRILHO BOR': 'GBBD',
  'GRAFITE BRILHO B': 'GBBD',
  'GRAFITE BRILH B': 'GBBD',
  'GRAFITE BRILHANT': 'GB',
  'GRAPHITE BRILHANT': 'GB',
  'GRAPHITE BRILHANTE': 'GB',
  'GRAPHITE DIAMO CLA': 'GDC',
  'GRAPHITE DIAM CLAR': 'GDC',
  'GRAPHITE DIAM ESC': 'GDE',
  'GRAPHITE FOSCO DIAM': 'GFD',
  'GRAPHITE FOS DIAM FL': 'GFD',
  'GRAPHITE FOS DIAM': 'GFD',
  'GRAPHITE FOSCO DIA': 'GFD',
  'GRAPHITE FOSCO DI': 'GFD',
  'GRAFITE FOSC': 'GF',
  'GRAPHITE FOSCO': 'GF',
  'GRAPHITE FOSCO F.L': 'GF',
  'GRAPHITE DIAM': 'GD',
  'GRAPHITE DIAMANTAD': 'GD',
  'GRAPHITE DIAM F.L': 'GD',
  'GRAPHITE DIAM FL': 'GD',
  'GRAF DIAM. F.L': 'GD',

  // --- BRONZE ---
  'BRONZE FOSCO': 'BFZ',
  'BRONZE': 'BZ',

  // --- OURO / GOLD ---
  'OURO V DIAMANTADO': 'OUROD',
  'OURO V DIAMANTA': 'OUROD',
  'OURO VELHO FOSCO': 'OVF',
  'OURO VELHO F': 'OVF',
  'OURO VELHO': 'OURO',
  'OURO BORDA DIAM.': 'OURO',
  'GOLD VITORIA': 'GV',
  'GOLD': 'GV',
  'OURO': 'OURO',
  'DOURADA DIAMANTADA': 'DD',

  // --- HYPER / GLOSS ---
  'HYPER DIAM': 'HD',
  'HYPER DIA.*R.C': 'HD',
  'HYPER DIAM R.C': 'HD',
  'HYPER GLOSS F.L': 'HG',
  'HYPER GLOSS': 'HG',
  'HYPER GLOS': 'HG',
  'HYPER GL': 'HG',
  'GLOSS SHADOW': 'GS',
  'GL SHADOW': 'GS',
  'GLOS SHADOW': 'GS',
  'GLOSS': 'GL',

  // --- OUTROS ---
  'VERM BORDA DIAM': 'LVD',
  'VERM. C/BORDA DIA': 'LVD',
  'VERM.. C/BORDA DIAM': 'LVD',
  'VERM BORD DIAM': 'LVD',
  'VERM. C/ BORDA DIAM': 'LVD',
  'VERM. BORDA DIA': 'LVD',
  'VER BOR DIAM': 'LVD',
  'POLIDA': 'P',
  'BRUTA': 'BRUTA',
  'DIAMOND': 'D',
  'INOX': 'INOX',
  'CROMADA': 'CR',
  'FGF': 'FGF',

  // --- SIGLAS DE FALLBACK (Garantia) ---
  ' LBD ': 'LBD',
  ' LBF ': 'LBF',
  ' BDS ': 'BDS',
  ' BD ': 'BD',
  ' SS ': 'SS',
  ' SD ': 'SD',
  ' GB ': 'GB',
  ' B ': 'B',
  ' BF ': 'BF',
  ' BFZ ': 'BFZ',
  ' BZ ': 'BZ',
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
  ' BG ': 'BG',
  ' DP ': 'DP',
  ' GDC ': 'GDC',
  ' GDE ': 'GDE',
  ' GBBD ': 'GBBD',
  ' GV ': 'GV',
  ' OVF ': 'OVF',
  ' OUROD ': 'OUROD',
  
  // Siglas curtas exatas
  'GF': 'GF', 'GFD': 'GFD', 'GD': 'GD', 'BD': 'BD', 'B': 'B', 
  'BF': 'BF', 'BFD': 'BFD', 'SS': 'SS', 'GB': 'GB', 'HG': 'HG', 
  'GL': 'GL', 'GS': 'GS', 'FBD': 'FBD', 'SD': 'SD', 'BDS': 'BDS',
  'LBD': 'LBD', 'LBF': 'LBF'
};

export const sortedFinishKeys = Object.keys(finishMapping).sort((a, b) => b.length - a.length);


// Mapa global de overrides
// 1. Por Item individual (codigo -> url)
let itemOverrides: Record<string, string> = {};
// 2. Por Modelo/Acabamento (model -> finish -> url)
let photoOverrides: Record<string, Record<string, string>> = {};

export function setPhotoOverrides(
    overrides: { model: string, finish: string, photo_url: string, item_codigo?: string }[]
) {
    const newItems: Record<string, string> = {};
    const newModels: Record<string, Record<string, string>> = {};
    
    overrides.forEach(o => {
        if (o.item_codigo) {
            newItems[o.item_codigo] = o.photo_url;
        } else {
            if (!newModels[o.model]) newModels[o.model] = {};
            newModels[o.model][o.finish] = o.photo_url;
        }
    });

    itemOverrides = newItems;
    photoOverrides = newModels;
}

/**
 * Extrai o código do modelo e o acabamento de uma descrição.
 */
export function getModelAndFinish(description: string) {
    // Normaliza a string para evitar erros com espaços duplos
    const descUpper = description.toUpperCase().replace(/\s+/g, ' ').trim();
    const modelCode = descUpper.split(' ')[0];
    
    let finishAbbr: string = '';
    
    for (const key of sortedFinishKeys) {
        // Limpa a chave também por garantia
        const trimmedKey = key.trim().toUpperCase().replace(/\s+/g, ' ');
        if (descUpper.includes(trimmedKey)) {
            finishAbbr = finishMapping[key];
            break;
        }
    }

    // REGRA ESPECIAL LINHA C: Se não tiver acabamento, usar BRUTA como padrão
    if (!finishAbbr && modelCode.startsWith('C')) {
        finishAbbr = 'BRUTA';
    }

    return { modelCode, finishAbbr };
}

/**
 * Resolve a URL da foto de uma roda baseada na sua descrição.
 * Transforma caminhos locais do photoMap em URLs públicas do Supabase Storage.
 */
export function getWheelPhotoUrl(description: string, itemCodigo?: string): string {
    const placeholder = "https://placehold.co/150x150/e2e8f0/64748b?text=FOTO";
    if (!description) return placeholder;

    // 0. Verificar Override Individual por Código
    if (itemCodigo && itemOverrides[itemCodigo]) {
        return itemOverrides[itemCodigo];
    }

    const descUpper = description.toUpperCase();
    const { modelCode, finishAbbr } = getModelAndFinish(descUpper);
    const modelPhotos = (photoMap as Record<string, Record<string, string>>)[modelCode] || {};
    
    // 1. Verificar Override por Modelo/Acabamento
    if (finishAbbr && photoOverrides[modelCode]?.[finishAbbr]) {
        return photoOverrides[modelCode][finishAbbr];
    }

    // 2. Extrair Acabamento (Já extraído acima)

    // 2. Extrair Aro/Tala (ex: 15X4, 15X4,0, 15X10)
    // Suporta X, x, * e separadores decimais ponto ou vírgula
    const aroMatch = descUpper.match(/(\d{2}[XxX\*][\d\.,]+)|(\b\d{2}\b)/i);
    // Normalização agressiva: 15X4,0 -> 15X4 | 15X7 -> 15X7
    const normalizeSize = (s: string) => s.replace(/,/g, '.').replace(/\.0\b/g, '').replace(/\*/g, 'X').toUpperCase();
    const itemAro = aroMatch ? normalizeSize(aroMatch[0]) : "";

    // 3. Tentar encontrar a melhor foto
    let bestPath = "";
    
    if (finishAbbr) {
        const finishRegex = new RegExp(`\\b${finishAbbr}\\b`, 'i');
        // Filtramos fotos do modelo que contenham o acabamento no nome/caminho como uma "palavra" inteira
        const photosForFinish = Object.entries(modelPhotos).filter(([_, path]) => {
            return finishRegex.test(path);
        });

        if (photosForFinish.length > 0) {
            // Se temos várias fotos para este acabamento, tentamos filtrar pelo Aro/Tala
            if (itemAro) {
                // Normalizamos o caminho da foto também para comparar
                const sizeMatch = photosForFinish.find(([_, path]) => {
                    const normalizedPath = normalizeSize(path.toUpperCase());
                    return normalizedPath.includes(itemAro);
                });
                
                if (sizeMatch) bestPath = sizeMatch[1];
            }
            
            // Se não achou pelo tamanho exato, tenta o primeiro do acabamento
            if (!bestPath) bestPath = photosForFinish[0][1];
        }
    }

    // 4. Fallback: Qualquer foto do modelo
    const rawPath = bestPath || (Object.values(modelPhotos)[0] || "");

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
