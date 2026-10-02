import { StockItem } from '../types';
import { sortedFinishKeys } from './photoUtils';

export interface ParsedWheelVariation {
    item: StockItem;
    model: string;
    medida: string;        // ex: '15X7', '18X8,5', '17"'
    aro: string;           // ex: '15"'
    tala: string;          // ex: '7' ou '8,5'
    et: string;            // ex: '35' ou '-44'
    furacao: string;       
    acabamento: string;    
}

export interface ModelVariationsData {
    model: string;
    totalVariations: number;
    currentVariation: ParsedWheelVariation;
    allVariations: ParsedWheelVariation[];
    availableMedidas: string[];   // ex: ['15X6', '15X7', '15X8', '18X8']
    availableAros: string[];
    availableTalas: string[];
    availableETs: string[];
    availableFuracoes: string[];
    availableAcabamentos: string[];
}

export function extractModel(description?: string, code?: string): string {
    if (description) {
        const clean = description.trim().toUpperCase()
            .replace(/^(?:RODAS?|JOGO\s+DE\s+RODAS?)\s+/i, '');
        const firstWord = clean.split(/\s+/)[0];
        if (firstWord && firstWord.length >= 2) {
            return firstWord;
        }
    }
    if (code) {
        const match = code.toUpperCase().match(/^([A-Z]{1,3}\d{1,3})/);
        if (match) return match[1];
    }
    return '';
}

export function extractAro(description?: string): string {
    if (!description) return '';
    const upper = description.toUpperCase();
    const matchX = upper.match(/\b(1[2-9]|2[0-8])\s*[Xx\*][\d\.,\-]+/i);
    if (matchX) {
        const digits = matchX[0].match(/^(1[2-9]|2[0-8])/);
        if (digits) return `${digits[1]}"`;
    }
    const matchAro = upper.match(/\bARO\s*(1[2-9]|2[0-8])\b/i);
    if (matchAro) return `${matchAro[1]}"`;
    const matchQuote = upper.match(/\b(1[2-9]|2[0-8])["'”]/);
    if (matchQuote) return `${matchQuote[1]}"`;
    return '';
}

export function extractTala(description?: string): string {
    if (!description) return '';
    // Ex: "15X7,0" -> "7" | "15X4" -> "4" | "19X8,5" -> "8,5"
    const match = description.toUpperCase().match(/\b\d{2}[Xx\*]([\d\.,\-]+)\b/);
    if (!match) return '';
    // Normaliza 7,0 ou 7.0 para 7, preservando 8,5, 7-8, etc.
    return match[1].replace(/[,.]0$/, '');
}

/**
 * Extrai a Medida combinada (Aro x Tala), ex: "15X6", "15X7", "18X8,5" ou "17\""
 */
export function extractMedida(description?: string): string {
    if (!description) return '';
    const upper = description.toUpperCase();
    const matchX = upper.match(/\b(1[2-9]|2[0-8])\s*[Xx\*]\s*([\d\.,\-]+)\b/i);
    if (matchX) {
        const aro = matchX[1];
        const tala = matchX[2].replace(/[,.]0$/, '');
        return `${aro}X${tala}`;
    }
    return extractAro(description);
}

export function extractET(description?: string): string {
    if (!description) return '';
    // Ex: "ET-44", "ET 35", "ET+20", "ET30", "ET+30"
    const match = description.toUpperCase().match(/\bET\s*([+-]?\s*\d+)\b/);
    if (!match) return '';
    const raw = match[1].replace(/\s+/g, '');
    // Normalizar +30 para 30 (mantém negativos como -44, -10)
    return raw.replace(/^\+/, '');
}

export function extractFuracao(description?: string): string {
    if (!description) return '';
    const upper = description.toUpperCase();
    const match = upper.match(/\b([34568][Xx][\d\.,]+(?:\/[\d\.,]+)*|[34568]F(?:UROS?)?)\b/i);
    if (match) return match[1].replace(/\s+/g, '').toUpperCase();
    return '';
}

export function extractAcabamento(description?: string): string {
    if (!description) return '';
    const upper = description.toUpperCase().replace(/\s+/g, ' ').trim();
    const paddedUpper = ` ${upper} `;
    const keysSortedByLength = [...sortedFinishKeys].sort((a, b) => b.trim().length - a.trim().length);

    for (const key of keysSortedByLength) {
        // Se a chave possui espaços laterais explícitos (ex: ' B ', ' BD ')
        if (key.startsWith(' ') || key.endsWith(' ')) {
            if (paddedUpper.includes(key)) {
                return key.trim();
            }
            continue;
        }

        const trimmedKey = key.trim().toUpperCase().replace(/\s+/g, ' ');
        // Siglas curtas exatas (1 a 4 letras): requer limite de palavra (\b)
        if (trimmedKey.length <= 4 && !trimmedKey.includes(' ')) {
            const regex = new RegExp(`\\b${trimmedKey}\\b`, 'i');
            if (regex.test(upper)) return key.trim(); 
        } else if (upper.includes(trimmedKey)) {
            return key.trim(); 
        }
    }
    const model = extractModel(description);
    if (model.startsWith('C')) return 'BRUTA';
    return '';
}

export function parseWheelVariation(item: StockItem): ParsedWheelVariation {
    return {
        item,
        model: extractModel(item.descricao, item.codigo),
        medida: extractMedida(item.descricao),
        aro: extractAro(item.descricao),
        tala: extractTala(item.descricao),
        et: extractET(item.descricao),
        furacao: extractFuracao(item.descricao),
        acabamento: extractAcabamento(item.descricao),
    };
}

export function getModelVariations(currentItem: StockItem, allStock: StockItem[]): ModelVariationsData | null {
    if (!currentItem) return null;

    const currentVariation = parseWheelVariation(currentItem);
    const model = currentVariation.model;
    if (!model) return null;

    const siblings = allStock.filter(item => extractModel(item.descricao, item.codigo) === model);
    if (siblings.length === 0) return null;

    const allVariations = siblings.map(parseWheelVariation);

    // 1. Medidas (Aro x Tala combinados)
    const availableMedidas = Array.from(new Set(allVariations.map(v => v.medida).filter(Boolean)))
        .sort((a, b) => {
            const matchA = a.match(/^(\d{2})(?:[Xx]([\d\.,\-]+))?/);
            const matchB = b.match(/^(\d{2})(?:[Xx]([\d\.,\-]+))?/);
            if (matchA && matchB) {
                const aroA = parseInt(matchA[1], 10) || 0;
                const aroB = parseInt(matchB[1], 10) || 0;
                if (aroA !== aroB) return aroA - aroB;

                const talaA = parseFloat((matchA[2] || '0').replace(',', '.')) || 0;
                const talaB = parseFloat((matchB[2] || '0').replace(',', '.')) || 0;
                if (talaA !== talaB) return talaA - talaB;
            }
            return a.localeCompare(b);
        });

    // 2. Aros individuais (compatibilidade)
    const availableAros = Array.from(new Set(allVariations.map(v => v.aro).filter(Boolean)))
        .sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));

    // 3. Talas individuais (no Aro selecionado)
    const inAro = currentVariation.aro ? allVariations.filter(v => v.aro === currentVariation.aro) : allVariations;
    const availableTalas = Array.from(new Set(inAro.map(v => v.tala).filter(Boolean)))
        .sort((a, b) => (parseFloat(a.replace(',', '.')) || 0) - (parseFloat(b.replace(',', '.')) || 0));

    // 4. Furações (no escopo da Medida selecionada: Medida ➜ Furação)
    const inMedida = currentVariation.medida 
        ? allVariations.filter(v => v.medida === currentVariation.medida) 
        : allVariations;

    const availableFuracoes = Array.from(new Set(inMedida.map(v => v.furacao).filter(Boolean))).sort((a, b) => {
        const matchA = a.match(/([34568])\s*[X\*\-]\s*([\d\.,]+)/i);
        const matchB = b.match(/([34568])\s*[X\*\-]\s*([\d\.,]+)/i);
        if (matchA && matchB) {
            const holesA = parseInt(matchA[1], 10) || 0;
            const holesB = parseInt(matchB[1], 10) || 0;
            if (holesA !== holesB) return holesA - holesB;

            const pcdA = parseFloat(matchA[2].replace(',', '.')) || 0;
            const pcdB = parseFloat(matchB[2].replace(',', '.')) || 0;
            if (pcdA !== pcdB) return pcdA - pcdB;
        }
        return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' });
    });

    // 5. Offset (ET) (no escopo da Medida e Furação selecionadas: Medida ➜ Furação ➜ Offset)
    const inMedidaFuracao = currentVariation.furacao
        ? inMedida.filter(v => v.furacao === currentVariation.furacao)
        : inMedida;

    const etPool = inMedidaFuracao.length > 0 ? inMedidaFuracao : inMedida;
    const availableETs = Array.from(new Set(etPool.map(v => v.et).filter(Boolean)))
        .sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));

    // 6. Acabamentos (no escopo da Medida, Furação e ET selecionados: Medida ➜ Furação ➜ Offset ➜ Acabamento)
    const inMedidaFuracaoET = (currentVariation.et && inMedidaFuracao.length > 0)
        ? inMedidaFuracao.filter(v => v.et === currentVariation.et)
        : inMedidaFuracao;

    const acabamentoPool = inMedidaFuracaoET.length > 0 ? inMedidaFuracaoET : inMedida;
    const availableAcabamentos = Array.from(new Set(acabamentoPool.map(v => v.acabamento).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b));

    return { 
        model, 
        totalVariations: allVariations.length, 
        currentVariation, 
        allVariations, 
        availableMedidas,
        availableAros, 
        availableTalas, 
        availableETs, 
        availableFuracoes, 
        availableAcabamentos 
    };
}

/**
 * Busca a melhor variação em CASCATA ESTRITA.
 * A hierarquia é: Medida (Aro/Tala) ➜ Furação ➜ Offset (ET) ➜ Acabamento.
 * REGRA FUNDAMENTAL: A Medida NUNCA é alterada ao clicar em Furação, ET ou Acabamento!
 */
export function findBestVariationMatch(
    allVariations: ParsedWheelVariation[],
    target: { medida?: string; aro?: string; tala?: string; et?: string; furacao?: string; acabamento?: string },
    current: ParsedWheelVariation
): StockItem | null {
    if (!allVariations || allVariations.length === 0) return null;

    // ─────────────────────────────────────────────────────────────
    // NÍVEL 1: O usuário clicou explicitamente em uma MEDIDA (Aro/Tala)
    // ─────────────────────────────────────────────────────────────
    if (target.medida) {
        const inTargetMedida = allVariations.filter(v => v.medida === target.medida);
        if (inTargetMedida.length > 0) {
            // Pontua dentro da nova medida tentando preservar Furação > ET > Acabamento > Estoque
            const scored = inTargetMedida.map(v => {
                let s = 0;
                if (current.furacao && v.furacao === current.furacao) s += 500;
                if (current.et && v.et === current.et) s += 200;
                if (current.acabamento && v.acabamento === current.acabamento) s += 100;
                if (Number(v.item.quantidade || 0) > 0) s += 1;
                return { item: v.item, score: s };
            });
            scored.sort((a, b) => b.score - a.score);
            return scored[0].item;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // NÍVEL 2: O usuário clicou em FURAÇÃO
    // CASCATA ESTRITA: A MEDIDA ATUAL NÃO PODE MUDAR!
    // ─────────────────────────────────────────────────────────────
    if (target.furacao) {
        let pool = allVariations.filter(v => 
            (!current.medida || v.medida === current.medida) && 
            v.furacao === target.furacao
        );

        if (pool.length > 0) {
            const scored = pool.map(v => {
                let s = 0;
                if (current.et && v.et === current.et) s += 500; // Mantém o ET se existir
                if (current.acabamento && v.acabamento === current.acabamento) s += 200; // Mantém acabamento se possível
                if (Number(v.item.quantidade || 0) > 0) s += 1;
                return { item: v.item, score: s };
            });
            scored.sort((a, b) => b.score - a.score);
            return scored[0].item;
        }

        // Fallback de segurança
        const fallbackPool = allVariations.filter(v => v.furacao === target.furacao);
        if (fallbackPool.length > 0) {
            const scored = fallbackPool.map(v => {
                let s = 0;
                if (current.medida && v.medida === current.medida) s += 10000;
                if (current.aro && v.aro === current.aro) s += 500;
                if (current.et && v.et === current.et) s += 100;
                if (current.acabamento && v.acabamento === current.acabamento) s += 50;
                if (Number(v.item.quantidade || 0) > 0) s += 1;
                return { item: v.item, score: s };
            });
            scored.sort((a, b) => b.score - a.score);
            return scored[0].item;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // NÍVEL 3: O usuário clicou em OFFSET (ET)
    // CASCATA ESTRITA: A MEDIDA E A FURAÇÃO ATUAIS NÃO PODEM MUDAR!
    // ─────────────────────────────────────────────────────────────
    if (target.et) {
        // Tenta achar com mesma Medida + mesma Furação + novo ET
        let pool = allVariations.filter(v => 
            (!current.medida || v.medida === current.medida) && 
            (!current.furacao || v.furacao === current.furacao) &&
            v.et === target.et
        );
        if (pool.length === 0) {
            // Tenta na mesma medida
            pool = allVariations.filter(v => (!current.medida || v.medida === current.medida) && v.et === target.et);
        }
        if (pool.length === 0) {
            pool = allVariations.filter(v => v.et === target.et);
        }
        if (pool.length > 0) {
            const scored = pool.map(v => {
                let s = 0;
                if (current.medida && v.medida === current.medida) s += 10000; // Bloqueio estrito da medida
                if (current.furacao && v.furacao === current.furacao) s += 1000; // Bloqueio da furação
                if (current.acabamento && v.acabamento === current.acabamento) s += 100;
                if (Number(v.item.quantidade || 0) > 0) s += 1;
                return { item: v.item, score: s };
            });
            scored.sort((a, b) => b.score - a.score);
            return scored[0].item;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // NÍVEL 4: O usuário clicou em ACABAMENTO
    // CASCATA ESTRITA: A MEDIDA, FURAÇÃO E ET NÃO PODEM MUDAR!
    // ─────────────────────────────────────────────────────────────
    if (target.acabamento) {
        // 1. Tenta achar na MESMA MEDIDA + MESMA FURAÇÃO + MESMO ET + NOVO ACABAMENTO
        let pool = allVariations.filter(v => 
            (!current.medida || v.medida === current.medida) &&
            (!current.furacao || v.furacao === current.furacao) &&
            (!current.et || v.et === current.et) &&
            v.acabamento === target.acabamento
        );

        if (pool.length > 0) {
            const scored = pool.map(v => {
                let s = 0;
                if (Number(v.item.quantidade || 0) > 0) s += 1;
                return { item: v.item, score: s };
            });
            scored.sort((a, b) => b.score - a.score);
            return scored[0].item;
        }

        // 2. Se não existir no mesmo ET, tenta na mesma Medida + mesma Furação
        let poolSameFuracao = allVariations.filter(v => 
            (!current.medida || v.medida === current.medida) &&
            (!current.furacao || v.furacao === current.furacao) &&
            v.acabamento === target.acabamento
        );
        if (poolSameFuracao.length > 0) {
            const scored = poolSameFuracao.map(v => {
                let s = 0;
                if (current.et && v.et === current.et) s += 500;
                if (Number(v.item.quantidade || 0) > 0) s += 1;
                return { item: v.item, score: s };
            });
            scored.sort((a, b) => b.score - a.score);
            return scored[0].item;
        }

        // 3. Se não existir na mesma furação, tenta na MESMA MEDIDA
        let poolSameMedida = allVariations.filter(v => 
            (!current.medida || v.medida === current.medida) &&
            v.acabamento === target.acabamento
        );
        if (poolSameMedida.length > 0) {
            const scored = poolSameMedida.map(v => {
                let s = 0;
                if (current.furacao && v.furacao === current.furacao) s += 500;
                if (current.et && v.et === current.et) s += 200;
                if (Number(v.item.quantidade || 0) > 0) s += 1;
                return { item: v.item, score: s };
            });
            scored.sort((a, b) => b.score - a.score);
            return scored[0].item;
        }

        // 4. Fallback global
        const fallbackPool = allVariations.filter(v => v.acabamento === target.acabamento);
        if (fallbackPool.length > 0) {
            const scored = fallbackPool.map(v => {
                let s = 0;
                if (current.medida && v.medida === current.medida) s += 10000;
                if (current.furacao && v.furacao === current.furacao) s += 500;
                if (current.et && v.et === current.et) s += 100;
                if (Number(v.item.quantidade || 0) > 0) s += 1;
                return { item: v.item, score: s };
            });
            scored.sort((a, b) => b.score - a.score);
            return scored[0].item;
        }
    }

    return null;
}
