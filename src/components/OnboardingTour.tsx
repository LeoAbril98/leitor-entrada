import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    ChevronRight, 
    ChevronLeft, 
    X, 
    MousePointer2,
    CheckCircle2
} from 'lucide-react';
import { cn } from '../utils';

interface Step {
    targetId: string;
    title: string;
    content: string;
    position: 'top' | 'bottom' | 'left' | 'right';
}

interface OnboardingTourProps {
    isOpen: boolean;
    onClose: () => void;
}

const steps: Step[] = [
    {
        targetId: 'tour-cloud',
        title: "Sincronização Cloud",
        content: "Este indicador confirma que você está conectado ao banco de dados Supabase. Tudo o que você fizer aqui é salvo instantaneamente na nuvem.",
        position: 'bottom'
    },
    {
        targetId: 'tour-search',
        title: "Pesquisa Inteligente",
        content: "Busque por modelo, aro ou furação. Você pode digitar vários termos separados por espaço (ex: 'R50 BLACK 15').",
        position: 'bottom'
    },
    {
        targetId: 'tour-filters',
        title: "Filtros em Cascata",
        content: "Use filtros hierárquicos para encontrar exatamente o que precisa em poucos cliques.",
        position: 'bottom'
    },
    {
        targetId: 'tour-media',
        title: "Anotações e Mídia",
        content: "Clique no ícone de '+' para gravar áudios, desenhar post-its ou adicionar etiquetas (Tags) em cada roda.",
        position: 'right'
    },
    {
        targetId: 'tour-summary',
        title: "Resumo da Operação",
        content: "Acompanhe o total de rodas filtradas e o progresso da sua planilha de importação.",
        position: 'bottom'
    }
];

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ isOpen, onClose }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const tourRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            updateTarget();
            window.addEventListener('resize', updateTarget);
            window.addEventListener('scroll', updateTarget, true);
        }
        return () => {
            window.removeEventListener('resize', updateTarget);
            window.removeEventListener('scroll', updateTarget, true);
        };
    }, [isOpen, currentStep]);

    const updateTarget = () => {
        const step = steps[currentStep];
        const element = document.getElementById(step.targetId);
        if (element) {
            setTargetRect(element.getBoundingClientRect());
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            // Se o elemento não for encontrado (ex: não carregado), pula para o próximo ou fecha
            setTargetRect(null);
        }
    };

    if (!isOpen || !targetRect) return null;

    const step = steps[currentStep];

    return (
        <div className="fixed inset-0 z-[200] pointer-events-none overflow-hidden">
            {/* Spotlight Overlay */}
            <div 
                className="absolute inset-0 bg-slate-900/70"
                style={{
                    clipPath: `polygon(
                        0% 0%, 
                        0% 100%, 
                        ${targetRect.left}px 100%, 
                        ${targetRect.left}px ${targetRect.top}px, 
                        ${targetRect.right}px ${targetRect.top}px, 
                        ${targetRect.right}px ${targetRect.bottom}px, 
                        ${targetRect.left}px ${targetRect.bottom}px, 
                        ${targetRect.left}px 100%, 
                        100% 100%, 
                        100% 0%
                    )`
                }}
            />

            {/* Pulsing Target Highlight (Visual only) */}
            <motion.div 
                initial={false}
                animate={{
                    left: targetRect.left - 4,
                    top: targetRect.top - 4,
                    width: targetRect.width + 8,
                    height: targetRect.height + 8,
                }}
                className="absolute border-2 border-amber-400 rounded-lg shadow-[0_0_15px_rgba(251,191,36,0.6)] z-10"
            />

            {/* Tooltip */}
            <div 
                className="absolute pointer-events-auto z-20 transition-all duration-300"
                style={{
                    left: step.position === 'right' ? targetRect.right + 20 : targetRect.left - 50,
                    top: step.position === 'bottom' ? targetRect.bottom + 20 : targetRect.top,
                    maxWidth: '300px'
                }}
            >
                <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl border border-amber-200 dark:border-amber-900/50"
                >
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-black">
                            {currentStep + 1}
                        </div>
                        <h4 className="font-black text-slate-800 dark:text-slate-100 text-sm italic uppercase tracking-wider">
                            {step.title}
                        </h4>
                    </div>
                    
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-6 font-medium">
                        {step.content}
                    </p>

                    <div className="flex items-center justify-between gap-4">
                        <div className="flex gap-1">
                            {steps.map((_, i) => (
                                <div 
                                    key={i} 
                                    className={cn(
                                        "w-1.5 h-1.5 rounded-full transition-all",
                                        i === currentStep ? "bg-amber-500 w-4" : "bg-slate-200 dark:bg-slate-700"
                                    )}
                                />
                            ))}
                        </div>

                        <div className="flex gap-2">
                            {currentStep > 0 && (
                                <button
                                    onClick={() => setCurrentStep(prev => prev - 1)}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                            )}
                            
                            {currentStep < steps.length - 1 ? (
                                <button
                                    onClick={() => setCurrentStep(prev => prev + 1)}
                                    className="px-4 py-2 bg-slate-900 dark:bg-amber-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-transform"
                                >
                                    Próximo
                                    <ChevronRight className="w-3 h-3" />
                                </button>
                            ) : (
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-transform"
                                >
                                    Entendi!
                                    <CheckCircle2 className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Skip Button */}
            <button 
                onClick={onClose}
                className="absolute top-8 right-8 pointer-events-auto p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors flex items-center gap-2 text-xs font-bold"
            >
                <X className="w-4 h-4" /> Pular Tour
            </button>
        </div>
    );
};
