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
  'GOLD BLACK L': 'GBL',

  // --- BLACK DIAMOND & SMOKE ---
  'BLACK DIAMOND SMOKE': 'BDS',
  'BLACK DIAM SMOKE': 'BDS', // ERP: cortado
  'BLACK DIA SMOKE': 'BDS',
  'BLACK DIAMOND S': 'BDS',
  'BLACK D SMOKE': 'BDS', // ERP: abreviado
  'PRETO DIAM FUME': 'BDS',
  'PRETO DIAMANTADO': 'BD',
  'PRETO DIAMANTA': 'BD', // ERP: cortado
  'PRETO DIAMANT': 'BD', // ERP: cortado
  'BLACK DIAMOND': 'BD',
  'BLACK DIAMON': 'BD', // ERP: cortado
  'BLACK DIAM': 'BD', // ERP: cortado
  'FACE BLACK DIAMOND': 'FBD',
  'FACE BLACK DIAMON': 'FBD', // ERP: cortado
  'FACE BLACK DIAM': 'FBD', // ERP: cortado
  'PRETO D. SEM REB': 'BDSR',
  'PRETO BORDA DIAM': 'BBD',

  // --- BLACK FOSCO / GLOSS / STANDARD ---
  'PRETO FOSCO BORDA DIAMANTADA': 'BFBD',
  'PRETO FOSCO BORDA': 'BFBD',
  'PRETO FOSCO B DI': 'BFBD',
  'PRETO FOSCO B D': 'BFBD',
  'PRETO FOSCO BOR': 'BFBD', // ERP: cortado
  'PRETO F. BORDA': 'BFBD', // ERP: abreviado
  'BLACK FOSCO BORD': 'BFBD', // ERP: cortado
  'BLACK FOSCO DIAMOND': 'BFD',
  'BLACK FOSCO DIAMON': 'BFD', // ERP: cortado
  'BLACK FOSCO DIA FL': 'BFD',
  'BLACK FOSCO D': 'BFD', // ERP: cortado
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
  'SILVER DIAMONO': 'SD', // ERP: erro digitação
  'SILVER DIAMON': 'SD', // ERP: cortado
  'SILVER DIAM': 'SD', // ERP: cortado
  'PRATA DIAMANTAD': 'SD',
  'PRATA DIAMANT': 'SD',
  'PRATA DIAM': 'SD',
  'DIAM PRATA': 'DP',
  'SILVER STAR': 'SS',
  'SIVER STAR': 'SS', // ERP: erro digitação
  'PRATA': 'SS',

  // --- GRAFITE / GRAPHITE ---
  'GRAFITE BRILHO BORDA': 'GBBD',
  'GRAFITE BORDA BRI': 'GBBD', // ERP: inversão
  'GRAFITE BRI BORDA': 'GBBD',
  'GRAFITE BRILHO BOR': 'GBBD',
  'GRAFITE BRILHO B': 'GBBD',
  'GRAFITE BRILH B': 'GBBD',
  'GRAFITE BRILHANT': 'GB',
  'GRAFITE BRILHAN': 'GB', // ERP: cortado
  'GRAFITE BRILHO': 'GB', // ERP: variação
  'GRAPHITE BRILHANT': 'GB',
  'GRAPHITE BRILHANTE': 'GB',
  'GRAPHITE DIAMO CLA': 'GDC',
  'GRAPHITE DIAM CLAR': 'GDC',
  'GRAPHITE DIAM ESC': 'GDE',
  'GRAFITE FOSCO DIAM': 'GFD',
  'GRAFHI FOSCO DIA': 'GFD', // ERP: erro digitação
  'GRAPHITE FOSCO DIAM': 'GFD',
  'GRAPHITE F DIAMON': 'GFD', // ERP: abreviação
  'GRAPHITE F DIAM': 'GFD', // ERP: abreviação
  'GRAPHITE FOS DIAM FL': 'GFD',
  'GRAPHITE FOS DIAM': 'GFD',
  'GRAPHITE FOSCO DIA': 'GFD',
  'GRAPHITE FOSCO DI': 'GFD',
  'GRAFITE FOS D': 'GFD',
  'GRAFIT FOSCO': 'GF', // ERP: erro digitação
  'GRAFITE FOSCO': 'GF',
  'GRAFITE FOSC': 'GF',
  'GRAPHITE FOSCO F.L': 'GF',
  'GRAPHITE FOSCO': 'GF',
  'GRAFIT': 'GB', // Fallback genérico
  'GRAFITE': 'GB', // Fallback genérico
  'GRAPHITE DIAMOND': 'GD',
  'GRPHITE DIMAOND': 'GD', // ERP: erro digitação duplo
  'GRAPHITE DI FL': 'GD', // ERP: abreviação
  'GRAFITE DIAMA': 'GD',
  'GRAFITE DIAMANTADO': 'GD',
  'GRAFITE DIAM': 'GD', // ERP: cortado
  'GRAPHITE DIAMANTAD': 'GD',
  'GRAPHITE DIAM F.L': 'GD',
  'GRAPHITE DIAM FL': 'GD',
  'GRAF DIAM. F.L': 'GD',
  'GRAPHITE DIAM': 'GD',

  // --- BRONZE ---
  'BRONZE FOSCO': 'BZF', // Na base de dados utiliza as siglas BZF ou BFZ
  'BRONZE': 'BZ',

  // --- OURO / GOLD ---
  'OURO V DIAMANTADO': 'OUROD',
  'OURO V DIAMANTA': 'OUROD',
  'OURO VELHO FOSCO': 'OVF',
  'OURO VELHO F': 'OVF',
  'OURO VELHO': 'OV',
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
  'H GLOSS': 'HG', // ERP: abreviado
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

  // --- SIGLAS PURAS / FALLBACK (Garantia) ---
  ' LBD ': 'LBD', ' LBF ': 'LBF', ' BDS ': 'BDS', ' BD ': 'BD', 
  ' SS ': 'SS', ' SD ': 'SD', ' GB ': 'GB', ' B ': 'B', 
  ' BF ': 'BF', ' BFZ ': 'BFZ', ' BZF ': 'BZF', ' BZ ': 'BZ', 
  ' GF ': 'GF', ' GD ': 'GD', ' GFD ': 'GFD', ' DD ': 'DD', 
  ' HD ': 'HD', ' HG ': 'HG', ' GL ': 'GL', ' GS ': 'GS', 
  ' FGF ': 'FGF', ' LVD ': 'LVD', ' GBL ': 'GBL', ' BG ': 'BG', 
  ' DP ': 'DP', ' GDC ': 'GDC', ' GDE ': 'GDE', ' GBBD ': 'GBBD', 
  ' GV ': 'GV', ' OVF ': 'OVF', ' OUROD ': 'OUROD', ' OV ': 'OV',
  
  // Siglas curtas exatas na borda de palavra
  'GF': 'GF', 'GFD': 'GFD', 'GD': 'GD', 'BD': 'BD', 'B': 'B', 
  'BF': 'BF', 'BFD': 'BFD', 'SS': 'SS', 'GB': 'GB', 'HG': 'HG', 
  'GL': 'GL', 'GS': 'GS', 'FBD': 'FBD', 'SD': 'SD', 'BDS': 'BDS',
  'LBD': 'LBD', 'LBF': 'LBF', 'OV': 'OV'
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
    const paddedDesc = ` ${descUpper} `;
    
    for (const key of sortedFinishKeys) {
        // Se a chave possui espaços laterais explícitos (ex: ' B ', ' BD ')
        if (key.startsWith(' ') || key.endsWith(' ')) {
            if (paddedDesc.includes(key)) {
                finishAbbr = finishMapping[key];
                break;
            }
            continue;
        }

        const trimmedKey = key.trim().toUpperCase().replace(/\s+/g, ' ');
        
        // Siglas curtas exatas (1 a 4 letras): requer limite de palavra (\b) para não bater dentro de outras palavras
        // como a letra 'B' bater em 'BORDA', 'BRUTA' ou 'CROMADA'
        if (trimmedKey.length <= 4 && !trimmedKey.includes(' ')) {
            const regex = new RegExp(`\\b${trimmedKey}\\b`, 'i');
            if (regex.test(descUpper)) {
                finishAbbr = finishMapping[key];
                break;
            }
        } else if (descUpper.includes(trimmedKey)) {
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

export type PhotoStatusType = 
    | 'override_item'   // Override manual salvo especificamente para este código
    | 'override_model'  // Override manual salvo para a combinação Modelo + Acabamento
    | 'exact'           // Foto exata encontrada no photoMap para o modelo e acabamento
    | 'fallback'        // Usando foto provisória/genérica do modelo (falta foto deste acabamento)
    | 'none';           // Nenhuma foto encontrada para este modelo

export interface WheelPhotoDetails {
    url: string;
    status: PhotoStatusType;
    statusLabel: string;
    modelCode: string;
    finishAbbr: string;
    aro: string;
    isPlaceholder: boolean;
    availablePhotosCount: number;
    hasOverride: boolean;
    overrideScope?: 'item' | 'model';
}

/**
 * Normaliza um caminho relativo de foto para URL pública do Supabase Storage.
 */
export function normalizePhotoPath(rawPath: string): string {
    if (!rawPath) return '';
    if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) return rawPath;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) return rawPath;

    // 1. Extrair caminho relativo (remove /fotos/ se existir)
    let relativePath = rawPath.replace(/^\/fotos\//, '');
    
    // 2. Trocar extensão para .webp
    relativePath = relativePath.substring(0, relativePath.lastIndexOf('.')) + '.webp';
    
    // 3. Normalizar
    let normalizedPath = relativePath.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    normalizedPath = normalizedPath.replace(/[^\w\s\/\.\-]/g, '');

    // 4. Montar URL pública (bucket 'fotos')
    const publicBaseUrl = `${supabaseUrl}/storage/v1/object/public/fotos/`;
    return publicBaseUrl + normalizedPath.split('/').map(part => encodeURIComponent(part)).join('/');
}

/**
 * Retorna os mapas de overrides ativos no momento.
 */
export function getActiveOverrides() {
    return {
        itemOverrides: { ...itemOverrides },
        photoOverrides: { ...photoOverrides }
    };
}

/**
 * Retorna todos os detalhes de resolução da foto de uma roda, incluindo seu status de foto
 * (sem foto, genérica, exata, ou com override).
 */
export function getWheelPhotoDetails(description: string, itemCodigo?: string): WheelPhotoDetails {
    const placeholder = "https://placehold.co/300x300/e2e8f0/64748b?text=SEM+FOTO";
    if (!description) {
        return {
            url: placeholder,
            status: 'none',
            statusLabel: 'Sem Foto',
            modelCode: '',
            finishAbbr: '',
            aro: '',
            isPlaceholder: true,
            availablePhotosCount: 0,
            hasOverride: false
        };
    }

    const descUpper = description.toUpperCase().replace(/\s+/g, ' ').trim();
    const { modelCode, finishAbbr } = getModelAndFinish(descUpper);
    const modelPhotos = (photoMap as Record<string, Record<string, string>>)[modelCode] || {};
    const availablePhotosCount = Object.keys(modelPhotos).length;

    // Extrair Aro/Tala (ex: 15X4, 15X4,0, 15X10)
    const aroMatch = descUpper.match(/(\d{2}[XxX\*][\d\.,]+)|(\b\d{2}\b)/i);
    const normalizeSize = (s: string) => s.replace(/,/g, '.').replace(/\.0\b/g, '').replace(/\*/g, 'X').toUpperCase();
    const itemAro = aroMatch ? normalizeSize(aroMatch[0]) : "";

    // 0. Override Individual por Código
    if (itemCodigo && itemOverrides[itemCodigo]) {
        return {
            url: itemOverrides[itemCodigo],
            status: 'override_item',
            statusLabel: 'Item Customizado',
            modelCode,
            finishAbbr,
            aro: itemAro,
            isPlaceholder: false,
            availablePhotosCount,
            hasOverride: true,
            overrideScope: 'item'
        };
    }

    // 1. Override por Modelo / Acabamento
    if (finishAbbr && photoOverrides[modelCode]?.[finishAbbr]) {
        return {
            url: photoOverrides[modelCode][finishAbbr],
            status: 'override_model',
            statusLabel: 'Grupo Customizado',
            modelCode,
            finishAbbr,
            aro: itemAro,
            isPlaceholder: false,
            availablePhotosCount,
            hasOverride: true,
            overrideScope: 'model'
        };
    }

    // 2. Modelo sem nenhuma foto cadastrada no photoMap
    if (availablePhotosCount === 0) {
        return {
            url: placeholder,
            status: 'none',
            statusLabel: 'Sem Foto',
            modelCode,
            finishAbbr,
            aro: itemAro,
            isPlaceholder: true,
            availablePhotosCount: 0,
            hasOverride: false
        };
    }

    // 3. Tentar encontrar a melhor foto para o acabamento correspondente
    let bestPath = "";
    if (finishAbbr) {
        const finishRegex = new RegExp(`\\b${finishAbbr}\\b`, 'i');
        const photosForFinish = Object.entries(modelPhotos).filter(([_, path]) => {
            return finishRegex.test(path);
        });

        if (photosForFinish.length > 0) {
            if (itemAro) {
                const sizeMatch = photosForFinish.find(([_, path]) => {
                    const normalizedPath = normalizeSize(path.toUpperCase());
                    return normalizedPath.includes(itemAro);
                });
                if (sizeMatch) bestPath = sizeMatch[1];
            }
            if (!bestPath) bestPath = photosForFinish[0][1];
        }
    }

    if (bestPath) {
        return {
            url: normalizePhotoPath(bestPath),
            status: 'exact',
            statusLabel: 'Foto Exata',
            modelCode,
            finishAbbr,
            aro: itemAro,
            isPlaceholder: false,
            availablePhotosCount,
            hasOverride: false
        };
    }

    // 4. Fallback: Qualquer foto do modelo (Genérica / Provisória)
    const fallbackPath = Object.values(modelPhotos)[0];
    if (fallbackPath) {
        return {
            url: normalizePhotoPath(fallbackPath),
            status: 'fallback',
            statusLabel: 'Foto Genérica',
            modelCode,
            finishAbbr,
            aro: itemAro,
            isPlaceholder: false,
            availablePhotosCount,
            hasOverride: false
        };
    }

    return {
        url: placeholder,
        status: 'none',
        statusLabel: 'Sem Foto',
        modelCode,
        finishAbbr,
        aro: itemAro,
        isPlaceholder: true,
        availablePhotosCount: 0,
        hasOverride: false
    };
}

/**
 * Resolve a URL da foto de uma roda baseada na sua descrição e código.
 */
export function getWheelPhotoUrl(description: string, itemCodigo?: string): string {
    return getWheelPhotoDetails(description, itemCodigo).url;
}
