import React, { useEffect, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface CameraScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (code: string) => void;
}

export function CameraScannerModal({ isOpen, onClose, onScan }: CameraScannerModalProps) {
    const [hasCameras, setHasCameras] = useState(true);

    useEffect(() => {
        let html5QrcodeScanner: Html5Qrcode | null = null;

        if (isOpen) {
            Html5Qrcode.getCameras().then(devices => {
                if (devices && devices.length) {
                    setHasCameras(true);
                    html5QrcodeScanner = new Html5Qrcode("reader");
                    html5QrcodeScanner.start(
                        { facingMode: "environment" },
                        {
                            fps: 10,
                            qrbox: { width: 250, height: 250 },
                            aspectRatio: 1.0,
                        },
                        (decodedText) => {
                            // On Success
                            if (html5QrcodeScanner) {
                                html5QrcodeScanner.stop().then(() => {
                                    onScan(decodedText);
                                    onClose();
                                }).catch(err => console.error(err));
                            }
                        },
                        () => {
                            // On Error (ignore frame errors)
                        }
                    ).catch(err => {
                        console.error('Camera start error:', err);
                        toast.error('Erro ao acessar a câmera. Verifique as permissões.');
                        onClose();
                    });
                } else {
                    setHasCameras(false);
                    toast.error('Nenhuma câmera encontrada no dispositivo.');
                    onClose();
                }
            }).catch(err => {
                console.error('getCameras error:', err);
                setHasCameras(false);
                toast.error('Erro ao acessar as câmeras. Verifique as permissões.');
                onClose();
            });
        }

        return () => {
            if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
                html5QrcodeScanner.stop().catch(err => console.error('Error stopping scanner during cleanup:', err));
            }
        };
    }, [isOpen, onClose, onScan]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative w-full max-w-md bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col items-center"
                >
                    <div className="w-full p-4 flex justify-between items-center bg-slate-800 text-white shrink-0 z-10">
                        <div className="flex items-center gap-2 font-bold text-lg">
                            <Camera className="w-5 h-5 text-indigo-400" />
                            Escanear Código
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="w-full relative aspect-square bg-black flex items-center justify-center overflow-hidden">
                        {!hasCameras ? (
                            <div className="text-slate-400 text-center p-6">
                                <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>Câmera não disponível</p>
                            </div>
                        ) : (
                            <div id="reader" className="w-full h-full object-cover"></div>
                        )}

                        {/* Overlay visual: a crosshair / scan box */}
                        {hasCameras && (
                            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10">
                                <div className="w-[250px] h-[250px] border-2 border-indigo-500/50 rounded-lg relative">
                                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-indigo-400 -mt-1 -ml-1 rounded-tl-sm" />
                                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-indigo-400 -mt-1 -mr-1 rounded-tr-sm" />
                                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-indigo-400 -mb-1 -ml-1 rounded-bl-sm" />
                                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-indigo-400 -mb-1 -mr-1 rounded-br-sm" />

                                    {/* Scan line animation */}
                                    <motion.div
                                        animate={{ y: [0, 246, 0] }}
                                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                        className="w-full h-0.5 bg-indigo-400 shadow-[0_0_8px_2px_rgba(99,102,241,0.5)] absolute top-0"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
