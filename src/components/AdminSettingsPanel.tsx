import React, { useState, useEffect, useMemo } from 'react';
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
    Loader2,
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Star,
    Layers,
    Filter,
    ChevronLeft,
    ChevronRight,
    RotateCcw,
    Copy,
    ExternalLink,
    RefreshCw,
    Package,
    Eye,
    Trash2,
    Link as LinkIcon,
    ArrowUpDown
} from 'lucide-react';
import { toast } from 'react-hot-toast';

import { 
    getInventory, 
    getPhotoOverrides, 
    savePhotoOverride,
    deletePhotoOverride,
    uploadPhotoToStorage
} from '../lib/supabase';
import { 
    getWheelPhotoUrl, 
    setPhotoOverrides, 
    getModelAndFinish,
    getWheelPhotoDetails,
    WheelPhotoDetails,
    PhotoStatusType,
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

type TabType = 'all' | 'no_photo' | 'fallback' | 'exact' | 'override';
type SortOption = 'no_photo_first' | 'codigo_asc' | 'descricao_asc' | 'stock_desc' | 'stock_asc';

export const AdminSettingsPanel: React.FC<AdminSettingsPanelProps> = ({ onBack }) => {
    const [stock, setStock] = useState<StockItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    
    // Filtros e Busca
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [selectedModel, setSelectedModel] = useState<string>("");
    const [selectedAro, setSelectedAro] = useState<string>("");
    const [selectedFinish, setSelectedFinish] = useState<string>("");
    const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');
    const [sortBy, setSortBy] = useState<SortOption>('no_photo_first');

    // Paginação
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState<number>(24);

    // Modal de Foto
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
    const [targetWheel, setTargetWheel] = useState<{ 
        model: string; 
        finish: string; 
        description: string; 
        codigo: string; 
        details: WheelPhotoDetails;
    } | null>(null);
    const [availablePhotos, setAvailablePhotos] = useState<string[]>([]);
    const [directUrlInput, setDirectUrlInput] = useState("");
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    // Resetar para página 1 sempre que os filtros mudarem
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, activeTab, selectedModel, selectedAro, selectedFinish, stockFilter, sortBy, itemsPerPage]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [inventory, overrides] = await Promise.all([
                getInventory(),
                getPhotoOverrides()
            ]);
            setPhotoOverrides(overrides);
            setStock(inventory || []);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao carregar dados do catálogo");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            const [inventory, overrides] = await Promise.all([
                getInventory(),
                getPhotoOverrides()
            ]);
            setPhotoOverrides(overrides);
            setStock(inventory || []);
            toast.success("Catálogo e fotos atualizados!");
        } catch (error) {
            toast.error("Erro ao recarregar dados");
        } finally {
            setIsRefreshing(false);
        }
    };

    // Copiar código do item
    const handleCopyCode = (codigo: string, e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(codigo);
        setCopiedCode(codigo);
        toast.success(`Código ${codigo} copiado!`);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    // Estatísticas Globais (KPIs)
    const metrics = useMemo(() => {
        let total = stock.length;
        let noPhoto = 0;
        let fallback = 0;
        let exact = 0;
        let override = 0;
        let inStock = 0;

        stock.forEach(item => {
            const details = getWheelPhotoDetails(item.descricao, item.codigo);
            if (details.hasOverride) override++;
            if (details.status === 'none') noPhoto++;
            else if (details.status === 'fallback') fallback++;
            else if (details.status === 'exact') exact++;

            if ((item.quantidade || 0) > 0) inStock++;
        });

        return { total, noPhoto, fallback, exact, override, inStock };
    }, [stock]);

    // Opções únicas de Modelos
    const availableModels = useMemo(() => {
        const map = new Map<string, number>();
        stock.forEach(item => {
            const { modelCode } = getModelAndFinish(item.descricao);
            if (modelCode) {
                map.set(modelCode, (map.get(modelCode) || 0) + 1);
            }
        });
        return Array.from(map.entries())
            .map(([model, count]) => ({ model, count }))
            .sort((a, b) => a.model.localeCompare(b.model));
    }, [stock]);

    // Opções únicas de Aros
    const availableAros = useMemo(() => {
        const map = new Map<string, number>();
        stock.forEach(item => {
            const match = item.descricao.toUpperCase().match(/\b(1[3-9]|2[0-6])\b/);
            if (match) {
                const aro = match[1];
                map.set(aro, (map.get(aro) || 0) + 1);
            }
        });
        return Array.from(map.entries())
            .map(([aro, count]) => ({ aro, count }))
            .sort((a, b) => Number(a.aro) - Number(b.aro));
    }, [stock]);

    // Opções únicas de Acabamentos
    const availableFinishes = useMemo(() => {
        const map = new Map<string, number>();
        stock.forEach(item => {
            const { finishAbbr } = getModelAndFinish(item.descricao);
            if (finishAbbr) {
                map.set(finishAbbr, (map.get(finishAbbr) || 0) + 1);
            }
        });
        return Array.from(map.entries())
            .map(([finish, count]) => ({ finish, count }))
            .sort((a, b) => a.finish.localeCompare(b.finish));
    }, [stock]);

    // Filtragem Completa e Ordenação
    const filteredItemsWithDetails = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        return stock
            .map(item => {
                const details = getWheelPhotoDetails(item.descricao, item.codigo);
                const aroMatch = item.descricao.toUpperCase().match(/\b(1[3-9]|2[0-6])\b/);
                const itemAroNumber = aroMatch ? aroMatch[1] : '';
                return {
                    item,
                    details,
                    itemAroNumber
                };
            })
            .filter(({ item, details, itemAroNumber }) => {
                // 1. Filtro por Aba de Status
                if (activeTab === 'no_photo' && details.status !== 'none') return false;
                if (activeTab === 'fallback' && details.status !== 'fallback') return false;
                if (activeTab === 'exact' && details.status !== 'exact') return false;
                if (activeTab === 'override' && !details.hasOverride) return false;

                // 2. Filtro por Busca de Texto
                if (query) {
                    const matchCode = item.codigo.toLowerCase().includes(query);
                    const matchDesc = item.descricao.toLowerCase().includes(query);
                    const matchModel = details.modelCode.toLowerCase().includes(query);
                    const matchFinish = details.finishAbbr.toLowerCase().includes(query);
                    if (!matchCode && !matchDesc && !matchModel && !matchFinish) return false;
                }

                // 3. Filtro por Modelo
                if (selectedModel && details.modelCode !== selectedModel) return false;

                // 4. Filtro por Aro
                if (selectedAro && itemAroNumber !== selectedAro) return false;

                // 5. Filtro por Acabamento
                if (selectedFinish && details.finishAbbr !== selectedFinish) return false;

                // 6. Filtro por Estoque
                const stockQty = item.quantidade || 0;
                if (stockFilter === 'in_stock' && stockQty <= 0) return false;
                if (stockFilter === 'out_of_stock' && stockQty > 0) return false;

                return true;
            })
            .sort((a, b) => {
                if (sortBy === 'no_photo_first') {
                    // Ordem de prioridade: Sem foto (0) > Genérica (1) > Override (2) > Exata (3)
                    const getRank = (status: PhotoStatusType) => {
                        if (status === 'none') return 0;
                        if (status === 'fallback') return 1;
                        if (status === 'override_item' || status === 'override_model') return 2;
                        return 3;
                    };
                    const rankA = getRank(a.details.status);
                    const rankB = getRank(b.details.status);
                    if (rankA !== rankB) return rankA - rankB;
                    return a.item.descricao.localeCompare(b.item.descricao);
                }
                if (sortBy === 'codigo_asc') {
                    return a.item.codigo.localeCompare(b.item.codigo);
                }
                if (sortBy === 'descricao_asc') {
                    return a.item.descricao.localeCompare(b.item.descricao);
                }
                if (sortBy === 'stock_desc') {
                    return (b.item.quantidade || 0) - (a.item.quantidade || 0);
                }
                if (sortBy === 'stock_asc') {
                    return (a.item.quantidade || 0) - (b.item.quantidade || 0);
                }
                return 0;
            });
    }, [stock, activeTab, searchQuery, selectedModel, selectedAro, selectedFinish, stockFilter, sortBy]);

    // Paginação
    const totalItems = filteredItemsWithDetails.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const paginatedItems = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredItemsWithDetails.slice(start, start + itemsPerPage);
    }, [filteredItemsWithDetails, currentPage, itemsPerPage]);

    // Abrir Modal de Foto
    const handleOpenPhotoSelection = (item: StockItem) => {
        const details = getWheelPhotoDetails(item.descricao, item.codigo);
        const modelsPhotos = (photoMap as any)[details.modelCode] || {};
        const urls = Object.values(modelsPhotos) as string[];
        
        setTargetWheel({ 
            model: details.modelCode, 
            finish: details.finishAbbr, 
            description: item.descricao,
            codigo: item.codigo,
            details
        });
        setAvailablePhotos(urls);
        setDirectUrlInput("");
        setIsPhotoModalOpen(true);
    };

    // Salvar Override
    const handleSavePhotoOverride = async (url: string, scope: 'item' | 'model') => {
        if (!targetWheel) return;
        
        const loadingToast = toast.loading(
            scope === 'item' 
                ? `Salvando foto para o item ${targetWheel.codigo}...` 
                : `Salvando foto para todo o grupo ${targetWheel.model} ${targetWheel.finish}...`
        );

        const success = await savePhotoOverride(
            targetWheel.model, 
            targetWheel.finish, 
            url, 
            scope === 'item' ? targetWheel.codigo : undefined
        );

        if (success) {
            toast.success(
                scope === 'item' 
                    ? "Foto personalizada salva apenas para este item!" 
                    : "Foto salva para todo o grupo do modelo!",
                { id: loadingToast }
            );
            setIsPhotoModalOpen(false);
            
            // Recarregar overrides
            const overrides = await getPhotoOverrides();
            setPhotoOverrides(overrides);
            setStock([...stock]); 
        } else {
            toast.error("Erro ao salvar override de foto", { id: loadingToast });
        }
    };

    // Remover Override / Restaurar Padrão
    const handleRemoveOverride = async (item: StockItem, details: WheelPhotoDetails) => {
        const isItemOverride = details.status === 'override_item';
        const confirmMsg = isItemOverride
            ? `Deseja remover a foto personalizada do código ${item.codigo} e voltar ao padrão?`
            : `Deseja remover a foto personalizada do grupo ${details.modelCode} ${details.finishAbbr}?`;
            
        if (!window.confirm(confirmMsg)) return;

        const loadingToast = toast.loading("Restaurando foto original...");
        try {
            const success = await deletePhotoOverride({
                model: details.modelCode,
                finish: details.finishAbbr,
                item_codigo: isItemOverride ? item.codigo : undefined
            });

            if (success) {
                toast.success("Foto restaurada com sucesso!", { id: loadingToast });
                const overrides = await getPhotoOverrides();
                setPhotoOverrides(overrides);
                setStock([...stock]);
                if (isPhotoModalOpen) setIsPhotoModalOpen(false);
            } else {
                toast.error("Não foi possível remover o override", { id: loadingToast });
            }
        } catch (err) {
            toast.error("Erro ao comunicar com o servidor", { id: loadingToast });
        }
    };

    // Upload de Imagem
    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const loadingToast = toast.loading("Comprimindo imagem no navegador...");

        try {
            // Compactar imagem via Canvas (máximo 800px, 70% qualidade JPEG)
            const compressedBlob = await compressImage(file, 800, 800, 0.7);
            
            const origSizeKB = Math.round(file.size / 1024);
            const compSizeKB = Math.round(compressedBlob.size / 1024);
            toast.loading(`Enviando ao Storage... (${origSizeKB}KB ➜ ${compSizeKB}KB)`, { id: loadingToast });

            // Upload para o Supabase Storage
            const publicUrl = await uploadPhotoToStorage(compressedBlob, file.name);

            if (publicUrl) {
                toast.success(`Foto enviada com sucesso! (${compSizeKB}KB)`, { id: loadingToast });
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

    // Limpar todos os filtros
    const handleClearFilters = () => {
        setSearchQuery("");
        setActiveTab('all');
        setSelectedModel("");
        setSelectedAro("");
        setSelectedFinish("");
        setStockFilter('all');
        setSortBy('no_photo_first');
    };

    const hasActiveFilters = searchQuery !== "" || activeTab !== 'all' || selectedModel !== "" || selectedAro !== "" || selectedFinish !== "" || stockFilter !== 'all' || sortBy !== 'no_photo_first';

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 transition-colors duration-300">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={onBack}
                            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all shadow-sm active:scale-95"
                            title="Voltar ao Painel"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2.5 tracking-tight">
                                    <span className="p-2 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-600/20">
                                        <Camera className="w-6 h-6" />
                                    </span>
                                    Ajuste e Catálogo de Fotos
                                </h1>
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
                                Identifique rodas sem imagem, resolva fotos genéricas e faça uploads personalizados.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleRefresh}
                            disabled={isRefreshing || isLoading}
                            className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
                            Atualizar Catálogo
                        </button>
                    </div>
                </header>

                {/* Métricas / Cards de Status Rápidos (Clicáveis como Filtro) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mb-8">
                    {/* 1. Total */}
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`p-4 rounded-3xl border text-left transition-all duration-200 flex flex-col justify-between ${
                            activeTab === 'all'
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/25 ring-2 ring-indigo-600/30'
                                : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-black uppercase tracking-wider opacity-80">Catálogo Total</span>
                            <Package className={`w-4 h-4 ${activeTab === 'all' ? 'text-white' : 'text-slate-400'}`} />
                        </div>
                        <div className="text-2xl font-black">{metrics.total}</div>
                        <span className="text-[10px] opacity-75 mt-1 font-semibold">Todas as rodas cadastradas</span>
                    </button>

                    {/* 2. Sem Foto (🚨 CRÍTICO) */}
                    <button
                        onClick={() => setActiveTab('no_photo')}
                        className={`p-4 rounded-3xl border text-left transition-all duration-200 flex flex-col justify-between relative overflow-hidden ${
                            activeTab === 'no_photo'
                                ? 'bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-600/25 ring-2 ring-rose-600/30'
                                : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-rose-200 dark:border-rose-950/50 hover:border-rose-400'
                        }`}
                    >
                        {metrics.noPhoto > 0 && (
                            <span className="absolute top-2 right-2 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                            </span>
                        )}
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-[11px] font-black uppercase tracking-wider ${activeTab === 'no_photo' ? 'text-white' : 'text-rose-600 dark:text-rose-400'}`}>
                                🚨 Sem Foto
                            </span>
                            <AlertCircle className={`w-4 h-4 ${activeTab === 'no_photo' ? 'text-white' : 'text-rose-500'}`} />
                        </div>
                        <div className="text-2xl font-black text-rose-500 dark:text-rose-400" style={{ color: activeTab === 'no_photo' ? 'white' : undefined }}>
                            {metrics.noPhoto}
                        </div>
                        <span className={`text-[10px] mt-1 font-bold ${activeTab === 'no_photo' ? 'text-white/90' : 'text-rose-600 dark:text-rose-400'}`}>
                            {metrics.noPhoto > 0 ? 'Precisam de imagem!' : 'Nenhuma pendência'}
                        </span>
                    </button>

                    {/* 3. Provisória / Genérica */}
                    <button
                        onClick={() => setActiveTab('fallback')}
                        className={`p-4 rounded-3xl border text-left transition-all duration-200 flex flex-col justify-between ${
                            activeTab === 'fallback'
                                ? 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/25 ring-2 ring-amber-500/30'
                                : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-amber-200 dark:border-amber-950/50 hover:border-amber-400'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-[11px] font-black uppercase tracking-wider ${activeTab === 'fallback' ? 'text-white' : 'text-amber-600 dark:text-amber-400'}`}>
                                ⚠️ Foto Genérica
                            </span>
                            <AlertTriangle className={`w-4 h-4 ${activeTab === 'fallback' ? 'text-white' : 'text-amber-500'}`} />
                        </div>
                        <div className="text-2xl font-black text-amber-600 dark:text-amber-400" style={{ color: activeTab === 'fallback' ? 'white' : undefined }}>
                            {metrics.fallback}
                        </div>
                        <span className="text-[10px] opacity-75 mt-1 font-semibold">Usa foto de outra cor do modelo</span>
                    </button>

                    {/* 4. Foto Exata */}
                    <button
                        onClick={() => setActiveTab('exact')}
                        className={`p-4 rounded-3xl border text-left transition-all duration-200 flex flex-col justify-between ${
                            activeTab === 'exact'
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-600/25 ring-2 ring-emerald-600/30'
                                : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-emerald-200 dark:border-emerald-950/50 hover:border-emerald-400'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-[11px] font-black uppercase tracking-wider ${activeTab === 'exact' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                ✅ Foto Exata
                            </span>
                            <CheckCircle2 className={`w-4 h-4 ${activeTab === 'exact' ? 'text-white' : 'text-emerald-500'}`} />
                        </div>
                        <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400" style={{ color: activeTab === 'exact' ? 'white' : undefined }}>
                            {metrics.exact}
                        </div>
                        <span className="text-[10px] opacity-75 mt-1 font-semibold">Mapeamento 100% correto</span>
                    </button>

                    {/* 5. Overrides Customizados */}
                    <button
                        onClick={() => setActiveTab('override')}
                        className={`p-4 rounded-3xl border text-left transition-all duration-200 flex flex-col justify-between col-span-2 sm:col-span-1 ${
                            activeTab === 'override'
                                ? 'bg-purple-600 text-white border-purple-600 shadow-lg shadow-purple-600/25 ring-2 ring-purple-600/30'
                                : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-purple-200 dark:border-purple-950/50 hover:border-purple-400'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-[11px] font-black uppercase tracking-wider ${activeTab === 'override' ? 'text-white' : 'text-purple-600 dark:text-purple-400'}`}>
                                ⭐ Customizadas
                            </span>
                            <Star className={`w-4 h-4 ${activeTab === 'override' ? 'text-white' : 'text-purple-500'}`} />
                        </div>
                        <div className="text-2xl font-black text-purple-600 dark:text-purple-400" style={{ color: activeTab === 'override' ? 'white' : undefined }}>
                            {metrics.override}
                        </div>
                        <span className="text-[10px] opacity-75 mt-1 font-semibold">Uploads e ajustes manuais</span>
                    </button>
                </div>

                {/* Bloco de Filtros Avançados */}
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden mb-8">
                    {/* Barra Superior de Filtros */}
                    <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 space-y-6">
                        {/* Linha 1: Campo de Busca Principal + Botão Rápido Sem Foto */}
                        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                <input 
                                    type="text"
                                    placeholder="Pesquisar por Código (ex: 1204), Descrição (ex: C10), Modelo ou Cor..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-12 pr-10 py-3.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-800 dark:text-slate-100 text-sm font-medium transition-all"
                                />
                                {searchQuery && (
                                    <button 
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Botão Rápido de Toggle "Sem Foto" */}
                            <button
                                onClick={() => setActiveTab(activeTab === 'no_photo' ? 'all' : 'no_photo')}
                                className={`px-5 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-sm active:scale-95 shrink-0 ${
                                    activeTab === 'no_photo'
                                        ? 'bg-rose-600 text-white ring-2 ring-rose-500/50'
                                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/40'
                                }`}
                            >
                                <AlertCircle className="w-4 h-4" />
                                {activeTab === 'no_photo' ? 'Mostrando Apenas Sem Foto' : `Filtrar Sem Foto (${metrics.noPhoto})`}
                            </button>
                        </div>

                        {/* Linha 2: Dropdowns de Filtros (Modelo, Aro, Acabamento, Estoque, Ordenação) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
                            {/* Filtro: Modelo */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Sliders className="w-3 h-3 text-indigo-500" />
                                    Modelo
                                </label>
                                <select
                                    value={selectedModel}
                                    onChange={e => setSelectedModel(e.target.value)}
                                    className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">Todos os Modelos ({availableModels.length})</option>
                                    {availableModels.map(({ model, count }) => (
                                        <option key={model} value={model}>
                                            {model} ({count} itens)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Filtro: Aro */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Layers className="w-3 h-3 text-indigo-500" />
                                    Aro
                                </label>
                                <select
                                    value={selectedAro}
                                    onChange={e => setSelectedAro(e.target.value)}
                                    className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">Todos os Aros</option>
                                    {availableAros.map(({ aro, count }) => (
                                        <option key={aro} value={aro}>
                                            Aro {aro} ({count} itens)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Filtro: Acabamento */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Sparkles className="w-3 h-3 text-indigo-500" />
                                    Acabamento / Cor
                                </label>
                                <select
                                    value={selectedFinish}
                                    onChange={e => setSelectedFinish(e.target.value)}
                                    className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">Todos os Acabamentos</option>
                                    {availableFinishes.map(({ finish, count }) => (
                                        <option key={finish} value={finish}>
                                            {finish} ({count})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Filtro: Estoque */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Package className="w-3 h-3 text-indigo-500" />
                                    Estoque Físico
                                </label>
                                <select
                                    value={stockFilter}
                                    onChange={e => setStockFilter(e.target.value as any)}
                                    className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="all">Todos ({stock.length})</option>
                                    <option value="in_stock">Apenas com Estoque (&gt; 0)</option>
                                    <option value="out_of_stock">Sem Estoque (0 un)</option>
                                </select>
                            </div>

                            {/* Ordenação */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <ArrowUpDown className="w-3 h-3 text-indigo-500" />
                                    Ordenar por
                                </label>
                                <select
                                    value={sortBy}
                                    onChange={e => setSortBy(e.target.value as any)}
                                    className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="no_photo_first">🚨 Sem foto primeiro</option>
                                    <option value="codigo_asc">Código (A ➜ Z)</option>
                                    <option value="descricao_asc">Descrição (A ➜ Z)</option>
                                    <option value="stock_desc">Maior Estoque</option>
                                    <option value="stock_asc">Menor Estoque</option>
                                </select>
                            </div>
                        </div>

                        {/* Barra de Resumo e Limpar Filtros */}
                        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                    Encontrados: <span className="font-black text-indigo-600 dark:text-indigo-400">{totalItems}</span> rodas
                                </span>
                                {hasActiveFilters && (
                                    <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase rounded-lg border border-amber-200 dark:border-amber-900/50">
                                        Filtros Ativos
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                {hasActiveFilters && (
                                    <button
                                        onClick={handleClearFilters}
                                        className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                        Limpar todos os filtros
                                    </button>
                                )}

                                {/* Seletor de Itens por Página */}
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-medium text-slate-400">Por página:</span>
                                    <select
                                        value={itemsPerPage}
                                        onChange={e => setItemsPerPage(Number(e.target.value))}
                                        className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
                                    >
                                        <option value={24}>24</option>
                                        <option value={48}>48</option>
                                        <option value={96}>96</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Conteúdo: Grid de Rodas ou Estado Vazio */}
                    <div className="p-6 md:p-8">
                        {isLoading ? (
                            <div className="py-28 flex flex-col items-center justify-center gap-4">
                                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                <p className="text-slate-400 text-sm font-bold uppercase tracking-widest animate-pulse">Carregando catálogo...</p>
                            </div>
                        ) : filteredItemsWithDetails.length === 0 ? (
                            <div className="py-24 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col items-center justify-center text-center p-8">
                                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-400 dark:text-slate-500 mb-4">
                                    <Sliders className="w-8 h-8" />
                                </div>
                                <h3 className="text-lg font-black text-slate-700 dark:text-slate-200">Nenhum resultado encontrado</h3>
                                <p className="text-slate-400 text-sm max-w-md mt-1 mb-6">
                                    Não encontramos nenhuma roda que corresponda aos filtros aplicados. Tente ajustar os termos ou limpar os filtros.
                                </p>
                                <button
                                    onClick={handleClearFilters}
                                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
                                >
                                    Limpar Filtros
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {paginatedItems.map(({ item, details, itemAroNumber }) => {
                                        const stockQty = item.quantidade || 0;
                                        const isNoPhoto = details.status === 'none';
                                        const isFallback = details.status === 'fallback';
                                        const isExact = details.status === 'exact';
                                        const isOverride = details.hasOverride;

                                        return (
                                            <div 
                                                key={item.codigo}
                                                className={`group bg-white dark:bg-slate-850 border rounded-3xl p-5 hover:shadow-xl transition-all duration-300 flex flex-col relative ${
                                                    isNoPhoto 
                                                        ? 'border-rose-300 dark:border-rose-900/60 shadow-rose-500/5' 
                                                        : isOverride
                                                        ? 'border-purple-300 dark:border-purple-900/60 shadow-purple-500/5'
                                                        : isFallback
                                                        ? 'border-amber-200 dark:border-amber-900/40'
                                                        : 'border-slate-200 dark:border-slate-800'
                                                }`}
                                            >
                                                {/* Área de Imagem */}
                                                <div className="aspect-square rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 relative mb-4 border border-slate-150 dark:border-slate-700/80">
                                                    <img 
                                                        src={details.url} 
                                                        alt={item.descricao}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                        onError={(e) => {
                                                            e.currentTarget.src = "https://placehold.co/300x300/e2e8f0/64748b?text=SEM+FOTO";
                                                        }}
                                                    />

                                                    {/* Badge de Código Copiável (Superior Esquerdo) */}
                                                    <button
                                                        onClick={(e) => handleCopyCode(item.codigo, e)}
                                                        className="absolute top-3 left-3 px-2.5 py-1 bg-slate-900/85 hover:bg-indigo-600 backdrop-blur-sm text-[10px] font-black text-white uppercase tracking-widest rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
                                                        title="Clique para copiar código"
                                                    >
                                                        {item.codigo}
                                                        {copiedCode === item.codigo ? (
                                                            <Check className="w-3 h-3 text-emerald-400" />
                                                        ) : (
                                                            <Copy className="w-3 h-3 text-slate-300 opacity-70 group-hover:opacity-100" />
                                                        )}
                                                    </button>

                                                    {/* Badge de Status da Foto (Superior Direito) */}
                                                    <div className="absolute top-3 right-3">
                                                        {isNoPhoto && (
                                                            <span className="px-2.5 py-1 bg-rose-600/90 text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-md flex items-center gap-1 backdrop-blur-sm">
                                                                <AlertCircle className="w-3 h-3" />
                                                                Sem Foto
                                                            </span>
                                                        )}
                                                        {isFallback && (
                                                            <span className="px-2.5 py-1 bg-amber-500/90 text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-md flex items-center gap-1 backdrop-blur-sm">
                                                                <AlertTriangle className="w-3 h-3" />
                                                                Genérica
                                                            </span>
                                                        )}
                                                        {isExact && (
                                                            <span className="px-2.5 py-1 bg-emerald-600/90 text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-md flex items-center gap-1 backdrop-blur-sm">
                                                                <Check className="w-3 h-3" />
                                                                Exata
                                                            </span>
                                                        )}
                                                        {isOverride && (
                                                            <span className="px-2.5 py-1 bg-purple-600/95 text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-md flex items-center gap-1 backdrop-blur-sm">
                                                                <Star className="w-3 h-3 fill-current" />
                                                                Customizada
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Badge de Estoque (Inferior Esquerdo) */}
                                                    <div className="absolute bottom-3 left-3">
                                                        <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg shadow-sm backdrop-blur-sm ${
                                                            stockQty > 0 
                                                                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30' 
                                                                : 'bg-slate-900/80 text-slate-400 border border-slate-700/40'
                                                        }`}>
                                                            {stockQty > 0 ? `${stockQty} un.` : '0 un.'}
                                                        </span>
                                                    </div>

                                                    {/* Badge de Aro (Inferior Direito) */}
                                                    {itemAroNumber && (
                                                        <div className="absolute bottom-3 right-3">
                                                            <span className="px-2 py-1 bg-slate-900/80 text-slate-300 text-[10px] font-black uppercase rounded-lg shadow-sm backdrop-blur-sm">
                                                                Aro {itemAroNumber}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Detalhes do Produto */}
                                                <div className="flex-1 mb-4">
                                                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug mb-2" title={item.descricao}>
                                                        {item.descricao}
                                                    </h3>

                                                    {/* Tags: Modelo e Cor */}
                                                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-extrabold rounded-md">
                                                            Mod: {details.modelCode || 'N/A'}
                                                        </span>
                                                        {details.finishAbbr && (
                                                            <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-extrabold rounded-md">
                                                                Cor: {details.finishAbbr}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Aviso de Override se existir */}
                                                    {details.hasOverride && (
                                                        <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold mt-2 flex items-center gap-1">
                                                            <Star className="w-3 h-3 fill-current" />
                                                            {details.overrideScope === 'item' ? 'Personalizado para este código' : `Personalizado para todo o grupo ${details.modelCode} ${details.finishAbbr}`}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Ações do Card */}
                                                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                                    <button 
                                                        onClick={() => handleOpenPhotoSelection(item)}
                                                        className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 shadow-sm ${
                                                            isNoPhoto
                                                                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                                                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                                                        }`}
                                                    >
                                                        <Camera className="w-4 h-4 shrink-0" />
                                                        {isNoPhoto ? 'Adicionar Foto' : 'Ajustar Foto'}
                                                    </button>

                                                    {/* Botão de Restaurar Override se houver */}
                                                    {details.hasOverride && (
                                                        <button
                                                            onClick={() => handleRemoveOverride(item, details)}
                                                            className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 rounded-xl transition-all"
                                                            title="Restaurar foto padrão do catálogo"
                                                        >
                                                            <RotateCcw className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Controles de Paginação */}
                                {totalPages > 1 && (
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-12 pt-8 border-t border-slate-100 dark:border-slate-800">
                                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                            Exibindo {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems} rodas
                                        </p>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                disabled={currentPage === 1}
                                                className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                                                title="Página Anterior"
                                            >
                                                <ChevronLeft className="w-5 h-5" />
                                            </button>

                                            {/* Indicador de Páginas */}
                                            <div className="flex items-center gap-1 px-2">
                                                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                                                    Página {currentPage}
                                                </span>
                                                <span className="text-xs font-medium text-slate-400">
                                                    de {totalPages}
                                                </span>
                                            </div>

                                            <button
                                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                disabled={currentPage === totalPages}
                                                className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                                                title="Próxima Página"
                                            >
                                                <ChevronRight className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de Seleção e Ajuste de Foto */}
            <AnimatePresence>
                {isPhotoModalOpen && targetWheel && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsPhotoModalOpen(false)}
                            className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
                        />

                        {/* Conteúdo do Modal */}
                        <motion.div 
                            initial={{ scale: 0.95, y: 20, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.95, y: 20, opacity: 0 }}
                            className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800"
                        >
                            {/* Modal Header */}
                            <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                                            Ajustar Foto do Catálogo
                                        </h3>
                                        <span className="px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-xs font-black rounded-lg">
                                            {targetWheel.codigo}
                                        </span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        {targetWheel.model} {targetWheel.finish ? `• Acabamento: ${targetWheel.finish}` : ''}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setIsPhotoModalOpen(false)} 
                                    className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar space-y-8">
                                {/* Grid de Comparação / Upload */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Lado Esquerdo: Foto Atual */}
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Foto Atual Resolvida
                                            </p>
                                            <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-md ${
                                                targetWheel.details.status === 'none'
                                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
                                                    : targetWheel.details.hasOverride
                                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400'
                                                    : targetWheel.details.status === 'fallback'
                                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                                            }`}>
                                                {targetWheel.details.statusLabel}
                                            </span>
                                        </div>

                                        <div className="aspect-square rounded-3xl overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-800 shadow-inner relative">
                                            <img 
                                                src={targetWheel.details.url} 
                                                className="w-full h-full object-cover"
                                                alt="Foto Atual"
                                                onError={(e) => (e.currentTarget.src = "https://placehold.co/400x400/e2e8f0/64748b?text=SEM+FOTO")}
                                            />
                                        </div>

                                        <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-3 line-clamp-2">
                                            {targetWheel.description}
                                        </p>

                                        {/* Botão de Restaurar Padrão se tiver override */}
                                        {targetWheel.details.hasOverride && (
                                            <button
                                                onClick={() => handleRemoveOverride({ codigo: targetWheel.codigo, descricao: targetWheel.description, local: '' }, targetWheel.details)}
                                                className="w-full mt-3 py-2 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                                            >
                                                <RotateCcw className="w-3.5 h-3.5" />
                                                Remover Override &amp; Restaurar Padrão
                                            </button>
                                        )}
                                    </div>
                                    
                                    {/* Lado Direito: Métodos para Trocar Foto */}
                                    <div className="flex flex-col justify-between gap-5">
                                        {/* Instruções */}
                                        <div className="bg-indigo-50 dark:bg-indigo-950/30 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
                                            <h4 className="text-xs font-black text-indigo-700 dark:text-indigo-300 uppercase mb-1 flex items-center gap-1.5">
                                                <Sparkles className="w-4 h-4" />
                                                Como Funciona o Ajuste
                                            </h4>
                                            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium leading-relaxed">
                                                Ao escolher uma foto abaixo ou fazer upload, você pode aplicar a imagem <strong>Apenas neste item ({targetWheel.codigo})</strong> ou <strong>Para todo o modelo ({targetWheel.model} {targetWheel.finish})</strong>.
                                            </p>
                                        </div>

                                        {/* Upload de Imagem */}
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                                Opção 1: Enviar Nova Imagem do Computador
                                            </p>
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
                                                className={`flex flex-col items-center justify-center p-5 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 ${
                                                    isUploading 
                                                    ? 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/20 cursor-not-allowed' 
                                                    : 'border-indigo-200 dark:border-indigo-900/50 hover:border-indigo-500 dark:hover:border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/10 hover:bg-indigo-50/20'
                                                }`}
                                            >
                                                {isUploading ? (
                                                    <div className="flex flex-col items-center gap-2 py-2">
                                                        <Loader2 className="w-6 h-6 text-indigo-600 dark:text-indigo-500 animate-spin" />
                                                        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider animate-pulse">
                                                            Compactando e Enviando...
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-1 text-slate-500 dark:text-slate-400">
                                                        <Upload className="w-6 h-6 text-indigo-600 dark:text-indigo-500 mb-1" />
                                                        <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider text-center">
                                                            Selecionar Foto no Dispositivo
                                                        </span>
                                                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 text-center">
                                                            Otimização automática ativada (JPEG leve, máx. 800px)
                                                        </span>
                                                    </div>
                                                )}
                                            </label>
                                        </div>

                                        {/* Inserir URL Direta */}
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                                Opção 2: Ou Inserir Link Direto de Imagem (URL)
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <div className="relative flex-1">
                                                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                    <input 
                                                        type="url"
                                                        placeholder="https://exemplo.com/foto-roda.jpg"
                                                        value={directUrlInput}
                                                        onChange={e => setDirectUrlInput(e.target.value)}
                                                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                </div>
                                                <button
                                                    disabled={!directUrlInput.trim().startsWith('http')}
                                                    onClick={() => handleSavePhotoOverride(directUrlInput.trim(), 'item')}
                                                    className="px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase transition-all shrink-0"
                                                >
                                                    Aplicar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Opções de Fotos do Modelo Disponíveis */}
                                <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Opção 3: Escolher das Fotos Cadastradas do Modelo ({availablePhotos.length} disponíveis)
                                        </p>
                                    </div>
                                    
                                    {availablePhotos.length === 0 ? (
                                        <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                                            <p className="text-slate-400 text-xs font-medium">
                                                Nenhuma foto vinculada no momento para a linha {targetWheel.model}. Faça upload de uma foto acima para vincular!
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                            {availablePhotos.map((url, idx) => (
                                                <div 
                                                    key={idx} 
                                                    className="group relative rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 border-transparent hover:border-indigo-500 transition-all shadow-sm"
                                                >
                                                    <div className="aspect-square w-full">
                                                        <img 
                                                            src={url} 
                                                            alt={`Opção ${idx}`} 
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                            onError={(e) => (e.currentTarget.src = "https://placehold.co/200x200/e2e8f0/64748b?text=FOTO")}
                                                        />
                                                    </div>

                                                    {/* Botões de Decisão ao Passar o Mouse */}
                                                    <div className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col justify-center items-center gap-2 p-3">
                                                        <button 
                                                            onClick={() => handleSavePhotoOverride(url, 'item')}
                                                            className="w-full py-2 bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white text-[10px] font-black uppercase rounded-xl shadow-lg transition-all active:scale-95"
                                                        >
                                                            Apenas este item
                                                        </button>
                                                        <button 
                                                            onClick={() => handleSavePhotoOverride(url, 'model')}
                                                            className="w-full py-2 bg-indigo-600 hover:bg-slate-900 text-white text-[10px] font-black uppercase rounded-xl shadow-lg transition-all active:scale-95"
                                                        >
                                                            Todo o grupo
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 bg-slate-50 dark:bg-slate-850 text-center border-t border-slate-100 dark:border-slate-800">
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    Todas as fotos enviadas são sincronizadas automaticamente com o Supabase Storage.
                                </p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
