import React from 'react';
import { parseWheelSpecs } from '../utils/photoUtils';
import { findWheelSpecOverride, getRingColorBySpecs } from '../utils/wheelSpecsStore';

interface LegendOption {
    type: 'ANEL' | 'CUBO';
    pcd: string;
    mm: string;
    ringColor: string;
    aro?: string;
}

interface WheelLegendCardProps {
    description?: string;
    itemCodigo?: string;
    className?: string;
}

/**
 * Extrai o número de furos a partir do PCD (ex: 3X112 -> 3, 4X100 -> 4, 5X114 -> 5, 6X139 -> 6, 8X165 -> 8)
 */
function getNumHoles(pcd: string): number {
    const match = (pcd || '').trim().match(/^(\d+)[XxX\*Ff]/);
    if (match) {
        const val = parseInt(match[1], 10);
        if ([3, 4, 5, 6, 8].includes(val)) return val;
        if (val > 0) return val;
    }
    return 4;
}

/**
 * Ícone SVG de cubo de roda dinâmico:
 * - Desenha exatamente 3, 4, 5, 6 ou 8 furos de parafuso.
 * - Modifica o estilo visual se for ANEL (anel centralizador interno colorido) ou CUBO (cubo direto sem anel).
 */
const WheelHubIcon: React.FC<{
    isAnel?: boolean;
    ringColor: string;
    numHoles?: number;
}> = ({ isAnel = true, ringColor, numHoles = 4 }) => {
    const holes = [];
    const radius = 18.5;
    const holeRadius = numHoles >= 8 ? 2.2 : numHoles >= 6 ? 2.6 : 3.2;

    for (let i = 0; i < numHoles; i++) {
        const angle = (i * (360 / numHoles) - 90) * (Math.PI / 180);
        const cx = 30 + radius * Math.cos(angle);
        const cy = 30 + radius * Math.sin(angle);
        holes.push({ cx, cy });
    }

    return (
        <svg viewBox="0 0 60 60" className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 drop-shadow-md">
            {/* Para CUBO DIRETO (Sem Anel): Fundo cilíndrico colorido de apoio como nos catálogos R10/E55 */}
            {!isAnel && (
                <circle cx="30" cy="30" r="27" fill={ringColor} opacity="0.9" />
            )}

            {/* Corpo principal da flange do cubo */}
            <circle 
                cx="30" 
                cy="30" 
                r={isAnel ? "26" : "24"} 
                fill="#e2e8f0" 
                stroke="#1e293b" 
                strokeWidth="2.5" 
            />
            
            {/* Furos de parafusos */}
            {holes.map((h, i) => (
                <circle 
                    key={i} 
                    cx={h.cx.toFixed(2)} 
                    cy={h.cy.toFixed(2)} 
                    r={holeRadius} 
                    fill="#0f172a" 
                    stroke="#020617" 
                    strokeWidth="0.5" 
                />
            ))}

            {/* Furo central do cubo */}
            <circle cx="30" cy="30" r="13" fill="#ffffff" stroke="#1e293b" strokeWidth="2" />

            {/* Anel Centralizador Interno (Apenas quando for ANEL) */}
            {isAnel && (
                <circle 
                    cx="30" 
                    cy="30" 
                    r="10.5" 
                    fill="none" 
                    stroke={ringColor} 
                    strokeWidth="4.5" 
                />
            )}
        </svg>
    );
};

export const WheelLegendCard: React.FC<WheelLegendCardProps> = ({
    description = '',
    itemCodigo = '',
    className = ''
}) => {
    const specs = parseWheelSpecs(description, itemCodigo);
    const descUpper = (description || '').toUpperCase();
    const model = specs.model.toUpperCase();
    const pcdVal = specs.furacao || '4X100';

    // 1. Tentar obter regra customizada configurada pelo usuário no menu
    const customOverride = findWheelSpecOverride(model, pcdVal, specs.aro);

    let isAnel = descUpper.includes('ANEL') || descUpper.includes(' A ') || specs.cuboTipo === 'anel';
    let typeLabel: 'ANEL' | 'CUBO' = isAnel ? 'ANEL' : 'CUBO';
    let mmVal = '57.1 MM';
    let ringColor = '#f97316'; // Laranja padrão

    if (customOverride) {
        isAnel = customOverride.type === 'ANEL';
        typeLabel = customOverride.type;
        mmVal = `${customOverride.mm} MM`;
        if (customOverride.ringColor) ringColor = customOverride.ringColor;
    } else {
        // Ajustar valor de MM conforme furação/especificação
        if (specs.cuboAnel) {
            mmVal = specs.cuboAnel.replace(/\(.*\)/, '').trim();
            if (!mmVal.toUpperCase().includes('MM')) mmVal += ' MM';
        } else if (pcdVal.includes('4X108')) {
            mmVal = '63.4 MM';
        } else if (pcdVal.includes('5X112')) {
            mmVal = '74.1 MM';
        } else if (pcdVal.includes('5X114')) {
            mmVal = '80.9 MM';
        } else if (pcdVal.includes('5X120')) {
            mmVal = '80.9 MM';
        } else if (pcdVal.includes('5X139')) {
            mmVal = '83.8 MM';
        }

        ringColor = getRingColorBySpecs(mmVal, typeLabel);
    }

    const option: LegendOption = {
        type: typeLabel,
        pcd: pcdVal,
        mm: mmVal.toUpperCase(),
        ringColor,
        aro: specs.aro ? `ARO ${specs.aro}` : undefined
    };

    const headerTitle = isAnel
        ? 'LEGENDA DE ANEL CENTRALIZADOR DA RODA'
        : 'LEGENDA DE CUBO (CB) E FURAÇÃO (PCD)';

    const subTitle = model ? `${specs.linha ? specs.linha + ' ' : ''}${model}` : '';
    const numHoles = getNumHoles(option.pcd);

    return (
        <div className={`bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col items-center ${className}`}>
            {/* Cabeçalho da legenda com Nome do Modelo / Linha */}
            <div className="text-center mb-3 space-y-0.5">
                <h4 className="text-[11px] sm:text-xs font-black tracking-wider text-slate-700 dark:text-slate-200 uppercase">
                    {headerTitle} {subTitle ? `- ${subTitle}` : ''}
                </h4>
            </div>

            {/* Exibe APENAS a especificação única da roda atual */}
            <div className="flex items-center justify-center gap-4 sm:gap-5">
                {/* Ícone SVG Dinâmico da Roda (3, 4, 5, 6, 8 Furos) */}
                <WheelHubIcon 
                    isAnel={isAnel} 
                    ringColor={option.ringColor} 
                    numHoles={numHoles} 
                />

                {/* Dados da Furação Atual, Tipo (ANEL / CUBO) e Medida (MM) */}
                <div className="flex flex-col justify-center">
                    {option.aro && (
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-0.5">
                            {option.aro}
                        </span>
                    )}
                    <span 
                        className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight pb-0.5 border-b-2"
                        style={{ borderColor: option.ringColor }}
                    >
                        {option.pcd}
                    </span>
                    <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 mt-1 uppercase tracking-wide">
                        {option.type} {option.mm}
                    </span>
                </div>
            </div>
        </div>
    );
};
