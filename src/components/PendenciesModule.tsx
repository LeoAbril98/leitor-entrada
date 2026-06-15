import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { ArrowLeft, ClipboardList, Pencil, Search, Filter, Trash2, Archive, X, FileSpreadsheet, Plus, Tag, PenTool, Mic, Volume2, Play, Square, AlertTriangle, Upload, CloudUpload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    getInventory, 
    loadPedidosFabrica, 
    upsertPedidoFabrica, 
    archiveAndClearPedidos, 
    syncPendenciasToCloud, 
    getPendenciasInventory, 
    clearPendenciasInventory,
    getItemTags, 
    saveItemTags,
    saveCloudSketch,
    deleteCloudSketch,
    saveCloudAudio,
    deleteCloudAudio,
    getCloudSketch,
    getCloudAudio,
    getAllCloudSketches,
    getAllCloudAudios,
    getGlobalTags,
    getLastUpdate,
    USE_LOCAL_DB
} from '../lib/supabase';
import { StockItem } from '../types';
import { PendencyQuantityModal } from './PendencyQuantityModal';
import { cn } from '../utils';
import photoMap from '../data/photoMap.json';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { getWheelPhotoUrl, getModelAndFinish } from '../utils/photoUtils';
import { SketchModal } from './SketchModal';
import { AudioRecorderModal } from './AudioRecorderModal';
import { AudioPlayerModal } from './AudioPlayerModal';
import { WelcomeModal } from './WelcomeModal';
import { OnboardingTour } from './OnboardingTour';
import { saveSketch, getSketch, getAllSketches, deleteSketch, saveAudio, getAudio, getAllAudioKeys, deleteAudio } from '../lib/sketchStore';
import {
    getPendingPedidoCount,
    loadPendingPedidos,
    mergePendingPedidosIntoState,
    queuePendingPedido,
    removePendingPedido,
    clearPendingPedidos
} from '../lib/offlinePedidoQueue';

interface PendenciesModuleProps {
    onBackToMenu: () => void;
    isAdmin?: boolean;
}

export const PendenciesModule: React.FC<PendenciesModuleProps> = ({ onBackToMenu, isAdmin = false }) => {
    const [stock, setStock] = useState<StockItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUploadDate, setLastUploadDate] = useState<string | null>(null);

    type FactoryName = 'MK' | 'MOLERI' | 'CM' | 'OLIMPO';
    const emptyFactoryPendencies: Record<FactoryName, number> = { MK: 0, MOLERI: 0, CM: 0, OLIMPO: 0 };
    const [pendencies, setPendencies] = useState<Record<string, Record<FactoryName, number>>>({});
    const [pendingSyncCount, setPendingSyncCount] = useState(0);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalConfig, setModalConfig] = useState<{
        item: StockItem | null;
        factory: FactoryName;
        currentQty: number;
        stockQty: number;
        pendencyQty: number;
        photoUrl?: string;
    }>({ item: null, factory: 'MK', currentQty: 0, stockQty: 0, pendencyQty: 0, photoUrl: '' });

    // Export Modal State
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isExportLoading, setIsExportLoading] = useState(false);
    const [isClearWeekModalOpen, setIsClearWeekModalOpen] = useState(false);
    const [isClearingWeek, setIsClearingWeek] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isSyncingCloud, setIsSyncingCloud] = useState(false);
    const [tempProcessedData, setTempProcessedData] = useState<StockItem[]>([]);
    const [importedFileName, setImportedFileName] = useState('');
    const [expandedMobileCode, setExpandedMobileCode] = useState<string | null>(null);

    // Scroll Ref
    const tableContainerRef = React.useRef<HTMLDivElement>(null);

    // Tags State
    const [itemTags, setItemTags] = useState<Record<string, string[]>>({});
    const [tagMenuOpen, setTagMenuOpen] = useState<string | null>(null); // Codigo do item com menu aberto
    const [customTagInput, setCustomTagInput] = useState("");
    const quickTags = ['VÍDEO', 'PEDIR', 'FOTO', 'WILLIAM', 'SP'];

    const handleToggleTag = async (codigo: string, tag: string) => {
        const currentTags = itemTags[codigo] || [];
        const newTags = currentTags.includes(tag)
            ? currentTags.filter(t => t !== tag)
            : [...currentTags, tag];

        const newTagsMap = { ...itemTags, [codigo]: newTags };
        setItemTags(newTagsMap);
        await saveItemTags(newTagsMap);

        if (!currentTags.includes(tag)) {
            toast.success(`Etiqueta "${tag}" adicionada`, { icon: '🏷️', duration: 1500 });
        }
    };

    const handleAddCustomTag = async (codigo: string) => {
        const val = customTagInput.trim().toUpperCase();
        if (!val) return;

        await handleToggleTag(codigo, val);
        setCustomTagInput("");
        setTagMenuOpen(null);
    };

    const loadTags = async () => {
        const tags = await getItemTags();
        setItemTags(tags);
    };

    // Sketch State
    const [sketches, setSketches] = useState<Record<string, string>>({});
    const [sketchModalOpen, setSketchModalOpen] = useState(false);
    const [activeSketchItem, setActiveSketchItem] = useState<{ codigo: string, title: string } | null>(null);

    const loadSketches = async () => {
        // 1. Carregar Local
        const localData = await getAllSketches();
        
        // 2. Carregar Nuvem e mesclar (Nuvem manda se não houver local ou for mais novo)
        const cloudData = await getAllCloudSketches();
        const merged = { ...cloudData, ...localData };
        
        setSketches(merged);
        
        // Opcional: Salvar o que veio da nuvem no local para cache futuro
        for (const [codigo, dataUrl] of Object.entries(cloudData)) {
            if (!localData[codigo]) await saveSketch(codigo, dataUrl as string);
        }
    };

    const handleSaveSketch = async (dataUrl: string) => {
        if (activeSketchItem) {
            // 1. Salvar no IndexedDB (Cache Instantâneo)
            await saveSketch(activeSketchItem.codigo, dataUrl);
            setSketches(prev => ({ ...prev, [activeSketchItem.codigo]: dataUrl }));
            
            // 2. Sincronizar com a Nuvem (Background)
            saveCloudSketch(activeSketchItem.codigo, dataUrl).then(success => {
                if (!success) console.warn("Falha ao sincronizar rascunho com a nuvem.");
            });

            toast.success("Desenho salvo (Sincronizado na nuvem!)", { icon: '🖋️' });
        }
    };

    const handleDeleteSketch = async () => {
        if (activeSketchItem) {
            await deleteSketch(activeSketchItem.codigo);
            await deleteCloudSketch(activeSketchItem.codigo);
            setSketches(prev => {
                const next = { ...prev };
                delete next[activeSketchItem.codigo];
                return next;
            });
            toast.success("Post-it removido local e nuvem!");
        }
    };

    // Audio State
    const [audios, setAudios] = useState<Record<string, string>>({}); // codigo -> blobUrl
    const [audioModalOpen, setAudioModalOpen] = useState(false);
    const [audioPlayerOpen, setAudioPlayerOpen] = useState(false);
    const [activeAudioItem, setActiveAudioItem] = useState<{ codigo: string, title: string } | null>(null);

    const loadAudios = async () => {
        // 1. Chaves locais
        const localKeys = await getAllAudioKeys();
        const urls: Record<string, string> = {};
        
        for (const key of localKeys) {
            const blob = await getAudio(key);
            if (blob) urls[key] = URL.createObjectURL(blob);
        }

        // 2. Buscar da Nuvem o que não tem no local
        const cloudAudios = await getAllCloudAudios(); // Record<codigo, base64>
        for (const [codigo, base64] of Object.entries(cloudAudios)) {
            if (!urls[codigo]) {
                const blob = base64ToBlob(base64 as string);
                await saveAudio(codigo, blob); // Salva no cache local
                urls[codigo] = URL.createObjectURL(blob);
            }
        }

        setAudios(urls);
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

    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    };

    const handleSaveAudio = async (blob: Blob) => {
        if (activeAudioItem) {
            // 1. Salvar localmente
            await saveAudio(activeAudioItem.codigo, blob);
            const url = URL.createObjectURL(blob);
            setAudios(prev => ({ ...prev, [activeAudioItem.codigo]: url }));
            
            // 2. Sincronizar com Nuvem (Base64)
            const base64 = await blobToBase64(blob);
            saveCloudAudio(activeAudioItem.codigo, base64).then(success => {
                 if (!success) console.warn("Falha ao sincronizar áudio com a nuvem.");
            });

            toast.success("Áudio salvo e sincronizado!", { icon: '🎙️' });
        }
    };

    const handleDeleteAudio = async (codigo: string) => {
        if (window.confirm("Deseja apagar este áudio (Remoção Total)?")) {
            await deleteAudio(codigo);
            await deleteCloudAudio(codigo);
            setAudios(prev => {
                const next = { ...prev };
                delete next[codigo];
                return next;
            });
            toast.success("Áudio removido local e nuvem.");
        }
    };

    const openModal = (item: StockItem, factory: FactoryName) => {
        const currentQty = pendencies[item.codigo]?.[factory] || 0;

        let stockQty = 0;
        let pendencyQty = 0;

        switch (factory) {
            case 'MK':
                stockQty = item.est_mk || 0;
                pendencyQty = item.pend_mk || 0;
                break;
            case 'MOLERI':
                stockQty = item.est_moleri || 0;
                pendencyQty = item.pend_moleri || 0;
                break;
            case 'CM':
                stockQty = item.est_cm || 0;
                pendencyQty = item.pend_cm || 0;
                break;
            case 'OLIMPO':
                stockQty = item.est_olimpo || 0;
                pendencyQty = item.pend_olimpo || 0;
                break;
        }

        const photoUrl = getWheelPhotoUrl(item.descricao);

        setModalConfig({ item, factory, currentQty, stockQty, pendencyQty, photoUrl });
        setIsModalOpen(true);
    };

    const handleConfirmQty = async (newQty: number): Promise<boolean> => {
        if (!modalConfig.item) return false;
        const { codigo } = modalConfig.item;
        const { factory } = modalConfig;

        queuePendingPedido(codigo, factory, newQty);
        setPendingSyncCount(getPendingPedidoCount());

        setPendencies(prev => {
            const itemPendencies = prev[codigo] || emptyFactoryPendencies;
            return {
                ...prev,
                [codigo]: {
                    ...itemPendencies,
                    [factory]: newQty
                }
            };
        });

        if (!USE_LOCAL_DB && typeof navigator !== 'undefined' && !navigator.onLine) {
            toast.error('Sem internet. Alteração salva neste aparelho e pendente de sincronização.', { duration: 6000 });
            return true;
        }

        const success = await upsertPedidoFabrica(codigo, factory, newQty);
        if (success) {
            removePendingPedido(codigo, factory);
            setPendingSyncCount(getPendingPedidoCount());
            return true;
        }

        toast.error(`Falha ao enviar para a nuvem. Alteração salva neste aparelho e pendente de sincronização.`, { duration: 6000 });
        return true;
    };

    const handleClearAll = async () => {
        setIsClearWeekModalOpen(true);
    };

    const syncPendingPedidos = async (showSuccessToast = false) => {
        const pendingRows = loadPendingPedidos();
        if (pendingRows.length === 0) {
            setPendingSyncCount(0);
            return 0;
        }

        if (!USE_LOCAL_DB && typeof navigator !== 'undefined' && !navigator.onLine) {
            setPendingSyncCount(pendingRows.length);
            return 0;
        }

        let syncedCount = 0;
        for (const row of pendingRows) {
            const success = await upsertPedidoFabrica(row.codigo, row.factory, row.quantidade);
            if (success) {
                removePendingPedido(row.codigo, row.factory);
                syncedCount += 1;
            }
        }

        const remainingCount = getPendingPedidoCount();
        setPendingSyncCount(remainingCount);

        if (syncedCount > 0 && remainingCount === 0 && showSuccessToast) {
            toast.success('Alterações enviadas para a nuvem com sucesso.', { duration: 4000 });
        }

        return syncedCount;
    };

    const executeClearWeek = async () => {
        setIsClearingWeek(true);
        const loadingToast = toast.loading("Arquivando e limpando lista...");

        try {
            const success = await archiveAndClearPedidos();
            const inventoryCleared = await clearPendenciasInventory();
            if (success && inventoryCleared) {
                setPendencies({});
                setStock([]);
                setLastUploadDate(null);
                clearPendingPedidos();
                setPendingSyncCount(0);
                localStorage.removeItem('inventory_cache');
                setIsClearWeekModalOpen(false);
                toast.success("Lista, estoque e pendência arquivados/zerados com sucesso! Pronto para nova semana.", { id: loadingToast });
            } else {
                toast.error("Erro ao zerar semana. Tente novamente.", { id: loadingToast });
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro ao zerar semana. Tente novamente.", { id: loadingToast });
        } finally {
            setIsClearingWeek(false);
        }
    };

    const handleExport = () => {
        if (stock.length === 0) {
            toast.error("Não há dados para exportar.");
            return;
        }
        setIsExportModalOpen(true);
    };

    const executeExport = async () => {
        setIsExportLoading(true);
        const loadingToast = toast.loading("Gerando planilha estilizada...");

        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Pendências');

            // 1. Configurar Página para Impressão
            worksheet.pageSetup = {
                orientation: 'landscape',
                paperSize: 9, // A4
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0,
                margins: {
                    left: 0.3,
                    right: 0.3,
                    top: 0.3,
                    bottom: 0.3,
                    header: 0.1,
                    footer: 0.1
                },
                printTitlesRow: '1:2', // Repetir Título + Cabeçalho em todas as páginas
                printArea: `B1:P${stock.length + 3}` // Excluir coluna A e incluir Título e Totais
            };

            // 2. Definir Colunas
            worksheet.columns = [
                { header: 'CATÁLOGO', key: 'codigo', width: 22 },
                { header: 'DESCRIÇÃO', key: 'descricao', width: 40 },
                { header: 'QTDE MIN', key: 'qtd_min', width: 10 },
                { header: 'PREÇO FÁBRICA', key: 'preco', width: 15 },
                
                { header: 'EST. MK', key: 'est_mk', width: 9 },
                { header: 'PEND MK', key: 'pend_mk', width: 9 },
                { header: 'MK', key: 'order_mk', width: 9 },
                
                { header: 'EST. MOLERI', key: 'est_moleri', width: 9 },
                { header: 'PEND MOLERI', key: 'pend_moleri', width: 9 },
                { header: 'MOLERI', key: 'order_moleri', width: 9 },
                
                { header: 'EST. CM', key: 'est_cm', width: 9 },
                { header: 'PEND CM', key: 'pend_cm', width: 9 },
                { header: 'CM', key: 'order_cm', width: 9 },
                
                { header: 'EST. OLIMPO', key: 'est_olimpo', width: 9 },
                { header: 'PEND OLIMPO', key: 'pend_olimpo', width: 9 },
                { header: 'OLIMPO', key: 'order_olimpo', width: 9 },
                { header: 'ETIQUETAS', key: 'tags', width: 25 },
                { header: 'TEM ÁUDIO?', key: 'has_audio', width: 15 },
                { header: 'TEM POST-IT?', key: 'has_sketch', width: 15 }
            ];

            // 3. Adicionar Título no Topo
            worksheet.spliceRows(1, 0, []); // Insere linha em branco no topo
            const titleRow = worksheet.getRow(1);
            titleRow.height = 40;
            worksheet.mergeCells('B1:P1');
            const titleCell = worksheet.getCell('B1');
            const today = new Date().toLocaleDateString('pt-BR').split('/').join(' ');
            titleCell.value = `PEDIDO MK /SC/SP/RS ${today}`;
            titleCell.font = { bold: true, italic: true, size: 14 };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

            // 4. Estilizar Cabeçalho (Agora na Linha 2)
            const headerRow = worksheet.getRow(2);
            headerRow.height = 35;
            headerRow.eachCell((cell, colNumber) => {
                let bgColor = 'FFE0E0E0'; // Cinza Padrão solicitado

                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: bgColor }
                };
                cell.font = { bold: true, size: 11, color: { argb: 'FF000000' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF000000' } },
                    left: { style: 'thin', color: { argb: 'FF000000' } },
                    bottom: { style: 'thin', color: { argb: 'FF000000' } },
                    right: { style: 'thin', color: { argb: 'FF000000' } }
                };
            });

            // 4. Adicionar Dados
            stock.forEach((item) => {
                const itemPends = pendencies[item.codigo] || { MK: 0, MOLERI: 0, CM: 0, OLIMPO: 0 };
                const row = worksheet.addRow({
                    codigo: item.codigo,
                    descricao: item.descricao,
                    qtd_min: 0,
                    preco: item.preco || 0,
                    est_mk: item.est_mk || 0,
                    pend_mk: item.pend_mk || 0,
                    order_mk: itemPends.MK || 0,
                    est_moleri: item.est_moleri || 0,
                    pend_moleri: item.pend_moleri || 0,
                    order_moleri: itemPends.MOLERI || 0,
                    est_cm: item.est_cm || 0,
                    pend_cm: item.pend_cm || 0,
                    order_cm: itemPends.CM || 0,
                    est_olimpo: item.est_olimpo || 0,
                    pend_olimpo: item.pend_olimpo || 0,
                    order_olimpo: itemPends.OLIMPO || 0,
                    tags: (itemTags[item.codigo] || []).join(', '),
                    has_audio: audios[item.codigo] ? 'SIM' : 'NÃO',
                    has_sketch: sketches[item.codigo] ? 'SIM' : 'NÃO'
                });

                row.height = 25;
                row.eachCell((cell, colNumber) => {
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FF000000' } },
                        left: { style: 'thin', color: { argb: 'FF000000' } },
                        bottom: { style: 'thin', color: { argb: 'FF000000' } },
                        right: { style: 'thin', color: { argb: 'FF000000' } }
                    };
                    cell.font = { size: 11 };
                    cell.alignment = { vertical: 'middle' };

                    // Alinhamento central para códigos e números
                    if (colNumber === 1 || colNumber >= 3) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    }

                    // Formatar Preço
                    if (colNumber === 4) {
                        cell.numFmt = '"R$ " #,##0.00';
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    }

                    // Ocultar valores ZERO APENAS nas colunas de Pedidos (7, 10, 13, 16) - as que são editadas no sistema
                    if ([7, 10, 13, 16].includes(colNumber) && cell.value === 0) {
                        cell.value = null;
                    }
                });
            });

            // 5. Linha de Totais
            const lastDataRowIndex = stock.length + 2; // Título + Header + Dados
            const totalRowIndex = lastDataRowIndex + 1;
            
            const totalRow = worksheet.addRow({});
            totalRow.height = 30;
            totalRow.getCell(1).value = 'TOTAL GERAL';
            totalRow.getCell(1).font = { bold: true, size: 10 };
            totalRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
            worksheet.mergeCells(`A${totalRowIndex}:B${totalRowIndex}`);

            // Adicionar fórmulas de soma apenas para as métricas das filiais (colunas 5 a 16)
            for (let i = 5; i <= 16; i++) {
                const cell = totalRow.getCell(i);
                const colLetter = worksheet.getColumn(i).letter;
                cell.value = { formula: `SUM(${colLetter}3:${colLetter}${lastDataRowIndex})` };
                cell.font = { bold: true };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                cell.border = {
                    top: { style: 'medium', color: { argb: 'FF000000' } },
                    left: { style: 'thin', color: { argb: 'FF000000' } },
                    bottom: { style: 'medium', color: { argb: 'FF000000' } },
                    right: { style: 'thin', color: { argb: 'FF000000' } }
                };
                if (i === 4) cell.numFmt = '"R$ " #,##0.00';
            }

            // 4. Aba Secundária: Rabiscos Visual (Galeria)
            const sketchedItems = stock.filter(item => sketches[item.codigo]);
            if (sketchedItems.length > 0) {
                const wsVisual = workbook.addWorksheet('Rabiscados (Visual)');
                wsVisual.columns = [
                    { header: 'MODELO', key: 'modelo', width: 45 },
                    { header: 'RABISCO / POST-IT', key: 'rabisco', width: 40 }
                ];

                // Cabeçalho da Galeria
                const visualHeader = wsVisual.getRow(1);
                visualHeader.font = { bold: true, size: 12 };
                visualHeader.height = 30;
                visualHeader.eachCell(cell => {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } }; // Amarelo Post-it
                });

                sketchedItems.forEach((item, index) => {
                    const rowNumber = index + 2;
                    const currentRow = wsVisual.addRow({
                        modelo: `${item.codigo} - ${item.descricao}`
                    });

                    currentRow.height = 140;
                    currentRow.getCell(1).alignment = { vertical: 'middle', wrapText: true };

                    // Inserir Imagem
                    try {
                        const base64Data = sketches[item.codigo];
                        const imageId = workbook.addImage({
                            base64: base64Data,
                            extension: 'png',
                        });

                        wsVisual.addImage(imageId, {
                            tl: { col: 1.1, row: rowNumber - 1 + 0.1 } as any,
                            br: { col: 1.9, row: rowNumber - 0.1 } as any,
                            editAs: 'oneCell'
                        });
                    } catch (e) {
                        console.error("Erro ao inserir imagem no Excel:", e);
                        currentRow.getCell(2).value = "[Erro ao carregar desenho]";
                    }
                });
            }

            // 5. Gerar e Baixar
            const buffer = await workbook.xlsx.writeBuffer();
            const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `Pendencias_Export_${dateStr}.xlsx`);

            toast.success("Planilha exportada com sucesso!", { id: loadingToast });
            setIsExportModalOpen(false);
        } catch (err) {
            console.error("Erro ao exportar:", err);
            toast.error("Erro ao gerar a planilha.", { id: loadingToast });
        } finally {
            setIsExportLoading(false);
        }
    };

    const processExcelFile = (file: File) => {
        setImportedFileName(file.name);
        const reader = new FileReader();
        const toastId = toast.loading("Lendo planilha...");
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames.find(n => n.toUpperCase() === 'PRINCIPAL') || wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                const mappedData: StockItem[] = data.map((row: any) => {
                    const normalize = (s: string) =>
                        String(s || '').normalize("NFD")
                            .replace(/[\u0300-\u036f]/g, "")
                            .replace(/[^A-Z0-9]/gi, "")
                            .toUpperCase();

                    const parseBrNumber = (val: any) => {
                        if (typeof val === 'number') return val;
                        if (!val) return 0;
                        const str = String(val).replace(/\s/g, '').replace(/\./g, '').replace(',', '.').trim();
                        const num = parseFloat(str);
                        return isNaN(num) ? 0 : num;
                    };

                    const find = (keywords: string[]) => {
                        const normalizedKeywords = keywords.map(normalize);
                        const foundKey = Object.keys(row).find(k =>
                            normalizedKeywords.includes(normalize(k))
                        );
                        return foundKey ? row[foundKey] : undefined;
                    };

                    return {
                        codigo: String(find(['CÓDIGO', 'CODIGO', 'CÓD']) || '').trim(),
                        descricao: String(find(['CATÁLOGO', 'CATALOGO', 'DESCRIÇÃO', 'DESCRICAO']) || '').trim(),
                        local: 'Planilha',
                        quantidade: parseBrNumber(find(['EST. MK', 'EST MK', 'ESTMK'])),
                        est_mk: parseBrNumber(find(['EST. MK', 'EST MK', 'ESTMK'])),
                        pend_mk: parseBrNumber(find(['PEND MK', 'PEND. MK', 'PENDMK'])),
                        est_moleri: parseBrNumber(find(['EST. MOLERI', 'EST MOLERI', 'ESTMOLERI'])),
                        pend_moleri: parseBrNumber(find(['PEND MOLERI', 'PEND. MOLERI', 'PENDMOLERI'])),
                        est_cm: parseBrNumber(find(['EST. CM', 'EST CM', 'ESTCM'])),
                        pend_cm: parseBrNumber(find(['PEND CM', 'PEND. CM', 'PENDCM'])),
                        est_olimpo: parseBrNumber(find(['EST. OLIMPO', 'EST OLIMPO', 'ESTOLIMPO'])),
                        pend_olimpo: parseBrNumber(find(['PEND OLIMPO', 'PEND. OLIMPO', 'PENDOLIMPO'])),
                        preco: parseBrNumber(find(['PREÇO FÁBRICA', 'PRECO FABRICA', 'PREÇO', 'PRECO']))
                    };
                }).filter(item => item.codigo);

                if (mappedData.length > 0) {
                    setTempProcessedData(mappedData);
                    toast.success(`${mappedData.length} itens extraídos com sucesso!`, { id: toastId });
                } else {
                    toast.error("Nenhum dado válido encontrado na planilha.", { id: toastId });
                }
            } catch (err) {
                console.error("Erro ao ler Excel:", err);
                toast.error("Erro ao processar o arquivo Excel.", { id: toastId });
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleSyncToCloud = async () => {
        if (tempProcessedData.length === 0) return;

        setIsSyncingCloud(true);
        const syncToast = toast.loading("Sincronizando com a nuvem...");
        try {
            await syncPendenciasToCloud(tempProcessedData, importedFileName || 'Planilha Importada');

            // Sucesso! Atualizar estado local
            setStock(tempProcessedData);
            const now = new Date().toISOString();
            setLastUploadDate(now);
            localStorage.setItem('inventory_cache', JSON.stringify({
                data: tempProcessedData,
                updatedAt: now,
                fileName: importedFileName
            }));

            toast.success("Estoque sincronizado com a nuvem v!", { id: syncToast });
            setIsUploadModalOpen(false); // Fecha o modal automaticamente
            setTempProcessedData([]); // Limpa dados temporários
        } catch (err) {
            console.error(err);
            toast.error("Erro ao sincronizar. Tente novamente.", { id: syncToast });
        } finally {
            setIsSyncingCloud(false);
        }
    };

    // Filtros
    const [showOnlyPending, setShowOnlyPending] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    
    const [showOnlyWithAudio, setShowOnlyWithAudio] = useState(false);
    const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
    const [isTourOpen, setIsTourOpen] = useState(false);
    const [globalTags, setGlobalTags] = useState<string[]>(['VÍDEO', 'PEDIR', 'FOTO', 'WILLIAM', 'SP']);
    const [showOnlyWithTags, setShowOnlyWithTags] = useState(false);
    const [showOnlyWithSketches, setShowOnlyWithSketches] = useState(false);

    const [filterLinha, setFilterLinha] = useState("");
    const [filterAro, setFilterAro] = useState("");
    const [filterFuracao, setFilterFuracao] = useState("");
    const [filterModelo, setFilterModelo] = useState("");
    const [filterAcabamento, setFilterAcabamento] = useState("");

    const getFields = (item: StockItem) => {
        const descUpper = item.descricao.toUpperCase();

        const { modelCode: model, finishAbbr: acabamento } = getModelAndFinish(descUpper);
        
        // Linha: Prefixo alfabético do modelo (ex: C, G, E)
        const linha = model.match(/^[A-Z]+/i)?.[0] || "";

        const aroMatch = descUpper.match(/(\d{2}[XxX\*][\d\.]+)|(\b\d{2}\b)/i);
        const aro = aroMatch ? aroMatch[0] : "";

        const furMatch = descUpper.match(/\d[XxX\*]\d{2,3}(\.\d+)?|\d[Ff]/i);
        const furacao = furMatch ? furMatch[0] : "";

        return { linha, aro, furacao, model, acabamento, descUpper };
    };

    // Filtros Hierárquicos (Cascata)
    // Para cada filtro, calculamos as opções baseadas nos itens que passam pelos OUTROS filtros aplicados.

    // Opções de Linha: Sempre baseadas no estoque total (topo da hierarquia)
    const uniqueLinhas = Array.from(new Set(stock.map(item => getFields(item).linha))).filter(Boolean).sort();

    // Opções de Modelo: Dependem da Linha selecionada
    const itemsForModelo = stock.filter(item => !filterLinha || getFields(item).linha === filterLinha);
    const uniqueModelos = Array.from(new Set(itemsForModelo.map(item => getFields(item).model))).filter(Boolean).sort();

    // Opções de Aro: Dependem da Linha e Modelo selecionados
    const itemsForAro = itemsForModelo.filter(item => !filterModelo || getFields(item).model === filterModelo);
    const uniqueAros = Array.from(new Set(itemsForAro.map(item => getFields(item).aro))).filter(Boolean).sort();

    // Opções de Furação: Dependem da Linha, Modelo e Aro selecionados
    const itemsForFuracao = itemsForAro.filter(item => !filterAro || getFields(item).aro === filterAro);
    const uniqueFuracoes = Array.from(new Set(itemsForFuracao.map(item => getFields(item).furacao))).filter(Boolean).sort();

    // Opções de Acabamento: Dependem de tudo acima
    const itemsForAcabamento = itemsForFuracao.filter(item => !filterFuracao || getFields(item).furacao === filterFuracao);
    const uniqueAcabamentos = Array.from(new Set(itemsForAcabamento.map(item => getFields(item).acabamento))).filter(Boolean).sort();

    const filteredStock = stock.filter(item => {
        if (showOnlyPending) {
            const p = pendencies[item.codigo];
            if (!p || (p.MK === 0 && p.MOLERI === 0 && p.CM === 0 && p.OLIMPO === 0)) {
                return false;
            }
        }
        if (searchQuery) {
            // Se o usuário digitou espaços (ex: "R 50"), nós buscamos os termos separados
            const terms = searchQuery.toUpperCase().trim().split(/\s+/).filter(Boolean);
            const desc = item.descricao.toUpperCase();
            const cod = item.codigo.toUpperCase();

            const matchesAll = terms.every(term => {
                const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                // Boundaries inteligentes:
                // 1. O termo tem que começar com espaço, X, -, início da string, ou O termo exato para código.
                // 2. Se o termo tem 2 caracteres ou mais e termina com letra, aceita partial (ex: "BLA" acha "BLACK").
                // 3. Se termina com número, não aceitamos outro número depois (ex: "R50" não acha "R500").
                const endsWithDigit = /\d$/.test(term);
                const rightBoundary = endsWithDigit ? '(?![0-9])' : '';

                const regex = new RegExp(`(^|\\s|X|/|-)${escapedTerm}${rightBoundary}`, 'i');

                // Verifica a descrição OU se o código COMEÇA EXATAMENTE com o termo
                return regex.test(desc) || cod.startsWith(term);
            });

            if (!matchesAll) return false;
        }

        const { linha, aro, furacao, model, acabamento } = getFields(item);
        if (filterLinha && linha !== filterLinha) return false;
        if (filterAro && aro !== filterAro) return false;
        if (filterFuracao && furacao !== filterFuracao) return false;
        if (filterModelo && model !== filterModelo) return false;
        if (filterAcabamento && acabamento !== filterAcabamento) return false;
        // Annotation Filters
        if (showOnlyWithAudio && !audios[item.codigo]) return false;
        if (showOnlyWithTags && (!itemTags[item.codigo] || itemTags[item.codigo].length === 0)) return false;
        if (showOnlyWithSketches && !sketches[item.codigo]) return false;

        return true;
    });

    // Reset page to 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [showOnlyPending, searchQuery, filterLinha, filterAro, filterFuracao, filterModelo, filterAcabamento]);

    // Reset scroll when page changes
    useEffect(() => {
        tableContainerRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    }, [currentPage]);

    const itemsPerPage = 100;
    const totalPages = Math.ceil(filteredStock.length / itemsPerPage) || 1;
    const paginatedStock = filteredStock.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const factories: Array<{
        key: FactoryName;
        label: string;
        shortLabel: string;
        estKey: keyof StockItem;
        pendKey: keyof StockItem;
        color: string;
        text: string;
        border: string;
    }> = [
        { key: 'MK', label: 'MK - PARANÁ', shortLabel: 'MK', estKey: 'est_mk', pendKey: 'pend_mk', color: 'bg-indigo-50 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-300 dark:border-indigo-700' },
        { key: 'MOLERI', label: 'MOLERI', shortLabel: 'MOLERI', estKey: 'est_moleri', pendKey: 'pend_moleri', color: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-700' },
        { key: 'CM', label: 'CM', shortLabel: 'CM', estKey: 'est_cm', pendKey: 'pend_cm', color: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-700' },
        { key: 'OLIMPO', label: 'OLIMPO', shortLabel: 'OLIMPO', estKey: 'est_olimpo', pendKey: 'pend_olimpo', color: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-300 dark:border-slate-700' }
    ];
    const getFactoryValue = (item: StockItem, key: keyof StockItem) => Number(item[key] || 0);
    const getFactoryOrder = (item: StockItem, factory: FactoryName) => Number(pendencies[item.codigo]?.[factory] || 0);
    const getItemTotals = (item: StockItem) => factories.reduce((totals, factory) => ({
        estoque: totals.estoque + getFactoryValue(item, factory.estKey),
        pendencia: totals.pendencia + getFactoryValue(item, factory.pendKey),
        pedido: totals.pedido + getFactoryOrder(item, factory.key)
    }), { estoque: 0, pendencia: 0, pedido: 0 });
    const factoryTotals = factories.map((factory) => ({
        ...factory,
        estoque: filteredStock.reduce((acc, item) => acc + getFactoryValue(item, factory.estKey), 0),
        pendencia: filteredStock.reduce((acc, item) => acc + getFactoryValue(item, factory.pendKey), 0),
        pedido: filteredStock.reduce((acc, item) => acc + getFactoryOrder(item, factory.key), 0)
    }));

    useEffect(() => {
        // Verificar se é o primeiro acesso à versão 2.0 (Cloud)
        const hasSeenWelcome = localStorage.getItem('@MK_WELCOME_CLOUD_SEEN');
        if (!hasSeenWelcome) {
            setIsWelcomeModalOpen(true);
        }

        const fetchData = async () => {
            try {
                const pendingAtStartup = getPendingPedidoCount();
                setPendingSyncCount(pendingAtStartup);
                if (pendingAtStartup > 0) {
                    toast('Existem alterações salvas neste aparelho aguardando sincronização.', { duration: 4000 });
                    await syncPendingPedidos(true);
                }

                // Carregar Catálogo de Tags
                const gTags = await getGlobalTags();
                setGlobalTags(gTags);

                // 1. Carregar Pedidos da Nuvem
                const pedidosData = await loadPedidosFabrica();
                let loadedPendencies: Record<string, Record<FactoryName, number>> = {};
                if (pedidosData && pedidosData.length > 0) {
                    pedidosData.forEach((row: any) => {
                        if (!loadedPendencies[row.codigo]) {
                            loadedPendencies[row.codigo] = { ...emptyFactoryPendencies };
                        }
                        loadedPendencies[row.codigo][row.factory as FactoryName] = row.quantidade;
                    });
                }
                loadedPendencies = mergePendingPedidosIntoState(loadedPendencies, emptyFactoryPendencies);
                setPendencies(loadedPendencies);
                setPendingSyncCount(getPendingPedidoCount());

                // 2. Tentar buscar inventário base das PENDÊNCIAS na Nuvem
                const inventoryData = await getPendenciasInventory();
                if (inventoryData && inventoryData.length > 0) {
                    setStock(inventoryData as StockItem[]);
                    
                    // Buscar metadados (data e nome do arquivo) da nuvem
                    const updateData = await getLastUpdate();
                    if (updateData) {
                        setLastUploadDate(updateData.date);
                    }

                    // Atualizar cache local
                    localStorage.setItem('inventory_cache', JSON.stringify({
                        data: inventoryData,
                        updatedAt: updateData?.date || new Date().toISOString(),
                        fileName: updateData?.fileName || 'Base Fixa Sincronizada'
                    }));
                } else {
                    // 3. Se não houver nada na nuvem, tentar carregar do Cache Local (Backup)
                    const savedCache = localStorage.getItem('inventory_cache');
                    if (savedCache) {
                        const { data, updatedAt, fileName } = JSON.parse(savedCache);
                        setStock(data as StockItem[]);
                        setLastUploadDate(updatedAt || null);
                        toast.success('Usando inventário carregado localmente.', { duration: 2000 });
                    }
                }

                await loadTags();
                await loadSketches();
                await loadAudios();
            } catch (err) {
                console.error('Erro ao inicializar', err);
                toast.error('Erro ao carregar dados.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();

        const handleOnline = () => {
            syncPendingPedidos(true);
        };

        window.addEventListener('online', handleOnline);
        return () => {
            window.removeEventListener('online', handleOnline);
        };
    }, []);

    return (
        <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors overflow-hidden">
            <Toaster position="top-center" />

            <header className="flex-none bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors z-20">
                <div className="w-full max-w-[98%] mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBackToMenu}
                            className="p-1.5 shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm font-bold flex items-center justify-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span className="hidden sm:inline text-sm">Menu</span>
                        </button>
                        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 whitespace-nowrap">
                            <ClipboardList className="text-amber-500 w-5 h-5" /> Pendências
                            {USE_LOCAL_DB ? (
                                <span className="px-1.5 py-0.5 text-[9px] bg-emerald-500 text-white rounded-md uppercase tracking-wider font-black shadow-sm animate-pulse">Local CSV</span>
                            ) : (
                                <span id="tour-cloud" className="px-1.5 py-0.5 text-[10px] bg-blue-600 text-white rounded-md uppercase tracking-widest font-black shadow-lg flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-blue-200 rounded-full animate-ping"></span>
                                    Supabase Cloud
                                </span>
                            )}
                            {pendingSyncCount > 0 && (
                                <span className="px-1.5 py-0.5 text-[10px] bg-amber-500 text-white rounded-md uppercase tracking-widest font-black shadow-lg">
                                    {pendingSyncCount} pendente{pendingSyncCount > 1 ? 's' : ''}
                                </span>
                            )}
                        </h1>
                        <div className="hidden md:block h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>
                        <div id="tour-summary" className="flex flex-col">
                            <p className="hidden lg:block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
                                {isLoading ? "Carregando..." : `${filteredStock.length} / ${stock.length} Rodas`}
                                {USE_LOCAL_DB ? (
                                    importedFileName && <span className="ml-2 text-amber-600 dark:text-amber-400 text-[9px] lowercase italic">({importedFileName})</span>
                                ) : (
                                    <span className="ml-2 text-blue-500 dark:text-blue-400 text-[9px] lowercase italic">(Banco de Dados Cloud)</span>
                                )}
                            </p>
                            {lastUploadDate && (
                                <p className="hidden lg:block text-[9px] font-medium text-slate-400 dark:text-slate-500">
                                    Planilha: {new Date(lastUploadDate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            )}
                        </div>
                    </div>

                    {!isLoading && (
                        <div className="flex flex-wrap items-center gap-2">
                            <div id="tour-search" className="relative w-48 lg:w-64">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                                <input
                                    type="text"
                                    placeholder="Buscar roda..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-500/50"
                                />
                            </div>

                            <button
                                id="tour-filters"
                                onClick={() => setShowFilters(!showFilters)}
                                className={cn(
                                    "px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-colors flex items-center gap-1.5",
                                    showFilters ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                                )}
                            >
                                <Filter className="w-3.5 h-3.5" /> Filtros
                            </button>

                            <button
                                onClick={() => setShowOnlyPending(!showOnlyPending)}
                                className={cn(
                                    "px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all border flex items-center gap-1.5 shadow-sm",
                                    showOnlyPending
                                        ? "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-700"
                                        : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                )}
                            >
                                📌 Pedidos
                            </button>

                            {isAdmin && (
                                <button
                                    onClick={handleExport}
                                    className="px-2.5 py-1.5 text-xs font-black rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm"
                                >
                                    <Upload className="w-3.5 h-3.5 rotate-180" /> Exportar
                                </button>
                            )}

                            {(filterLinha || filterAro || filterFuracao || filterModelo || filterAcabamento || searchQuery) && (
                                <button onClick={() => { setFilterLinha(""); setFilterAro(""); setFilterFuracao(""); setFilterModelo(""); setFilterAcabamento(""); setSearchQuery(""); }} className="px-2.5 py-1.5 text-[10px] uppercase tracking-tighter font-black text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors border border-red-200 dark:border-red-900/40">
                                    Limpar
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </header>

            <main className="flex-1 flex flex-col w-full max-w-[98%] mx-auto px-2 sm:px-4 py-3 overflow-hidden">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden"
                >
                    <div className="flex-none px-4 py-2 border-b border-slate-200 dark:border-slate-800">
                        {showFilters && (
                            <div className="flex flex-wrap items-center gap-2 py-1">
                                <select value={filterLinha} onChange={e => setFilterLinha(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer shadow-sm">
                                    <option value="">Linhas</option>
                                    {uniqueLinhas.map(o => <option key={o} value={o}>Linha {o}</option>)}
                                </select>

                                <select value={filterModelo} onChange={e => setFilterModelo(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer shadow-sm">
                                    <option value="">Modelos</option>
                                    {uniqueModelos.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>

                                <select value={filterAro} onChange={e => setFilterAro(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer shadow-sm">
                                    <option value="">Aros / Talas</option>
                                    {uniqueAros.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>

                                <select value={filterFuracao} onChange={e => setFilterFuracao(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer shadow-sm">
                                    <option value="">Furações</option>
                                    {uniqueFuracoes.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>

                                <select value={filterAcabamento} onChange={e => setFilterAcabamento(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer shadow-sm">
                                    <option value="">Acabamentos</option>
                                    {uniqueAcabamentos.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>

                                <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden lg:block" />

                                <button 
                                    onClick={() => setShowOnlyWithAudio(!showOnlyWithAudio)}
                                    className={cn(
                                        "px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5",
                                        showOnlyWithAudio ? "bg-rose-500 text-white border-rose-600 shadow-sm" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                                    )}
                                >
                                    <Volume2 className={cn("w-3.5 h-3.5", showOnlyWithAudio ? "text-white" : "text-rose-500")} /> Com Áudio
                                </button>

                                <button 
                                    onClick={() => setShowOnlyWithTags(!showOnlyWithTags)}
                                    className={cn(
                                        "px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5",
                                        showOnlyWithTags ? "bg-indigo-500 text-white border-indigo-600 shadow-sm" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                                    )}
                                >
                                    <Tag className={cn("w-3.5 h-3.5", showOnlyWithTags ? "text-white" : "text-indigo-500")} /> Com Tags
                                </button>

                                <button 
                                    onClick={() => setShowOnlyWithSketches(!showOnlyWithSketches)}
                                    className={cn(
                                        "px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5",
                                        showOnlyWithSketches ? "bg-amber-500 text-white border-amber-600 shadow-sm" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                                    )}
                                >
                                    <PenTool className={cn("w-3.5 h-3.5", showOnlyWithSketches ? "text-white" : "text-amber-500")} /> Com Post-it
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="md:hidden flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 px-3 py-3 space-y-3">
                        {isLoading ? (
                            <div className="px-4 py-10 text-center text-sm font-bold text-slate-400">
                                Carregando itens...
                            </div>
                        ) : paginatedStock.map((item) => {
                            const photoUrl = getWheelPhotoUrl(item.descricao, item.codigo);
                            const isExpanded = expandedMobileCode === item.codigo;

                            return (
                                <div key={item.codigo} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => setExpandedMobileCode(isExpanded ? null : item.codigo)}
                                        className="w-full p-3 flex gap-3 text-left active:bg-slate-50 dark:active:bg-slate-800 transition-colors"
                                    >
                                        <img
                                            src={photoUrl}
                                            alt={`Foto ${item.descricao}`}
                                            className="w-20 h-20 rounded-xl object-cover border border-slate-200 dark:border-slate-700 bg-white shrink-0"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100 leading-tight line-clamp-2">
                                                        {item.descricao}
                                                    </h3>
                                                    <p className="mt-1 text-xs font-mono text-slate-400">{item.codigo}</p>
                                                </div>
                                                <span className="shrink-0 text-sm font-bold text-slate-600 dark:text-slate-300">
                                                    {item.preco ? item.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                                                </span>
                                            </div>
                                            <div className="mt-2 flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    {isExpanded ? 'Fechar detalhes' : 'Abrir detalhes'}
                                                </span>
                                                <span className={cn("text-lg leading-none text-slate-500 transition-transform", isExpanded && "rotate-180")}>
                                                    ^
                                                </span>
                                            </div>
                                        </div>
                                    </button>

                                    <div className="px-3 pb-3">
                                        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                                            <div className="grid grid-cols-[54px_repeat(4,minmax(0,1fr))] bg-slate-50 dark:bg-slate-950">
                                                <div className="border-r border-slate-200 dark:border-slate-800" />
                                                {factories.map((factory) => (
                                                    <div key={factory.key} className={cn("h-9 flex items-center justify-center px-1 text-[10px] font-black uppercase text-center border-r last:border-r-0 border-slate-200 dark:border-slate-800", factory.color, factory.text)}>
                                                        {factory.shortLabel}
                                                    </div>
                                                ))}
                                            </div>
                                            {[
                                                { label: 'Est.', color: 'text-blue-600', getValue: (factory: typeof factories[number]) => getFactoryValue(item, factory.estKey) },
                                                { label: 'Pend.', color: 'text-orange-600', getValue: (factory: typeof factories[number]) => getFactoryValue(item, factory.pendKey) },
                                                { label: 'Ped.', color: 'text-emerald-600', getValue: (factory: typeof factories[number]) => getFactoryOrder(item, factory.key) }
                                            ].map((metric) => (
                                                <div key={metric.label} className="grid grid-cols-[54px_repeat(4,minmax(0,1fr))] border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                                                    <div className="h-9 flex items-center justify-center text-[10px] font-black uppercase text-slate-400 border-r border-slate-200 dark:border-slate-800">
                                                        {metric.label}
                                                    </div>
                                                    {factories.map((factory) => (
                                                        <div key={factory.key} className="h-9 flex items-center justify-center border-r last:border-r-0 border-slate-200 dark:border-slate-800">
                                                            <span className={cn("text-base font-black", metric.color)}>
                                                                {metric.getValue(factory)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <AnimatePresence initial={false}>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden border-t border-slate-100 dark:border-slate-800"
                                            >
                                                {factories.map((factory) => (
                                                    <div key={factory.key} className="grid grid-cols-[92px_1fr_1fr_92px] min-h-[58px] border-b last:border-b-0 border-slate-100 dark:border-slate-800">
                                                        <div className={cn("flex items-center justify-center px-2 text-[11px] font-black uppercase text-center", factory.color, factory.text)}>
                                                            {factory.shortLabel}
                                                        </div>
                                                        <div className="flex flex-col items-center justify-center border-l border-slate-100 dark:border-slate-800">
                                                            <span className="text-[10px] font-bold uppercase text-slate-400">Est.</span>
                                                            <span className="text-lg font-black text-blue-600">{getFactoryValue(item, factory.estKey)}</span>
                                                        </div>
                                                        <div className="flex flex-col items-center justify-center border-l border-slate-100 dark:border-slate-800">
                                                            <span className="text-[10px] font-bold uppercase text-slate-400">Pend.</span>
                                                            <span className="text-lg font-black text-orange-600">{getFactoryValue(item, factory.pendKey)}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => openModal(item, factory.key)}
                                                            className={cn("m-2 rounded-lg border bg-white dark:bg-slate-950 flex items-center justify-center gap-1 font-black text-base transition-all active:scale-95", factory.border, factory.text)}
                                                        >
                                                            {getFactoryOrder(item, factory.key)}
                                                            <Pencil className="w-3.5 h-3.5 opacity-70" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>

                    <div ref={tableContainerRef} className="hidden md:block flex-1 overflow-auto relative">
                        <table className="w-full text-[15px] text-left whitespace-nowrap border-separate border-spacing-0">
                            <thead className="sticky top-[-2px] z-30 text-xs font-black uppercase bg-white dark:bg-slate-900 shadow-sm">
                                {/* Linha 1: Cabeçalhos de Grupo */}
                                <tr className="h-10">
                                    <th rowSpan={2} className="sticky top-[-2px] left-0 z-50 px-4 py-0 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 min-w-[100px] text-slate-400 align-middle">FOTO</th>
                                    <th rowSpan={2} className="sticky top-[-2px] left-[100px] z-50 px-4 py-0 border-b border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 min-w-[300px] lg:min-w-[400px] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] text-slate-400 align-middle">IDENTIFICAÇÃO DO PRODUTO</th>
                                    <th rowSpan={2} className="sticky top-[-2px] px-2 py-0 border-b border-r border-slate-200 dark:border-slate-700 text-right min-w-[80px] text-slate-400 align-middle bg-white dark:bg-slate-900">PREÇO</th>

                                    <th colSpan={3} className="sticky top-[-2px] px-2 py-0 border-r border-slate-200 dark:border-slate-700 text-center bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-300 tracking-[0.2em] align-middle">MK - PARANÁ</th>
                                    <th colSpan={3} className="sticky top-[-2px] px-2 py-0 border-r border-slate-200 dark:border-slate-700 text-center bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 tracking-[0.2em] align-middle">MOLERI</th>
                                    <th colSpan={3} className="sticky top-[-2px] px-2 py-0 border-r border-slate-200 dark:border-slate-700 text-center bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300 tracking-[0.2em] align-middle">CM</th>
                                    <th colSpan={3} className="sticky top-[-2px] px-2 py-0 border-slate-200 dark:border-slate-700 text-center bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-300 tracking-[0.2em] align-middle">OLIMPO</th>
                                </tr>
                                {/* Linha 2: Cabeçalhos Individuais */}
                                <tr className="h-8">
                                    <th className="sticky top-[38px] px-2 py-0 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-indigo-100 dark:bg-indigo-900 z-30">EST.</th>
                                    <th className="sticky top-[38px] px-2 py-0 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-indigo-100 dark:bg-indigo-900 z-30">PEND.</th>
                                    <th className="sticky top-[38px] px-2 py-0 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-indigo-200 dark:bg-indigo-800 z-30">PEDIDO</th>

                                    <th className="sticky top-[38px] px-2 py-0 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-emerald-100 dark:bg-emerald-900 z-30">EST.</th>
                                    <th className="sticky top-[38px] px-2 py-0 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-emerald-100 dark:bg-emerald-900 z-30">PEND.</th>
                                    <th className="sticky top-[38px] px-2 py-0 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-emerald-200 dark:bg-emerald-800 z-30">PEDIDO</th>

                                    <th className="sticky top-[38px] px-2 py-0 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-amber-100 dark:bg-amber-900 z-30">EST.</th>
                                    <th className="sticky top-[38px] px-2 py-0 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-amber-100 dark:bg-amber-900 z-30">PEND.</th>
                                    <th className="sticky top-[38px] px-2 py-0 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-amber-200 dark:bg-amber-800 z-30">PEDIDO</th>

                                    <th className="sticky top-[38px] px-2 py-0 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-rose-100 dark:bg-rose-900 z-30">EST.</th>
                                    <th className="sticky top-[38px] px-2 py-0 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-rose-100 dark:bg-rose-900 z-30">PEND.</th>
                                    <th className="sticky top-[38px] px-2 py-0 border-b border-slate-200 dark:border-slate-700 text-center bg-rose-200 dark:bg-rose-800 z-30">PEDIDO</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                                {!isLoading && paginatedStock.map((item, idx) => {
                                    const isEven = idx % 2 === 0;
                                    const bgNormal = isEven ? "bg-white dark:bg-slate-900" : "bg-slate-50 dark:bg-slate-800";
                                    const bgHighlight = isEven ? "bg-slate-50 dark:bg-slate-800" : "bg-slate-100 dark:bg-slate-700";
                                    const bgInput = isEven ? "bg-white dark:bg-slate-900" : "bg-slate-50 dark:bg-slate-800";

                                    const photoUrl = getWheelPhotoUrl(item.descricao, item.codigo);
                                    const modelCode = item.descricao.split(' ')[0].toUpperCase();

                                    return (
                                        <tr key={item.codigo} className="hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors group">
                                            <td className={cn("sticky left-0 z-10 px-4 py-3 min-w-[100px]", bgNormal)}>
                                                <img
                                                    src={photoUrl}
                                                    alt={`Foto ${modelCode}`}
                                                    className="w-16 h-16 rounded-md object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
                                                />
                                            </td>
                                            <td className={cn("sticky left-[100px] px-4 py-3 min-w-[300px] lg:min-w-[400px] border-r border-slate-200 dark:border-slate-700/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]", bgNormal, tagMenuOpen?.toString().includes(item.codigo) ? "z-50" : "z-[5]")}>
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-slate-700 dark:text-slate-200 font-bold text-base">
                                                            {item.descricao}
                                                        </span>

                                                        {/* Tags List */}
                                                        {itemTags[item.codigo]?.map(tag => (
                                                            <button
                                                                key={tag}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleToggleTag(item.codigo, tag);
                                                                }}
                                                                className="px-3 py-1.5 text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/40 rounded-xl border-2 border-slate-200 dark:border-slate-700 transition-all flex items-center gap-2 group/tag shadow-sm active:scale-90"
                                                            >
                                                                {tag}
                                                                <X className="w-4 h-4 text-slate-400 group-hover/tag:text-red-500" />
                                                            </button>
                                                        ))}

                                                        {/* Action Hub (Triple Menu) */}
                                                        <div className="flex items-center gap-2">
                                                            {/* Sketch Preview */}
                                                            {sketches[item.codigo] && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setActiveSketchItem({ codigo: item.codigo, title: item.descricao });
                                                                        setSketchModalOpen(true);
                                                                    }}
                                                                    className="w-10 h-10 rounded border-2 border-amber-200 bg-amber-50 overflow-hidden shadow-sm hover:scale-110 hover:rotate-3 transition-all relative group/sketch"
                                                                >
                                                                    <img src={sketches[item.codigo]} alt="Rascunho" className="w-full h-full object-contain" />
                                                                    <div className="absolute inset-0 bg-amber-500/0 group-hover/sketch:bg-amber-500/10 flex items-center justify-center">
                                                                        <Pencil className="w-3 h-3 text-amber-600 opacity-0 group-hover/sketch:opacity-100" />
                                                                    </div>
                                                                </button>
                                                            )}

                                                            {/* Audio Preview (Icon to Open Player) */}
                                                            {audios[item.codigo] && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setActiveAudioItem({ codigo: item.codigo, title: item.descricao });
                                                                        setAudioPlayerOpen(true);
                                                                    }}
                                                                    className="p-2.5 rounded-full bg-rose-50 dark:bg-rose-900/30 text-rose-500 hover:bg-rose-100 hover:scale-110 transition-all border border-rose-100 dark:border-rose-800 shadow-sm"
                                                                    title="Ouvir Nota de Voz"
                                                                >
                                                                    <Volume2 className="w-4 h-4" />
                                                                </button>
                                                            )}

                                                            <div className="relative">
                                                                <button
                                                                    id={idx === 0 ? "tour-media" : undefined}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setTagMenuOpen(tagMenuOpen === item.codigo ? null : item.codigo);
                                                                    }}
                                                                    className={cn(
                                                                        "p-2 rounded-xl transition-all border shadow-sm",
                                                                        tagMenuOpen === item.codigo
                                                                            ? "bg-slate-900 border-slate-900 text-white rotate-45 scale-110"
                                                                            : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300 hover:text-slate-900"
                                                                    )}
                                                                >
                                                                    <Plus className="w-4 h-4" />
                                                                </button>

                                                                {/* Triple Choice Menu */}
                                                                <AnimatePresence>
                                                                    {tagMenuOpen === item.codigo && (
                                                                        <>
                                                                            <div
                                                                                className="fixed inset-0 z-40"
                                                                                onClick={() => setTagMenuOpen(null)}
                                                                            />
                                                                            <motion.div
                                                                                initial={{ opacity: 0, scale: 0.5, y: idx < 3 ? -10 : 10 }}
                                                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                                                exit={{ opacity: 0, scale: 0.5, y: idx < 3 ? -10 : 10 }}
                                                                                className={cn(
                                                                                    "absolute left-0 z-[100] flex flex-col gap-2",
                                                                                    idx < 3 ? "top-full mt-3" : "bottom-full mb-3"
                                                                                )}
                                                                                onClick={e => e.stopPropagation()}
                                                                            >
                                                                                {/* Tag Action */}
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setTagMenuOpen(`tags-${item.codigo}`);
                                                                                    }}
                                                                                    className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-all font-bold text-sm shadow-xl whitespace-nowrap"
                                                                                >
                                                                                    <Tag className="w-4 h-4 text-indigo-500" /> ETIQUETAS
                                                                                </button>

                                                                                {/* Sketch Action */}
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setActiveSketchItem({ codigo: item.codigo, title: item.descricao });
                                                                                        setSketchModalOpen(true);
                                                                                        setTagMenuOpen(null);
                                                                                    }}
                                                                                    className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-all font-bold text-sm shadow-xl whitespace-nowrap"
                                                                                >
                                                                                    <PenTool className="w-4 h-4 text-amber-500" /> RABISCAR
                                                                                </button>

                                                                                {/* Audio Action */}
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setActiveAudioItem({ codigo: item.codigo, title: item.descricao });
                                                                                        setAudioModalOpen(true);
                                                                                        setTagMenuOpen(null);
                                                                                    }}
                                                                                    className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-all font-bold text-sm shadow-xl whitespace-nowrap"
                                                                                >
                                                                                    <Mic className="w-4 h-4 text-rose-500" /> GRAVAR ÁUDIO
                                                                                </button>
                                                                            </motion.div>
                                                                        </>
                                                                    )}

                                                                    {/* Sub-menu for Tags specifically */}
                                                                    {tagMenuOpen === `tags-${item.codigo}` && (
                                                                        <>
                                                                            <div
                                                                                className="fixed inset-0 z-40"
                                                                                onClick={() => setTagMenuOpen(null)}
                                                                            />
                                                                            <motion.div
                                                                                initial={{ opacity: 0, scale: 0.95, y: idx < 3 ? -10 : 10 }}
                                                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                                                exit={{ opacity: 0, scale: 0.95, y: idx < 3 ? -10 : 10 }}
                                                                                className={cn(
                                                                                    "absolute left-0 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-3 min-w-[200px]",
                                                                                    idx < 3 ? "top-full mt-3" : "bottom-full mb-3"
                                                                                )}
                                                                                onClick={e => e.stopPropagation()}
                                                                            >
                                                                                <div className="text-[10px] font-bold text-slate-400 px-1 py-1 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700 mb-2 flex items-center gap-1.5 line-clamp-1">
                                                                                    <Tag className="w-3 h-3 text-indigo-500" /> Selecionar Tag
                                                                                </div>
                                                                                <div className="grid grid-cols-1 gap-1">
                                                                                    {globalTags.map(tag => (
                                                                                        <button
                                                                                            key={tag}
                                                                                            onClick={() => handleToggleTag(item.codigo, tag)}
                                                                                            className={cn(
                                                                                                "w-full text-left px-3 py-2 rounded-xl text-sm font-bold transition-colors",
                                                                                                itemTags[item.codigo]?.includes(tag)
                                                                                                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                                                                                                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                                                                                            )}
                                                                                        >
                                                                                            {tag}
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex gap-1">
                                                                                    <input
                                                                                        type="text"
                                                                                        placeholder="Nova..."
                                                                                        className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border-none focus:ring-1 focus:ring-indigo-500"
                                                                                        onKeyDown={(e) => {
                                                                                            if (e.key === 'Enter') {
                                                                                                const val = e.currentTarget.value.trim().toUpperCase();
                                                                                                if (val) {
                                                                                                    handleToggleTag(item.codigo, val);
                                                                                                    e.currentTarget.value = '';
                                                                                                }
                                                                                            }
                                                                                        }}
                                                                                    />
                                                                                </div>
                                                                            </motion.div>
                                                                        </>
                                                                    )}
                                                                </AnimatePresence>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={cn("px-2 py-3 text-right text-slate-500", bgNormal)}>
                                                {item.preco ? item.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                                            </td>

                                            {/* MK */}
                                            <td className={cn("px-2 py-3 text-center font-bold text-slate-500 text-base", "bg-indigo-50/20 dark:bg-indigo-900/5")}>{item.est_mk || 0}</td>
                                            <td className={cn("px-2 py-3 text-center text-slate-400 text-base", "bg-indigo-50/20 dark:bg-indigo-900/5")}>{item.pend_mk || 0}</td>
                                            <td
                                                className={cn("px-2 py-3 text-center cursor-pointer hover:bg-indigo-100/50 dark:hover:bg-indigo-800/20 transition-colors border-x border-slate-200 dark:border-slate-700 font-black text-red-600 dark:text-red-400 group", "bg-indigo-100/30 dark:bg-indigo-800/10")}
                                                onClick={() => openModal(item, 'MK')}
                                            >
                                                <div className="flex items-center justify-center gap-1 mx-auto w-16 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 rounded-lg py-1.5 shadow-sm group-hover:border-indigo-400 group-hover:ring-1 group-hover:ring-indigo-400/50 transition-all">
                                                    <span className="text-xl">{pendencies[item.codigo]?.MK || 0}</span>
                                                    <Pencil className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 transition-colors" />
                                                </div>
                                            </td>

                                            {/* MOLERI */}
                                            <td className={cn("px-2 py-3 text-center font-bold text-slate-500 text-base", "bg-emerald-50/20 dark:bg-emerald-900/5")}>{item.est_moleri || 0}</td>
                                            <td className={cn("px-2 py-3 text-center text-slate-400 text-base", "bg-emerald-50/20 dark:bg-emerald-900/5")}>{item.pend_moleri || 0}</td>
                                            <td
                                                className={cn("px-2 py-3 text-center cursor-pointer hover:bg-emerald-100/50 dark:hover:bg-emerald-800/20 transition-colors border-x border-slate-200 dark:border-slate-700 font-black text-red-600 dark:text-red-400 group", "bg-emerald-100/30 dark:bg-emerald-800/10")}
                                                onClick={() => openModal(item, 'MOLERI')}
                                            >
                                                <div className="flex items-center justify-center gap-1 mx-auto w-16 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 rounded-lg py-1.5 shadow-sm group-hover:border-emerald-400 group-hover:ring-1 group-hover:ring-emerald-400/50 transition-all">
                                                    <span className="text-xl">{pendencies[item.codigo]?.MOLERI || 0}</span>
                                                    <Pencil className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-emerald-500 transition-colors" />
                                                </div>
                                            </td>

                                            {/* CM */}
                                            <td className={cn("px-2 py-3 text-center font-bold text-slate-500 text-base", "bg-amber-50/20 dark:bg-amber-900/5")}>{item.est_cm || 0}</td>
                                            <td className={cn("px-2 py-3 text-center text-slate-400 text-base", "bg-amber-50/20 dark:bg-amber-900/5")}>{item.pend_cm || 0}</td>
                                            <td
                                                className={cn("px-2 py-3 text-center cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors border-x border-slate-200 dark:border-slate-700 font-black text-red-600 dark:text-red-400 group", "bg-amber-100/30 dark:bg-amber-900/10")}
                                                onClick={() => openModal(item, 'CM')}
                                            >
                                                <div className="flex items-center justify-center gap-1 mx-auto w-16 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 rounded-lg py-1.5 shadow-sm group-hover:border-amber-400 group-hover:ring-1 group-hover:ring-amber-400/50 transition-all">
                                                    <span className="text-xl">{pendencies[item.codigo]?.CM || 0}</span>
                                                    <Pencil className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-amber-500 transition-colors" />
                                                </div>
                                            </td>

                                            {/* OLIMPO */}
                                            <td className={cn("px-2 py-3 text-center font-bold text-slate-500 text-base", "bg-rose-50/20 dark:bg-rose-900/5")}>{item.est_olimpo || 0}</td>
                                            <td className={cn("px-2 py-3 text-center text-slate-400 text-base", "bg-rose-50/20 dark:bg-rose-900/5")}>{item.pend_olimpo || 0}</td>
                                            <td
                                                className={cn("px-2 py-3 text-center cursor-pointer hover:bg-rose-100/50 dark:hover:bg-rose-900/30 transition-colors border-x border-slate-200 dark:border-slate-700 font-black text-red-600 dark:text-red-400 group", "bg-rose-100/30 dark:bg-rose-900/10")}
                                                onClick={() => openModal(item, 'OLIMPO')}
                                            >
                                                <div className="flex items-center justify-center gap-1 mx-auto w-16 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 rounded-lg py-1.5 shadow-sm group-hover:border-rose-400 group-hover:ring-1 group-hover:ring-rose-400/50 transition-all">
                                                    <span className="text-xl">{pendencies[item.codigo]?.OLIMPO || 0}</span>
                                                    <Pencil className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-rose-500 transition-colors" />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {isLoading && (
                                    <tr>
                                        <td colSpan={16} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                                            Carregando itens...
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {!isLoading && (
                        <div className="flex-none border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-20 shadow-[0_-8px_15px_-3px_rgba(0,0,0,0.1)]">
                            <div className="md:hidden p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                                <div className="grid grid-cols-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    {factoryTotals.map((factory) => (
                                        <div key={factory.key} className="border-r last:border-r-0 border-slate-200 dark:border-slate-800">
                                            <div className={cn("h-10 flex items-center justify-center px-1 text-[10px] font-black uppercase text-center", factory.color, factory.text)}>
                                                {factory.shortLabel}
                                            </div>
                                            <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-950">
                                                <div className="py-2 text-center">
                                                    <span className="block text-[9px] font-bold uppercase text-slate-400">Est.</span>
                                                    <span className="text-xs font-black text-slate-800 dark:text-slate-100">{factory.estoque}</span>
                                                </div>
                                                <div className="py-2 text-center">
                                                    <span className="block text-[9px] font-bold uppercase text-slate-400">Pend.</span>
                                                    <span className="text-xs font-black text-orange-600">{factory.pendencia}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Totais do Rodapé - Divididos por Fábrica */}
                            <div className="hidden md:block px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
                                <div className="flex items-start justify-start gap-6 min-w-max pb-1">
                                    {/* MK */}
                                    <div className="flex flex-col gap-1 border-r border-slate-200 dark:border-slate-700 pr-6">
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">MK</span>
                                        <div className="flex items-center gap-4">
                                            <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase">Est</span><span className="text-base font-bold">{filteredStock.reduce((acc, item) => acc + (item.est_mk || 0), 0)}</span></div>
                                            <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase">Pnd</span><span className="text-base font-bold">{filteredStock.reduce((acc, item) => acc + (item.pend_mk || 0), 0)}</span></div>
                                            <div className="flex flex-col bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase">Ped</span>
                                                <span className="text-lg font-black text-amber-800 dark:text-amber-300">{filteredStock.reduce((acc, item) => acc + (pendencies[item.codigo]?.MK || 0), 0)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* MOLERI */}
                                    <div className="flex flex-col gap-1 border-r border-slate-200 dark:border-slate-700 pr-6">
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">MOLERI</span>
                                        <div className="flex items-center gap-4">
                                            <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase">Est</span><span className="text-base font-bold">{filteredStock.reduce((acc, item) => acc + (item.est_moleri || 0), 0)}</span></div>
                                            <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase">Pnd</span><span className="text-base font-bold">{filteredStock.reduce((acc, item) => acc + (item.pend_moleri || 0), 0)}</span></div>
                                            <div className="flex flex-col bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase">Ped</span>
                                                <span className="text-lg font-black text-amber-800 dark:text-amber-300">{filteredStock.reduce((acc, item) => acc + (pendencies[item.codigo]?.MOLERI || 0), 0)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* CM */}
                                    <div className="flex flex-col gap-1 border-r border-slate-200 dark:border-slate-700 pr-6">
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">CM</span>
                                        <div className="flex items-center gap-4">
                                            <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase">Est</span><span className="text-base font-bold">{filteredStock.reduce((acc, item) => acc + (item.est_cm || 0), 0)}</span></div>
                                            <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase">Pnd</span><span className="text-base font-bold">{filteredStock.reduce((acc, item) => acc + (item.pend_cm || 0), 0)}</span></div>
                                            <div className="flex flex-col bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase">Ped</span>
                                                <span className="text-lg font-black text-amber-800 dark:text-amber-300">{filteredStock.reduce((acc, item) => acc + (pendencies[item.codigo]?.CM || 0), 0)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* OLIMPO */}
                                    <div className="flex flex-col gap-1 pr-6 border-r border-slate-200 dark:border-slate-700">
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">OLIMPO</span>
                                        <div className="flex items-center gap-4">
                                            <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase">Est</span><span className="text-base font-bold">{filteredStock.reduce((acc, item) => acc + (item.est_olimpo || 0), 0)}</span></div>
                                            <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase">Pnd</span><span className="text-base font-bold">{filteredStock.reduce((acc, item) => acc + (item.pend_olimpo || 0), 0)}</span></div>
                                            <div className="flex flex-col bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase">Ped</span>
                                                <span className="text-lg font-black text-amber-800 dark:text-amber-300">{filteredStock.reduce((acc, item) => acc + (pendencies[item.codigo]?.OLIMPO || 0), 0)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Botão Zerar/Arquivar - Estilo Bloco */}
                                    {isAdmin && (
                                        <div className="flex flex-col gap-1 pl-6">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AÇÕES</span>
                                            <button
                                                onClick={handleClearAll}
                                                className="flex items-center gap-2 h-[42px] px-3 bg-slate-100 dark:bg-slate-800 hover:bg-red-500 dark:hover:bg-red-900/50 hover:text-white dark:hover:text-red-100 text-slate-500 rounded-xl transition-all border border-slate-200 dark:border-slate-700 hover:border-red-500 group shadow-sm active:scale-95"
                                            >
                                                <Archive className="w-4 h-4" />
                                                <span className="text-[10px] font-black uppercase whitespace-nowrap">Zerar Semana</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Paginação */}
                            <div className="p-3 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900">
                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredStock.length)} de {filteredStock.length} rodas
                                </span>
                                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1.5 text-sm font-semibold rounded cursor-pointer transition-colors text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 dark:active:bg-slate-600"
                                    >
                                        Anterior
                                    </button>
                                    <div className="text-sm font-black text-amber-600 dark:text-amber-500 px-3 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded shadow-inner">
                                        {currentPage} <span className="text-slate-400 font-medium">/ {totalPages}</span>
                                    </div>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1.5 text-sm font-semibold rounded cursor-pointer transition-colors text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 dark:active:bg-slate-600"
                                    >
                                        Próximo
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
            </main>

            <PendencyQuantityModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                item={modalConfig.item}
                factory={modalConfig.factory}
                photoUrl={modalConfig.photoUrl}
                stockQty={modalConfig.stockQty}
                pendencyQty={modalConfig.pendencyQty}
                currentQty={modalConfig.currentQty}
                onConfirm={handleConfirmQty}
            />

            <SketchModal
                isOpen={sketchModalOpen}
                onClose={() => setSketchModalOpen(false)}
                onSave={handleSaveSketch}
                onDelete={handleDeleteSketch}
                initialData={activeSketchItem ? sketches[activeSketchItem.codigo] : null}
                title={activeSketchItem?.title || ""}
            />

            <AudioRecorderModal
                isOpen={audioModalOpen}
                onClose={() => setAudioModalOpen(false)}
                onSave={handleSaveAudio}
                title={activeAudioItem?.title || ""}
            />

            <AudioPlayerModal
                isOpen={audioPlayerOpen}
                onClose={() => setAudioPlayerOpen(false)}
                onDelete={() => activeAudioItem && handleDeleteAudio(activeAudioItem.codigo)}
                audioUrl={activeAudioItem ? audios[activeAudioItem.codigo] : null}
                title={activeAudioItem?.title || ""}
            />

            {/* Modal de Importação e Sincronização Cloud */}
            {/* Modal de Exportação */}
            <AnimatePresence>
                {isClearWeekModalOpen && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => !isClearingWeek && setIsClearWeekModalOpen(false)}
                            className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.92, opacity: 0, y: 18 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.92, opacity: 0, y: 18 }}
                            className="relative w-full max-w-md rounded-[28px] bg-white dark:bg-slate-900 shadow-2xl border border-white/60 dark:border-slate-800 overflow-hidden"
                        >
                            <div className="px-8 py-9 text-center">
                                <div className="mx-auto mb-7 w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                    <AlertTriangle className="w-8 h-8 text-amber-500" />
                                </div>

                                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-3">
                                    Atenção!
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 text-[15px] leading-7 font-medium">
                                    Ao zerar a semana, todos os pedidos atuais serão enviados para o <strong className="text-slate-700 dark:text-slate-200">histórico</strong>. Também serão limpos o <strong className="text-slate-700 dark:text-slate-200">estoque</strong> e a <strong className="text-slate-700 dark:text-slate-200">pendência</strong> carregados por upload na nuvem.
                                </p>

                                <div className="mt-8 space-y-3">
                                    <button
                                        onClick={executeClearWeek}
                                        disabled={isClearingWeek}
                                        className="w-full h-12 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-600/20 transition-all active:scale-[0.98]"
                                    >
                                        {isClearingWeek ? 'Zerando semana...' : 'Zerar semana'}
                                    </button>
                                    <button
                                        onClick={() => setIsClearWeekModalOpen(false)}
                                        disabled={isClearingWeek}
                                        className="w-full h-12 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50"
                                    >
                                        Voltar
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {isExportModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => !isExportLoading && setIsExportModalOpen(false)}
                            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl relative overflow-hidden"
                        >
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="bg-emerald-100 dark:bg-emerald-900/30 p-3 rounded-2xl">
                                        <FileSpreadsheet className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <button
                                        onClick={() => setIsExportModalOpen(false)}
                                        disabled={isExportLoading}
                                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
                                    >
                                        <X className="w-6 h-6 text-slate-400" />
                                    </button>
                                </div>

                                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">Exportar Pedidos</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
                                    Deseja gerar o relatório com todos os pedidos atuais e saldos de fábrica em formato Excel?
                                </p>

                                <div className="space-y-3">
                                    <button
                                        onClick={executeExport}
                                        disabled={isExportLoading}
                                        className={cn(
                                            "w-full py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20",
                                            isExportLoading
                                                ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                                                : "bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98]"
                                        )}
                                    >
                                        {isExportLoading ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 border-3 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                                                Gerando...
                                            </div>
                                        ) : (
                                            <>
                                                <CloudUpload className="w-6 h-6" />
                                                Gerar Planilha
                                            </>
                                        )}
                                    </button>

                                    <button
                                        onClick={() => setIsExportModalOpen(false)}
                                        disabled={isExportLoading}
                                        className="w-full py-4 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-colors disabled:opacity-50"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>

                            {/* Footer decorativo */}
                            <div className="bg-slate-50 dark:bg-slate-950/50 px-6 py-4 flex items-center justify-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Excel Automático</span>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <WelcomeModal 
                isOpen={isWelcomeModalOpen} 
                onClose={() => {
                    setIsWelcomeModalOpen(false);
                    localStorage.setItem('@MK_WELCOME_CLOUD_SEEN', 'true');
                    setTimeout(() => setIsTourOpen(true), 500); // Inicia o tour logo após
                }} 
            />

            <OnboardingTour 
                isOpen={isTourOpen} 
                onClose={() => setIsTourOpen(false)} 
            />
        </div>
    );
};
