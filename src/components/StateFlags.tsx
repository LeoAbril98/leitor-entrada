import React from 'react';
import { cn } from '../utils';

// Bandeira oficial vetorial do Estado do Paraná (PR)
export const FlagPR: React.FC<{ className?: string }> = ({ className = "w-5 h-3.5" }) => (
    <svg className={cn("rounded-[3px] shadow-xs overflow-hidden shrink-0 select-none", className)} viewBox="0 0 20 14" fill="none">
        {/* Fundo verde */}
        <rect width="20" height="14" fill="#008037" />
        {/* Faixa diagonal branca */}
        <polygon points="0,0 4.5,0 20,9.8 20,14 15.5,14 0,4.2" fill="#FFFFFF" />
        {/* Esfera central azul */}
        <circle cx="10" cy="7" r="3.1" fill="#002776" />
        {/* Estrelas do Cruzeiro do Sul */}
        <circle cx="10" cy="5.3" r="0.4" fill="#FFFFFF" />
        <circle cx="10" cy="8.7" r="0.4" fill="#FFFFFF" />
        <circle cx="8.6" cy="7" r="0.4" fill="#FFFFFF" />
        <circle cx="11.4" cy="7" r="0.4" fill="#FFFFFF" />
        <circle cx="10.7" cy="7.8" r="0.25" fill="#FFFFFF" />
    </svg>
);

// Bandeira oficial vetorial do Estado de Santa Catarina (SC)
export const FlagSC: React.FC<{ className?: string }> = ({ className = "w-5 h-3.5" }) => (
    <svg className={cn("rounded-[3px] shadow-xs overflow-hidden shrink-0 select-none", className)} viewBox="0 0 20 14" fill="none">
        {/* Faixas horizontais vermelhas */}
        <rect width="20" height="14" fill="#E52222" />
        {/* Faixa central branca */}
        <rect y="4.66" width="20" height="4.68" fill="#FFFFFF" />
        {/* Losango verde central */}
        <polygon points="10,2 16.2,7 10,12 3.8,7" fill="#009B3A" />
        {/* Estrela / Armas interna simples */}
        <circle cx="10" cy="7" r="1.5" fill="#E52222" />
        <circle cx="10" cy="7" r="0.9" fill="#FFFFFF" />
    </svg>
);

// Bandeira do Brasil (para opção Todos)
export const FlagBR: React.FC<{ className?: string }> = ({ className = "w-5 h-3.5" }) => (
    <svg className={cn("rounded-[3px] shadow-xs overflow-hidden shrink-0 select-none", className)} viewBox="0 0 20 14" fill="none">
        <rect width="20" height="14" fill="#009B3A" />
        <polygon points="10,1.8 18.2,7 10,12.2 1.8,7" fill="#FEDF00" />
        <circle cx="10" cy="7" r="3" fill="#002776" />
        <path d="M7.2 6.8 Q10 8.3 12.8 6.8" stroke="#FFFFFF" strokeWidth="0.65" fill="none" />
    </svg>
);
