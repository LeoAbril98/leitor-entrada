import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, Zap, ZapOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface CameraScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (code: string) => void;
}

interface CameraDevice {
    id: string;
    label: string;
}

// Selects the highest quality 1x Wide camera, avoiding blurry ultra-wide (0.5x) and telephoto lenses.
const getBestBackCamera = (devices: CameraDevice[]): string | null => {
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
    return mainBackCamera ? mainBackCamera.id : backCameras[0].id;
};

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
    isOpen,
    onClose,
    onScan
}) => {
    const [cameras, setCameras] = useState<CameraDevice[]>([]);
    const [activeCameraId, setActiveCameraId] = useState<string>('');
    const [runningResolution, setRunningResolution] = useState<string>('');
    const [currentFacingMode, setCurrentFacingMode] = useState<'environment' | 'user'>('environment');
    
    const [isScanning, setIsScanning] = useState(false);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [isScannedSuccess, setIsScannedSuccess] = useState(false);
    
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [torchSupported, setTorchSupported] = useState(false);
    
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const hasScannedRef = useRef(false);
    const startingRef = useRef(false);
    const containerId = 'camera-scanner-element';

    useEffect(() => {
        if (!isOpen) return;

        hasScannedRef.current = false;
        startingRef.current = false;

        // Initialize scanner instance with format filters in the constructor configuration
        const html5Qrcode = new Html5Qrcode(containerId, {
            formatsToSupport: [
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.EAN_13
            ],
            verbose: false
        });
        scannerRef.current = html5Qrcode;

        const startScanning = async () => {
            if (startingRef.current) return;
            startingRef.current = true;

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
                try {
                    await startScannerOnDevice(html5Qrcode, { facingMode: "environment" });
                } catch {
                    setHasPermission(false);
                }
            }
        };

        startScanning();

        return () => {
            hasScannedRef.current = true;
            startingRef.current = false;
            
            if (scannerRef.current) {
                const scanner = scannerRef.current;
                if (scanner.isScanning) {
                    scanner.stop().catch(err => console.error('Erro ao parar scanner no unmount', err));
                }
            }
            scannerRef.current = null;
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
            setRunningResolution('');
            setIsScannedSuccess(false);

            // Request HD video resolution constraints using a flexible range.
            const videoConstraints: MediaTrackConstraints = {
                width: { min: 640, ideal: 1280, max: 1920 },
                height: { min: 480, ideal: 720, max: 1080 },
                facingMode: typeof cameraSelector === 'string' ? undefined : cameraSelector.facingMode
            };

            if (typeof cameraSelector === 'string') {
                videoConstraints.deviceId = { exact: cameraSelector };
            }

            await scanner.start(
                cameraSelector,
                {
                    fps: 12, // 12 FPS: balanced decoding frequency without CPU throttling
                    videoConstraints,
                    // By leaving out "qrbox", html5-qrcode scans the ENTIRE video feed,
                    // so the barcode can be read anywhere on the screen!
                    experimentalFeatures: {
                        useBarCodeDetectorIfSupported: true
                    }
                },
                (decodedText) => {
                    if (hasScannedRef.current) return;
                    if (decodedText) {
                        hasScannedRef.current = true;
                        
                        // Trigger visual success feedback
                        setIsScannedSuccess(true);
                        
                        // Vibrate if supported (satisfying physical feedback)
                        if (typeof navigator !== 'undefined' && navigator.vibrate) {
                            try {
                                navigator.vibrate(100);
                            } catch (e) {}
                        }

                        // Stop scanner immediately
                        const currentScanner = scannerRef.current;
                        if (currentScanner && currentScanner.isScanning) {
                            currentScanner.stop().catch(() => {});
                        }
                        setIsScanning(false);
                        
                        // Delay closure for 300ms to display visual success animation
                        setTimeout(() => {
                            onScan(decodedText);
                            onClose();
                        }, 300);
                    }
                },
                () => {
                    // Suppress verbose frame scanning errors
                }
            );

            setHasPermission(true);

            // Read settings from the active video track to know which camera and resolution are running
            try {
                const settings = (scanner as any).getRunningTrackSettings?.();
                if (settings) {
                    if (settings.deviceId) {
                        setActiveCameraId(settings.deviceId);
                    }
                    if (settings.width && settings.height) {
                        setRunningResolution(`${settings.width}x${settings.height}`);
                    }
                }
            } catch (e) {
                console.warn("Não foi possível ler as configurações da câmera ativa:", e);
            }

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
        hasScannedRef.current = false;

        const validCameras = cameras.filter(c => c.id);
        
        if (validCameras.length > 1) {
            // Cycle through available camera ids
            let nextIndex = 0;
            if (activeCameraId) {
                const currentIndex = validCameras.findIndex(c => c.id === activeCameraId);
                nextIndex = currentIndex >= 0 ? (currentIndex + 1) % validCameras.length : 0;
            } else {
                nextIndex = 1;
            }
            const nextDevice = validCameras[nextIndex];
            setActiveCameraId(nextDevice.id);
            
            toast.success(`Alternando para: ${nextDevice.label || 'Câmera ' + (nextIndex + 1)}`, {
                id: 'camera-switch-toast',
                duration: 1500
            });
            
            await startScannerOnDevice(scannerRef.current, nextDevice.id);
        } else {
            // Fallback: toggle facingMode constraint
            const nextFacing = currentFacingMode === 'environment' ? 'user' : 'environment';
            setCurrentFacingMode(nextFacing);
            setActiveCameraId('');
            
            toast.success(`Alternando câmera para modo: ${nextFacing === 'environment' ? 'Traseira' : 'Frontal'}`, {
                id: 'camera-switch-toast',
                duration: 1500
            });

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

    const handleClose = async () => {
        hasScannedRef.current = true;
        if (scannerRef.current && scannerRef.current.isScanning) {
            try {
                await scannerRef.current.stop();
            } catch {
                // Ignore stop failure
            }
        }
        setIsScanning(false);
        onClose();
    };

    if (!isOpen) return null;

    // Show switch camera button if we have multiple cameras or if we are toggling facingMode fallback
    const showSwitchButton = cameras.length > 1 || (!activeCameraId && hasPermission);

    // Active camera human-readable label
    const activeCameraLabel = cameras.find(c => c.id === activeCameraId)?.label 
        || (currentFacingMode === 'environment' ? 'Câmera Traseira Principal' : 'Câmera Frontal');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
            <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                
                {/* Header */}
                <div className="px-6 py-4 flex flex-col border-b border-slate-800 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Camera className="w-5 h-5 text-emerald-500 animate-pulse" />
                            <span className="font-bold text-white">Ler Código com Câmera</span>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    {hasPermission && (
                        <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400">
                            <span className="truncate">Câmera: <span className="text-emerald-400 font-semibold">{activeCameraLabel}</span></span>
                            {runningResolution && (
                                <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-mono ml-2 shrink-0">{runningResolution}</span>
                            )}
                        </div>
                    )}
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
                                onClick={handleClose}
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
                    {isScanning && !isScannedSuccess && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            {/* Aiming Guide Box (guide only - scanner runs full screen) */}
                            <div className="relative w-[85%] h-[50%] max-w-[420px] max-h-[220px] border border-white/20 rounded-3xl bg-transparent flex flex-col justify-between overflow-hidden">
                                
                                {/* Corner styling */}
                                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-500 rounded-tl" />
                                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-500 rounded-tr" />
                                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-500 rounded-bl" />
                                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-500 rounded-br" />

                                {/* Moving Laser Line */}
                                <div className="absolute left-0 w-full h-0.5 bg-emerald-500/80 shadow-[0_0_8px_#10b981] animate-laser" />
                            </div>
                        </div>
                    )}

                    {/* Success Highlight Overlay */}
                    {isScannedSuccess && (
                        <div className="absolute inset-0 border-[6px] border-emerald-500 bg-emerald-500/15 z-10 transition-all duration-200 animate-pulse pointer-events-none flex items-center justify-center">
                            <div className="bg-emerald-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-lg flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                                Código Lido!
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