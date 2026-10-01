import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Truck,
    UploadCloud,
    FileSpreadsheet,
    Plus,
    Trash2,
    Download,
    Eye,
    ArrowLeft,
    CheckCircle2,
    Clock,
    Search,
    AlertCircle,
    Check,
    X,
    Building2,
    Files,
    AlertTriangle,
    Link,
    Filter,
    HelpCircle,
    RefreshCw,
    Cloud
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { cn } from '../utils';
import {
    Romaneio,
    RomaneioItem,
    getRomaneios,
    saveRomaneio,
    deleteRomaneio,
    exportRomaneioToExcel,
    parseMultipleExcelRomaneios,
    appendFilesToExistingRomaneio,
    linkRomaneioItemToStock,
    fetchAndSyncRomaneios
} from '../services/romaneioService';
import { getInventory, saveCloudCargaCodeMapping } from '../lib/supabase';
import { StockItem } from '../types';
import { getWheelPhotoUrl } from '../utils/photoUtils';

interface AdminRomaneioPanelProps {
    onBack: () => void;
}

export const AdminRomaneioPanel: React.FC<AdminRomaneioPanelProps> = ({ onBack }) => {
    const [romaneios, setRomaneios] = useState<Romaneio[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [selectedRomaneioForView, setSelectedRomaneioForView] = useState<Romaneio | null>(null);

    // Catálogo geral do estoque para a conferência e vínculos rápidos
    const [stockList, setStockList] = useState<StockItem[]>([]);

    // Estados do Formulário de Upload Multi-Planilhas
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [parsedData, setParsedData] = useState<{
        nomeSugerido: string;
        arquivosProcessados: string[];
        itensConsolidados: {
            id?: string;
            codigo: string;
            codigoOriginal?: string;
            descricao: string;
            quantidade: number;
            local: string;
            estoqueDb: number;
            isIdentified?: boolean;
            arquivosOrigem?: string[];
        }[];
        totalPecas: number;
        totalCodigos: number;
        totalIdentificados: number;
        totalNaoIdentificados: number;
    } | null>(null);

    // Filtro da Prévia ('all' | 'identified' | 'unidentified')
    const [previewFilterTab, setPreviewFilterTab] = useState<'all' | 'identified' | 'unidentified'>('all');

    // Estados do Modal de Conferência / Vínculo de Código
    const [linkingItemIndex, setLinkingItemIndex] = useState<number | null>(null);
    const [linkingSearchQuery, setLinkingSearchQuery] = useState('');
    const [linkingSavedViewItem, setLinkingSavedViewItem] = useState<{ itemId: string; rawCode: string; currentDesc: string } | null>(null);

    const [formTitulo, setFormTitulo] = useState('');
    const [formNumero, setFormNumero] = useState('');
    const [formDestino, setFormDestino] = useState('');

    // Anexar planilha a um romaneio existente
    const [targetRomaneioIdForAppend, setTargetRomaneioIdForAppend] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const appendFileInputRef = useRef<HTMLInputElement | null>(null);
    const [isSyncingCloud, setIsSyncingCloud] = useState(false);

    // Carregar romaneios e catálogo ao montar
    const loadList = () => {
        const list = getRomaneios();
        setRomaneios(list);
    };

    // Sincronizar com a nuvem (Supabase)
    const handleSyncCloud = async () => {
        setIsSyncingCloud(true);
        try {
            const list = await fetchAndSyncRomaneios();
            setRomaneios(list);
            toast.success('Sincronizado com a nuvem Supabase!', { id: 'cloud-sync-toast', duration: 2500 });
        } catch (e) {
            console.warn('Erro ao sincronizar com Supabase:', e);
            toast.error('Erro na sincronização com Supabase', { id: 'cloud-sync-toast' });
        } finally {
            setIsSyncingCloud(false);
        }
    };

    useEffect(() => {
        loadList();
        // Sincronizar dados mais recentes da nuvem na abertura
        handleSyncCloud();

        getInventory().then((data) => {
            if (data && Array.isArray(data)) {
                setStockList(data as StockItem[]);
            }
        }).catch(err => console.warn('Erro ao carregar catálogo para conferência:', err));

        const handleUpdate = () => loadList();
        window.addEventListener('mkr_romaneios_updated', handleUpdate);
        return () => window.removeEventListener('mkr_romaneios_updated', handleUpdate);
    }, []);

    // Processar múltiplos arquivos Excel para criar novo romaneio
    const handleFilesSelected = async (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;

        const files = Array.from(fileList);
        const validExts = ['.xlsx', '.xls', '.csv'];
        const validFiles = files.filter(f => validExts.some(ext => f.name.toLowerCase().endsWith(ext)));

        if (validFiles.length === 0) {
            toast.error('Selecione arquivos Excel (.xlsx, .xls) ou .csv válidos.');
            return;
        }

        setIsLoadingFiles(true);
        const toastId = toast.loading(`Lendo e cruzando ${validFiles.length} planilha(s) com o banco de dados...`);

        try {
            const result = await parseMultipleExcelRomaneios(validFiles);

            if (result.itensConsolidados.length === 0) {
                toast.error('Nenhum código e quantidade válidos foram identificados nas planilhas.', { id: toastId });
                return;
            }

            setSelectedFiles(validFiles);
            setParsedData(result);
            setFormTitulo(result.nomeSugerido);
            setFormNumero(`ROM-${new Date().getFullYear()}-${String(romaneios.length + 1).padStart(3, '0')}`);
            setFormDestino('');
            setPreviewFilterTab(result.totalNaoIdentificados > 0 ? 'unidentified' : 'all');

            if (result.totalNaoIdentificados > 0) {
                toast(
                    `Atenção: ${result.totalNaoIdentificados} código(s) não foram identificados automaticamente no banco. Você pode conferir e vincular antes de publicar.`,
                    { id: toastId, icon: '⚠️', duration: 5000 }
                );
            } else {
                toast.success(
                    `${result.totalCodigos} códigos consolidados (${result.totalPecas} peças)! 100% identificados no banco.`,
                    { id: toastId, duration: 4000 }
                );
            }
            setIsUploadModalOpen(true);
        } catch (error: any) {
            console.error('Erro ao ler planilhas:', error);
            toast.error(error.message || 'Erro ao processar planilhas Excel.', { id: toastId });
        } finally {
            setIsLoadingFiles(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Abrir modal de vínculo para um item na prévia de upload
    const handleOpenLinkModal = (index: number) => {
        if (!parsedData) return;
        const item = parsedData.itensConsolidados[index];
        setLinkingItemIndex(index);
        const initialSearch = (item.codigoOriginal || item.codigo).replace(/[-_]/g, ' ').trim();
        setLinkingSearchQuery(initialSearch);
    };

    // Confirmar vínculo de um item da prévia com uma roda do banco
    const handleConfirmLinkItem = async (selectedStock: StockItem) => {
        if (!parsedData || linkingItemIndex === null) return;

        const updatedItens = [...parsedData.itensConsolidados];
        const currentItem = updatedItens[linkingItemIndex];
        const rawCode = currentItem.codigoOriginal || currentItem.codigo;

        // Atualizar este item e quaisquer outros itens na mesma importação que compartilhem o mesmo código bruto
        updatedItens.forEach((it, idx) => {
            if ((it.codigoOriginal || it.codigo) === rawCode || idx === linkingItemIndex) {
                updatedItens[idx] = {
                    ...it,
                    codigo: selectedStock.codigo,
                    codigoOriginal: rawCode,
                    descricao: selectedStock.descricao,
                    local: selectedStock.local || 'SEM LOCAL',
                    estoqueDb: Number(selectedStock.quantidade) || 0,
                    isIdentified: true
                };
            }
        });

        // Salvar vínculo permanente no LocalStorage e Supabase
        const cleanRawCode = rawCode.trim().toUpperCase();
        if (cleanRawCode && cleanRawCode !== selectedStock.codigo.trim().toUpperCase()) {
            try {
                const saved = localStorage.getItem('@MK_WHEEL_CODE_MAPPINGS');
                const map = saved ? JSON.parse(saved) : {};
                map[cleanRawCode] = selectedStock.codigo;
                localStorage.setItem('@MK_WHEEL_CODE_MAPPINGS', JSON.stringify(map));
                await saveCloudCargaCodeMapping(cleanRawCode, selectedStock.codigo, selectedStock.descricao);
            } catch (err) {
                console.warn('Erro ao salvar mapeamento:', err);
            }
        }

        const totalIdentificados = updatedItens.filter(i => i.isIdentified).length;
        const totalNaoIdentificados = updatedItens.filter(i => !i.isIdentified).length;

        setParsedData({
            ...parsedData,
            itensConsolidados: updatedItens,
            totalIdentificados,
            totalNaoIdentificados
        });

        setLinkingItemIndex(null);
        setLinkingSearchQuery('');
        toast.success(`Código "${rawCode}" vinculado e salvo no Supabase para todos os aparelhos!`);
    };

    // Abrir modal de vínculo para um item em romaneio já salvo
    const handleOpenLinkSavedViewModal = (itemId: string, rawCode: string, currentDesc: string) => {
        setLinkingSavedViewItem({ itemId, rawCode, currentDesc });
        setLinkingSearchQuery(rawCode.replace(/[-_]/g, ' ').trim());
    };

    // Confirmar vínculo para romaneio já salvo
    const handleConfirmLinkSavedItem = async (selectedStock: StockItem) => {
        if (!selectedRomaneioForView || !linkingSavedViewItem) return;

        const updated = await linkRomaneioItemToStock(
            selectedRomaneioForView.id,
            linkingSavedViewItem.itemId,
            selectedStock,
            linkingSavedViewItem.rawCode
        );

        if (updated) {
            setSelectedRomaneioForView(updated);
            loadList();
            toast.success(`Item vinculado a "${selectedStock.codigo}" e sincronizado no Supabase!`);
        }
        setLinkingSavedViewItem(null);
        setLinkingSearchQuery('');
    };

    // Filtragem de produtos no catálogo para o modal de vínculo
    const filteredStockForLinking = useMemo(() => {
        if (!linkingSearchQuery.trim()) return stockList.slice(0, 40);
        const q = linkingSearchQuery.toLowerCase().trim();
        const tokens = q.split(/\s+/).filter(Boolean);

        return stockList.filter(s => {
            const code = (s.codigo || '').toLowerCase();
            const desc = (s.descricao || '').toLowerCase();
            const loc = (s.local || '').toLowerCase();
            return tokens.every(tok => code.includes(tok) || desc.includes(tok) || loc.includes(tok));
        }).slice(0, 50);
    }, [stockList, linkingSearchQuery]);

    // Filtragem da tabela de prévia por tab ('all' | 'identified' | 'unidentified')
    const previewItemsFiltered = useMemo(() => {
        if (!parsedData) return [];
        if (previewFilterTab === 'identified') {
            return parsedData.itensConsolidados.filter(i => i.isIdentified);
        }
        if (previewFilterTab === 'unidentified') {
            return parsedData.itensConsolidados.filter(i => !i.isIdentified);
        }
        return parsedData.itensConsolidados;
    }, [parsedData, previewFilterTab]);

    const linkingCurrentItemRawCode = linkingItemIndex !== null && parsedData
        ? (parsedData.itensConsolidados[linkingItemIndex].codigoOriginal || parsedData.itensConsolidados[linkingItemIndex].codigo)
        : linkingSavedViewItem ? linkingSavedViewItem.rawCode : '';

    const linkingCurrentItemRawDesc = linkingItemIndex !== null && parsedData
        ? parsedData.itensConsolidados[linkingItemIndex].descricao
        : linkingSavedViewItem ? linkingSavedViewItem.currentDesc : '';

    // Adicionar mais arquivos à pré-visualização atual
    const handleAddMoreFilesToPreview = async (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;
        const newFiles = Array.from(fileList);
        const allFiles = [...selectedFiles, ...newFiles];

        setIsLoadingFiles(true);
        const toastId = toast.loading(`Re-consolidando ${allFiles.length} planilhas...`);

        try {
            const result = await parseMultipleExcelRomaneios(allFiles);
            setSelectedFiles(allFiles);
            setParsedData(result);
            toast.success(`${allFiles.length} planilhas mescladas com sucesso!`, { id: toastId });
        } catch (err: any) {
            toast.error('Erro ao mesclar planilhas adicionais.', { id: toastId });
        } finally {
            setIsLoadingFiles(false);
        }
    };

    // Anexar arquivo a um romaneio existente já publicado
    const handleAppendFilesToExisting = async (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0 || !targetRomaneioIdForAppend) return;

        const files = Array.from(fileList);
        const toastId = toast.loading(`Anexando ${files.length} planilha(s) ao romaneio...`);

        try {
            const updated = await appendFilesToExistingRomaneio(targetRomaneioIdForAppend, files);
            if (updated) {
                toast.success(`Planilha anexada! Romaneio atualizado para ${updated.totalPecas} peças.`, { id: toastId });
                loadList();
                if (selectedRomaneioForView?.id === updated.id) {
                    setSelectedRomaneioForView(updated);
                }
            } else {
                toast.error('Romaneio não encontrado para atualização.', { id: toastId });
            }
        } catch (err: any) {
            toast.error(err.message || 'Erro ao anexar arquivo ao romaneio.', { id: toastId });
        } finally {
            setTargetRomaneioIdForAppend(null);
            if (appendFileInputRef.current) appendFileInputRef.current.value = '';
        }
    };

    // Confirmar e Salvar o Romaneio
    const handleConfirmImport = async () => {
        if (!parsedData) return;

        if (!formTitulo.trim()) {
            toast.error('Digite um título ou identificação para o romaneio');
            return;
        }

        setIsSaving(true);
        try {
            const saved = saveRomaneio({
                titulo: formTitulo,
                numero: formNumero,
                clienteOuDestino: formDestino,
                itens: parsedData.itensConsolidados,
                arquivos: parsedData.arquivosProcessados
            });

            toast.success(`Romaneio "${saved.titulo}" criado e salvo no Supabase! Visível em todos os dispositivos.`, { duration: 4500 });
            setIsUploadModalOpen(false);
            setParsedData(null);
            setSelectedFiles([]);
            loadList();
        } catch (error) {
            console.error('Erro ao salvar romaneio:', error);
            toast.error('Erro ao salvar romaneio');
        } finally {
            setIsSaving(false);
        }
    };

    // Excluir Romaneio
    const handleDelete = (id: string, titulo: string) => {
        if (window.confirm(`Tem certeza que deseja excluir o romaneio "${titulo}"?`)) {
            deleteRomaneio(id);
            toast.success('Romaneio excluído com sucesso.');
            loadList();
            if (selectedRomaneioForView?.id === id) {
                setSelectedRomaneioForView(null);
            }
        }
    };

    // Filtragem na busca
    const filteredRomaneios = romaneios.filter(r => {
        const q = searchTerm.toLowerCase();
        return (
            r.titulo.toLowerCase().includes(q) ||
            r.numero.toLowerCase().includes(q) ||
            (r.clienteOuDestino && r.clienteOuDestino.toLowerCase().includes(q))
        );
    });

    return (
        <div className="min-h-screen bg-[#F4F7FE] dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-4 sm:p-6 md:p-8 antialiased">
            <Toaster position="top-center" />

            {/* Input oculto para anexar a romaneio existente */}
            <input
                ref={appendFileInputRef}
                type="file"
                multiple
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={(e) => handleAppendFilesToExisting(e.target.files)}
            />

            <div className="max-w-6xl mx-auto space-y-6">
                {/* CABEÇALHO */}
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-[24px] border border-slate-200/80 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-3.5">
                        <button
                            onClick={onBack}
                            className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all active:scale-95"
                            title="Voltar ao Painel"
                        >
                            <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
                        </button>

                        <div className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20 shrink-0">
                            <Truck className="w-6 h-6 stroke-[2.2]" />
                        </div>

                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                                    Gestão de Romaneios (Admin)
                                </h1>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                                    <Cloud className="w-3 h-3" /> Supabase Nuvem
                                </span>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 font-medium">
                                Importe múltiplos arquivos Excel para a mesma carga e cruze com o estoque do banco
                            </p>
                        </div>
                    </div>

                    {/* Botão Sincronizar Nuvem e Botão Importar Excel */}
                    <div className="flex items-center gap-2.5 self-start sm:self-center flex-wrap">
                        <button
                            onClick={handleSyncCloud}
                            disabled={isSyncingCloud}
                            className="px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-xs sm:text-sm shadow-xs active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                            title="Sincronizar Romaneios e Vínculos com o Supabase"
                        >
                            <RefreshCw className={cn("w-4 h-4 text-emerald-500", isSyncingCloud && "animate-spin")} />
                            <span>{isSyncingCloud ? 'Sincronizando...' : 'Sincronizar Nuvem'}</span>
                        </button>

                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".xlsx, .xls, .csv"
                            className="hidden"
                            onChange={(e) => handleFilesSelected(e.target.files)}
                        />

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoadingFiles}
                            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-bold text-xs sm:text-sm shadow-lg shadow-rose-500/25 active:scale-95 transition-all flex items-center gap-2"
                        >
                            <UploadCloud className="w-4 h-4 stroke-[2.5]" />
                            <span>Importar Planilhas (Multi-Arquivos)</span>
                        </button>
                    </div>
                </header>

                {/* BARRA DE PESQUISA & ESTATÍSTICAS RÁPIDAS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 relative">
                        <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Buscar romaneio por título, número ou destino..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-13 pl-12 pr-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-rose-500 transition-all text-sm font-medium shadow-sm"
                        />
                    </div>

                    <div className="flex items-center justify-around bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl px-4 py-2 shadow-sm text-center">
                        <div>
                            <span className="block text-[11px] text-slate-400 font-bold uppercase">Total Cargas</span>
                            <span className="text-lg font-black text-slate-800 dark:text-slate-100">{romaneios.length}</span>
                        </div>
                        <div className="w-px h-8 bg-slate-100 dark:bg-slate-800" />
                        <div>
                            <span className="block text-[11px] text-slate-400 font-bold uppercase">Total Peças</span>
                            <span className="text-lg font-black text-rose-600 dark:text-rose-400">
                                {romaneios.reduce((acc, r) => acc + r.totalPecas, 0).toLocaleString('pt-BR')}
                            </span>
                        </div>
                    </div>
                </div>

                {/* LISTA DE ROMANEIOS IMPORTADOS */}
                {filteredRomaneios.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200/80 dark:border-slate-800 p-8 sm:p-12 text-center shadow-sm">
                        <div className="w-16 h-16 rounded-[22px] bg-rose-50 dark:bg-rose-950/30 text-rose-500 mx-auto flex items-center justify-center mb-4">
                            <FileSpreadsheet className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                            {searchTerm ? 'Nenhum romaneio encontrado para esta busca' : 'Nenhum romaneio cadastrado ainda'}
                        </h3>
                        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-md mx-auto">
                            Você pode selecionar 1, 2, 3 ou mais arquivos Excel de uma vez. O sistema irá juntar os itens da mesma carga e cruzar com o estoque do banco.
                        </p>
                        {!searchTerm && (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="mt-5 px-5 py-2.5 rounded-xl bg-rose-500 text-white font-bold text-sm shadow hover:bg-rose-600 transition-all inline-flex items-center gap-2"
                            >
                                <UploadCloud className="w-4 h-4" />
                                <span>Selecionar Arquivo(s) Excel</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredRomaneios.map((romaneio) => {
                            const percent = romaneio.totalPecas > 0
                                ? Math.round((romaneio.totalConferido / romaneio.totalPecas) * 100)
                                : 0;

                            const isConcluido = romaneio.status === 'concluido' || percent === 100;
                            const totalArquivos = (romaneio.arquivos || []).length;

                            return (
                                <motion.div
                                    key={romaneio.id}
                                    layout
                                    className="bg-white dark:bg-slate-900 rounded-[24px] p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                                >
                                    <div>
                                        {/* Topo do Card */}
                                        <div className="flex items-start justify-between gap-2 mb-3">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-full border border-rose-200/60 dark:border-rose-900/60">
                                                    {romaneio.numero}
                                                </span>
                                                {totalArquivos > 1 && (
                                                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-900/60 flex items-center gap-1">
                                                        <Files className="w-3 h-3" />
                                                        {totalArquivos} planilhas
                                                    </span>
                                                )}
                                            </div>

                                            <span className={cn(
                                                "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md",
                                                isConcluido
                                                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                                                    : romaneio.totalConferido > 0
                                                        ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
                                                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                            )}>
                                                {isConcluido ? 'Concluído' : romaneio.totalConferido > 0 ? 'Em Andamento' : 'Pendente'}
                                            </span>
                                        </div>

                                        <h3 className="font-bold text-slate-900 dark:text-white text-base mt-1 line-clamp-1">
                                            {romaneio.titulo}
                                        </h3>

                                        {/* Informações de Destino e Data */}
                                        <div className="space-y-1 my-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
                                            {romaneio.clienteOuDestino && (
                                                <div className="flex items-center gap-1.5 truncate">
                                                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                    <span className="truncate">{romaneio.clienteOuDestino}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span>
                                                    {new Date(romaneio.dataCriacao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Barra de Progresso */}
                                        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 mb-4">
                                            <div className="flex justify-between items-center text-xs mb-1.5 font-semibold">
                                                <span className="text-slate-600 dark:text-slate-300">
                                                    {romaneio.totalItens} códigos • {romaneio.totalPecas} peças
                                                </span>
                                                <span className={cn(
                                                    "font-bold",
                                                    isConcluido ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                                                )}>
                                                    {percent}%
                                                </span>
                                            </div>
                                            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className={cn(
                                                        "h-full rounded-full transition-all duration-500",
                                                        isConcluido ? "bg-emerald-500" : "bg-gradient-to-r from-rose-500 to-pink-600"
                                                    )}
                                                    style={{ width: `${Math.min(100, percent)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Ações do Card */}
                                    <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                                        <button
                                            onClick={() => setSelectedRomaneioForView(romaneio)}
                                            className="flex-1 py-2 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            <span>Ver Tabela</span>
                                        </button>

                                        {/* Botão Anexar mais uma planilha a esta carga */}
                                        <button
                                            onClick={() => {
                                                setTargetRomaneioIdForAppend(romaneio.id);
                                                appendFileInputRef.current?.click();
                                            }}
                                            className="py-2 px-2.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition flex items-center gap-1 border border-rose-200/60 dark:border-rose-900/60"
                                            title="Anexar mais uma planilha a esta carga"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span className="hidden sm:inline">+Planilha</span>
                                        </button>

                                        <button
                                            onClick={() => exportRomaneioToExcel(romaneio)}
                                            className="p-2 rounded-xl text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition"
                                            title="Exportar para Excel"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>

                                        <button
                                            onClick={() => handleDelete(romaneio.id, romaneio.titulo)}
                                            className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                                            title="Excluir Romaneio"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* MODAL DE CONFIRMAÇÃO / PREVIEW DO EXCEL MULTI-ARQUIVOS */}
            <AnimatePresence>
                {isUploadModalOpen && parsedData && (
                    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-slate-900 rounded-[28px] max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] flex flex-col"
                        >
                            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-500 flex items-center justify-center">
                                        <FileSpreadsheet className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-lg text-slate-900 dark:text-white">
                                            Consolidar & Publicar Romaneio
                                        </h3>
                                        <p className="text-xs text-slate-400 font-medium">
                                            {parsedData.arquivosProcessados.length} arquivo(s) mesclado(s) para esta carga
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsUploadModalOpen(false)}
                                    className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Formulário de Identificação */}
                            <div className="py-4 space-y-4 flex-1 overflow-y-auto">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Título / Nome do Romaneio *
                                        </label>
                                        <input
                                            type="text"
                                            value={formTitulo}
                                            onChange={(e) => setFormTitulo(e.target.value)}
                                            placeholder="Ex: Carga Filial SC - Lote 1"
                                            className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-rose-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Número / Identificador
                                        </label>
                                        <input
                                            type="text"
                                            value={formNumero}
                                            onChange={(e) => setFormNumero(e.target.value)}
                                            placeholder="Ex: ROM-2026-001"
                                            className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-rose-500"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Destino / Cliente / Transportadora
                                        </label>
                                        <input
                                            type="text"
                                            value={formDestino}
                                            onChange={(e) => setFormDestino(e.target.value)}
                                            placeholder="Ex: Filial SC, Rodonaves..."
                                            className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-rose-500"
                                        />
                                    </div>

                                    {/* Arquivos Anexados com opção de adicionar mais */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                                Planilhas Anexadas ({parsedData.arquivosProcessados.length})
                                            </label>
                                            <label className="text-[11px] font-bold text-rose-600 dark:text-rose-400 cursor-pointer hover:underline">
                                                + Adicionar outra
                                                <input
                                                    type="file"
                                                    multiple
                                                    accept=".xlsx, .xls, .csv"
                                                    className="hidden"
                                                    onChange={(e) => handleAddMoreFilesToPreview(e.target.files)}
                                                />
                                            </label>
                                        </div>
                                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                                            {parsedData.arquivosProcessados.map((fn, i) => (
                                                <span key={i} className="text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md truncate max-w-xs">
                                                    📄 {fn}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Resumo de Códigos, Peças e Status de Identificação */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                                        <span className="block text-[10px] font-bold uppercase text-slate-400">Códigos Únicos</span>
                                        <span className="text-lg font-black text-slate-800 dark:text-slate-100">
                                            {parsedData.totalCodigos}
                                        </span>
                                    </div>

                                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                                        <span className="block text-[10px] font-bold uppercase text-slate-400">Peças na Carga</span>
                                        <span className="text-lg font-black text-slate-800 dark:text-slate-100">
                                            {parsedData.totalPecas.toLocaleString('pt-BR')}
                                        </span>
                                    </div>

                                    <div className="p-3 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50">
                                        <span className="block text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Identificados</span>
                                        <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                                            {parsedData.totalIdentificados}
                                        </span>
                                    </div>

                                    <div className={cn(
                                        "p-3 rounded-2xl border transition-all",
                                        parsedData.totalNaoIdentificados > 0
                                            ? "bg-amber-500/10 dark:bg-amber-500/20 border-amber-300 dark:border-amber-700 shadow-xs"
                                            : "bg-slate-50 dark:bg-slate-800 border-slate-200/80 dark:border-slate-700"
                                    )}>
                                        <span className={cn(
                                            "block text-[10px] font-bold uppercase",
                                            parsedData.totalNaoIdentificados > 0 ? "text-amber-700 dark:text-amber-400" : "text-slate-400"
                                        )}>
                                            Não Identificados
                                        </span>
                                        <span className={cn(
                                            "text-lg font-black",
                                            parsedData.totalNaoIdentificados > 0 ? "text-amber-700 dark:text-amber-300 animate-pulse" : "text-slate-400"
                                        )}>
                                            {parsedData.totalNaoIdentificados}
                                        </span>
                                    </div>
                                </div>

                                {/* Banner de Aviso se houver códigos não identificados */}
                                {parsedData.totalNaoIdentificados > 0 && (
                                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-800/80 rounded-2xl flex items-center justify-between gap-3 text-xs">
                                        <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200 font-semibold">
                                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                            <span>
                                                <strong>{parsedData.totalNaoIdentificados} código(s)</strong> da planilha não foram reconhecidos no banco. Clique em <strong>Vincular Roda</strong> para associá-los e memorizar o vínculo!
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setPreviewFilterTab('unidentified')}
                                            className="px-2.5 py-1 rounded-xl bg-amber-500 text-white font-bold text-[11px] shrink-0 hover:bg-amber-600 transition"
                                        >
                                            Ver Pendentes
                                        </button>
                                    </div>
                                )}

                                {/* Barra de Filtros da Prévia */}
                                <div className="flex items-center justify-between gap-2 pt-1">
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                        Itens ({previewItemsFiltered.length} de {parsedData.totalCodigos}):
                                    </span>

                                    <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
                                        <button
                                            type="button"
                                            onClick={() => setPreviewFilterTab('all')}
                                            className={cn(
                                                "px-2.5 py-1 rounded-lg transition",
                                                previewFilterTab === 'all'
                                                    ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs"
                                                    : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                                            )}
                                        >
                                            Todos ({parsedData.totalCodigos})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPreviewFilterTab('identified')}
                                            className={cn(
                                                "px-2.5 py-1 rounded-lg transition flex items-center gap-1",
                                                previewFilterTab === 'identified'
                                                    ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
                                                    : "text-slate-500 hover:text-emerald-600"
                                            )}
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            Identificados ({parsedData.totalIdentificados})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPreviewFilterTab('unidentified')}
                                            className={cn(
                                                "px-2.5 py-1 rounded-lg transition flex items-center gap-1",
                                                previewFilterTab === 'unidentified'
                                                    ? "bg-amber-500 text-white shadow-xs"
                                                    : parsedData.totalNaoIdentificados > 0
                                                        ? "text-amber-600 font-bold animate-pulse"
                                                        : "text-slate-500 hover:text-slate-800"
                                            )}
                                        >
                                            <AlertTriangle className="w-3.5 h-3.5" />
                                            Não Identificados ({parsedData.totalNaoIdentificados})
                                        </button>
                                    </div>
                                </div>

                                {/* Tabela Prévia Completa com Botão de Vínculo */}
                                <div>
                                    <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50 dark:bg-slate-800/90 sticky top-0 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 z-10">
                                                <tr>
                                                    <th className="p-2.5">Código</th>
                                                    <th className="p-2.5">Descrição</th>
                                                    <th className="p-2.5 text-center">Qtd Romaneio</th>
                                                    <th className="p-2.5 text-center">Local</th>
                                                    <th className="p-2.5 text-center">Estoque Banco</th>
                                                    <th className="p-2.5 text-center">Conferência / Vínculo</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                                                {previewItemsFiltered.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} className="p-6 text-center text-slate-400 text-xs">
                                                            Nenhum item nesta visualização.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    previewItemsFiltered.map((it) => {
                                                        const saldoInsuficiente = it.quantidade > it.estoqueDb;
                                                        // Encontrar índice real no array original
                                                        const realIdx = parsedData.itensConsolidados.findIndex(p => p.codigo === it.codigo && p.descricao === it.descricao);
                                                        const photoUrl = getWheelPhotoUrl(it.descricao, it.codigo);

                                                        return (
                                                            <tr
                                                                key={it.id || `${it.codigo}_${it.descricao}`}
                                                                className={cn(
                                                                    "transition-colors",
                                                                    !it.isIdentified
                                                                        ? "bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50/70 dark:hover:bg-amber-950/30"
                                                                        : "hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                                                                )}
                                                            >
                                                                <td className="p-2.5 font-bold font-mono text-slate-900 dark:text-white">
                                                                    <div className="flex flex-col">
                                                                        <span>{it.codigo}</span>
                                                                        {it.codigoOriginal && it.codigoOriginal !== it.codigo && (
                                                                            <span className="text-[10px] text-slate-400 font-normal">
                                                                                orig: {it.codigoOriginal}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="p-2.5 max-w-[220px]">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 overflow-hidden flex items-center justify-center p-0.5 shadow-2xs">
                                                                            <img
                                                                                src={photoUrl}
                                                                                alt={it.descricao}
                                                                                className="w-full h-full object-contain"
                                                                                onError={(e) => {
                                                                                    (e.target as HTMLImageElement).src = '/logo 2.svg';
                                                                                }}
                                                                            />
                                                                        </div>
                                                                        <span className="truncate block font-semibold text-slate-800 dark:text-slate-100">
                                                                            {it.descricao || '—'}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="p-2.5 text-center font-black text-rose-600 dark:text-rose-400">
                                                                    {it.quantidade}
                                                                </td>
                                                                <td className="p-2.5 text-center">
                                                                    <span className={cn(
                                                                        "px-2 py-0.5 rounded-md font-mono text-[11px] font-bold",
                                                                        it.local && it.local !== 'N/A' && it.local !== 'SEM LOCAL'
                                                                            ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                                                                            : "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
                                                                    )}>
                                                                        {it.local || 'SEM LOCAL'}
                                                                    </span>
                                                                </td>
                                                                <td className="p-2.5 text-center">
                                                                    <span className={cn(
                                                                        "px-2 py-0.5 rounded-md font-bold text-[11px] inline-flex items-center gap-1",
                                                                        saldoInsuficiente
                                                                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                                                            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                                                    )}>
                                                                        {saldoInsuficiente && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                                                                        {it.estoqueDb} un
                                                                    </span>
                                                                </td>
                                                                <td className="p-2.5 text-center whitespace-nowrap">
                                                                    {it.isIdentified ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleOpenLinkModal(realIdx)}
                                                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 font-bold text-[11px] transition"
                                                                            title="Identificado. Clique se quiser trocar o vínculo."
                                                                        >
                                                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                                            <span>OK • Trocar</span>
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleOpenLinkModal(realIdx)}
                                                                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs active:scale-95 transition"
                                                                        >
                                                                            <Search className="w-3.5 h-3.5" />
                                                                            <span>Vincular Roda</span>
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Botões do Modal */}
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5">
                                <button
                                    onClick={() => setIsUploadModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirmImport}
                                    disabled={isSaving}
                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white text-sm font-bold shadow-md shadow-rose-500/25 hover:from-rose-600 hover:to-pink-700 active:scale-95 transition flex items-center gap-2"
                                >
                                    <Check className="w-4 h-4 stroke-[2.5]" />
                                    <span>{isSaving ? 'Salvando...' : 'Confirmar e Publicar na Home'}</span>
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* MODAL DE VISUALIZAÇÃO DE TABELA COMPLETA DO ROMANEIO */}
            <AnimatePresence>
                {selectedRomaneioForView && (
                    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-slate-900 rounded-[28px] max-w-5xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] flex flex-col"
                        >
                            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 px-2.5 py-0.5 rounded-md">
                                            {selectedRomaneioForView.numero}
                                        </span>
                                        <h3 className="font-black text-xl text-slate-900 dark:text-white">
                                            {selectedRomaneioForView.titulo}
                                        </h3>
                                    </div>
                                    <p className="text-xs text-slate-400 font-medium mt-1">
                                        {selectedRomaneioForView.totalItens} códigos distintos • {selectedRomaneioForView.totalPecas} peças na carga • {selectedRomaneioForView.totalConferido} conferidas
                                        {selectedRomaneioForView.arquivos?.length > 1 && ` • (${selectedRomaneioForView.arquivos.length} planilhas mescladas)`}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => exportRomaneioToExcel(selectedRomaneioForView)}
                                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5 text-xs font-bold"
                                        title="Baixar Planilha"
                                    >
                                        <Download className="w-4 h-4" />
                                        <span>Exportar</span>
                                    </button>
                                    <button
                                        onClick={() => setSelectedRomaneioForView(null)}
                                        className="p-2.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Tabela com as 5 Colunas Solicitadas + Conferido */}
                            <div className="flex-1 overflow-y-auto my-4 rounded-xl border border-slate-200 dark:border-slate-800">
                                <table className="w-full text-left text-xs sm:text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                                        <tr>
                                            <th className="p-3">Código</th>
                                            <th className="p-3">Descrição</th>
                                            <th className="p-3 text-center">Qtd Carga</th>
                                            <th className="p-3 text-center">Conferido</th>
                                            <th className="p-3 text-center">Local</th>
                                            <th className="p-3 text-center">Estoque (Banco)</th>
                                            <th className="p-3 text-center">Vínculo</th>
                                            <th className="p-3 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                                        {selectedRomaneioForView.itens.map((it) => {
                                            const isDone = it.conferido >= it.quantidade;
                                            const saldoInsuficiente = it.quantidade > it.estoqueDb;
                                            const hasValidLink = it.isIdentified || (it.local && it.local !== 'N/A' && it.local !== 'SEM LOCAL');

                                            return (
                                                <tr key={it.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                                    <td className="p-3 font-bold font-mono text-slate-900 dark:text-white">
                                                        <div className="flex flex-col">
                                                            <span>{it.codigo}</span>
                                                            {it.codigoOriginal && it.codigoOriginal !== it.codigo && (
                                                                <span className="text-[10px] text-slate-400 font-normal">
                                                                    orig: {it.codigoOriginal}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-xs text-slate-500 dark:text-slate-400 max-w-[200px] truncate">
                                                        {it.descricao || '—'}
                                                    </td>
                                                    <td className="p-3 text-center font-black text-rose-600 dark:text-rose-400">
                                                        {it.quantidade}
                                                    </td>
                                                    <td className="p-3 text-center font-bold text-slate-800 dark:text-slate-200">
                                                        {it.conferido}
                                                    </td>
                                                    <td className="p-3 text-center text-xs">
                                                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-slate-600 dark:text-slate-300 font-bold">
                                                            {it.local || 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center text-xs">
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded-md font-bold inline-flex items-center gap-1",
                                                            saldoInsuficiente
                                                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                                                : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                                        )}>
                                                            {saldoInsuficiente && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                                                            {it.estoqueDb} un
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center whitespace-nowrap">
                                                        {hasValidLink ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenLinkSavedViewModal(it.id, it.codigoOriginal || it.codigo, it.descricao)}
                                                                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                                                                title="Trocar produto vinculado"
                                                            >
                                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                                <span>OK</span>
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenLinkSavedViewModal(it.id, it.codigoOriginal || it.codigo, it.descricao)}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] shadow-2xs active:scale-95 transition"
                                                            >
                                                                <Search className="w-3 h-3" />
                                                                <span>Vincular</span>
                                                            </button>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <span className={cn(
                                                            "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full",
                                                            isDone
                                                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                                                                : it.conferido > 0
                                                                    ? "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
                                                                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                                        )}>
                                                            {isDone ? 'Conferido' : it.conferido > 0 ? 'Parcial' : 'Pendente'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                                <button
                                    onClick={() => setSelectedRomaneioForView(null)}
                                    className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs"
                                >
                                    Fechar
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* MODAL DE VÍNCULO E CONFERÊNCIA DE CÓDIGO (BANCO MK) */}
            <AnimatePresence>
                {(linkingItemIndex !== null || linkingSavedViewItem !== null) && (
                    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="bg-white dark:bg-slate-900 rounded-[28px] max-w-2xl w-full p-5 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                        <Search className="w-5 h-5 stroke-[2.2]" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-lg text-slate-900 dark:text-white leading-tight">
                                            Conferência e Vínculo de Código
                                        </h3>
                                        <p className="text-xs text-slate-400 font-medium">
                                            Associe o item da planilha ao produto oficial do banco MK
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setLinkingItemIndex(null);
                                        setLinkingSavedViewItem(null);
                                        setLinkingSearchQuery('');
                                    }}
                                    className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Card com os dados que vieram na Planilha */}
                            <div className="my-3.5 p-3.5 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-300/40 dark:border-amber-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <span className="block text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 tracking-wider">
                                        ITEM NÃO IDENTIFICADO NA PLANILHA
                                    </span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                                            {linkingCurrentItemRawCode}
                                        </span>
                                        <span className="text-xs text-slate-600 dark:text-slate-300 truncate font-semibold">
                                            • {linkingCurrentItemRawDesc}
                                        </span>
                                    </div>
                                </div>
                                <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-200/60 dark:bg-amber-900/60 px-2.5 py-1 rounded-lg shrink-0 text-center">
                                    Memória permanente ativa
                                </span>
                            </div>

                            {/* Campo de Busca em Tempo Real no Banco MK */}
                            <div className="relative mb-3">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Buscar produto no banco por código, aro, modelo ou descrição..."
                                    value={linkingSearchQuery}
                                    onChange={(e) => setLinkingSearchQuery(e.target.value)}
                                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                                />
                                {linkingSearchQuery && (
                                    <button
                                        onClick={() => setLinkingSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Lista de Resultados de Produtos do Banco */}
                            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px] max-h-[360px]">
                                {filteredStockForLinking.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 text-xs font-medium border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                                        Nenhuma roda encontrada com os termos digitados. Tente buscar pelo aro (ex: 15) ou modelo (ex: K72, R99).
                                    </div>
                                ) : (
                                    filteredStockForLinking.map((stockItem) => {
                                        const photoUrl = getWheelPhotoUrl(stockItem.descricao, stockItem.codigo);

                                        return (
                                            <div
                                                key={stockItem.codigo}
                                                className="p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-500 bg-white dark:bg-slate-900/80 hover:bg-amber-50/30 dark:hover:bg-amber-950/20 transition-all flex items-center justify-between gap-3 shadow-2xs group"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 overflow-hidden flex items-center justify-center p-0.5 shadow-xs">
                                                        <img
                                                            src={photoUrl}
                                                            alt={stockItem.descricao}
                                                            className="w-full h-full object-contain"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).src = '/logo 2.svg';
                                                            }}
                                                        />
                                                    </div>

                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono font-black text-xs text-slate-900 dark:text-white">
                                                                {stockItem.codigo}
                                                            </span>
                                                            <span className="font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                                                                {stockItem.local || 'SEM LOCAL'}
                                                            </span>
                                                        </div>
                                                        <h5 className="font-bold text-slate-700 dark:text-slate-200 text-xs leading-tight truncate mt-0.5">
                                                            {stockItem.descricao}
                                                        </h5>
                                                        <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                                                            Estoque: {stockItem.quantidade || 0} un
                                                        </span>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => {
                                                        if (linkingItemIndex !== null) {
                                                            handleConfirmLinkItem(stockItem);
                                                        } else if (linkingSavedViewItem) {
                                                            handleConfirmLinkSavedItem(stockItem);
                                                        }
                                                    }}
                                                    className="shrink-0 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs active:scale-95 transition flex items-center gap-1.5"
                                                >
                                                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                                    <span>Vincular</span>
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Footer */}
                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                                <button
                                    onClick={() => {
                                        setLinkingItemIndex(null);
                                        setLinkingSavedViewItem(null);
                                        setLinkingSearchQuery('');
                                    }}
                                    className="px-4 py-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition"
                                >
                                    Fechar sem vincular
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
