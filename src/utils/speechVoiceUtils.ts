/**
 * Utilitários para síntese de voz fluida e natural no módulo de localização
 */

export interface VoiceBadgeInfo {
    label: string;
    isNatural: boolean;
    color: string;
}

/**
 * Filtra e retorna apenas as vozes em Português disponíveis no navegador
 */
export const getPortugueseVoices = (voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] => {
    if (!voices || voices.length === 0) return [];
    return voices.filter(v => {
        const lang = (v.lang || '').toLowerCase().replace('_', '-');
        return lang.startsWith('pt');
    });
};

/**
 * Calcula uma pontuação de fluidez para ordenar vozes automaticamente
 * Prioriza vozes neurais / naturais (Microsoft Francisca/Antonio, Google, Apple Enhanced)
 */
export const scoreVoiceQuality = (voice: SpeechSynthesisVoice): number => {
    const name = (voice.name || '').toLowerCase();
    const lang = (voice.lang || '').toLowerCase().replace('_', '-');
    let score = 0;

    // Preferência clara para pt-BR
    if (lang.includes('br')) score += 50;

    // Vozes neurais / online da Microsoft (Windows 10/11 e Edge) - extremas de fluidas
    if (name.includes('natural') || name.includes('neural') || name.includes('online')) {
        score += 150;
    }

    // Vozes neurais do Google (Chrome e Android) - muito fluidas
    if (name.includes('google')) {
        score += 120;
    }

    // Vozes Apple Enhanced / Premium (macOS e iOS)
    if (name.includes('enhanced') || name.includes('premium') || name.includes('siri')) {
        score += 120;
    }

    // Nomes de vozes modernas de destaque
    if (name.includes('francisca') || name.includes('antonio') || name.includes('brenda') || name.includes('thalita')) {
        score += 30;
    }

    // Penaliza a voz antiga SAPI5 mecânica do Windows (Microsoft Maria clássica)
    if (name.includes('maria') && !name.includes('natural')) {
        score -= 40;
    }

    return score;
};

/**
 * Retorna a melhor voz em Português disponível no dispositivo
 */
export const getBestPtBrVoice = (voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
    const ptVoices = getPortugueseVoices(voices);
    if (ptVoices.length === 0) return null;

    return [...ptVoices].sort((a, b) => scoreVoiceQuality(b) - scoreVoiceQuality(a))[0] || ptVoices[0];
};

/**
 * Retorna badge descritivo de qualidade para a voz
 */
export const getVoiceBadge = (voice: SpeechSynthesisVoice): VoiceBadgeInfo => {
    const name = (voice.name || '').toLowerCase();

    if (name.includes('natural') || name.includes('neural') || name.includes('online')) {
        return {
            label: 'Ultra Natural (IA)',
            isNatural: true,
            color: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
        };
    }
    if (name.includes('google')) {
        return {
            label: 'Google Fluida',
            isNatural: true,
            color: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800'
        };
    }
    if (name.includes('enhanced') || name.includes('premium') || name.includes('siri')) {
        return {
            label: 'Apple Aprimorada',
            isNatural: true,
            color: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800'
        };
    }
    if (name.includes('maria') && !name.includes('natural')) {
        return {
            label: 'Voz Padrão do Sistema',
            isNatural: false,
            color: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
        };
    }

    return {
        label: 'Compatível',
        isNatural: false,
        color: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
    };
};

/**
 * Formata o código do local para pronúncia fluida (ex: '15D' vira '15 D')
 */
export const formatLocationForSpeech = (rawLocation: string): string => {
    let clean = (rawLocation || '').trim();
    if (!clean || clean === '---' || clean.toUpperCase() === 'SEM LOCAL') {
        return 'Sem localização cadastrada';
    }

    // Troca traços e underlines por espaço
    clean = clean.replace(/[-_]+/g, ' ');

    // Separa números colados com letras (ex: '15D' -> '15 D', 'A02' -> 'A 02')
    clean = clean.replace(/([0-9]+)([a-zA-Z]+)/g, '$1 $2')
        .replace(/([a-zA-Z]+)([0-9]+)/g, '$1 $2');

    // Remove zeros à esquerda desnecessários em sequências puramente numéricas se houver
    clean = clean.replace(/\b0+([1-9])/g, '$1');

    if (/^rua\b/i.test(clean)) {
        return clean;
    }
    return `Rua ${clean}`;
};

/**
 * Constrói a frase falada de forma conversacional e com pausas naturais (vírgulas)
 */
export const formatTextForSpeech = (
    rawLocation: string,
    quantidade: number,
    truckQtd?: number
): string => {
    const localFala = formatLocationForSpeech(rawLocation);
    const qtd = Number(quantidade) || 0;
    const caminhão = Number(truckQtd) || 0;

    let fraseEstoque = '';
    if (qtd <= 0) {
        fraseEstoque = 'sem estoque no momento';
    } else if (qtd === 1) {
        fraseEstoque = '1 unidade em estoque';
    } else {
        fraseEstoque = `${qtd} unidades em estoque`;
    }

    let fraseCaminhao = '';
    if (caminhão > 0) {
        fraseCaminhao = `, e ${caminhão} chegando no caminhão`;
    }

    // Se não tem localização
    if (localFala === 'Sem localização cadastrada') {
        if (qtd <= 0) {
            return `Sem localização cadastrada e sem estoque no momento${fraseCaminhao}.`;
        }
        return `Sem localização cadastrada, com ${fraseEstoque}${fraseCaminhao}.`;
    }

    return `${localFala}, ${fraseEstoque}${fraseCaminhao}.`;
};
