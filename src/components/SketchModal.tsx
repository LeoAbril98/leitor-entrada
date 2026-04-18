import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Eraser, Save, RotateCcw, Trash2 } from 'lucide-react';
import { cn } from '../utils';

interface SketchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (dataUrl: string) => void;
    onDelete: () => void;
    initialData?: string | null;
    title: string;
}

export const SketchModal: React.FC<SketchModalProps> = ({ isOpen, onClose, onSave, onDelete, initialData, title }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#1e293b'); // Slate 800 (Preto suave)
    const [lineWidth, setLineWidth] = useState(3);
    
    // Configurações do Canvas
    useEffect(() => {
        if (isOpen && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                
                // Se houver dado inicial, carregar
                if (initialData) {
                    const img = new Image();
                    img.onload = () => ctx.drawImage(img, 0, 0);
                    img.src = initialData;
                } else {
                    // Limpar fundo
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                }
            }
        }
    }, [isOpen, initialData]);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true);
        draw(e);
    };

    const stopDrawing = () => {
        if (isDrawing) {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            ctx?.beginPath();
        }
        setIsDrawing(false);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const x = clientX - rect.left;
        const y = clientY - rect.top;

        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx && canvas) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    const handleSave = () => {
        if (canvasRef.current) {
            const dataUrl = canvasRef.current.toDataURL('image/png');
            onSave(dataUrl);
            onClose();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />
                    
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-md bg-amber-50 rounded-2xl shadow-2xl overflow-hidden border-2 border-amber-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header Post-it Style */}
                        <div className="bg-amber-100/50 px-4 py-3 border-b border-amber-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <RotateCcw className="w-4 h-4 text-amber-600" />
                                <span className="text-sm font-black text-amber-900 uppercase tracking-tight">Rabiscar: {title}</span>
                            </div>
                            <button onClick={onClose} className="p-1 hover:bg-amber-200 rounded-full transition-colors text-amber-700">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Infinite Canvas Area */}
                        <div className="p-4 flex flex-col items-center gap-4">
                            <div className="relative bg-white rounded-lg shadow-inner border border-amber-200 cursor-crosshair overflow-hidden">
                                <canvas
                                    ref={canvasRef}
                                    width={350}
                                    height={350}
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDrawing}
                                    className="max-w-full h-auto touch-none"
                                />
                                {/* Grid Marks like Paper */}
                                <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:20px_20px]" />
                            </div>

                            {/* Toolbar */}
                            <div className="w-full flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setColor('#ef4444')} // Vermelho caneta
                                        className={cn("w-8 h-8 rounded-full border-2 transition-all", color === '#ef4444' ? "border-amber-600 scale-110 shadow-md" : "border-transparent bg-red-500")}
                                    />
                                    <button 
                                        onClick={() => setColor('#1e293b')} // Preto/Slate caneta
                                        className={cn("w-8 h-8 rounded-full border-2 transition-all", color === '#1e293b' ? "border-amber-600 scale-110 shadow-md" : "border-transparent bg-slate-800")}
                                    />
                                    <button 
                                        onClick={() => setColor('#2563eb')} // Azul bic
                                        className={cn("w-8 h-8 rounded-full border-2 transition-all", color === '#2563eb' ? "border-amber-600 scale-110 shadow-md" : "border-transparent bg-blue-600")}
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    {initialData && (
                                        <button 
                                            onClick={() => {
                                                if (window.confirm("Deseja apagar este Post-it permanentemente?")) {
                                                    onDelete();
                                                    onClose();
                                                }
                                            }}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                            title="Excluir Post-it"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}
                                    <button 
                                        onClick={clearCanvas}
                                        className="flex items-center gap-1 px-3 py-2 bg-white text-slate-600 border border-slate-200 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all font-bold text-xs"
                                    >
                                        <Eraser className="w-4 h-4" /> LIMPAR
                                    </button>
                                    <button 
                                        onClick={handleSave}
                                        className="flex items-center gap-1 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-black text-xs shadow-lg shadow-emerald-200"
                                    >
                                        <Save className="w-4 h-4" /> SALVAR
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Footer styling */}
                        <div className="h-2 bg-amber-100/30" />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
