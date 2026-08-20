import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, Zap, ZapOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface CameraScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (code: string) => void;
}

// Selects the highest quality 1x Wide camera, avoiding blurry ultra-wide (0.5x) and telephoto lenses.
const getBestBackCamera = (devices: MediaDeviceInfo[]): string | null => {
    if (!devices || devices.length === 0) return null;

    // Filter for back cameras
    const backCameras = devices.filter(device => {
        const label = device.label.toLowerCase();
        return label.includes('back') || 
               label.includes('traseira') || 
               label.includes('rear') || 
               label.includes('environment');
    });

    if (backCameras.length === 0) return null;

    // Prioritize the main Wide camera. Avoid ultra-wide (0.5x) or telephoto (3x/5x) lenses
    const mainBackCamera = backCameras.find(device => {
        const label = device.label.toLowerCase();
        return !label.includes('ultra') && 
               !label.includes('tele') && 
               !label.includes('0.5x') && 
               !label.includes('zoom');
    });

    // Fall back to first back camera if specific main camera is not identified
    return mainBackCamera ? mainBackCamera.deviceId : backCameras[0].deviceId;
};

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
    isOpen,
    onClose,
    onScan
}) => {
    const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
    const [activeCameraId, setActiveCameraId] = useState<string>('');
    const [currentFacingMode, setCurrentFacingMode] = useState<'environment' | 'user'>('environment');
    const [isScanning, setIsScanning] = useState(false);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [torchSupported, setTorchSupported] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const containerId = 'camera-scanner-element';

    useEffect(() => {
        if (!isOpen) return;

        // Initialize scanner instance
        const html5Qrcode = new Html5Qrcode(containerId);
        scannerRef.current = html5Qrcode;

        const startScanning = async () => {
            try {
                // Request camera permission and list devices immediately (preserving user gesture context)
                const devices = await Html5Qrcode.getCameras();
                setHasPermission(true);
                setCameras(devices);

                if (devices && devices.length > 0) {
                    const bestCameraId = getBestBackCamera(devices);
                    if (bestCameraId) {
                        setActiveCameraId(bestCameraId);
                        await startScannerOnDevice(html5Qrcode, bestCameraId);
                        return;
                    }
                }
                
                // Fallback if no specific camera was listed
                await startScannerOnDevice(html5Qrcode, { facingMode: "environment" });
            } catch (err) {
                console.warn('Erro ao solicitar/listar cameras, tentando facingMode como fallback:', err);
                // Fallback generic facingMode
                await startScannerOnDevice(html5Qrcode, { facingMode: "environment" });
            }
        };

        // Start scanning immediately without setTimeout to preserve Safari user-interaction context
        startScanning();

        return () => {
            if (scannerRef.current) {
                const scanner = scannerRef.current;
                if (scanner.isScanning) {
                    scanner.stop().catch(err => console.error('Erro ao parar scanner no unmount', err));
                }
            }
        };
    }, [isOpen]);

    const startScannerOnDevice = async (
        scanner: Html5Qrcode, 
        cameraSelector: string | { facingMode: "environment" | "user" }
    ) => {
        try {
            if (scanner.isScanning) {
                await scanner.stop();
            }
            setIsScanning(true);
            setIsTorchOn(false);
            setTorchSupported(false);

            await scanner.start(
                cameraSelector,
                {
                    fps: 15,
                    qrbox: (width, height) => {
                        // Taller and wider area to allow barcode reading at angles, tilt or distance
                        const boxWidth = Math.min(width * 0.9, 380);
                        const boxHeight = Math.min(height * 0.6, 200);
                        return { width: boxWidth, height: boxHeight };
                    },
                    formatsToSupport: [
                        Html5QrcodeSupportedFormats.CODE_128,
                        Html5QrcodeSupportedFormats.CODE_39,
                        Html5QrcodeSupportedFormats.EAN_13,
                        Html5QrcodeSupportedFormats.EAN_8,
                        Html5QrcodeSupportedFormats.UPC_A,
                        Html5QrcodeSupportedFormats.UPC_E,
                        Html5QrcodeSupportedFormats.QR_CODE
                    ]
                },
                (decodedText) => {
                    if (decodedText) {
                        onScan(decodedText);
                        onClose();
                    }
                },
                () => {
                    // Suppress verbose frame scanning errors
                }
            );

            setHasPermission(true);

            // Check if torch/flashlight is supported on the active video track
            try {
                const capabilities = (scanner as any).getRunningTrackCapabilities?.();
                if (capabilities && capabilities.torch) {
                    setTorchSupported(true);
                }
            } catch (e) {
                console.warn("Não foi possível verificar suporte a lanterna:", e);
            }
        } catch (err) {
            console.error('Erro ao iniciar scanner no dispositivo', err);
            
            // Fallback chain
            if (typeof cameraSelector === 'string') {
                console.log('Tentando fallback para facingMode environment...');
                setActiveCameraId('');
                await startScannerOnDevice(scanner, { facingMode: 'environment' });
            } else if (typeof cameraSelector !== 'string' && cameraSelector.facingMode === 'environment') {
                console.log('Camera traseira indisponível. Tentando camera frontal como fallback...');
                setCurrentFacingMode('user');
                setActiveCameraId('');
                await startScannerOnDevice(scanner, { facingMode: 'user' });
            } else {
                setIsScanning(false);
                setHasPermission(false);
                toast.error('Erro ao iniciar a câmera. Verifique as permissões.');
            }
        }
    };

    const handleSwitchCamera = async () => {
        if (!scannerRef.current) return;

        const validCameras = cameras.filter(c => c.deviceId);
        
        if (validCameras.length > 1) {
            // Cycle through available camera deviceIds
            let nextIndex = 0;
            if (activeCameraId) {
                const currentIndex = validCameras.findIndex(c => c.deviceId === activeCameraId);
                nextIndex = (currentIndex + 1) % validCameras.length;
            } else {
                nextIndex = 1;
            }
            const nextDevice = validCameras[nextIndex];
            setActiveCameraId(nextDevice.deviceId);
            await startScannerOnDevice(scannerRef.current, nextDevice.deviceId);
        } else {
            // Fallback: toggle facingMode constraint
            const nextFacing = currentFacingMode === 'environment' ? 'user' : 'environment';
            setCurrentFacingMode(nextFacing);
            setActiveCameraId('');
            await startScannerOnDevice(scannerRef.current, { facingMode: nextFacing });
        }
    };

    const handleToggleTorch = async () => {
        if (!scannerRef.current || !torchSupported) return;
        
        try {
            const nextTorchState = !isTorchOn;
            await scannerRef.current.applyVideoConstraints({
                advanced: [{ torch: nextTorchState } as any]
            });
            setIsTorchOn(nextTorchState);
        } catch (err) {
            console.error('Erro ao alternar lanterna', err);
            toast.error('Não foi possível acionar a lanterna.');
        }
    };

    if (!isOpen) return null;

    // Show switch camera button if we have multiple cameras or if we are toggling facingMode fallback
    const showSwitchButton = cameras.length > 1 || (!activeCameraId && hasPermission);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
            <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                
                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-2">
                        <Camera className="w-5 h-5 text-emerald-500 animate-pulse" />
                        <span className="font-bold text-white">Ler Código com Câmera</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body/Scanner Area */}
                <div className="relative w-full aspect-[4/3] min-h-[320px] bg-black overflow-hidden shrink-0">
                    
                    {/* Mounting element for html5-qrcode */}
                    <div 
                        id={containerId} 
                        className="absolute inset-0 w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover [&_video]:block" 
                    />

                    {/* Camera Permission State */}
                    {hasPermission === false && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900 text-slate-200">
                            <AlertTriangle className="w-12 h-12 text-amber-500 mb-3" />
                            <p className="font-bold text-lg mb-2">Acesso à Câmera Negado</p>
                            <p className="text-sm text-slate-400 max-w-xs mb-4">
                                Por favor, autorize o acesso à câmera nas configurações do seu navegador para escanear os códigos.
                            </p>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition-colors"
                            >
                                Fechar
                            </button>
                        </div>
                    )}

                    {hasPermission === null && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-slate-200">
                            <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
                            <p className="text-sm text-slate-400 font-medium">Solicitando acesso à câmera...</p>
                        </div>
                    )}

                    {/* Scanning overlay with laser line */}
                    {isScanning && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            {/* Scanning Area indicator */}
                            <div className="relative w-[90%] h-[60%] max-w-[380px] max-h-[200px] border-2 border-emerald-500 rounded-3xl bg-transparent flex flex-col justify-between overflow-hidden shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
                                
                                {/* Corner styling */}
                                <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl" />
                                <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr" />
                                <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl" />
                                <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br" />

                                {/* Moving Laser Line */}
                                <div className="absolute left-0 w-full h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-laser" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="px-6 py-4 bg-slate-950 border-t border-slate-800/60 flex items-center justify-center gap-4 shrink-0">
                    {/* Torch control */}
                    {torchSupported && (
                        <button
                            onClick={handleToggleTorch}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] ${
                                isTorchOn
                                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                            }`}
                        >
                            {isTorchOn ? (
                                <>
                                    <ZapOff className="w-4 h-4" />
                                    <span>Apagar Lanterna</span>
                                </>
                            ) : (
                                <>
                                    <Zap className="w-4 h-4 text-amber-400" />
                                    <span>Acender Lanterna</span>
                                </>
                            )}
                        </button>
                    )}

                    {/* Switch camera control */}
                    {showSwitchButton && (
                        <button
                            onClick={handleSwitchCamera}
                            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]"
                        >
                            <RefreshCw className="w-4 h-4 text-emerald-400" />
                            <span>Inverter Câmera</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
