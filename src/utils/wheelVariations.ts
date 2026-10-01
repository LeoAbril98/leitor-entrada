import { StockItem } from '../types';
import { sortedFinishKeys } from './photoUtils';

export interface ParsedWheelVariation {
    item: StockItem;
    model: string;
    aro: string;           // ex: '15"'
    tala: string;          // ex: '7.0'
    furacao: string;       // ex: '4X100' ou '4X100/108'
    acabamento: string;    // ex: 'BLACK DIAMOND' ou 'BD'
}

export interface ModelVariationsData {
    model: string;
    totalVariations: number;
    currentVariation: ParsedWheelVariation;
    allVariations: ParsedWheelVariation[];
    availableAros: string[];
    availableFuracoes: string[];
    availableAcabamentos: string[];
}

/**
 * Extrai o código do modelo de uma roda a partir da descrição ou código.
 * Ex: "K34 15X6,0 4X100..." -> "K34"
 * Ex: "RODA C10 15X4..." -> "C10"
 */
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
        // Tentar extrair do código (ex: K341560... -> K34, C101540... -> C10)
        const match = code.toUpperCase().match(/^([A-Z]{1,3}\d{1,3})/);
        if (match) return match[1];
    }

    return '';
}

/**
 * Extrai o Aro de uma descrição.
 * Ex: "15X7,0" -> '15"'
 * Ex: "ARO 17" -> '17"'
 */
export function extractAro(description?: string): string {
    if (!description) return '';
    const upper = description.toUpperCase();

    // 1. Procura padrão 15X6, 17*7, 18X8,5, 15X7-8
    const matchX = upper.match(/\b(1[2-9]|2[0-8])\s*[Xx\*][\d\.,\-]+/i);
    if (matchX) {
        const digits = matchX[0].match(/^(1[2-9]|2[0-8])/);
        if (digits) return `${digits[1]}"`;
    }

    // 2. Procura padrão ARO 15
    const matchAro = upper.match(/\bARO\s*(1[2-9]|2[0-8])\b/i);
    if (matchAro) {
        return `${matchAro[1]}"`;
    }

    // 3. Procura padrão 15" ou 17"
    const matchQuote = upper.match(/\b(1[2-9]|2[0-8])["'”]/);
    if (matchQuote) {
        return `${matchQuote[1]}"`;
    }

    return '';
}

/**
 * Extrai a Tala de uma descrição.
 * Ex: "15X7,0" -> '7,0'
 */
export function extractTala(description?: string): string {
    if (!description) return '';
    const match = description.toUpperCase().match(/\b\d{2}[Xx\*]([\d\.,\-]+)\b/);
    return match ? match[1] : '';
}

/**
 * Extrai a Furação de uma descrição.
 * Ex: "4X100", "4X100/108", "5X112", "5X114,3", "4F", "5F"
 */
export function extractFuracao(description?: string): string {
    if (!description) return '';
    const upper = description.toUpperCase();

    // Padrão 4X100, 4X100/108, 5X112, 6X139, 4F, 5F
    const match = upper.match(/\b([34568][Xx][\d\.,]+(?:\/[\d\.,]+)*|[34568]F(?:UROS?)?)\b/i);
    if (match) {
        return match[1].replace(/\s+/g, '').toUpperCase();
    }

    return '';
}

/**
 * Extrai o Acabamento de uma descrição usando a lista de acabamentos conhecidos.
 * Ex: "BLACK DIAMOND SMOKE", "BLACK DIAMOND", "BLACK FOSCO", "BLACK"
 */
export function extractAcabamento(description?: string): string {
    if (!description) return '';
    
    // Normaliza a string: deixa tudo maiúsculo e transforma espaços duplos/triplos em apenas um espaço
    const upper = description.toUpperCase().replace(/\s+/g, ' ').trim();

    // Ordena do maior para o menor
    const keysSortedByLength = [...sortedFinishKeys].sort((a, b) => {
        return b.trim().length - a.trim().length;
    });

    for (const key of keysSortedByLength) {
        // Limpa a chave da lista também, por garantia
        const trimmedKey = key.trim().toUpperCase().replace(/\s+/g, ' ');
        
        if (trimmedKey.length <= 2) {
            const regex = new RegExp(`\\b${trimmedKey}\\b`, 'i');
            if (regex.test(upper)) {
                return key.trim(); 
            }
        } else if (upper.includes(trimmedKey)) {
            return key.trim(); // Achou! Retorna exatamente como está escrito na lista
        }
    }

    // Regra Linha C: Se começa com C e não achou acabamento, pode ser BRUTA
    const model = extractModel(description);
    if (model.startsWith('C')) {
        return 'BRUTA';
    }

    return '';
}

/**
 * Realiza o parse completo das especificações de um item de roda.
 */
export function parseWheelVariation(item: StockItem): ParsedWheelVariation {
    return {
        item,
        model: extractModel(item.descricao, item.codigo),
        aro: extractAro(item.descricao),
        tala: extractTala(item.descricao),
        furacao: extractFuracao(item.descricao),
        acabamento: extractAcabamento(item.descricao),
    };
}

/**
 * Agrupa e extrai todas as variações disponíveis para o modelo do item atual dentro do estoque completo.
 */
export function getModelVariations(
    currentItem: StockItem,
    allStock: StockItem[]
): ModelVariationsData | null {
    if (!currentItem) return null;

    const currentVariation = parseWheelVariation(currentItem);
    const model = currentVariation.model;
    if (!model) return null;

    // Filtrar todos os itens do mesmo modelo
    const siblings = allStock.filter(item => {
        const itemModel = extractModel(item.descricao, item.codigo);
        return itemModel === model;
    });

    if (siblings.length === 0) return null;

    const allVariations = siblings.map(parseWheelVariation);

    // 1. Aros: Todos os aros disponíveis para o modelo
    const aroSet = new Set<string>();
    allVariations.forEach(v => {
        if (v.aro) aroSet.add(v.aro);
    });

    const availableAros = Array.from(aroSet).sort((a, b) => {
        const numA = parseInt(a) || 0;
        const numB = parseInt(b) || 0;
        return numA - numB;
    });

    // 2. Furações: APENAS as que existem no Aro selecionado
    const variationsInSelectedAro = currentVariation.aro 
        ? allVariations.filter(v => v.aro === currentVariation.aro)
        : allVariations;

    const furacaoSet = new Set<string>();
    variationsInSelectedAro.forEach(v => {
        if (v.furacao) furacaoSet.add(v.furacao);
    });
    const availableFuracoes = Array.from(furacaoSet).sort((a, b) => {
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

    // 3. Acabamentos: APENAS os que existem no Aro selecionado (e furação atual se houver)
    const variationsInSelectedAroAndFuracao = currentVariation.furacao
        ? variationsInSelectedAro.filter(v => v.furacao === currentVariation.furacao)
        : variationsInSelectedAro;

    const acabamentoPool = variationsInSelectedAroAndFuracao.length > 0 
        ? variationsInSelectedAroAndFuracao 
        : variationsInSelectedAro;

    const acabamentoSet = new Set<string>();
    acabamentoPool.forEach(v => {
        if (v.acabamento) acabamentoSet.add(v.acabamento);
    });
    const availableAcabamentos = Array.from(acabamentoSet).sort((a, b) => a.localeCompare(b));

    return {
        model,
        totalVariations: allVariations.length,
        currentVariation,
        allVariations,
        availableAros,
        availableFuracoes,
        availableAcabamentos
    };
}

/**
 * Busca a melhor variação quando o usuário clica em um atributo específico (Aro, Furação ou Acabamento).
 * Prioriza combinações existentes que mantenham os outros atributos atuais ou itens com estoque positivo.
 */
export function findBestVariationMatch(
    allVariations: ParsedWheelVariation[],
    target: { aro?: string; furacao?: string; acabamento?: string },
    current: ParsedWheelVariation
): StockItem | null {
    if (!allVariations || allVariations.length === 0) return null;

    const desiredAro = target.aro ?? current.aro;
    const desiredFuracao = target.furacao ?? current.furacao;
    const desiredAcabamento = target.acabamento ?? current.acabamento;

    // 1. Tentar correspondência EXATA (mesmo aro + mesma furação + mesmo acabamento)
    const exactMatch = allVariations.find(v => 
        (!desiredAro || v.aro === desiredAro) &&
        (!desiredFuracao || v.furacao === desiredFuracao) &&
        (!desiredAcabamento || v.acabamento === desiredAcabamento)
    );
    if (exactMatch) return exactMatch.item;

    // 2. Se mudou o Aro: manter a furação se possível, senão o acabamento
    if (target.aro) {
        const withFuracao = allVariations.find(v => v.aro === target.aro && v.furacao === current.furacao);
        if (withFuracao) return withFuracao.item;

        const withAcabamento = allVariations.find(v => v.aro === target.aro && v.acabamento === current.acabamento);
        if (withAcabamento) return withAcabamento.item;

        // Qualquer item com esse aro (preferir com estoque)
        const anyWithStock = allVariations.find(v => v.aro === target.aro && Number(v.item.quantidade || 0) > 0);
        if (anyWithStock) return anyWithStock.item;

        const anyAro = allVariations.find(v => v.aro === target.aro);
        if (anyAro) return anyAro.item;
    }

    // 3. Se mudou a Furação: manter o aro se possível, senão o acabamento
    if (target.furacao) {
        const withAro = allVariations.find(v => v.furacao === target.furacao && v.aro === current.aro);
        if (withAro) return withAro.item;

        const withAcabamento = allVariations.find(v => v.furacao === target.furacao && v.acabamento === current.acabamento);
        if (withAcabamento) return withAcabamento.item;

        const anyFuracao = allVariations.find(v => v.furacao === target.furacao);
        if (anyFuracao) return anyFuracao.item;
    }

    // 4. Se mudou o Acabamento: manter aro e furação se possível
    if (target.acabamento) {
        const withAroFuracao = allVariations.find(v => v.acabamento === target.acabamento && v.aro === current.aro && v.furacao === current.furacao);
        if (withAroFuracao) return withAroFuracao.item;

        const withAro = allVariations.find(v => v.acabamento === target.acabamento && v.aro === current.aro);
        if (withAro) return withAro.item;

        const anyAcabamento = allVariations.find(v => v.acabamento === target.acabamento);
        if (anyAcabamento) return anyAcabamento.item;
    }

    return null;
}
