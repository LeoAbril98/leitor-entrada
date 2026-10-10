export function romaneioOrigin(value: { tipo?: string; titulo?: string; numero?: string }): 'PR' | 'SC' | 'CM' {
    if (value.tipo === 'PR' || value.tipo === 'SC' || value.tipo === 'CM') return value.tipo;
    const text = `${value.titulo || ''} ${value.numero || ''}`.toUpperCase();
    if (/\bCM\b|CAMPINAS/.test(text)) return 'CM';
    if (/\bSC\b|SANTA CATARINA/.test(text)) return 'SC';
    return 'PR';
}
