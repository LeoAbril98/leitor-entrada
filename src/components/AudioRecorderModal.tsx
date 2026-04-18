import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mic, Square, Play, Trash2, Save, RotateCcw, Volume2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface AudioRecorderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (blob: Blob) => void;
    title: string;
}

export const AudioRecorderModal: React.FC<AudioRecorderModalProps> = ({ isOpen, onClose, onSave, title }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [duration, setDuration] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        if (!isOpen) {
            stopRecording();
            setAudioBlob(null);
            setAudioUrl(null);
            setDuration(0);
        }
    }, [isOpen]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                setAudioUrl(URL.createObjectURL(blob));
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setDuration(0);
            timerRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Erro ao acessar microfone:", err);
            toast.error("Permissão de microfone negada ou não disponível.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleSave = () => {
        if (audioBlob) {
            onSave(audioBlob);
            onClose();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
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
                        <div className="bg-rose-500 px-6 py-4 flex items-center justify-between text-white">
                            <div className="flex items-center gap-2">
                                <Volume2 className="w-5 h-5" />
                                <span className="font-bold tracking-tight">Nota de Áudio</span>
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

                            {/* Center Visualizer/Timer */}
                            <div className="w-32 h-32 rounded-full bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center border-4 border-slate-100 dark:border-slate-700 relative overflow-hidden">
                                {isRecording && (
                                    <motion.div 
                                        animate={{ scale: [1, 1.2, 1] }} 
                                        transition={{ repeat: Infinity, duration: 1 }}
                                        className="absolute inset-0 bg-rose-500/10"
                                    />
                                )}
                                <span className={isRecording ? "text-rose-500 font-mono text-2xl font-bold z-10" : "text-slate-400 font-mono text-2xl font-bold"}>
                                    {formatDuration(duration)}
                                </span>
                            </div>

                            {/* Controls */}
                            <div className="w-full flex flex-col gap-4">
                                {!audioBlob ? (
                                    <button
                                        onClick={isRecording ? stopRecording : startRecording}
                                        className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 transition-all ${
                                            isRecording 
                                            ? "bg-slate-900 text-white hover:bg-slate-800" 
                                            : "bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-200 dark:shadow-rose-900/20"
                                        }`}
                                    >
                                        {isRecording ? (
                                            <><Square className="w-6 h-6 fill-current" /> PARAR GRAVAÇÃO</>
                                        ) : (
                                            <><Mic className="w-6 h-6" /> INICIAR GRAVAÇÃO</>
                                        )}
                                    </button>
                                ) : (
                                    <div className="space-y-4 w-full">
                                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700">
                                            <audio src={audioUrl!} controls className="w-full h-8" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button 
                                                onClick={() => { setAudioBlob(null); setAudioUrl(null); setDuration(0); }}
                                                className="py-3 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm hover:bg-slate-50"
                                            >
                                                <RotateCcw className="w-4 h-4" /> REFAZER
                                            </button>
                                            <button 
                                                onClick={handleSave}
                                                className="py-3 bg-rose-500 text-white rounded-2xl flex items-center justify-center gap-2 font-bold text-sm hover:bg-rose-600 shadow-lg shadow-rose-200 dark:shadow-none"
                                            >
                                                <Save className="w-4 h-4" /> SALVAR
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
