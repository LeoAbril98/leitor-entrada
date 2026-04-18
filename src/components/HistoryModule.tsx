import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    ArrowLeft, 
    History as HistoryIcon, 
    Calendar, 
    ChevronRight, 
    RotateCcw, 
    Search, 
    Package, 
    ShoppingCart,
    AlertCircle,
    CheckCircle2,
    X,
    Tag,
    PenTool,
    Volume2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getHistoryBatches, getHistoryItems, restoreHistoryBatch } from '../lib/supabase';
import { saveSketch, saveAudio } from '../lib/sketchStore';
import { cn } from '../utils';
import { AudioPlayerModal } from './AudioPlayerModal';
import { SketchModal } from './SketchModal';
import { AudioRecorderModal } from './AudioRecorderModal';

interface HistoryModuleProps {
    onBack: () => void;
}

export const HistoryModule: React.FC<HistoryModuleProps> = ({ onBack }) => {
    const [batches, setBatches] = useState<any[]>([]);
    const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
    const [batchItems, setBatchItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Modais de Mídia
    const [sketchModalOpen, setSketchModalOpen] = useState(false);
    const [activeSketchItem, setActiveSketchItem] = useState<{ codigo: string, title: string, data?: string } | null>(null);
    const [audioPlayerOpen, setAudioPlayerOpen] = useState(false);
    const [activeAudioItem, setActiveAudioItem] = useState<{ codigo: string, title: string, data?: string } | null>(null);

    useEffect(() => {
        loadBatches();
    }, []);

    const loadBatches = async () => {
        setIsLoading(true);
        const data = await getHistoryBatches();
        setBatches(data);
        setIsLoading(false);
    };

    const handleSelectBatch = async (batchName: string) => {
        setSelectedBatch(batchName);
        setIsLoading(true);
        const items = await getHistoryItems(batchName);
        setBatchItems(items);
        setIsLoading(false);
    };

    const handleRestore = async () => {
        if (!selectedBatch) return;

        if (window.confirm(`ATENÇÃO: Isso irá substituir todos os pedidos atuais, ETIQUETAS, RASCUNHOS e ÁUDIOS pelo conteúdo de "${selectedBatch}". Deseja continuar?`)) {
            const loadingToast = toast.loading("Restaurando snapshot total...");
            
            try {
                const result = await restoreHistoryBatch(selectedBatch);
                
                if (result.success) {
                    // Reidratar o IndexedDB com os rascunhos e áudios do histórico
                    for (const item of result.items) {
                        if (item.sketch_data) {
                            await saveSketch(item.codigo, item.sketch_data);
                        }
                        if (item.audio_data) {
                            // Converter Base64 de volta para Blob
                            const blob = base64ToBlob(item.audio_data);
                            await saveAudio(item.codigo, blob);
                        }
                    }

                    toast.success("Snapshot total restaurado!", { id: loadingToast });
                    onBack();
                } else {
                    toast.error("Erro ao restaurar snapshot.", { id: loadingToast });
                }
            } catch (error) {
                console.error(error);
                toast.error("Erro crítico na restauração.", { id: loadingToast });
            }
        }
    };

    const base64ToBlob = (base64: string) => {
        const parts = base64.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        for (let i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
        }
        return new Blob([uInt8Array], { type: contentType });
    };

    // Agrupar itens por código (consolidar as fábricas em uma única linha para visualização)
    const consolidatedItems = React.useMemo(() => {
        const map = new Map();
        batchItems.forEach(item => {
            if (!map.has(item.codigo)) {
                map.set(item.codigo, {
                    codigo: item.codigo,
                    descricao: item.descricao,
                    preco: item.preco,
                    tags: item.tags,
                    hasSketch: !!item.sketch_data,
                    sketch_data: item.sketch_data,
                    hasAudio: !!item.audio_data,
                    audio_data: item.audio_data,
                    MK: 0, MOLERI: 0, CM: 0, OLIMPO: 0
                });
            }
            const current = map.get(item.codigo);
            current[item.factory] = item.quantidade;
            // Atualizar metadados caso estejam vindo em linhas separadas (embora o normal seja vir em todas por código)
            if (item.tags) current.tags = item.tags;
            if (item.sketch_data) {
                current.hasSketch = true;
                current.sketch_data = item.sketch_data;
            }
            if (item.audio_data) {
                current.hasAudio = true;
                current.audio_data = item.audio_data;
            }
        });

        return Array.from(map.values()).filter(it => 
            it.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            it.descricao.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [batchItems, searchTerm]);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header Superior */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <button 
                        onClick={selectedBatch ? () => setSelectedBatch(null) : onBack}
                        className="flex items-center gap-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors group"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className="font-bold uppercase tracking-widest text-sm">
                            {selectedBatch ? "Voltar aos Lotes" : "Painel Principal"}
                        </span>
                    </button>

                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                                {selectedBatch ? "Detalhes do Lote" : "Histórico de Pendências"}
                            </h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Snapshots semanais</p>
                        </div>
                        <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                            <HistoryIcon className="w-6 h-6 text-white" />
                        </div>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {!selectedBatch ? (
                        <motion.div 
                            key="batch-list"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        >
                            {isLoading ? (
                                Array(6).fill(0).map((_, i) => (
                                    <div key={i} className="h-48 bg-slate-200 dark:bg-slate-800 rounded-[2.5rem] animate-pulse" />
                                ))
                            ) : batches.length === 0 ? (
                                <div className="col-span-full py-20 text-center">
                                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <AlertCircle className="w-10 h-10 text-slate-300" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-600 dark:text-slate-400 mb-2">Nenhum lote arquivado</h3>
                                    <p className="text-slate-400">As tabelas aparecerão aqui após você "Zerar a Semana".</p>
                                </div>
                            ) : (
                                batches.map((batch) => (
                                    <motion.button
                                        key={batch.lote_nome}
                                        whileHover={{ y: -8, scale: 1.02 }}
                                        onClick={() => handleSelectBatch(batch.lote_nome)}
                                        className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 text-left transition-all hover:border-amber-500 hover:shadow-2xl hover:shadow-amber-500/10 flex flex-col justify-between h-56"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="bg-amber-50 dark:bg-amber-900/30 p-3 rounded-2xl text-amber-600 dark:text-amber-400">
                                                <Calendar className="w-6 h-6" />
                                            </div>
                                            <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
                                        </div>
                                        
                                        <div>
                                            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2 line-clamp-1">
                                                {batch.lote_nome}
                                            </h3>
                                            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
                                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                Snapshot salvo em {new Date(batch.arquivado_em).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </motion.button>
                                ))
                            )}
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="batch-details"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden"
                        >
                            {/* Toolbar de Ações do Detalhe */}
                            <div className="p-6 md:p-8 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-1">{selectedBatch}</h3>
                                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Modo de Visualização Histórica</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="relative flex-1 md:w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input 
                                            type="text" 
                                            placeholder="Buscar no histórico..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                                        />
                                    </div>
                                    <button 
                                        onClick={handleRestore}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 active:scale-95 whitespace-nowrap"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        Restaurar Semana
                                    </button>
                                </div>
                            </div>

                            {/* Tabela de Dados */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-800/30 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                            <th className="px-8 py-5 border-b border-slate-100 dark:border-slate-800">Cód</th>
                                            <th className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">Descrição</th>
                                            <th className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 text-center">MK</th>
                                            <th className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 text-center">MOL</th>
                                            <th className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 text-center">CM</th>
                                            <th className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 text-center">OLI</th>
                                            <th className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 text-center">NOTAS</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                        {isLoading ? (
                                            Array(5).fill(0).map((_, i) => (
                                                <tr key={i} className="animate-pulse">
                                                    <td colSpan={7} className="px-8 py-4 h-16 bg-slate-50 dark:bg-slate-800/10"></td>
                                                </tr>
                                            ))
                                        ) : consolidatedItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-8 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                                                    Nenhum item encontrado neste lote
                                                </td>
                                            </tr>
                                        ) : (
                                            consolidatedItems.map((item) => (
                                                <tr key={item.codigo} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                    <td className="px-8 py-5">
                                                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-[10px] font-black text-slate-500">
                                                            {item.codigo}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-5 font-bold text-slate-700 dark:text-slate-200 text-sm">
                                                        <div className="flex flex-col gap-1">
                                                            {item.descricao}
                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                {item.tags?.map((tag: string) => (
                                                                    <span key={tag} className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 text-[9px] text-slate-400 rounded border border-slate-200 dark:border-slate-700">
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 text-center text-sm font-black text-slate-600 dark:text-slate-400">{item.MK || '-'}</td>
                                                    <td className="px-6 py-5 text-center text-sm font-black text-slate-600 dark:text-slate-400">{item.MOLERI || '-'}</td>
                                                    <td className="px-6 py-5 text-center text-sm font-black text-slate-600 dark:text-slate-400">{item.CM || '-'}</td>
                                                    <td className="px-6 py-5 text-center text-sm font-black text-slate-600 dark:text-slate-400">{item.OLIMPO || '-'}</td>
                                                        <div className="flex items-center justify-center gap-2">
                                                            {item.hasSketch && (
                                                                <button 
                                                                    onClick={() => {
                                                                        setActiveSketchItem({ codigo: item.codigo, title: item.descricao, data: item.sketch_data });
                                                                        setSketchModalOpen(true);
                                                                    }}
                                                                    className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors group/btn"
                                                                >
                                                                    <PenTool className="w-3.5 h-3.5 text-amber-500 group-hover/btn:scale-110 transition-transform" title="Ver rascunho" />
                                                                </button>
                                                            )}
                                                            {item.hasAudio && (
                                                                <button 
                                                                    onClick={() => {
                                                                        setActiveAudioItem({ codigo: item.codigo, title: item.descricao, data: item.audio_data });
                                                                        setAudioPlayerOpen(true);
                                                                    }}
                                                                    className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors group/btn"
                                                                >
                                                                    <Volume2 className="w-3.5 h-3.5 text-rose-500 group-hover/btn:scale-110 transition-transform" title="Ouvir áudio" />
                                                                </button>
                                                            )}
                                                            {item.tags?.length > 0 && <Tag className="w-3.5 h-3.5 text-indigo-500" title="Possui etiquetas" />}
                                                            {!item.hasSketch && !item.hasAudio && (!item.tags || item.tags.length === 0) && (
                                                                <span className="text-slate-300 dark:text-slate-700">-</span>
                                                            )}
                                                        </div>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-6 bg-slate-50 dark:bg-slate-800/20 text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
                                    <AlertCircle className="w-3 h-3 text-amber-500" />
                                    Esta é uma visualização de arquivo. Use o botão "Restaurar" para editar estes dados.
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Modais de Mídia (Modo Visualização) */}
                <SketchModal
                    isOpen={sketchModalOpen}
                    onClose={() => setSketchModalOpen(false)}
                    item={activeSketchItem}
                    onSave={() => {}} // Não salva no histórico
                    readOnly={true}
                />

                <AudioPlayerModal
                    isOpen={audioPlayerOpen}
                    onClose={() => setAudioPlayerOpen(false)}
                    item={activeAudioItem}
                    readOnly={true}
                />
            </div>
        </div>
    );
};
