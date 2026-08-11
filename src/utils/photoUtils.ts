export { default as photoMap } from '../data/photoMap.json';
import photoMap from '../data/photoMap.json';
import { findWheelSpecOverride } from './wheelSpecsStore';

// Small 1x1 transparent PNG as a safe fallback that never triggers network requests
export const NO_PHOTO_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

export function hasMapping(description: string | null | undefined): boolean {
    if (!description) return false;
    const modelCode = description.toUpperCase().split(' ')[0];
    const modelPhotos = (photoMap as any)[modelCode];
    return !!modelPhotos && Object.keys(modelPhotos).length > 0;
}

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
  'GF': 'GF',
  'GFD': 'GFD',
  'GD': 'GD',
  'BD': 'BD',
  'B': 'B',
  'BF': 'BF',
  'BFD': 'BFD',
  'SS': 'SS',
  'GB': 'GB',
  'HG': 'HG',
  'GL': 'GL',
  'GS': 'GS',
  'FBD': 'FBD',
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
    const descUpper = description.toUpperCase();
    const modelCode = descUpper.split(' ')[0];
    
    let finishAbbr: string = '';
    for (const key of sortedFinishKeys) {
        if (descUpper.includes(key)) {
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

export interface WheelSpecs {
    model: string;
    linha: string;
    aroTala: string;
    aro: string;
    tala: string;
    furacao: string;
    offset: string;
    cuboAnel: string;
    cuboTipo: 'cubo' | 'anel' | 'desconhecido';
    acabamento: string;
}

/**
 * Extrai informações técnicas completas da roda a partir da descrição e/ou código.
 * (Aro, Tala, Furação/PCD, Offset/ET, Cubo/Anel Centralizador, Linha/Modelo, Acabamento)
 */
export function parseWheelSpecs(description: string = '', itemCodigo: string = ''): WheelSpecs {
    const descUpper = (description || '').toUpperCase().trim();
    const codeUpper = (itemCodigo || '').toUpperCase().trim();
    const { modelCode: model, finishAbbr } = getModelAndFinish(descUpper);

    // 1. Linha (ex: Linha M, Linha K, Linha R)
    const lineLetter = model.match(/^[A-Z]+/i)?.[0] || "";
    const linha = lineLetter ? `Linha ${lineLetter}` : "";

    // 2. Aro e Tala (ex: 13X5,5 | 15X7 | 14X6 | 17X4 | 15*7.5 | 13X5.5)
    const sizeMatch = descUpper.match(/(\d{2})[XxX\*]([\d\.,]+)/i);
    let aro = "";
    let tala = "";
    let aroTala = "";
    if (sizeMatch) {
        aro = sizeMatch[1];
        tala = sizeMatch[2].replace(',', '.');
        aroTala = `${aro}x${tala}"`;
    } else {
        const aroOnly = descUpper.match(/(\b\d{2}\b)/);
        if (aroOnly) {
            aro = aroOnly[1];
            aroTala = `${aro}"`;
        }
    }

    // 3. Furação (PCD) (ex: 4X98 | 4X100 | 5X112 | 5X120 | 5X114 | 4X108 | 4F | 5F)
    const furMatch = descUpper.match(/\b(\d[XxX\*]\d{2,3}(\.\d+)?)\b/i) || descUpper.match(/\b(\d[Ff])\b/i);
    const furacao = furMatch ? furMatch[0].toUpperCase().replace('*', 'X') : "";

    // 4. Offset (ET) (ex: ET36 | ET 36 | ET39 | ET32 | ET42)
    const etMatch = descUpper.match(/\bET\s*(-?\d{1,2})\b/i) || descUpper.match(/\bET(\d{1,2})\b/i);
    let offset = "";
    if (etMatch) {
        offset = `ET${etMatch[1]}`;
    } else {
        // Tentar extrair do código (ex: A36 -> ET36 ou ET36)
        const codeEt = codeUpper.match(/ET(\d{2})|A(\d{2})/);
        if (codeEt) {
            offset = `ET${codeEt[1] || codeEt[2]}`;
        }
    }

    // 5. Cubo (CB) / Anel Centralizador
    let cuboAnel = "";
    let cuboTipo: 'cubo' | 'anel' | 'desconhecido' = 'desconhecido';

    // 5.1 Verificar se existe um mapeamento customizado pelo usuário no menu
    const customOverride = findWheelSpecOverride(model, furacao, aro);

    if (customOverride) {
        cuboTipo = customOverride.type === 'ANEL' ? 'anel' : 'cubo';
        cuboAnel = `${customOverride.mm} mm (${customOverride.type === 'ANEL' ? 'Anel' : 'Cubo Esp.'})`;
    } else {
        const mmMatch = descUpper.match(/(\d{2}\.\d)\s*(MM)?/i) || descUpper.match(/CB\s*(\d{2}\.\d)/i);
        const isAnelKeyword = /\b(ANEL|ANEL CENTRALIZADOR)\b/i.test(descUpper) || /\b\d[XxX\*]\d{2,3}\s+A\s+/i.test(descUpper) || descUpper.includes(' ANEL ');
        const isCuboKeyword = /\b(CUBO|CB|CUBO ESP|CUBO ESPECIFICO)\b/i.test(descUpper);

        if (mmMatch) {
            const mmVal = mmMatch[1];
            if (isAnelKeyword) {
                cuboAnel = `${mmVal} mm (Anel)`;
                cuboTipo = 'anel';
            } else {
                cuboAnel = `${mmVal} mm (Cubo)`;
                cuboTipo = 'cubo';
            }
        } else if (model.startsWith('R82')) {
            cuboAnel = '56.6 mm (Cubo Esp.)';
            cuboTipo = 'cubo';
        } else if (model.startsWith('R83') || model.startsWith('R75')) {
            cuboAnel = '57.1 mm (Cubo Esp.)';
            cuboTipo = 'cubo';
        } else if (model.startsWith('K57')) {
            cuboAnel = '57.1 mm (Anel)';
            cuboTipo = 'anel';
        } else if (model.startsWith('K58')) {
            if (furacao.includes('5X112')) {
                cuboAnel = '66.6 mm (Cubo Esp.)';
                cuboTipo = 'cubo';
            } else if (furacao.includes('5X120')) {
                cuboAnel = '72.6 mm (Cubo Esp.)';
                cuboTipo = 'cubo';
            } else {
                cuboAnel = '66.6/72.6 mm (Cubo Esp.)';
                cuboTipo = 'cubo';
            }
        } else if (isAnelKeyword) {
            if (furacao.includes('4X100') || furacao.includes('4X98')) {
                cuboAnel = '57.1 mm (Anel)';
            } else {
                cuboAnel = 'Anel Centralizador';
            }
            cuboTipo = 'anel';
        } else if (isCuboKeyword) {
            cuboAnel = 'Cubo Específico';
            cuboTipo = 'cubo';
        } else if (furacao) {
            if (furacao.includes('4X100') || furacao.includes('4X98')) {
                cuboAnel = '57.1 mm (Anel)';
                cuboTipo = 'anel';
            } else if (furacao.includes('5X112')) {
                cuboAnel = '66.6 mm (Cubo Esp.)';
                cuboTipo = 'cubo';
            } else if (furacao.includes('5X120')) {
                cuboAnel = '72.6 mm (Cubo Esp.)';
                cuboTipo = 'cubo';
            }
        }
    }

    // 6. Acabamento
    let acabamento = finishAbbr || "";
    for (const [key] of Object.entries(finishMapping)) {
        if (descUpper.includes(key) && key.length > 3) {
            acabamento = key;
            break;
        }
    }

    return {
        model,
        linha,
        aroTala,
        aro,
        tala,
        furacao,
        offset,
        cuboAnel,
        cuboTipo,
        acabamento
    };
}
