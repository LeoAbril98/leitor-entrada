import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    ArrowLeft, 
    Search, 
    X, 
    Camera, 
    Check, 
    Sliders, 
    Image as ImageIcon,
    Settings2,
    Sparkles,
    Upload,
    Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';

import { 
    getInventory, 
    getPhotoOverrides, 
    savePhotoOverride,
    uploadPhotoToStorage
} from '../lib/supabase';
import { 
    getWheelPhotoUrl, 
    setPhotoOverrides, 
    getModelAndFinish,
    photoMap
} from '../utils/photoUtils';
import { StockItem } from '../types';

// Função utilitária para compressão de imagens via Canvas no lado do cliente
const compressImage = (file: File, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Dimensionamento mantendo o aspect ratio original
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Canvas 2D context not available'));
                    return;
                }

                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                // Converter para JPEG compacto para economizar banda/espaço
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Canvas blob conversion failed'));
                        }
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

interface AdminSettingsPanelProps {
    onBack: () => void;
}

export const AdminSettingsPanel: React.FC<AdminSettingsPanelProps> = ({ onBack }) => {
    const [stock, setStock] = useState<StockItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    
    // Modal de Foto
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
    const [targetWheel, setTargetWheel] = useState<{ model: string, finish: string, description: string, codigo: string } | null>(null);
    const [availablePhotos, setAvailablePhotos] = useState<string[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const inventory = await getInventory();
            const overrides = await getPhotoOverrides();
            setPhotoOverrides(overrides);
            setStock(inventory);
        } catch (error) {
            toast.error("Erro ao carregar dados de configurações");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenPhotoSelection = (item: StockItem) => {
        const { modelCode, finishAbbr } = getModelAndFinish(item.descricao);
        const modelsPhotos = (photoMap as any)[modelCode] || {};
        const urls = Object.values(modelsPhotos) as string[];
        
        setTargetWheel({ 
            model: modelCode, 
            finish: finishAbbr, 
            description: item.descricao,
            codigo: item.codigo
        });
        setAvailablePhotos(urls);
        setIsPhotoModalOpen(true);
    };

    const handleSavePhotoOverride = async (url: string, scope: 'item' | 'model') => {
        if (!targetWheel) return;
        
        const success = await savePhotoOverride(
            targetWheel.model, 
            targetWheel.finish, 
            url, 
            scope === 'item' ? targetWheel.codigo : undefined
        );

        if (success) {
            toast.success(scope === 'item' ? "Foto salva apenas para este item!" : "Foto salva para todo o grupo!");
            setIsPhotoModalOpen(false);
            
            // Recarregar overrides
            const overrides = await getPhotoOverrides();
            setPhotoOverrides(overrides);
            
            // Forçar re-render dos itens
            setStock([...stock]); 
        } else {
            toast.error("Erro ao salvar override de foto");
        }
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const loadingToast = toast.loading("Preparando e compactando imagem...");

        try {
            // 1. Compactar imagem client-side (máximo 800px, 70% qualidade JPEG)
            const compressedBlob = await compressImage(file, 800, 800, 0.7);
            
            const origSizeKB = Math.round(file.size / 1024);
            const compSizeKB = Math.round(compressedBlob.size / 1024);
            toast.loading(`Enviando para o Storage... (Reduzido de ${origSizeKB}KB para ${compSizeKB}KB)`, { id: loadingToast });

            // 2. Upload para o storage
            const publicUrl = await uploadPhotoToStorage(compressedBlob, file.name);

            if (publicUrl) {
                toast.success(`Foto enviada com sucesso! (Salva com ${compSizeKB}KB)`, { id: loadingToast });
                
                // Adicionar a URL no topo das fotos disponíveis para seleção imediata
                setAvailablePhotos(prev => [publicUrl, ...prev]);
            } else {
                toast.error("Falha no upload da foto", { id: loadingToast });
            }
        } catch (error) {
            console.error("Erro no upload da imagem:", error);
            toast.error("Erro ao processar imagem", { id: loadingToast });
        } finally {
            setIsUploading(false);
            event.target.value = "";
        }
    };

    // Filtragem dos itens de estoque baseada na busca
    const filteredStock = stock.filter(item => 
        item.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.descricao.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 transition-colors duration-300">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={onBack}
                            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-100 dark:hover:border-indigo-900/50 transition-all shadow-sm active:scale-95"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 tracking-tight">
                                <Settings2 className="w-8 h-8 text-indigo-600 dark:text-indigo-500" />
                                Configurações do Sistema
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 font-medium tracking-tight mt-0.5">
                                Gerencie fotos do catálogo, overrides visuais e mídias de expedição.
                            </p>
                        </div>
                    </div>
                </header>

                {/* Grid das Configurações */}
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden mb-12">
                    {/* Abas / Menu Lateral Simulado */}
                    <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/20 px-8 py-5 flex items-center gap-2">
                        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl font-black text-xs uppercase tracking-widest">
                            <ImageIcon className="w-4 h-4" />
                            Ajuste de Fotos
                        </div>
                    </div>

                    {/* Conteúdo: Ajuste de Fotos */}
                    <div className="p-8">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    Ajuste de Fotos por Modelo
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                                    Corrija a associação de imagens dos modelos de rodas no catálogo ou aplique overrides para itens específicos.
                                </p>
                            </div>
                            <div className="relative w-full md:w-96">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input 
                                    type="text"
                                    placeholder="Buscar por código ou modelo..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-700 dark:text-slate-200 text-sm font-medium"
                                />
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="py-24 flex flex-col items-center justify-center gap-4">
                                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                <p className="text-slate-400 text-sm font-bold uppercase tracking-widest animate-pulse">Carregando catálogo...</p>
                            </div>
                        ) : filteredStock.length === 0 ? (
                            <div className="py-24 border-2 border-dashed border-slate-150 dark:border-slate-800 rounded-3xl flex flex-col items-center justify-center text-center p-8">
                                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-400 dark:text-slate-600 mb-4">
                                    <Sliders className="w-8 h-8" />
                                </div>
                                <h3 className="text-lg font-black text-slate-700 dark:text-slate-300">Nenhum resultado encontrado</h3>
                                <p className="text-slate-400 text-sm max-w-sm mt-1">Refine seus termos de busca para encontrar o item desejado no catálogo.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {filteredStock.slice(0, 100).map(item => (
                                    <div 
                                        key={item.codigo}
                                        className="group bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 hover:border-indigo-500/30 dark:hover:border-indigo-500/30 hover:shadow-lg transition-all duration-300 flex flex-col"
                                    >
                                        {/* Imagem do Card */}
                                        <div className="aspect-square rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 relative mb-4 border border-slate-150 dark:border-slate-700">
                                            <img 
                                                src={getWheelPhotoUrl(item.descricao, item.codigo)} 
                                                alt={item.descricao}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                onError={(e) => (e.currentTarget.src = "https://placehold.co/300x300/e2e8f0/64748b?text=SEM+FOTO")}
                                            />
                                            <div className="absolute top-3 left-3 px-3 py-1 bg-slate-900/80 backdrop-blur-sm text-[10px] font-black text-white uppercase tracking-widest rounded-lg">
                                                {item.codigo}
                                            </div>
                                        </div>

                                        {/* Detalhes */}
                                        <div className="flex-1 min-h-[50px] mb-4">
                                            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 line-clamp-2 leading-snug">
                                                {item.descricao}
                                            </h3>
                                        </div>

                                        {/* Botão de Ajuste */}
                                        <button 
                                            onClick={() => handleOpenPhotoSelection(item)}
                                            className="w-full py-3 bg-white dark:bg-slate-800 hover:bg-indigo-600 dark:hover:bg-indigo-600 border border-slate-200 dark:border-slate-700 hover:border-indigo-600 dark:hover:border-indigo-600 text-slate-700 dark:text-slate-200 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 shadow-sm"
                                        >
                                            <Camera className="w-4 h-4 shrink-0" />
                                            Ajustar Foto
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {!isLoading && filteredStock.length > 100 && (
                            <p className="text-center text-xs font-black text-slate-400 uppercase tracking-widest mt-8 flex items-center justify-center gap-2">
                                <Sparkles className="w-3 h-3 text-indigo-500" />
                                Limitando a exibição aos primeiros 100 resultados. Use a busca para filtrar.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de Seleção de Foto */}
            <AnimatePresence>
                {isPhotoModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsPhotoModalOpen(false)}
                            className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
                        />
                        {/* Conteúdo do Modal */}
                        <motion.div 
                            initial={{ scale: 0.95, y: 20, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.95, y: 20, opacity: 0 }}
                            className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            {/* Modal Header */}
                            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Personalizar Foto</h3>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                        Definindo para {targetWheel?.model} - {targetWheel?.finish}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setIsPhotoModalOpen(false)} 
                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                >
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-8 overflow-y-auto custom-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                    {/* Lado Esquerdo: Foto Atual */}
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Foto Atual Resolvida</p>
                                        <div className="aspect-square rounded-3xl overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 border-slate-150 dark:border-slate-800 shadow-inner relative">
                                            <img 
                                                src={targetWheel ? getWheelPhotoUrl(targetWheel.description, targetWheel.codigo) : ""} 
                                                className="w-full h-full object-cover"
                                                alt="Atual"
                                                onError={(e) => (e.currentTarget.src = "https://placehold.co/400x400/e2e8f0/64748b?text=SEM+FOTO")}
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Lado Direito: Instruções */}
                                    <div className="flex flex-col justify-center gap-4">
                                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-[2rem] border border-indigo-100 dark:border-indigo-900/30">
                                            <h4 className="text-sm font-black text-indigo-700 dark:text-indigo-300 uppercase mb-2">Instruções de Ajuste</h4>
                                            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold leading-relaxed">
                                                Escolha uma nova imagem abaixo para este modelo. Ao clicar nela, você poderá decidir se quer aplicar a mudança apenas para o código específico (<span className="underline">{targetWheel?.codigo}</span>) ou para todo o grupo de acabamento {targetWheel?.model} {targetWheel?.finish}.
                                            </p>
                                        </div>
                                        
                                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-150 dark:border-slate-800">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                                    {availablePhotos.length} fotos disponíveis no storage
                                                </p>
                                            </div>
                                        </div>

                                        {/* Upload de Nova Foto */}
                                        <div className="relative">
                                            <input 
                                                type="file" 
                                                accept="image/*"
                                                id="file-upload"
                                                onChange={handleImageUpload}
                                                className="hidden"
                                                disabled={isUploading}
                                            />
                                            <label 
                                                htmlFor="file-upload"
                                                className={`flex flex-col items-center justify-center p-5 border-2 border-dashed rounded-[1.5rem] cursor-pointer transition-all duration-205 ${
                                                    isUploading 
                                                    ? 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/20 cursor-not-allowed' 
                                                    : 'border-indigo-200 dark:border-indigo-900/50 hover:border-indigo-500 dark:hover:border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/10 hover:bg-indigo-50/20'
                                                }`}
                                            >
                                                {isUploading ? (
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Loader2 className="w-6 h-6 text-indigo-600 dark:text-indigo-500 animate-spin" />
                                                        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider animate-pulse">
                                                            Compactando e Enviando...
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-1.5 text-slate-500 dark:text-slate-400">
                                                        <Upload className="w-6 h-6 text-indigo-600 dark:text-indigo-500" />
                                                        <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider text-center">
                                                            Upload de Nova Foto
                                                        </span>
                                                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 text-center">
                                                            Compactação inteligente ativada (JPEG, máx. 800px, 70%)
                                                        </span>
                                                    </div>
                                                )}
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Seção: Opções de Fotos */}
                                <div className="border-t border-slate-100 dark:border-slate-800 pt-8">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Opções de Fotos Disponíveis no Storage</p>
                                    
                                    {availablePhotos.length === 0 ? (
                                        <p className="text-center py-8 text-slate-400 text-sm italic font-medium">Nenhuma foto cadastrada no storage para a linha {targetWheel?.model}.</p>
                                    ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                            {availablePhotos.map((url, idx) => (
                                                <div key={idx} className="group relative rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 border-transparent hover:border-indigo-500 transition-all shadow-sm">
                                                    <div className="aspect-square w-full">
                                                        <img 
                                                            src={url} 
                                                            alt={`Opção ${idx}`} 
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-355"
                                                            onError={(e) => (e.currentTarget.src = "https://placehold.co/200x200/e2e8f0/64748b?text=FOTO")}
                                                        />
                                                    </div>
                                                    {/* Botões de Ação ao Hover */}
                                                    <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-center items-center gap-2 p-3">
                                                        <button 
                                                            onClick={() => handleSavePhotoOverride(url, 'item')}
                                                            className="w-full py-2 bg-white text-indigo-600 text-[10px] font-black uppercase rounded-xl shadow-lg hover:bg-indigo-600 hover:text-white transition-all active:scale-95"
                                                        >
                                                            Apenas este
                                                        </button>
                                                        <button 
                                                            onClick={() => handleSavePhotoOverride(url, 'model')}
                                                            className="w-full py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl shadow-lg hover:bg-slate-900 transition-all active:scale-95"
                                                        >
                                                            Todo o Grupo
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
							</div>

                            {/* Modal Footer */}
                            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 text-center border-t border-slate-100 dark:border-slate-800">
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] max-w-lg mx-auto">
                                    Nota: Se a foto desejada não estiver listada, verifique a pasta correspondente no Supabase Storage.
                                </p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
