import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Pause, Trash2, Volume2, Clock } from 'lucide-react';

interface AudioPlayerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDelete: () => void;
    audioUrl: string | null;
    title: string;
}

export const AudioPlayerModal: React.FC<AudioPlayerModalProps> = ({ isOpen, onClose, onDelete, audioUrl, title }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (!isOpen) {
            setIsPlaying(false);
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        }
    }, [isOpen]);

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const formatTime = (time: number) => {
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
                    />
                    
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Audio Source */}
                        <audio 
                            ref={audioRef}
                            src={audioUrl || ''}
                            onTimeUpdate={handleTimeUpdate}
                            onLoadedMetadata={handleLoadedMetadata}
                            onEnded={handleEnded}
                        />

                        <div className="bg-rose-500 px-6 py-4 flex items-center justify-between text-white">
                            <div className="flex items-center gap-2">
                                <Volume2 className="w-5 h-5" />
                                <span className="font-bold tracking-tight">Ouvir Nota de Voz</span>
                            </div>
                            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-8 flex flex-col items-center gap-6">
                            <div className="text-center">
                                <p className="text-slate-400 text-sm mb-1 uppercase tracking-widest font-bold">Modelo</p>
                                <h3 className="text-slate-900 dark:text-white font-black text-lg leading-tight">{title}</h3>
                            </div>

                            {/* Player Core Visual */}
                            <div className="w-full flex flex-col gap-4">
                                <div className="w-full bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl flex flex-col items-center gap-4 border border-slate-100 dark:border-slate-700 shadow-inner">
                                    <div className="flex items-center justify-between w-full mb-2">
                                        <span className="text-[10px] font-bold text-slate-400 font-mono">{formatTime(currentTime)}</span>
                                        <span className="text-[10px] font-bold text-slate-400 font-mono">{formatTime(duration)}</span>
                                    </div>
                                    
                                    {/* Progress Bar (Simple) */}
                                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <motion.div 
                                            className="h-full bg-rose-500"
                                            animate={{ width: `${(currentTime / duration) * 100}%` }}
                                            transition={{ ease: "linear", duration: 0.1 }}
                                        />
                                    </div>

                                    {/* Big Play/Pause */}
                                    <button 
                                        onClick={togglePlay}
                                        className="w-16 h-16 rounded-full bg-rose-500 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-rose-200 dark:shadow-none"
                                    >
                                        {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current ml-1" />}
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        onClick={() => {
                                            if (window.confirm("Deseja apagar este áudio permanentemente?")) {
                                                onDelete();
                                                onClose();
                                            }
                                        }}
                                        className="py-3 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm hover:bg-red-50 hover:text-red-600 transition-all shadow-sm"
                                    >
                                        <Trash2 className="w-4 h-4" /> EXCLUIR
                                    </button>
                                    <button 
                                        onClick={onClose}
                                        className="py-3 bg-slate-900 text-white rounded-2xl flex items-center justify-center gap-2 font-bold text-sm hover:bg-slate-800 transition-all"
                                    >
                                        FECHAR
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Bottom Decoration */}
                        <div className="h-2 bg-rose-500/10" />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
