import photoMap from '../data/photoMap.json';

const finishMapping: Record<string, string> = {
  'PRETO DIAMANTADO': 'BD',
  'BLACK DIAMOND': 'BD',
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

const sortedFinishKeys = Object.keys(finishMapping).sort((a, b) => b.length - a.length);

/**
 * Resolve a URL da foto de uma roda baseada na sua descrição.
 * Busca o modelo (primeira palavra) e o acabamento no mapeamento.
 */
export function getWheelPhotoUrl(description: string): string {
    if (!description) return "https://placehold.co/150x150/e2e8f0/64748b?text=FOTO";

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

    const photoUrl = (finishAbbr && modelPhotos[finishAbbr]) 
        ? modelPhotos[finishAbbr] 
        : (Object.values(modelPhotos)[0] || "https://placehold.co/150x150/e2e8f0/64748b?text=FOTO");

    return photoUrl;
}
