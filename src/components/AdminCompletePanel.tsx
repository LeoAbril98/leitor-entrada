import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'react-hot-toast';
import {
    AlertTriangle,
    ArrowLeft,
    Camera,
    CloudUpload,
    Database,
    FileSpreadsheet,
    Filter,
    History as HistoryIcon,
    Info,
    LayoutGrid,
    Loader2,
    Package,
    Pencil,
    Plus,
    RotateCcw,
    Save,
    Search,
    Settings,
    ShoppingCart,
    Sliders,
    Tag,
    Trash2,
    TrendingUp,
    Upload,
    X,
    Mic,
    PenTool,
    Volume2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import Lottie from 'lottie-react';
import { saveAs } from 'file-saver';
import cloudSyncAnimation from '../assets/cloud-sync.json';
import { cn } from '../utils';
import {
    getPhotoOverrides,
    loadPedidosFabrica,
    savePhotoOverride,
    uploadPhotoToStorage,
    getGlobalTags,
    addGlobalTag,
    deleteGlobalTag,
    syncPendenciasToCloud,
    clearPendenciasInventory,
    getPendenciaCompletaBaseRows,
    savePendenciaCompletaBaseRows,
    getPendenciaExportCodeMappings,
    savePendenciaExportCodeMappings,
    deletePendenciaExportCodeMapping,
    getItemTags, 
    saveItemTags,
    saveCloudSketch,
    deleteCloudSketch,
    saveCloudAudio,
    deleteCloudAudio,
    getCloudAudio,
    getAllCloudSketches,
    getAllCloudAudios,
    clearAllPedidosFabrica,
    archiveAndClearPedidos
} from '../lib/supabase';
import {
    getModelAndFinish,
    getWheelPhotoUrl,
    photoMap,
    setPhotoOverrides
} from '../utils/photoUtils';
import { SketchModal } from './SketchModal';
import { AudioRecorderModal } from './AudioRecorderModal';
import { AudioPlayerModal } from './AudioPlayerModal';
import { saveSketch, getSketch, getAllSketches, deleteSketch, saveAudio, getAudio, getAllAudioKeys, deleteAudio } from '../lib/sketchStore';

interface AdminCompletePanelProps {
    onBack: () => void;
    onViewHistory: () => void;
}

type DepotKey = 'pr' | 'sc' | 'cm' | 'rs';
type MetricKey = 'estoque' | 'pendencia';
type FactoryName = 'MK' | 'MOLERI' | 'CM' | 'OLIMPO';

interface CompleteWheelRow {
    codigo: string;
    descricao: string;
    custo: number;
    ordem: number;
    ordemOrigem?: 'importada';
    pedido_pr: number;
    estoque_pr: number;
    pendencia_pr: number;
    pedido_sc: number;
    estoque_sc: number;
    pendencia_sc: number;
    pedido_cm: number;
    estoque_cm: number;
    pendencia_cm: number;
    pedido_rs: number;
    estoque_rs: number;
    pendencia_rs: number;
}

interface UploadSlot {
    depot: DepotKey;
    metric: MetricKey;
    label: string;
}

interface PhotoTarget {
    model: string;
    finish: string;
    description: string;
    codigo: string;
}

interface MissingImportItem {
    codigo: string;
    codigoOriginal?: string;
    descricao: string;
    quantidade: number;
}

interface ImportReport {
    label: string;
    uploadKey: string;
    fileName: string;
    field: keyof CompleteWheelRow;
    totalLido: number;
    totalImportado: number;
    quantidadeImportada: number;
    quantidadeNaoImportada: number;
    missingItems: MissingImportItem[];
    pendingRows: CompleteWheelRow[];
    exportCodeMappings: Record<string, ExportMapping>;
}

interface ExportMapping {
    codigo: string;
    descricao?: string;
}

interface UploadSummary {
    fileName: string;
    totalItens: number;
    quantidadeTotal: number;
}

const STORAGE_KEY = '@MK_PENDENCIA_COMPLETA_ROWS';
const UPLOAD_SUMMARY_STORAGE_KEY = '@MK_PENDENCIA_COMPLETA_UPLOAD_SUMMARY';
const CODE_MAPPING_STORAGE_KEY = '@MK_PENDENCIA_COMPLETA_CODE_MAPPINGS';
const EXPORT_CODE_MAPPING_STORAGE_KEY = '@MK_PENDENCIA_COMPLETA_EXPORT_CODE_MAPPINGS';

const DEPOTS: { key: DepotKey; label: string }[] = [
    { key: 'pr', label: 'PR' },
    { key: 'sc', label: 'SC' },
    { key: 'cm', label: 'CM' },
    { key: 'rs', label: 'RS' }
];

const DEPOT_FACTORIES: Record<DepotKey, FactoryName> = {
    pr: 'MK',
    sc: 'MOLERI',
    cm: 'CM',
    rs: 'OLIMPO'
};

const DEPOT_STYLES: Record<DepotKey, { group: string; order: string; body: string }> = {
    pr: {
        group: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-300',
        order: 'bg-indigo-200 dark:bg-indigo-800',
        body: 'bg-indigo-50/20 dark:bg-indigo-900/5'
    },
    sc: {
        group: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300',
        order: 'bg-emerald-200 dark:bg-emerald-800',
        body: 'bg-emerald-50/20 dark:bg-emerald-900/5'
    },
    cm: {
        group: 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300',
        order: 'bg-amber-200 dark:bg-amber-800',
        body: 'bg-amber-50/20 dark:bg-amber-900/5'
    },
    rs: {
        group: 'bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-300',
        order: 'bg-rose-200 dark:bg-rose-800',
        body: 'bg-rose-50/20 dark:bg-rose-900/5'
    }
};

const REPLACEMENT_RULES_STORAGE_KEY = '@MK_COMPLETA_REPLACEMENT_RULES';

export type ReplacementRuleType = 'prefix_swap' | 'suffix_replace' | 'remove_char' | 'remove_asterisk';

export interface ReplacementRule {
    id: string;
    description: string;
    type: ReplacementRuleType;
    active: boolean;
    targetPrefixes: string[]; // Se vazio, aplica a todos. Ex: ['C55', 'M12']
    oldPrefix?: string;
    newPrefix?: string;
    oldSuffix?: string;
    newSuffix?: string;
    charToRemove?: string;
}

export const DEFAULT_REPLACEMENT_RULES: ReplacementRule[] = [
    {
        id: 'remove-asterisk',
        description: 'Remover asterisco (*) de códigos que começam com C ou R',
        type: 'remove_asterisk',
        active: true,
        targetPrefixes: [],
    },
    {
        id: 'c-to-e',
        description: 'Trocar prefixo C por E',
        type: 'prefix_swap',
        active: true,
        targetPrefixes: ['C55', 'C56', 'C58', 'C63', 'C64', 'C87', 'C90'],
        oldPrefix: 'C',
        newPrefix: 'E'
    },
    {
        id: 'c56-lbd-to-bd',
        description: 'Corrigir sufixo LBD para BD',
        type: 'suffix_replace',
        active: true,
        targetPrefixes: ['E56', 'C56'],
        oldSuffix: 'LBD',
        newSuffix: 'BD'
    },
    {
        id: 'c56-bd-to-d',
        description: 'Corrigir sufixo BD para D',
        type: 'suffix_replace',
        active: true,
        targetPrefixes: ['E56', 'C56'],
        oldSuffix: 'BD',
        newSuffix: 'D'
    },
    {
        id: 'remove-u',
        description: 'Remover caractere U',
        type: 'remove_char',
        active: true,
        targetPrefixes: ['M12', 'M22'],
        charToRemove: 'U'
    }
];

const UPLOAD_SLOTS: UploadSlot[] = DEPOTS.flatMap(({ key, label }) => [
    { depot: key, metric: 'estoque', label: `Estoque ${label}` },
    { depot: key, metric: 'pendencia', label: `Pendência ${label}` }
]);

const getUploadKey = (slot: UploadSlot) => `${slot.metric}_${slot.depot}`;
const getUploadField = (slot: UploadSlot) => `${slot.metric}_${slot.depot}` as keyof CompleteWheelRow;

const emptyRow = (): CompleteWheelRow => ({
    codigo: '',
    descricao: '',
    custo: 0,
    ordem: 0,
    ordemOrigem: undefined,
    pedido_pr: 0,
    estoque_pr: 0,
    pendencia_pr: 0,
    pedido_sc: 0,
    estoque_sc: 0,
    pendencia_sc: 0,
    pedido_cm: 0,
    estoque_cm: 0,
    pendencia_cm: 0,
    pedido_rs: 0,
    estoque_rs: 0,
    pendencia_rs: 0
});

const normalize = (value: unknown) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9]/gi, '')
        .toUpperCase();

const normalizeDescriptionSearch = (value: unknown) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/114[,.]3/g, '114')
        .replace(/139[,.]7/g, '139')
        .replace(/(\d+)[,.]0+(?=\D|$)/g, '$1')
        .replace(/[^A-Z0-9]/gi, '')
        .toUpperCase();

const parseNumber = (value: unknown) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const raw = String(value || '').trim();
    if (!raw) return 0;
    const cleaned = raw.replace(/\s/g, '').replace(/[R$]/gi, '');
    const decimal = cleaned.includes(',')
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned;
    const parsed = Number.parseFloat(decimal);
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatNumber = (value: number) => value.toLocaleString('pt-BR');

const normalizeUploadCode = (codigo: string, rules: ReplacementRule[] = DEFAULT_REPLACEMENT_RULES) => {
    let normalized = codigo.trim().toUpperCase();
    const activeRules = rules.filter(r => r.active);

    for (const rule of activeRules) {
        const currentPrefix = normalized.slice(0, 3);
        const matchesPrefix = rule.targetPrefixes.length === 0 || rule.targetPrefixes.includes(currentPrefix);

        if (!matchesPrefix) continue;

        if (rule.type === 'remove_asterisk') {
            if (/^[CR]/.test(normalized)) {
                normalized = normalized.replace(/\*/g, '');
            }
        } 
        else if (rule.type === 'prefix_swap' && rule.oldPrefix && rule.newPrefix) {
            if (normalized.startsWith(rule.oldPrefix)) {
                normalized = rule.newPrefix + normalized.slice(rule.oldPrefix.length);
            }
        }
        else if (rule.type === 'suffix_replace' && rule.oldSuffix && rule.newSuffix) {
            if (normalized.endsWith(rule.oldSuffix)) {
                normalized = normalized.slice(0, -rule.oldSuffix.length) + rule.newSuffix;
            }
        }
        else if (rule.type === 'remove_char' && rule.charToRemove) {
            const regex = new RegExp(rule.charToRemove, 'g');
            normalized = normalized.replace(regex, '');
        }
    }

    return normalized;
};

const getFallbackOriginalExportCode = (codigo: string) => {
    const normalized = codigo.trim().toUpperCase();
    const prefix = normalized.slice(0, 3);
    const eToCPrefixes = ['E55', 'E56', 'E58', 'E63', 'E64', 'E87', 'E90'];
    let fallback = normalized;

    if (eToCPrefixes.includes(prefix)) {
        fallback = `C${normalized.slice(1)}`;
    }

    if (fallback.startsWith('C56') && /D$/.test(fallback) && !/BD$/.test(fallback)) {
        fallback = `${fallback.slice(0, -1)}BD`;
    }

    if (/^[CR]/.test(fallback) && !fallback.endsWith('*')) {
        fallback = `${fallback}*`;
    }

    return fallback || codigo;
};

const findValue = (row: Record<string, unknown>, aliases: string[]) => {
    const normalizedAliases = aliases.map(normalize);
    const key = Object.keys(row).find((candidate) => normalizedAliases.includes(normalize(candidate)));
    return key ? row[key] : undefined;
};

const getColumnValue = (row: Record<string, unknown>, index: number) => Object.values(row)[index];

const readWorkbookRows = async (file: File): Promise<Record<string, unknown>[]> => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames.find((name) => normalize(name) === 'PRINCIPAL') || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
};

const compressImage = (file: File, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;

                if (width > height && width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                } else if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
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
                canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Canvas blob conversion failed')), 'image/jpeg', quality);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};

const loadStoredRows = (): CompleteWheelRow[] => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed)
            ? parsed.map((row, index) => ({ ...emptyRow(), ...row, ordem: Number(row.ordem ?? index) }))
            : [];
    } catch {
        return [];
    }
};

const loadUploadSummaries = (): Record<string, UploadSummary> => {
    try {
        const stored = localStorage.getItem(UPLOAD_SUMMARY_STORAGE_KEY);
        if (!stored) return {};
        const parsed = JSON.parse(stored);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

const loadCodeMappings = (): Record<string, string> => {
    try {
        const stored = localStorage.getItem(CODE_MAPPING_STORAGE_KEY);
        if (!stored) return {};
        const parsed = JSON.parse(stored);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

const loadExportCodeMappings = (): Record<string, ExportMapping> => {
    try {
        const stored = localStorage.getItem(EXPORT_CODE_MAPPING_STORAGE_KEY);
        if (!stored) return {};
        const parsed = JSON.parse(stored);
        if (!parsed || typeof parsed !== 'object') return {};

        return Object.entries(parsed as Record<string, unknown>).reduce<Record<string, ExportMapping>>((acc, [fixedCode, value]) => {
            if (typeof value === 'string') {
                acc[fixedCode] = { codigo: value };
            } else if (value && typeof value === 'object') {
                const mapping = value as Partial<ExportMapping>;
                if (mapping.codigo) acc[fixedCode] = { codigo: String(mapping.codigo), descricao: mapping.descricao ? String(mapping.descricao) : undefined };
            }
            return acc;
        }, {});
    } catch {
        return {};
    }
};

const loadReplacementRules = (): ReplacementRule[] => {
    try {
        const stored = localStorage.getItem(REPLACEMENT_RULES_STORAGE_KEY);
        if (!stored) return DEFAULT_REPLACEMENT_RULES;
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        return DEFAULT_REPLACEMENT_RULES;
    } catch {
        return DEFAULT_REPLACEMENT_RULES;
    }
};

const loadCatalogOrder = async () => {
    try {
        const response = await fetch('/tabela.csv');
        if (!response.ok) return new Map<string, number>();

        const text = await response.text();
        const order = new Map<string, number>();
        text.split(/\r?\n/).forEach((line, index) => {
            const codigo = line.split(';')[0]?.trim();
            if (codigo && !order.has(codigo)) order.set(codigo, index);
        });
        return order;
    } catch {
        return new Map<string, number>();
    }
};

export const AdminCompletePanel: React.FC<AdminCompletePanelProps> = ({ onBack, onViewHistory }) => {
    const [view, setView] = useState<'dashboard' | 'table'>('dashboard');
    const [rows, setRows] = useState<CompleteWheelRow[]>(loadStoredRows);
    const [catalogOrder, setCatalogOrder] = useState<Map<string, number>>(new Map());
    const [query, setQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [editingCode, setEditingCode] = useState<string | null>(null);
    const [draft, setDraft] = useState<CompleteWheelRow>(emptyRow);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [showUnsyncedWarning, setShowUnsyncedWarning] = useState(false);
    const [showSyncConfirm, setShowSyncConfirm] = useState(false);
    const [showSyncSuccess, setShowSyncSuccess] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isSyncingCloud, setIsSyncingCloud] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [activeSettingsTab, setActiveSettingsTab] = useState<'vinculos' | 'regras' | 'tags'>('vinculos');
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
    const [isPhotoUploading, setIsPhotoUploading] = useState(false);
    const [importReport, setImportReport] = useState<ImportReport | null>(null);
    const [uploadSummaries, setUploadSummaries] = useState<Record<string, UploadSummary>>(loadUploadSummaries);
    const [codeMappings, setCodeMappings] = useState<Record<string, string>>(loadCodeMappings);
    const [exportCodeMappings, setExportCodeMappings] = useState<Record<string, ExportMapping>>(loadExportCodeMappings);
    const [replacementRules, setReplacementRules] = useState<ReplacementRule[]>(loadReplacementRules);
    const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});
    const [linkTargetItem, setLinkTargetItem] = useState<MissingImportItem | null>(null);
    const [linkSearch, setLinkSearch] = useState('');
    const [addTargetItem, setAddTargetItem] = useState<MissingImportItem | null>(null);
    const [resetUploadSlot, setResetUploadSlot] = useState<UploadSlot | null>(null);
    const [expandedMobileCode, setExpandedMobileCode] = useState<string | null>(null);
    const [photoTarget, setPhotoTarget] = useState<PhotoTarget | null>(null);
    const [availablePhotos, setAvailablePhotos] = useState<string[]>([]);
    const [lastUploads, setLastUploads] = useState<Record<string, string>>({});
    const [globalTags, setGlobalTags] = useState<string[]>([]);
    const [newTagName, setNewTagName] = useState("");
    
    // Filtros Antigos
    const [showFilters, setShowFilters] = useState(false);
    const [filterLinha, setFilterLinha] = useState("");
    const [filterAro, setFilterAro] = useState("");
    const [filterFuracao, setFilterFuracao] = useState("");
    const [filterModelo, setFilterModelo] = useState("");
    const [filterAcabamento, setFilterAcabamento] = useState("");

    // Novos Filtros
    const [filterFactoryOrders, setFilterFactoryOrders] = useState(false);
    const [filterHasTags, setFilterHasTags] = useState(false);
    const [filterHasSketch, setFilterHasSketch] = useState(false);
    const [filterHasAudio, setFilterHasAudio] = useState(false);

    // Tags, Sketch e Audio States
    const [itemTags, setItemTags] = useState<Record<string, string[]>>({});
    const [tagMenuOpen, setTagMenuOpen] = useState<string | null>(null);

    const [sketches, setSketches] = useState<Record<string, string>>({});
    const [sketchModalOpen, setSketchModalOpen] = useState(false);
    const [activeSketchItem, setActiveSketchItem] = useState<{ codigo: string, title: string } | null>(null);

    const [audios, setAudios] = useState<Record<string, string>>({}); // codigo -> blobUrl
    const [audioModalOpen, setAudioModalOpen] = useState(false);
    const [audioPlayerOpen, setAudioPlayerOpen] = useState(false);
    const [activeAudioItem, setActiveAudioItem] = useState<{ codigo: string, title: string } | null>(null);

    const baseInputRef = useRef<HTMLInputElement | null>(null);
    const tableContainerRef = useRef<HTMLDivElement | null>(null);

    // Lógicas de Carregamento
    const loadItemTags = async () => {
        const tags = await getItemTags();
        setItemTags(tags);
    };

    const loadExportMappings = async () => {
        const cloudMappings = await getPendenciaExportCodeMappings();
        if (Object.keys(cloudMappings).length === 0) return;

        setExportCodeMappings((current) => {
            const next = { ...current, ...cloudMappings };
            localStorage.setItem(EXPORT_CODE_MAPPING_STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    };

    const loadSketches = async () => {
        const localData = await getAllSketches();
        const cloudData = await getAllCloudSketches();
        const merged = { ...cloudData, ...localData };
        setSketches(merged);
        for (const [codigo, dataUrl] of Object.entries(cloudData)) {
            if (!localData[codigo]) await saveSketch(codigo, dataUrl as string);
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

    const loadAudios = async () => {
        const localKeys = await getAllAudioKeys();
        const urls: Record<string, string> = {};
        for (const key of localKeys) {
            const blob = await getAudio(key);
            if (blob) urls[key] = URL.createObjectURL(blob);
        }
        const cloudAudios = await getAllCloudAudios();
        for (const [codigo, base64] of Object.entries(cloudAudios)) {
            if (!urls[codigo]) {
                const blob = base64ToBlob(base64 as string);
                await saveAudio(codigo, blob);
                urls[codigo] = URL.createObjectURL(blob);
            }
        }
        setAudios(urls);
    };

    useEffect(() => {
        loadCatalogOrder().then(setCatalogOrder);
        getGlobalTags().then(setGlobalTags);
        loadItemTags();
        loadExportMappings();
        loadSketches();
        loadAudios();
    }, []);

    useEffect(() => {
        let isMounted = true;

        const loadBaseRowsFromCloud = async () => {
            if (rows.length > 0) return;

            const cloudRows = await getPendenciaCompletaBaseRows();
            if (!isMounted || cloudRows.length === 0) return;

            const baseRows = cloudRows.map((row, index) => ({
                ...emptyRow(),
                codigo: row.codigo,
                descricao: row.descricao,
                custo: Number(row.custo) || 0,
                ordem: Number(row.ordem ?? index),
                ordemOrigem: row.ordem_origem === 'importada' ? 'importada' as const : undefined
            }));

            const pedidos = await loadPedidosFabrica();
            const orderByCode = new Map<string, Partial<Record<DepotKey, number>>>();

            pedidos.forEach((pedido: { codigo: string; factory: string; quantidade: number }) => {
                const depot = DEPOTS.find((item) => DEPOT_FACTORIES[item.key] === pedido.factory)?.key;
                if (!depot) return;

                const current = orderByCode.get(pedido.codigo) || {};
                current[depot] = Number(pedido.quantidade) || 0;
                orderByCode.set(pedido.codigo, current);
            });

            const rowsWithOrders = baseRows.map((row) => {
                const orders = orderByCode.get(row.codigo);
                if (!orders) return row;

                return {
                    ...row,
                    pedido_pr: orders.pr ?? row.pedido_pr,
                    pedido_sc: orders.sc ?? row.pedido_sc,
                    pedido_cm: orders.cm ?? row.pedido_cm,
                    pedido_rs: orders.rs ?? row.pedido_rs
                };
            });

            setRows(rowsWithOrders);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(rowsWithOrders));
            toast.success('Base fixa carregada da nuvem.', { duration: 2000 });
        };

        loadBaseRowsFromCloud();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        const migrateLocalBaseToCloud = async () => {
            if (rows.length === 0) return;

            const cloudRows = await getPendenciaCompletaBaseRows();
            if (!isMounted || cloudRows.length > 0) return;

            const success = await savePendenciaCompletaBaseRows(rows.map((row, index) => ({
                codigo: row.codigo,
                descricao: row.descricao,
                custo: row.custo,
                ordem: row.ordem ?? index,
                ordem_origem: row.ordemOrigem || null
            })));

            if (success) toast.success('Base fixa enviada para a nuvem.', { duration: 2000 });
        };

        migrateLocalBaseToCloud();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        const syncOrdersFromPendencies = async () => {
            const pedidos = await loadPedidosFabrica();
            if (!isMounted || pedidos.length === 0) return;

            setRows((currentRows) => {
                const orderByCode = new Map<string, Partial<Record<DepotKey, number>>>();

                pedidos.forEach((pedido: { codigo: string; factory: string; quantidade: number }) => {
                    const depot = DEPOTS.find((item) => DEPOT_FACTORIES[item.key] === pedido.factory)?.key;
                    if (!depot) return;

                    const current = orderByCode.get(pedido.codigo) || {};
                    current[depot] = Number(pedido.quantidade) || 0;
                    orderByCode.set(pedido.codigo, current);
                });

                const nextRows = currentRows.map((row) => {
                    const orders = orderByCode.get(row.codigo);
                    if (!orders) return row;

                    return {
                        ...row,
                        pedido_pr: orders.pr ?? row.pedido_pr,
                        pedido_sc: orders.sc ?? row.pedido_sc,
                        pedido_cm: orders.cm ?? row.pedido_cm,
                        pedido_rs: orders.rs ?? row.pedido_rs
                    };
                });

                localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRows));
                return nextRows;
            });
        };

        syncOrdersFromPendencies();

        return () => {
            isMounted = false;
        };
    }, []);

    const persistRows = (nextRows: CompleteWheelRow[]) => {
        setRows(nextRows);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRows));
        savePendenciaCompletaBaseRows(nextRows.map((row, index) => ({
            codigo: row.codigo,
            descricao: row.descricao,
            custo: row.custo,
            ordem: row.ordem ?? index,
            ordem_origem: row.ordemOrigem || null
        }))).then((success) => {
            if (!success) console.warn('Falha ao sincronizar base fixa da Pendência Completa.');
        });
    };

    const persistUploadSummaries = (nextSummaries: Record<string, UploadSummary>) => {
        setUploadSummaries(nextSummaries);
        localStorage.setItem(UPLOAD_SUMMARY_STORAGE_KEY, JSON.stringify(nextSummaries));
    };

    const persistCodeMappings = (nextMappings: Record<string, string>) => {
        setCodeMappings(nextMappings);
        localStorage.setItem(CODE_MAPPING_STORAGE_KEY, JSON.stringify(nextMappings));
    };

    const persistExportCodeMappings = (nextMappings: Record<string, ExportMapping>) => {
        setExportCodeMappings(nextMappings);
        localStorage.setItem(EXPORT_CODE_MAPPING_STORAGE_KEY, JSON.stringify(nextMappings));
        savePendenciaExportCodeMappings(nextMappings).then((success) => {
            if (!success) console.warn('Falha ao sincronizar vínculos de exportação com o Supabase.');
        });
    };

    const persistReplacementRules = (newRules: ReplacementRule[]) => {
        setReplacementRules(newRules);
        localStorage.setItem(REPLACEMENT_RULES_STORAGE_KEY, JSON.stringify(newRules));
    };

    const toggleRuleActive = (ruleId: string) => {
        const newRules = replacementRules.map(r => 
            r.id === ruleId ? { ...r, active: !r.active } : r
        );
        persistReplacementRules(newRules);
        toast.success('Status da regra atualizado!');
    };

    const getFields = (item: CompleteWheelRow) => {
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

    const uniqueLinhas = useMemo(() => Array.from(new Set(rows.map(item => getFields(item).linha))).filter(Boolean).sort(), [rows]);
    
    const itemsForModelo = useMemo(() => rows.filter(item => !filterLinha || getFields(item).linha === filterLinha), [rows, filterLinha]);
    const uniqueModelos = useMemo(() => Array.from(new Set(itemsForModelo.map(item => getFields(item).model))).filter(Boolean).sort(), [itemsForModelo]);

    const itemsForAro = useMemo(() => itemsForModelo.filter(item => !filterModelo || getFields(item).model === filterModelo), [itemsForModelo, filterModelo]);
    const uniqueAros = useMemo(() => Array.from(new Set(itemsForAro.map(item => getFields(item).aro))).filter(Boolean).sort(), [itemsForAro]);

    const itemsForFuracao = useMemo(() => itemsForAro.filter(item => !filterAro || getFields(item).aro === filterAro), [itemsForAro, filterAro]);
    const uniqueFuracoes = useMemo(() => Array.from(new Set(itemsForFuracao.map(item => getFields(item).furacao))).filter(Boolean).sort(), [itemsForFuracao]);

    const itemsForAcabamento = useMemo(() => itemsForFuracao.filter(item => !filterFuracao || getFields(item).furacao === filterFuracao), [itemsForFuracao, filterFuracao]);
    const uniqueAcabamentos = useMemo(() => Array.from(new Set(itemsForAcabamento.map(item => getFields(item).acabamento))).filter(Boolean).sort(), [itemsForAcabamento]);


    const filteredRows = useMemo(() => {
        const terms = String(query || '')
            .split(/\s+/)
            .map(normalizeDescriptionSearch)
            .filter(Boolean);
            
        let baseRows = terms.length === 0 ? rows : rows.filter((row) => {
            const haystackCode = normalize(row.codigo);
            const haystackDesc = normalizeDescriptionSearch(row.descricao);
            return terms.every((term) => haystackCode.includes(term) || haystackDesc.includes(term));
        });

        baseRows = baseRows.filter(item => {
            const { linha, aro, furacao, model, acabamento } = getFields(item);
            if (filterLinha && linha !== filterLinha) return false;
            if (filterAro && aro !== filterAro) return false;
            if (filterFuracao && furacao !== filterFuracao) return false;
            if (filterModelo && model !== filterModelo) return false;
            if (filterAcabamento && acabamento !== filterAcabamento) return false;
            
            if (filterFactoryOrders) {
                const hasOrder = (item.pedido_pr || 0) > 0 || 
                                 (item.pedido_sc || 0) > 0 || 
                                 (item.pedido_cm || 0) > 0 || 
                                 (item.pedido_rs || 0) > 0;
                if (!hasOrder) return false;
            }
            if (filterHasTags && (!itemTags[item.codigo] || itemTags[item.codigo].length === 0)) return false;
            if (filterHasSketch && !sketches[item.codigo]) return false;
            if (filterHasAudio && !audios[item.codigo]) return false;

            return true;
        });

        const getOrder = (row: CompleteWheelRow) => (
            row.ordemOrigem === 'importada'
                ? row.ordem
                : catalogOrder.get(row.codigo) ?? row.ordem
        );

        return [...baseRows].sort((left, right) => getOrder(left) - getOrder(right));
    }, [catalogOrder, query, rows, filterLinha, filterAro, filterFuracao, filterModelo, filterAcabamento, filterFactoryOrders, filterHasTags, filterHasSketch, filterHasAudio, itemTags, sketches, audios]);

    const totals = useMemo(() => {
        return DEPOTS.reduce((acc, depot) => {
            acc[depot.key] = {
                estoque: rows.reduce((sum, row) => sum + Number(row[`estoque_${depot.key}`] || 0), 0),
                pendencia: rows.reduce((sum, row) => sum + Number(row[`pendencia_${depot.key}`] || 0), 0),
                pedido: rows.reduce((sum, row) => sum + Number(row[`pedido_${depot.key}`] || 0), 0)
            };
            return acc;
        }, {} as Record<DepotKey, { estoque: number; pendencia: number; pedido: number }>);
    }, [rows]);

    const mobileDepots = DEPOTS.map((depot) => ({
        ...depot,
        shortLabel: depot.label === 'PR' ? 'MK' : depot.label,
        color: depot.key === 'pr'
            ? 'bg-indigo-50 dark:bg-indigo-950/40'
            : depot.key === 'sc'
                ? 'bg-emerald-50 dark:bg-emerald-950/40'
                : depot.key === 'cm'
                    ? 'bg-amber-50 dark:bg-amber-950/40'
                    : 'bg-slate-100 dark:bg-slate-800',
        text: depot.key === 'pr'
            ? 'text-indigo-700 dark:text-indigo-300'
            : depot.key === 'sc'
                ? 'text-emerald-700 dark:text-emerald-300'
                : depot.key === 'cm'
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-slate-700 dark:text-slate-300',
        border: depot.key === 'pr'
            ? 'border-indigo-300 dark:border-indigo-700'
            : depot.key === 'sc'
                ? 'border-emerald-300 dark:border-emerald-700'
                : depot.key === 'cm'
                    ? 'border-amber-300 dark:border-amber-700'
                    : 'border-slate-300 dark:border-slate-700'
    }));
    const getDepotValue = (row: CompleteWheelRow, depot: DepotKey, metric: MetricKey | 'pedido') => Number(row[`${metric}_${depot}` as keyof CompleteWheelRow] || 0);

    useEffect(() => {
        setCurrentPage(1);
    }, [query, rows.length, filterLinha, filterAro, filterFuracao, filterModelo, filterAcabamento]);

    useEffect(() => {
        tableContainerRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        window.scrollTo({ top: 0, behavior: 'auto' });
    }, [currentPage]);

    const dashboardTotals = useMemo(() => {
        const stats = {
            totalStock: 0,
            totalPnd: 0,
            totalOrders: 0,
            byFactoryEst: { MK: 0, MOLERI: 0, CM: 0, OLIMPO: 0 },
            byFactoryPnd: { MK: 0, MOLERI: 0, CM: 0, OLIMPO: 0 },
            byFactoryOrders: { MK: 0, MOLERI: 0, CM: 0, OLIMPO: 0 }
        };

        rows.forEach(item => {
            const prEst = Number(item.estoque_pr || 0);
            const scEst = Number(item.estoque_sc || 0);
            const cmEst = Number(item.estoque_cm || 0);
            const rsEst = Number(item.estoque_rs || 0);
            
            const prPnd = Number(item.pendencia_pr || 0);
            const scPnd = Number(item.pendencia_sc || 0);
            const cmPnd = Number(item.pendencia_cm || 0);
            const rsPnd = Number(item.pendencia_rs || 0);
            
            const prOrd = Number(item.pedido_pr || 0);
            const scOrd = Number(item.pedido_sc || 0);
            const cmOrd = Number(item.pedido_cm || 0);
            const rsOrd = Number(item.pedido_rs || 0);

            stats.byFactoryEst.MK += prEst;
            stats.byFactoryEst.MOLERI += scEst;
            stats.byFactoryEst.CM += cmEst;
            stats.byFactoryEst.OLIMPO += rsEst;
            stats.totalStock += prEst + scEst + cmEst + rsEst;

            stats.byFactoryPnd.MK += prPnd;
            stats.byFactoryPnd.MOLERI += scPnd;
            stats.byFactoryPnd.CM += cmPnd;
            stats.byFactoryPnd.OLIMPO += rsPnd;
            stats.totalPnd += prPnd + scPnd + cmPnd + rsPnd;

            stats.byFactoryOrders.MK += prOrd;
            stats.byFactoryOrders.MOLERI += scOrd;
            stats.byFactoryOrders.CM += cmOrd;
            stats.byFactoryOrders.OLIMPO += rsOrd;
            stats.totalOrders += prOrd + scOrd + cmOrd + rsOrd;
        });

        return stats;
    }, [rows]);

    const itemsPerPage = 100;
    const totalPages = Math.ceil(filteredRows.length / itemsPerPage) || 1;
    const currentPageRows = filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const firstVisibleItem = filteredRows.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const lastVisibleItem = Math.min(currentPage * itemsPerPage, filteredRows.length);
    const linkSearchResults = useMemo(() => {
        const terms = String(linkSearch || '')
            .split(/\s+/)
            .map(normalizeDescriptionSearch)
            .filter(Boolean);
        if (terms.length === 0) return rows.slice(0, 80);

        return rows
            .filter((row) => {
                const haystack = normalizeDescriptionSearch(row.descricao);
                return terms.every((term) => haystack.includes(term));
            })
            .slice(0, 80);
    }, [linkSearch, rows]);

    const importBaseFile = async (file: File) => {
        const toastId = toast.loading('Importando base fixa...');
        try {
            const sheetRows = await readWorkbookRows(file);
            const mapped = sheetRows
                .map((sheetRow, index) => {
                    const codigo = String(findValue(sheetRow, ['CODIGO', 'CÓDIGO', 'COD', 'CÓD']) || '').trim();
                    const descricao = String(findValue(sheetRow, ['DESCRICAO', 'DESCRIÇÃO', 'CATALOGO', 'CATÁLOGO']) || '').trim();
                    const custo = parseNumber(findValue(sheetRow, ['CUSTO', 'PRECO', 'PREÇO', 'PRECO FABRICA', 'PREÇO FÁBRICA']));
                    return { ...emptyRow(), codigo, descricao, custo, ordem: index, ordemOrigem: 'importada' as const };
                })
                .filter((row) => row.codigo && row.descricao);

            if (mapped.length === 0) {
                toast.error('Nenhum item com código e descrição foi encontrado.', { id: toastId });
                return;
            }

            const currentByCode = new Map(rows.map((row) => [row.codigo, row]));
            const merged = mapped.map((baseRow) => ({
                ...baseRow,
                ...Object.fromEntries(
                    Object.entries(currentByCode.get(baseRow.codigo) || {}).filter(([key]) => key.startsWith('pedido_') || key.startsWith('estoque_') || key.startsWith('pendencia_'))
                )
            }));

            persistRows(merged);
            toast.success(`${mapped.length} rodas salvas na base fixa.`, { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error('Erro ao ler a planilha da base fixa.', { id: toastId });
        } finally {
            if (baseInputRef.current) baseInputRef.current.value = '';
        }
    };

    const importMetricFile = async (file: File, slot: UploadSlot) => {
        if (rows.length === 0) {
            toast.error('Importe a base fixa antes de carregar estoque ou pendência.');
            return;
        }

        const toastId = toast.loading(`Lendo ${slot.label}...`);
        try {
            const sheetRows = await readWorkbookRows(file);
            const quantities = new Map<string, { descricao: string; quantidade: number; codigoOriginal?: string }>();
            const uploadExportCodeMappings: Record<string, ExportMapping> = {};

            sheetRows.forEach((sheetRow) => {
                const rawSourceCodigo = String(
                    findValue(sheetRow, ['PCE_ITEM', 'PRODUTO', 'CODIGO', 'CÓDIGO', 'COD', 'CÓD', 'ITEM', 'REFERENCIA', 'REFERÊNCIA'])
                    || getColumnValue(sheetRow, 0)
                    || ''
                ).trim();
                const sourceCodigo = normalizeUploadCode(rawSourceCodigo, replacementRules);
                const codigo = codeMappings[sourceCodigo] || sourceCodigo;
                const descricao = String(
                    findValue(sheetRow, ['NOME_ITEM', 'DESCRICAO', 'DESCRIÇÃO', 'DESCRICAO PRODUTO', 'DESCRIÇÃO PRODUTO', 'NOME', 'PRODUTO DESCRICAO', 'PRODUTO DESCRIÇÃO'])
                    || getColumnValue(sheetRow, 1)
                    || ''
                ).trim();
                const qty = parseNumber(
                    findValue(sheetRow, ['QUANTIDADE_PEDIDOS', 'QUANTIDADE', 'QTDE', 'QTD', 'SALDO', 'ESTOQUE', 'ESTOQUE DISPONIVEL', 'ESTOQUE DISPONÍVEL', 'PENDENCIA', 'PENDÊNCIA'])
                    ?? getColumnValue(sheetRow, 2)
                );
                if (!sourceCodigo) return;
                if ((rawSourceCodigo && rawSourceCodigo !== codigo) || descricao) {
                    const currentMapping = uploadExportCodeMappings[codigo];
                    uploadExportCodeMappings[codigo] = {
                        codigo: currentMapping?.codigo || rawSourceCodigo || sourceCodigo,
                        descricao: currentMapping?.descricao || descricao || undefined
                    };
                }

                const current = quantities.get(codigo);
                quantities.set(codigo, {
                    descricao: current?.descricao || descricao || (codigo !== sourceCodigo ? `Vínculo: ${sourceCodigo}` : ''),
                    quantidade: (current?.quantidade || 0) + qty,
                    codigoOriginal: current?.codigoOriginal || rawSourceCodigo || sourceCodigo
                });
            });

            const field = getUploadField(slot);
            const rowCodes = new Set(rows.map((row) => row.codigo));
            const missingItems = Array.from(quantities.entries())
                .filter(([codigo]) => !rowCodes.has(codigo))
                .map(([codigo, item]) => ({
                    codigo,
                    codigoOriginal: item.codigoOriginal,
                    descricao: item.descricao || '-',
                    quantidade: item.quantidade
                }));
            let matched = 0;
            let importedQuantity = 0;
            const nextRows = rows.map((row) => {
                const item = quantities.get(row.codigo);
                if (item === undefined) return row;
                matched += 1;
                importedQuantity += item.quantidade;
                return { ...row, [field]: item.quantidade };
            });
            const missingQuantity = missingItems.reduce((sum, item) => sum + item.quantidade, 0);

            setImportReport({
                label: slot.label,
                uploadKey: getUploadKey(slot),
                fileName: file.name,
                field,
                totalLido: quantities.size,
                totalImportado: matched,
                quantidadeImportada: importedQuantity,
                quantidadeNaoImportada: missingQuantity,
                missingItems,
                pendingRows: nextRows,
                exportCodeMappings: uploadExportCodeMappings
            });
            toast.success(`${slot.label}: prévia pronta para confirmar.`, { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error(`Erro ao importar ${slot.label}.`, { id: toastId });
        }
    };

    const startEdit = (row?: CompleteWheelRow) => {
        setDraft(row ? { ...row } : emptyRow());
        setEditingCode(row?.codigo || 'new');
    };

    const addMissingItemToFixedList = (item: MissingImportItem) => {
        if (!importReport) return;

        const alreadyExists = importReport.pendingRows.some((row) => row.codigo === item.codigo);
        if (alreadyExists) {
            setAddTargetItem(null);
            return;
        }

        const newRow = {
            ...emptyRow(),
            codigo: item.codigo,
            descricao: item.descricao === '-' ? item.codigo : item.descricao,
            ordem: importReport.pendingRows.length,
            ordemOrigem: 'importada' as const,
            [importReport.field]: item.quantidade
        } as CompleteWheelRow;

        setImportReport({
            ...importReport,
            totalImportado: importReport.totalImportado + 1,
            quantidadeImportada: importReport.quantidadeImportada + item.quantidade,
            quantidadeNaoImportada: Math.max(0, importReport.quantidadeNaoImportada - item.quantidade),
            missingItems: importReport.missingItems.filter((missingItem) => missingItem.codigo !== item.codigo),
            pendingRows: [...importReport.pendingRows, newRow],
            exportCodeMappings: {
                ...importReport.exportCodeMappings,
                [newRow.codigo]: {
                    codigo: item.codigoOriginal || item.codigo,
                    descricao: item.descricao === '-' ? undefined : item.descricao
                }
            }
        });
        setAddTargetItem(null);
        toast.success(`${item.codigo} adicionado à base fixa pendente.`);
    };

    const linkMissingItemToExistingCode = (item: MissingImportItem, targetCodigoInput?: string) => {
        if (!importReport) return;

        const targetCodigo = (targetCodigoInput || linkDrafts[item.codigo] || '').trim();
        const targetRow = importReport.pendingRows.find((row) => row.codigo === targetCodigo);
        if (!targetRow) {
            toast.error('Informe um código existente da base fixa para vincular.');
            return;
        }

        const nextRows = importReport.pendingRows.map((row) => (
            row.codigo === targetCodigo
                ? { ...row, [importReport.field]: Number(row[importReport.field] || 0) + item.quantidade }
                : row
        ));
        const nextMappings = { ...codeMappings, [item.codigo]: targetCodigo };
        const nextExportMappings = {
            ...exportCodeMappings,
            ...importReport.exportCodeMappings,
            [targetCodigo]: {
                codigo: item.codigoOriginal || item.codigo,
                descricao: item.descricao === '-' ? undefined : item.descricao
            }
        };

        persistCodeMappings(nextMappings);
        persistExportCodeMappings(nextExportMappings);
        setImportReport({
            ...importReport,
            totalImportado: importReport.totalImportado + 1,
            quantidadeImportada: importReport.quantidadeImportada + item.quantidade,
            quantidadeNaoImportada: Math.max(0, importReport.quantidadeNaoImportada - item.quantidade),
            missingItems: importReport.missingItems.filter((missingItem) => missingItem.codigo !== item.codigo),
            pendingRows: nextRows,
            exportCodeMappings: {
                ...importReport.exportCodeMappings,
                [targetCodigo]: {
                    codigo: item.codigoOriginal || item.codigo,
                    descricao: item.descricao === '-' ? undefined : item.descricao
                }
            }
        });
        setLinkDrafts((current) => {
            const next = { ...current };
            delete next[item.codigo];
            return next;
        });
        setLinkTargetItem(null);
        setLinkSearch('');
        toast.success(`${item.codigo} vinculado ao código ${targetCodigo}.`);
    };

    const cancelPendingUpload = () => {
        setImportReport(null);
        toast('Upload cancelado. Nada foi salvo.');
    };

    const confirmPendingUpload = () => {
        if (!importReport) return;

        persistRows(importReport.pendingRows);
        persistExportCodeMappings({
            ...exportCodeMappings,
            ...importReport.exportCodeMappings
        });
        setLastUploads((current) => ({ ...current, [importReport.uploadKey]: importReport.fileName }));
        persistUploadSummaries({
            ...uploadSummaries,
            [importReport.uploadKey]: {
                fileName: importReport.fileName,
                totalItens: importReport.totalImportado,
                quantidadeTotal: importReport.quantidadeImportada
            }
        });
        setImportReport(null);
        setIsUploadModalOpen(true);
        toast.success('Upload confirmado e salvo.');
    };

    const confirmResetUpload = () => {
        if (!resetUploadSlot) return;

        const key = getUploadKey(resetUploadSlot);
        const field = getUploadField(resetUploadSlot);
        const nextRows = rows.map((row) => ({ ...row, [field]: 0 }));
        const nextSummaries = { ...uploadSummaries };
        delete nextSummaries[key];

        persistRows(nextRows);
        persistUploadSummaries(nextSummaries);
        setLastUploads((current) => {
            const nextUploads = { ...current };
            delete nextUploads[key];
            return nextUploads;
        });
        setResetUploadSlot(null);
        toast.success(`${resetUploadSlot.label} liberado para refazer upload.`);
    };

    const openPhotoSelection = (row: CompleteWheelRow) => {
        const codigo = row.codigo.trim();
        const descricao = row.descricao.trim();

        if (!codigo || !descricao) {
            toast.error('Informe código e descrição antes de ajustar a foto.');
            return;
        }

        const { modelCode, finishAbbr } = getModelAndFinish(descricao);
        const modelPhotos = (photoMap as Record<string, Record<string, string>>)[modelCode] || {};

        setPhotoTarget({
            model: modelCode,
            finish: finishAbbr,
            description: descricao,
            codigo
        });
        setAvailablePhotos(Object.values(modelPhotos));
        setIsPhotoModalOpen(true);
    };

    const savePhotoSelection = async (url: string, scope: 'item' | 'model') => {
        if (!photoTarget) return;

        const success = await savePhotoOverride(
            photoTarget.model,
            photoTarget.finish,
            url,
            scope === 'item' ? photoTarget.codigo : undefined
        );

        if (!success) {
            toast.error('Erro ao salvar foto.');
            return;
        }

        const overrides = await getPhotoOverrides();
        setPhotoOverrides(overrides);
        setRows((current) => [...current]);
        setDraft((current) => ({ ...current }));
        setIsPhotoModalOpen(false);
        toast.success(scope === 'item' ? 'Foto salva apenas para este item.' : 'Foto salva para o grupo.');
    };

    const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsPhotoUploading(true);
        const toastId = toast.loading('Compactando imagem...');

        try {
            const compressedBlob = await compressImage(file, 800, 800, 0.7);
            toast.loading('Enviando foto...', { id: toastId });

            const publicUrl = await uploadPhotoToStorage(compressedBlob, file.name);
            if (!publicUrl) {
                toast.error('Falha no upload da foto.', { id: toastId });
                return;
            }

            setAvailablePhotos((current) => [publicUrl, ...current]);
            toast.success('Foto enviada. Escolha onde aplicar.', { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error('Erro ao processar imagem.', { id: toastId });
        } finally {
            setIsPhotoUploading(false);
            event.currentTarget.value = '';
        }
    };

    const saveDraft = () => {
        const codigo = draft.codigo.trim();
        const descricao = draft.descricao.trim();
        if (!codigo || !descricao) {
            toast.error('Código e descrição são obrigatórios.');
            return;
        }

        const normalizedDraft = { ...draft, codigo, descricao, custo: Number(draft.custo) || 0 };
        const exists = rows.some((row) => row.codigo === codigo);
        if (editingCode === 'new' && exists) {
            toast.error('Já existe uma roda com esse código.');
            return;
        }

        const nextRows = editingCode === 'new'
            ? [...rows, { ...normalizedDraft, ordem: rows.length }]
            : rows.map((row) => (row.codigo === editingCode ? normalizedDraft : row));

        persistRows(nextRows);
        setEditingCode(null);
        toast.success(editingCode === 'new' ? 'Item adicionado.' : 'Item atualizado.');
    };

    const deleteRow = (codigo: string) => {
        if (!window.confirm('Apagar este item da base fixa?')) return;
        persistRows(rows.filter((row) => row.codigo !== codigo));
        toast.success('Item removido da base.');
    };

    const clearVariableValues = async () => {
        if (!window.confirm('ATENÇÃO: isso vai arquivar os pedidos atuais no histórico, zerar pedidos, estoques e pendências do Painel Completo, além de limpar áudios, rascunhos e tags. A base fixa de rodas continuará salva.\n\nDeseja continuar?')) return;
        
        const toastId = toast.loading('Limpando dados e arquivos...');
        try {
            const nextRows = rows.map((row) => ({
                ...row,
                estoque_pr: 0,
                pendencia_pr: 0,
                pedido_pr: 0,
                estoque_sc: 0,
                pendencia_sc: 0,
                pedido_sc: 0,
                estoque_cm: 0,
                pendencia_cm: 0,
                pedido_cm: 0,
                estoque_rs: 0,
                pendencia_rs: 0,
                pedido_rs: 0
            }));
            persistRows(nextRows);
            setLastUploads({});
            persistUploadSummaries({});
            const inventoryCleared = await clearPendenciasInventory();

            const audioKeys = Array.from(new Set([...await getAllAudioKeys(), ...Object.keys(audios)]));
            const audioHistory: Record<string, string> = {};
            for (const codigo of audioKeys) {
                const blob = await getAudio(codigo);
                if (blob) {
                    const base64 = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });
                    audioHistory[codigo] = base64;
                }
            }

            // Arquivar pedidos e metadados no Histórico e depois limpar da nuvem
            await archiveAndClearPedidos({
                tags: itemTags,
                sketches: sketches,
                audios: audioHistory
            });

            // Apagar rascunhos locais e na nuvem
            for (const codigo of Object.keys(sketches)) {
                await deleteSketch(codigo);
                await deleteCloudSketch(codigo);
            }
            setSketches({});

            // Apagar audios locais e na nuvem
            for (const codigo of audioKeys) {
                await deleteAudio(codigo);
                await deleteCloudAudio(codigo);
            }
            setAudios({});

            // Remover todas as tags dos itens
            const emptyTagsMap: Record<string, string[]> = {};
            for (const codigo of Object.keys(itemTags)) {
                if (itemTags[codigo] && itemTags[codigo].length > 0) {
                    emptyTagsMap[codigo] = [];
                }
            }
            if (Object.keys(emptyTagsMap).length > 0) {
                await saveItemTags(emptyTagsMap);
            }
            setItemTags({});

            toast.success(
                inventoryCleared
                    ? 'Pedidos arquivados. Painel Completo e Pendência zerados com sucesso!'
                    : 'Pedidos arquivados, mas houve falha ao limpar a base da Pendência.',
                { id: toastId }
            );
        } catch (error) {
            console.error('Erro ao zerar valores e anexos:', error);
            toast.error('Erro parcial ao limpar anexos. Tente novamente.', { id: toastId });
        }
    };

    const syncToSupabase = async () => {
        setShowSyncConfirm(false);
        setIsUploadModalOpen(false);
        setIsSyncingCloud(true);
        setShowSyncSuccess(true);
        
        try {
            const getOrder = (row: CompleteWheelRow) => (
                row.ordemOrigem === 'importada'
                    ? row.ordem
                    : catalogOrder.get(row.codigo) ?? row.ordem
            );
            const orderedRows = [...rows].sort((left, right) => getOrder(left) - getOrder(right));

            const stockItems = orderedRows.map(row => ({
                codigo: row.codigo,
                descricao: row.descricao,
                local: 'SISTEMA',
                preco: row.custo || 0,
                est_mk: row.estoque_pr || 0,
                pend_mk: row.pendencia_pr || 0,
                est_moleri: row.estoque_sc || 0,
                pend_moleri: row.pendencia_sc || 0,
                est_cm: row.estoque_cm || 0,
                pend_cm: row.pendencia_cm || 0,
                est_olimpo: row.estoque_rs || 0,
                pend_olimpo: row.pendencia_rs || 0,
            }));

            await syncPendenciasToCloud(stockItems, 'BaseFixa_Completa');
            
            setTimeout(() => {
                setShowSyncSuccess(false);
            }, 3000);
        } catch (error) {
            console.error('Erro na sincronização:', error);
            toast.error('Erro ao sincronizar com a nuvem.');
            setShowSyncSuccess(false);
        } finally {
            setIsSyncingCloud(false);
        }
    };

    const exportCompleteTable = async () => {
        const toastId = toast.loading('Gerando planilha completa...');
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Tabela Completa');

            // Configurar Página para Impressão
            worksheet.pageSetup = {
                orientation: 'landscape',
                paperSize: 9, // A4
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0,
                margins: {
                    left: 0.3, right: 0.3, top: 0.3, bottom: 0.3,
                    header: 0.1, footer: 0.1
                },
                printTitlesRow: '1:2',
                printArea: `A1:O${rows.length + 3}`
            };

            // Definir Colunas
            worksheet.columns = [
                { header: 'CÓDIGO', key: 'codigo', width: 22 },
                { header: 'DESCRIÇÃO', key: 'descricao', width: 40 },
                { header: 'CUSTO (R$)', key: 'custo', width: 15 },
                { header: 'EST. MK', key: 'est_pr', width: 9 },
                { header: 'PEND MK', key: 'pend_pr', width: 9 },
                { header: 'MK', key: 'order_pr', width: 9 },
                { header: 'EST. MOLERI', key: 'est_sc', width: 9 },
                { header: 'PEND MOLERI', key: 'pend_sc', width: 9 },
                { header: 'MOLERI', key: 'order_sc', width: 9 },
                { header: 'EST. CM', key: 'est_cm', width: 9 },
                { header: 'PEND CM', key: 'pend_cm', width: 9 },
                { header: 'CM', key: 'order_cm', width: 9 },
                { header: 'EST. OLIMPO', key: 'est_rs', width: 9 },
                { header: 'PEND OLIMPO', key: 'pend_rs', width: 9 },
                { header: 'OLIMPO', key: 'order_rs', width: 9 }
            ];

            // Adicionar Título no Topo
            worksheet.spliceRows(1, 0, []);
            const titleRow = worksheet.getRow(1);
            titleRow.height = 40;
            worksheet.mergeCells('A1:O1');
            const titleCell = worksheet.getCell('A1');
            const today = new Date().toLocaleDateString('pt-BR').split('/').join(' ');
            titleCell.value = `TABELA COMPLETA (GERAL) - ${today}`;
            titleCell.font = { bold: true, italic: true, size: 14 };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

            // Cabeçalho na Linha 2
            const headerRow = worksheet.getRow(2);
            headerRow.height = 35;
            headerRow.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
                cell.font = { bold: true, size: 11, color: { argb: 'FF000000' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF000000' } },
                    left: { style: 'thin', color: { argb: 'FF000000' } },
                    bottom: { style: 'thin', color: { argb: 'FF000000' } },
                    right: { style: 'thin', color: { argb: 'FF000000' } }
                };
            });

            // Adicionar Dados
            const getOrder = (row: CompleteWheelRow) => (
                row.ordemOrigem === 'importada'
                    ? row.ordem
                    : catalogOrder.get(row.codigo) ?? row.ordem
            );
            const orderedRows = [...rows].sort((left, right) => getOrder(left) - getOrder(right));

            orderedRows.forEach((item) => {
                const row = worksheet.addRow({
                    codigo: item.codigo,
                    descricao: item.descricao,
                    custo: item.custo || 0,
                    est_pr: item.estoque_pr || 0,
                    pend_pr: item.pendencia_pr || 0,
                    order_pr: item.pedido_pr || 0,
                    est_sc: item.estoque_sc || 0,
                    pend_sc: item.pendencia_sc || 0,
                    order_sc: item.pedido_sc || 0,
                    est_cm: item.estoque_cm || 0,
                    pend_cm: item.pendencia_cm || 0,
                    order_cm: item.pedido_cm || 0,
                    est_rs: item.estoque_rs || 0,
                    pend_rs: item.pendencia_rs || 0,
                    order_rs: item.pedido_rs || 0
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

                    if (colNumber === 1 || colNumber >= 3) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    }

                    if (colNumber === 3) {
                        cell.numFmt = '"R$ " #,##0.00';
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    }
                });
            });

            // Totais
            const lastDataRowIndex = orderedRows.length + 2;
            const totalRowIndex = lastDataRowIndex + 1;
            const totalRow = worksheet.addRow({});
            totalRow.height = 30;
            totalRow.getCell(1).value = 'TOTAL GERAL';
            totalRow.getCell(1).font = { bold: true, size: 10 };
            totalRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
            worksheet.mergeCells(`A${totalRowIndex}:B${totalRowIndex}`);

            for (let i = 4; i <= 15; i++) {
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
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `Tabela_Completa_Geral_${dateStr}.xlsx`);

            setIsExportModalOpen(false);
            toast.success('Tabela completa exportada com sucesso!', { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error('Erro ao gerar exportação completa.', { id: toastId });
        }
    };

    const handleAddTag = async () => {
        if (!newTagName.trim()) return;
        const success = await addGlobalTag(newTagName.trim());
        if (success) {
            setGlobalTags(prev => [...prev, newTagName.trim().toUpperCase()].sort());
            setNewTagName("");
            toast.success("Tag adicionada!");
        } else {
            toast.error("Erro ao adicionar tag");
        }
    };

    const handleDeleteTag = async (tagName: string) => {
        if (!window.confirm(`Excluir a etiqueta "${tagName}" da biblioteca?`)) return;
        const success = await deleteGlobalTag(tagName);
        if (success) {
            setGlobalTags(prev => prev.filter(t => t !== tagName));
            toast.success("Tag removida");
        } else {
            toast.error("Erro ao remover tag");
        }
    };

    const exportFactoryOrders = async (factoryKey: DepotKey, factoryName: string) => {
        const orderKey = `pedido_${factoryKey}` as keyof CompleteWheelRow;
        const orderRows = rows.filter((row) => Number(row[orderKey] || 0) > 0);

        if (orderRows.length === 0) {
            toast.error(`Nenhum pedido encontrado para a fábrica ${factoryName} nesta semana.`);
            return;
        }

        const toastId = toast.loading(`Gerando pedidos da ${factoryName}...`);
        try {
            const cloudMappings = await getPendenciaExportCodeMappings();
            const latestExportMappings = {
                ...exportCodeMappings,
                ...loadExportCodeMappings(),
                ...cloudMappings
            };
            if (Object.keys(cloudMappings).length > 0) {
                setExportCodeMappings(latestExportMappings);
                localStorage.setItem(EXPORT_CODE_MAPPING_STORAGE_KEY, JSON.stringify(latestExportMappings));
            }
            const manualReverseMappings = (Object.entries(codeMappings) as [string, string][]).reduce<Record<string, string>>((acc, [sourceCode, fixedCode]) => {
                if (!acc[fixedCode]) acc[fixedCode] = sourceCode;
                return acc;
            }, {});
            const getExportInfo = (row: CompleteWheelRow) => {
                const mapping = latestExportMappings[row.codigo];
                return {
                    codigo: mapping?.codigo || manualReverseMappings[row.codigo] || getFallbackOriginalExportCode(row.codigo),
                    descricao: mapping?.descricao || row.descricao
                };
            };
            const factoryOrders = orderRows.map((row) => {
                const exportInfo = getExportInfo(row);
                return {
                    'Código': exportInfo.codigo,
                    'Descrição': exportInfo.descricao,
                    'Quantidade': Number(row[orderKey])
                };
            });

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(`Pedidos ${factoryName}`);
            const today = new Date();
            const dateLabel = today.toLocaleDateString('pt-BR');
            const dateFile = today.toISOString().split('T')[0];
            const totalQuantity = factoryOrders.reduce((total, item) => total + item.Quantidade, 0);
            const border: Partial<ExcelJS.Borders> = {
                top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
            };

            worksheet.columns = [
                { header: 'Código', key: 'codigo', width: 24 },
                { header: 'Descrição', key: 'descricao', width: 58 },
                { header: 'Quantidade', key: 'quantidade', width: 16 }
            ];

            worksheet.spliceRows(1, 0, []);
            worksheet.mergeCells('A1:C1');
            const titleCell = worksheet.getCell('A1');
            titleCell.value = `PEDIDOS ${factoryName.toUpperCase()} - ${dateLabel}`;
            titleCell.font = { bold: true, size: 14, color: { argb: 'FF1E293B' } };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
            titleCell.border = border;
            worksheet.getRow(1).height = 30;

            const headerRow = worksheet.getRow(2);
            headerRow.height = 26;
            headerRow.eachCell((cell) => {
                cell.font = { bold: true, size: 11, color: { argb: 'FF0F172A' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
                cell.border = border;
            });

            factoryOrders.forEach((item) => {
                const row = worksheet.addRow({
                    codigo: item.Código,
                    descricao: item.Descrição,
                    quantidade: item.Quantidade
                });
                row.height = 24;
                row.eachCell((cell, colNumber) => {
                    cell.font = { size: 11, color: { argb: 'FF1E293B' } };
                    cell.border = border;
                    cell.alignment = {
                        horizontal: colNumber === 2 ? 'left' : 'center',
                        vertical: 'middle',
                        wrapText: colNumber === 2
                    };
                });
            });

            const totalRow = worksheet.addRow({
                codigo: 'TOTAL',
                descricao: `${factoryOrders.length} itens`,
                quantidade: totalQuantity
            });
            totalRow.height = 28;
            totalRow.eachCell((cell, colNumber) => {
                cell.font = { bold: true, size: 11, color: { argb: 'FF0F172A' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                cell.border = {
                    top: { style: 'medium', color: { argb: 'FF64748B' } },
                    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    bottom: { style: 'medium', color: { argb: 'FF64748B' } },
                    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                };
                cell.alignment = {
                    horizontal: colNumber === 2 ? 'left' : 'center',
                    vertical: 'middle'
                };
            });

            worksheet.views = [{ state: 'frozen', ySplit: 2 }];
            worksheet.autoFilter = {
                from: 'A2',
                to: `C${factoryOrders.length + 2}`
            };

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `Pedidos_${factoryName}_${dateFile}.xlsx`);
            setIsExportModalOpen(false);
            toast.success(`Planilha de pedidos da ${factoryName} exportada!`, { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error(`Erro ao exportar pedidos da ${factoryName}.`, { id: toastId });
        }
    };

    return (
        <>
            <Toaster position="top-center" />
            
            {view === 'dashboard' ? (
                <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                            <button 
                                onClick={onBack}
                                className="flex items-center gap-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors group"
                            >
                                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                                <span className="font-bold uppercase tracking-widest text-sm">Painel Principal</span>
                            </button>

                            <div className="flex flex-wrap gap-3">
                                <button 
                                    onClick={onViewHistory}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                                >
                                    <HistoryIcon className="w-4 h-4 text-amber-500" />
                                    Histórico
                                </button>
                                <button 
                                    onClick={() => setIsExportModalOpen(true)}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                                >
                                    <FileSpreadsheet className="w-4 h-4" />
                                    Exportar Excel
                                </button>
                                <button 
                                    onClick={clearVariableValues}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl text-red-600 dark:text-red-400 font-bold hover:bg-red-100 transition-all shadow-sm active:scale-95"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    Zerar Semana
                                </button>
                                <button 
                                    onClick={() => setIsSettingsModalOpen(true)}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                                >
                                    <Settings className="w-4 h-4" />
                                    Configurações
                                </button>
                                <button 
                                    onClick={() => setView('table')}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                    Acessar Tabela
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                            {/* BLOCO 1 */}
                            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col group hover:border-indigo-500/50 transition-colors">
                                <div className="p-8 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                                            <Package className="w-6 h-6" />
                                        </div>
                                        <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Estoque Geral</span>
                                    </div>
                                    <div className="text-5xl font-black text-slate-800 dark:text-slate-100 tracking-tighter">
                                        {dashboardTotals.totalStock}
                                    </div>
                                </div>
                                <div className="p-8 grid grid-cols-2 gap-y-6 gap-x-4 flex-1 bg-white dark:bg-slate-900">
                                    {Object.entries(dashboardTotals.byFactoryEst).map(([filial, valor]) => (
                                        <div key={filial} className="flex flex-col">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{filial}</span>
                                            <span className="text-xl font-black text-slate-700 dark:text-slate-300">{valor}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* BLOCO 2 */}
                            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col group hover:border-amber-500/50 transition-colors">
                                <div className="p-8 border-b border-slate-50 dark:border-slate-800 bg-amber-50/20 dark:bg-amber-900/10">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-3 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl">
                                            <TrendingUp className="w-6 h-6" />
                                        </div>
                                        <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Pendências Fixas</span>
                                    </div>
                                    <div className="text-5xl font-black text-amber-600 dark:text-amber-500 tracking-tighter">
                                        {dashboardTotals.totalPnd}
                                    </div>
                                </div>
                                <div className="p-8 grid grid-cols-2 gap-y-6 gap-x-4 flex-1 bg-white dark:bg-slate-900">
                                    {Object.entries(dashboardTotals.byFactoryPnd).map(([filial, valor]) => (
                                        <div key={filial} className="flex flex-col">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{filial}</span>
                                            <span className="text-xl font-black text-slate-700 dark:text-slate-300">{valor}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* BLOCO 3 */}
                            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col group hover:border-emerald-500/50 transition-colors">
                                <div className="p-8 border-b border-slate-50 dark:border-slate-800 bg-emerald-50/20 dark:bg-emerald-900/10">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                                            <ShoppingCart className="w-6 h-6" />
                                        </div>
                                        <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Pedidos da Semana</span>
                                    </div>
                                    <div className="text-5xl font-black text-emerald-600 dark:text-emerald-500 tracking-tighter">
                                        {dashboardTotals.totalOrders}
                                    </div>
                                </div>
                                <div className="p-8 grid grid-cols-2 gap-y-6 gap-x-4 flex-1 bg-white dark:bg-slate-900">
                                    {Object.entries(dashboardTotals.byFactoryOrders).map(([filial, valor]) => (
                                        <div key={filial} className="flex flex-col">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{filial}</span>
                                            <span className="text-xl font-black text-slate-700 dark:text-slate-300 transition-colors group-hover:text-emerald-600">{valor}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 p-4 md:p-6 transition-colors">
                    <div className="w-full max-w-[96rem] mx-auto flex-1 flex flex-col min-h-0">
                <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setView('dashboard')}
                            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 transition-all shadow-sm active:scale-95"
                            title="Voltar ao Dashboard"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <Database className="w-7 h-7 text-indigo-500" />
                                Pendência Completa
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                                Base fixa de rodas com importação dos estoques e pendências por depósito.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <input
                            ref={baseInputRef}
                            type="file"
                            accept=".xlsx,.xls,.xlsm,.csv"
                            className="hidden"
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) importBaseFile(file);
                            }}
                        />
                        <button
                            onClick={() => baseInputRef.current?.click()}
                            className="h-11 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-sm active:scale-95 transition-all"
                        >
                            <Upload className="w-4 h-4" />
                            Importar Base
                        </button>
                        <button
                            onClick={() => setIsUploadModalOpen(true)}
                            disabled={rows.length === 0}
                            className="h-11 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 rounded-lg font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-sm active:scale-95 transition-all"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            Uploads
                        </button>
                        <button
                            onClick={() => startEdit()}
                            className="h-11 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-lg font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-sm active:scale-95 transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            Adicionar
                        </button>
                        <button
                            onClick={() => setIsExportModalOpen(true)}
                            disabled={rows.length === 0}
                            className="h-11 px-4 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 rounded-lg font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-sm active:scale-95 transition-all"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            Exportar
                        </button>
                    </div>
                </header>

                <section className="flex-1 flex flex-col min-h-0">
                    <main className="flex-1 flex flex-col min-h-0">
                        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm">
                            <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <div className="relative w-full md:max-w-md">
                                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                value={query}
                                                onChange={(event) => setQuery(event.target.value)}
                                                placeholder="Buscar por código ou descrição"
                                                className="w-full h-10 pl-9 pr-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:border-indigo-500"
                                            />
                                        </div>

                                        <button
                                            onClick={() => setShowFilters(!showFilters)}
                                            className={cn(
                                                "px-2.5 py-2 text-sm font-bold rounded-lg border transition-colors flex items-center gap-1.5 h-10",
                                                showFilters ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-700" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                                            )}
                                        >
                                            <Filter className="w-4 h-4" /> Filtros
                                        </button>

                                        {(filterLinha || filterAro || filterFuracao || filterModelo || filterAcabamento || query) && (
                                            <button onClick={() => { setFilterLinha(""); setFilterAro(""); setFilterFuracao(""); setFilterModelo(""); setFilterAcabamento(""); setQuery(""); }} className="px-2.5 py-2 text-xs uppercase tracking-tighter font-black text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-red-200 dark:border-red-900/40 h-10">
                                                Limpar
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4">
                                    <span className="text-xs font-bold text-slate-500">
                                        {filteredRows.length} de {rows.length} itens
                                    </span>
                                </div>
                                </div>
                                {showFilters && (
                                    <div className="flex flex-wrap items-center gap-2 pt-3 mt-3 border-t border-slate-100 dark:border-slate-800">
                                        <select value={filterLinha} onChange={e => setFilterLinha(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer shadow-sm">
                                            <option value="">Linhas</option>
                                            {uniqueLinhas.map(o => <option key={o} value={o}>Linha {o}</option>)}
                                        </select>

                                        <select value={filterModelo} onChange={e => setFilterModelo(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer shadow-sm">
                                            <option value="">Modelos</option>
                                            {uniqueModelos.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>

                                        <select value={filterAro} onChange={e => setFilterAro(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer shadow-sm">
                                            <option value="">Aros / Talas</option>
                                            {uniqueAros.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>

                                        <select value={filterFuracao} onChange={e => setFilterFuracao(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer shadow-sm">
                                            <option value="">Furações</option>
                                            {uniqueFuracoes.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>

                                        <select value={filterAcabamento} onChange={e => setFilterAcabamento(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer shadow-sm">
                                            <option value="">Acabamentos</option>
                                            {uniqueAcabamentos.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>

                                        <div className="flex items-center gap-2 ml-auto">
                                            <button
                                                onClick={() => setFilterFactoryOrders(!filterFactoryOrders)}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 shadow-sm active:scale-95",
                                                    filterFactoryOrders
                                                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400"
                                                        : "bg-white border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                                )}
                                                title="Filtrar apenas itens que têm pedido em alguma fábrica"
                                            >
                                                <ShoppingCart className="w-3.5 h-3.5" />
                                                Com Pedidos
                                            </button>
                                            
                                            <button
                                                onClick={() => setFilterHasTags(!filterHasTags)}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 shadow-sm active:scale-95",
                                                    filterHasTags
                                                        ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400"
                                                        : "bg-white border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                                )}
                                            >
                                                <Tag className="w-3.5 h-3.5" />
                                                Tags
                                            </button>

                                            <button
                                                onClick={() => setFilterHasSketch(!filterHasSketch)}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 shadow-sm active:scale-95",
                                                    filterHasSketch
                                                        ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400"
                                                        : "bg-white border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                                )}
                                            >
                                                <PenTool className="w-3.5 h-3.5" />
                                                Posts
                                            </button>

                                            <button
                                                onClick={() => setFilterHasAudio(!filterHasAudio)}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 shadow-sm active:scale-95",
                                                    filterHasAudio
                                                        ? "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-400"
                                                        : "bg-white border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                                )}
                                            >
                                                <Mic className="w-3.5 h-3.5" />
                                                Áudio
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="md:hidden flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 px-3 py-3 space-y-3">
                                {filteredRows.length === 0 ? (
                                    <div className="px-4 py-10 text-center text-sm font-bold text-slate-400">
                                        Importe a base fixa para começar.
                                    </div>
                                ) : currentPageRows.map((row) => {
                                    const photoUrl = getWheelPhotoUrl(row.descricao, row.codigo);
                                    const isExpanded = expandedMobileCode === row.codigo;

                                    return (
                                        <div key={row.codigo} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                                            <button
                                                type="button"
                                                onClick={() => setExpandedMobileCode(isExpanded ? null : row.codigo)}
                                                className="w-full p-3 flex gap-3 text-left active:bg-slate-50 dark:active:bg-slate-800 transition-colors"
                                            >
                                                <img
                                                    src={photoUrl}
                                                    alt={`Foto ${row.descricao}`}
                                                    className="w-20 h-20 rounded-xl object-cover border border-slate-200 dark:border-slate-700 bg-white shrink-0"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <h3 className="text-base font-black text-slate-900 dark:text-slate-100 leading-tight line-clamp-2">
                                                                {row.descricao}
                                                            </h3>
                                                            <p className="mt-1 text-xs font-mono text-slate-400">{row.codigo}</p>
                                                        </div>
                                                        <span className="shrink-0 text-sm font-bold text-slate-600 dark:text-slate-300">
                                                            {row.custo ? row.custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
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
                                                        {mobileDepots.map((depot) => (
                                                            <div key={depot.key} className={cn("h-9 flex items-center justify-center px-1 text-[10px] font-black uppercase text-center border-r last:border-r-0 border-slate-200 dark:border-slate-800", depot.color, depot.text)}>
                                                                {depot.shortLabel}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {[
                                                        { label: 'Est.', color: 'text-blue-600', getValue: (depot: typeof mobileDepots[number]) => getDepotValue(row, depot.key, 'estoque') },
                                                        { label: 'Pend.', color: 'text-orange-600', getValue: (depot: typeof mobileDepots[number]) => getDepotValue(row, depot.key, 'pendencia') },
                                                        { label: 'Ped.', color: 'text-emerald-600', getValue: (depot: typeof mobileDepots[number]) => getDepotValue(row, depot.key, 'pedido') }
                                                    ].map((metric) => (
                                                        <div key={metric.label} className="grid grid-cols-[54px_repeat(4,minmax(0,1fr))] border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                                                            <div className="h-9 flex items-center justify-center text-[10px] font-black uppercase text-slate-400 border-r border-slate-200 dark:border-slate-800">
                                                                {metric.label}
                                                            </div>
                                                            {mobileDepots.map((depot) => (
                                                                <div key={depot.key} className="h-9 flex items-center justify-center border-r last:border-r-0 border-slate-200 dark:border-slate-800">
                                                                    <span className={cn("text-base font-black", metric.color)}>
                                                                        {metric.getValue(depot)}
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
                                                        {mobileDepots.map((depot) => (
                                                            <div key={depot.key} className="grid grid-cols-[92px_1fr_1fr_1fr] min-h-[58px] border-b last:border-b-0 border-slate-100 dark:border-slate-800">
                                                                <div className={cn("flex items-center justify-center px-2 text-[11px] font-black uppercase text-center", depot.color, depot.text)}>
                                                                    {depot.shortLabel}
                                                                </div>
                                                                <div className="flex flex-col items-center justify-center border-l border-slate-100 dark:border-slate-800">
                                                                    <span className="text-[10px] font-bold uppercase text-slate-400">Est.</span>
                                                                    <span className="text-lg font-black text-blue-600">{getDepotValue(row, depot.key, 'estoque')}</span>
                                                                </div>
                                                                <div className="flex flex-col items-center justify-center border-l border-slate-100 dark:border-slate-800">
                                                                    <span className="text-[10px] font-bold uppercase text-slate-400">Pend.</span>
                                                                    <span className="text-lg font-black text-orange-600">{getDepotValue(row, depot.key, 'pendencia')}</span>
                                                                </div>
                                                                <div className={cn("m-2 rounded-lg border bg-white dark:bg-slate-950 flex items-center justify-center font-black text-base", depot.border, depot.text)}>
                                                                    {getDepotValue(row, depot.key, 'pedido')}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        <div className="p-3 flex gap-2 bg-slate-50 dark:bg-slate-950">
                                                            <button
                                                                onClick={() => startEdit(row)}
                                                                className="flex-1 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                                Editar
                                                            </button>
                                                            <button
                                                                onClick={() => deleteRow(row.codigo)}
                                                                className="h-10 px-4 rounded-lg border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 font-black text-xs uppercase tracking-widest flex items-center justify-center"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                            </div>

                            <div ref={tableContainerRef} className="hidden md:block flex-1 overflow-auto relative">
                                <table className="w-full min-w-[1480px] text-[15px] text-left whitespace-nowrap border-separate border-spacing-0">
                                    <thead className="sticky top-0 z-20 text-xs font-black uppercase bg-white dark:bg-slate-900 shadow-sm text-slate-500 dark:text-slate-300">
                                        <tr className="h-10">
                                            <th rowSpan={2} className="sticky left-0 top-0 z-40 px-4 py-0 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 min-w-[100px] align-middle">Foto</th>
                                            <th rowSpan={2} className="sticky left-[100px] top-0 z-40 px-4 py-0 border-b border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 min-w-[320px] lg:min-w-[420px] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] align-middle">Identificação do produto</th>
                                            <th rowSpan={2} className="top-0 px-2 py-0 border-b border-r border-slate-200 dark:border-slate-700 text-right min-w-[100px] align-middle bg-white dark:bg-slate-900">Custo</th>
                                            {DEPOTS.map((depot) => (
                                                <th
                                                    key={depot.key}
                                                    className={cn('top-0 px-2 py-0 border-r border-slate-200 dark:border-slate-700 text-center tracking-[0.2em] align-middle', DEPOT_STYLES[depot.key].group)}
                                                    colSpan={3}
                                                >
                                                    <div className="p-2 text-center font-black">{depot.label}</div>
                                                </th>
                                            ))}
                                            <th className="p-3 w-24">Ações</th>
                                        </tr>
                                        <tr className="h-8 text-[10px] uppercase tracking-widest">
                                            {DEPOTS.map((depot) => (
                                                <React.Fragment key={depot.key}>
                                                    <th className={cn('px-2 py-0 border-b border-r border-slate-200 dark:border-slate-700 text-center', DEPOT_STYLES[depot.key].group)}>Est.</th>
                                                    <th className={cn('px-2 py-0 border-b border-r border-slate-200 dark:border-slate-700 text-center', DEPOT_STYLES[depot.key].group)}>Pend.</th>
                                                    <th className={cn('px-2 py-0 border-b border-r border-slate-200 dark:border-slate-700 text-center', DEPOT_STYLES[depot.key].order)}>Pedido</th>
                                                </React.Fragment>
                                            ))}
                                            <th />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={16} className="p-10 text-center text-slate-400 font-bold">
                                                    Importe a base fixa para começar.
                                                </td>
                                            </tr>
                                        ) : currentPageRows.map((row, index) => {
                                            const isEven = index % 2 === 0;
                                            const bgNormal = isEven ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800';
                                            const photoUrl = getWheelPhotoUrl(row.descricao, row.codigo);
                                            const modelCode = row.descricao.split(' ')[0].toUpperCase();

                                            return (
                                            <tr key={row.codigo} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors group">
                                                <td className={cn('sticky left-0 z-10 px-4 py-3 min-w-[100px]', bgNormal)}>
                                                    <img
                                                        src={photoUrl}
                                                        alt={`Foto ${modelCode}`}
                                                        className="w-16 h-16 rounded-md object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
                                                    />
                                                </td>
                                                <td className={cn('sticky left-[100px] z-[5] px-4 py-3 min-w-[320px] lg:min-w-[420px] border-r border-slate-200 dark:border-slate-700/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]', bgNormal)}>
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-slate-700 dark:text-slate-200 font-bold text-base">{row.descricao}</span>
                                                        <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">{row.codigo}</span>
                                                        
                                                        {/* Tags List */}
                                                        {itemTags[row.codigo]?.length > 0 && (
                                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                                {itemTags[row.codigo].map(tag => (
                                                                    <span
                                                                        key={tag}
                                                                        className="px-2 py-0.5 text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center shadow-sm"
                                                                    >
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Action Hub (Only Read/Preview) */}
                                                        <div className="flex items-center gap-2 mt-2">
                                                            {/* Sketch Preview */}
                                                            {sketches[row.codigo] && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setActiveSketchItem({ codigo: row.codigo, title: row.descricao });
                                                                        setSketchModalOpen(true);
                                                                    }}
                                                                    className="w-8 h-8 rounded border-2 border-amber-200 bg-amber-50 overflow-hidden shadow-sm hover:scale-110 transition-all"
                                                                    title="Ver Post-it"
                                                                >
                                                                    <img src={sketches[row.codigo]} alt="Rascunho" className="w-full h-full object-contain" />
                                                                </button>
                                                            )}

                                                            {/* Audio Preview */}
                                                            {audios[row.codigo] && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setActiveAudioItem({ codigo: row.codigo, title: row.descricao });
                                                                        setAudioPlayerOpen(true);
                                                                    }}
                                                                    className="p-1.5 rounded-full bg-rose-50 dark:bg-rose-900/30 text-rose-500 hover:bg-rose-100 hover:scale-110 transition-all border border-rose-100 dark:border-rose-800 shadow-sm"
                                                                    title="Ouvir Nota de Voz"
                                                                >
                                                                    <Volume2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className={cn('px-2 py-3 text-right font-bold text-slate-500', bgNormal)}>
                                                    {row.custo ? row.custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                                                </td>
                                                {DEPOTS.map((depot) => (
                                                    <React.Fragment key={depot.key}>
                                                        <td className={cn('px-2 py-3 text-center font-bold text-slate-500 text-base', DEPOT_STYLES[depot.key].body)}>{row[`estoque_${depot.key}`] || 0}</td>
                                                        <td className={cn('px-2 py-3 text-center text-slate-400 text-base', DEPOT_STYLES[depot.key].body)}>{row[`pendencia_${depot.key}`] || 0}</td>
                                                        <td className={cn('px-2 py-3 text-center border-x border-slate-200 dark:border-slate-700 font-black text-red-600 dark:text-red-400', DEPOT_STYLES[depot.key].body)}>
                                                            <div className="flex items-center justify-center mx-auto w-16 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 rounded-lg py-1.5 shadow-sm">
                                                                <span className="text-xl">{row[`pedido_${depot.key}`] || 0}</span>
                                                            </div>
                                                        </td>
                                                    </React.Fragment>
                                                ))}
                                                <td className={cn('p-2', bgNormal)}>
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button onClick={() => startEdit(row)} className="p-2 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600" title="Editar">
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => deleteRow(row.codigo)} className="p-2 rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600" title="Apagar">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex-none border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-20 shadow-[0_-8px_15px_-3px_rgba(0,0,0,0.1)]">
                                <div className="md:hidden p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                                    <div className="grid grid-cols-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                        {mobileDepots.map((depot) => (
                                            <div key={depot.key} className="border-r last:border-r-0 border-slate-200 dark:border-slate-800">
                                                <div className={cn("h-10 flex items-center justify-center px-1 text-[10px] font-black uppercase text-center", depot.color, depot.text)}>
                                                    {depot.shortLabel}
                                                </div>
                                                <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-950">
                                                    <div className="py-2 text-center">
                                                        <span className="block text-[9px] font-bold uppercase text-slate-400">Est.</span>
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-100">{totals[depot.key].estoque}</span>
                                                    </div>
                                                    <div className="py-2 text-center">
                                                        <span className="block text-[9px] font-bold uppercase text-slate-400">Pend.</span>
                                                        <span className="text-xs font-black text-orange-600">{totals[depot.key].pendencia}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={clearVariableValues}
                                        disabled={rows.length === 0}
                                        className="mt-3 w-full h-10 bg-white dark:bg-slate-950 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 disabled:opacity-40 rounded-lg font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        Zerar Valores
                                    </button>
                                </div>

                                <div className="hidden md:flex px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 overflow-x-auto items-center justify-between gap-6">
                                    <div className="flex items-start justify-start gap-6 min-w-max pb-1">
                                        {DEPOTS.map((depot) => (
                                            <div key={depot.key} className="flex flex-col gap-1 border-r last:border-r-0 border-slate-200 dark:border-slate-700 pr-6 last:pr-0">
                                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{depot.label}</span>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-slate-500 uppercase">Est</span>
                                                        <span className="text-base font-bold text-slate-800 dark:text-slate-100">{totals[depot.key].estoque}</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-slate-500 uppercase">Pnd</span>
                                                        <span className="text-base font-bold text-slate-800 dark:text-slate-100">{totals[depot.key].pendencia}</span>
                                                    </div>
                                                    <div className="flex flex-col bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                                        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase">Ped</span>
                                                        <span className="text-lg font-black text-amber-800 dark:text-amber-300">{totals[depot.key].pedido}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={clearVariableValues}
                                        disabled={rows.length === 0}
                                        className="shrink-0 h-11 px-4 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 rounded-lg font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-sm active:scale-95 transition-all"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        Zerar Valores
                                    </button>
                                </div>

                                <div className="p-3 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900">
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                            Mostrando {firstVisibleItem} - {lastVisibleItem} de {filteredRows.length} rodas
                                        </span>
                                    </div>
                                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <button
                                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1.5 text-sm font-semibold rounded cursor-pointer transition-colors text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 dark:active:bg-slate-600"
                                    >
                                        Anterior
                                    </button>
                                    <div className="text-sm font-black text-amber-600 dark:text-amber-500 px-3 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded shadow-inner">
                                        {currentPage} <span className="text-slate-400 font-medium">/ {totalPages}</span>
                                    </div>
                                    <button
                                        onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1.5 text-sm font-semibold rounded cursor-pointer transition-colors text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 dark:active:bg-slate-600"
                                    >
                                        Próximo
                                    </button>
                                </div>
                            </div>
                        </div>
                        </div>
                    </main>
                </section>
                    </div>
                </div>
            )}

            {importReport && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
                    >
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">
                                    Resultado do upload
                                </h2>
                                <p className="mt-1 text-xs text-slate-500">
                                    {importReport.label}
                                </p>
                            </div>
                            <button onClick={cancelPendingUpload} className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total lido</div>
                                    <div className="mt-2 text-2xl font-black text-slate-800 dark:text-slate-100">{formatNumber(importReport.totalLido)}</div>
                                </div>
                                <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-4">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Quantidade importada</div>
                                    <div className="mt-2 text-4xl font-black text-emerald-700 dark:text-emerald-300 leading-none">{formatNumber(importReport.quantidadeImportada)}</div>
                                    <div className="mt-2 inline-flex items-center rounded bg-white/80 dark:bg-slate-950/50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                                        {formatNumber(importReport.totalImportado)} códigos
                                    </div>
                                </div>
                                <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400">Não encontrados</div>
                                    <div className="mt-2 text-2xl font-black text-red-700 dark:text-red-300">{formatNumber(importReport.missingItems.length)}</div>
                                    <div className="text-[10px] font-bold text-red-600 dark:text-red-400">Qtd {formatNumber(importReport.quantidadeNaoImportada)}</div>
                                </div>
                                <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Status</div>
                                    <div className="mt-2 text-sm font-black text-amber-700 dark:text-amber-300">
                                        {importReport.missingItems.length > 0 ? 'Revisar lista' : 'Tudo importado'}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-5">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
                                        Itens não importados
                                    </h3>
                                    <span className="text-xs font-bold text-slate-400">
                                        {importReport.missingItems.length} itens
                                    </span>
                                </div>

                                {importReport.missingItems.length === 0 ? (
                                    <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-6 text-center text-sm font-bold text-emerald-700 dark:text-emerald-300">
                                        Todos os códigos do arquivo foram encontrados na base fixa.
                                    </div>
                                ) : (
                                    <div className="max-h-80 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
                                        <table className="w-full text-sm">
                                            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-300">
                                                <tr>
                                                    <th className="p-3 text-left w-44">Código</th>
                                                    <th className="p-3 text-left">Descrição</th>
                                                    <th className="p-3 text-right w-32">Quantidade</th>
                                                    <th className="p-3 text-left w-64">Nosso código</th>
                                                    <th className="p-3 text-center w-32">Ação</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {importReport.missingItems.map((item) => (
                                                    <tr key={item.codigo} className="border-t border-slate-100 dark:border-slate-800">
                                                        <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-200">{item.codigo}</td>
                                                        <td className="p-3 font-semibold text-slate-600 dark:text-slate-300">{item.descricao}</td>
                                                        <td className="p-3 text-right font-black text-red-600 dark:text-red-400">{formatNumber(item.quantidade)}</td>
                                                        <td className="p-3">
                                                            <button
                                                                onClick={() => {
                                                                    setLinkTargetItem(item);
                                                                    setLinkSearch(item.descricao === '-' ? '' : item.descricao);
                                                                }}
                                                                className="w-full h-9 px-3 flex items-center justify-center gap-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 text-xs font-bold text-indigo-600 dark:text-indigo-400 transition-colors shadow-sm"
                                                            >
                                                                <Search className="w-3.5 h-3.5" />
                                                                {linkDrafts[item.codigo] ? `Vinculado: ${linkDrafts[item.codigo]}` : 'Vincular código'}
                                                            </button>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <button
                                                                onClick={() => setAddTargetItem(item)}
                                                                className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest"
                                                            >
                                                                Adicionar
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 flex justify-end gap-2">
                                <button
                                    onClick={cancelPendingUpload}
                                    className="h-11 px-4 rounded-lg font-black text-xs uppercase tracking-widest text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                >
                                    Cancelar upload
                                </button>
                                <button
                                    onClick={confirmPendingUpload}
                                    className="h-11 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-black text-xs uppercase tracking-widest"
                                >
                                    Confirmar upload
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {resetUploadSlot && (
                <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-950/60 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
                    >
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                                    Refazer upload
                                </h2>
                                <p className="mt-1 text-xs text-slate-500">
                                    Isso vai limpar os valores de {resetUploadSlot.label} e liberar o card para um novo arquivo.
                                </p>
                            </div>
                            <button onClick={() => setResetUploadSlot(null)} className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 flex justify-end gap-2">
                            <button
                                onClick={() => setResetUploadSlot(null)}
                                className="h-11 px-4 rounded-lg font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmResetUpload}
                                className="h-11 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-widest"
                            >
                                Limpar e refazer
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {addTargetItem && (
                <div className="fixed inset-0 z-[68] flex items-center justify-center bg-slate-950/60 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
                    >
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                                    Adicionar à base fixa
                                </h2>
                                <p className="mt-1 text-xs text-slate-500">
                                    Confirme apenas se esse item realmente deve existir na tabela fixa.
                                </p>
                            </div>
                            <button onClick={() => setAddTargetItem(null)} className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                                Ao clicar em adicionar, este item será incluído na prévia da tabela fixa com a quantidade deste upload. Depois, ao clicar em <strong>Confirmar upload</strong>, ele será salvo na lista principal e poderá ser usado nos próximos uploads.
                            </div>

                            <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <div className="grid grid-cols-[120px_1fr] border-b border-slate-200 dark:border-slate-800">
                                    <div className="p-3 bg-slate-50 dark:bg-slate-950 text-[10px] font-black uppercase tracking-widest text-slate-500">Código</div>
                                    <div className="p-3 font-mono font-bold text-slate-800 dark:text-slate-100">{addTargetItem.codigo}</div>
                                </div>
                                <div className="grid grid-cols-[120px_1fr] border-b border-slate-200 dark:border-slate-800">
                                    <div className="p-3 bg-slate-50 dark:bg-slate-950 text-[10px] font-black uppercase tracking-widest text-slate-500">Descrição</div>
                                    <div className="p-3 font-semibold text-slate-700 dark:text-slate-200">{addTargetItem.descricao}</div>
                                </div>
                                <div className="grid grid-cols-[120px_1fr]">
                                    <div className="p-3 bg-slate-50 dark:bg-slate-950 text-[10px] font-black uppercase tracking-widest text-slate-500">Quantidade</div>
                                    <div className="p-3 font-black text-emerald-700 dark:text-emerald-300">{formatNumber(addTargetItem.quantidade)}</div>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                            <button
                                onClick={() => setAddTargetItem(null)}
                                className="h-11 px-4 rounded-lg font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => addMissingItemToFixedList(addTargetItem)}
                                className="h-11 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest"
                            >
                                Adicionar à base fixa
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {linkTargetItem && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
                    >
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">
                                    Vincular código
                                </h2>
                                <p className="mt-1 text-xs text-slate-500">
                                    {linkTargetItem.codigo} - {linkTargetItem.descricao}
                                </p>
                            </div>
                            <button onClick={() => setLinkTargetItem(null)} className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5">
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    autoFocus
                                    value={linkSearch}
                                    onChange={(event) => setLinkSearch(event.target.value)}
                                    placeholder="Buscar pela descrição da base fixa"
                                    className="w-full h-11 pl-9 pr-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="mt-4 max-h-96 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-300">
                                        <tr>
                                            <th className="p-3 text-left w-44">Código</th>
                                            <th className="p-3 text-left">Descrição</th>
                                            <th className="p-3 text-center w-32">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {linkSearchResults.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="p-8 text-center text-slate-400 font-bold">
                                                    Nenhum item encontrado.
                                                </td>
                                            </tr>
                                        ) : linkSearchResults.map((row) => (
                                            <tr key={row.codigo} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                                                <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-200">{row.codigo}</td>
                                                <td className="p-3 font-semibold text-slate-600 dark:text-slate-300">{row.descricao}</td>
                                                <td className="p-3 text-center">
                                                    <button
                                                        onClick={() => linkMissingItemToExistingCode(linkTargetItem, row.codigo)}
                                                        className="h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest"
                                                    >
                                                        Usar
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {isUploadModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
                    >
                        <div className="p-6 flex items-start justify-between gap-4">
                            <div className="flex items-start gap-4">
                                <div className="w-14 h-14 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-300">
                                    <Upload className="w-7 h-7" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">
                                        Upload das tabelas
                                    </h2>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        Envie os arquivos de estoque e pendência por filial quando precisar atualizar a base.
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                    if (Object.keys(uploadSummaries).length > 0) {
                                        setShowUnsyncedWarning(true);
                                    } else {
                                        setIsUploadModalOpen(false);
                                    }
                                }} 
                                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="px-6 pb-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {UPLOAD_SLOTS.map((slot) => {
                                    const key = getUploadKey(slot);
                                    const summary = uploadSummaries[key];
                                    const isStock = slot.metric === 'estoque';
                                    const accent = isStock
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900'
                                        : 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-900';

                                    return (
                                        <label
                                            key={key}
                                            className={cn(
                                                'group flex items-center gap-4 p-4 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer transition-all bg-white dark:bg-slate-950/30 shadow-sm',
                                                rows.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md',
                                                summary && 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20'
                                            )}
                                        >
                                            <div className={cn('w-12 h-12 rounded-lg border flex items-center justify-center shrink-0', accent)}>
                                                <FileSpreadsheet className="w-6 h-6" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <div className="text-sm font-black text-slate-800 dark:text-slate-100">{slot.label}</div>
                                                    {summary && (
                                                        <span className="rounded bg-emerald-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
                                                            Feito
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400 truncate">{summary?.fileName || lastUploads[key] || 'Nenhum arquivo'}</div>
                                                {summary && (
                                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                                                            Qtd {formatNumber(summary.quantidadeTotal)}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                                            {formatNumber(summary.totalItens)} itens
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            {summary ? (
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        setResetUploadSlot(slot);
                                                    }}
                                                    className="h-10 px-3 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-950/30"
                                                >
                                                    Refazer
                                                </button>
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 group-hover:text-indigo-600 group-hover:border-indigo-200 transition-colors">
                                                    <Upload className="w-4 h-4" />
                                                </div>
                                            )}
                                            <input
                                                type="file"
                                                accept=".xlsx,.xls,.xlsm,.csv"
                                                disabled={rows.length === 0 || Boolean(summary)}
                                                className="hidden"
                                                onChange={(event) => {
                                                    const file = event.target.files?.[0];
                                                    if (file) importMetricFile(file, slot);
                                                    event.currentTarget.value = '';
                                                }}
                                            />
                                        </label>
                                    );
                                })}
                            </div>

                            <div className="mt-5 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-950/20 p-4 flex gap-3">
                                <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-300 shrink-0 mt-0.5" />
                                <div>
                                    <div className="text-sm font-black text-indigo-800 dark:text-indigo-200">Dica</div>
                                    <p className="mt-1 text-xs leading-relaxed text-indigo-700 dark:text-indigo-300">
                                        Use arquivos CSV ou Excel com coluna de código como Produto e coluna de quantidade. Após selecionar um arquivo, revise a prévia antes de confirmar o upload.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-6 flex justify-between gap-3">
                                <button
                                    onClick={() => {
                                        if (Object.keys(uploadSummaries).length > 0) {
                                            setShowUnsyncedWarning(true);
                                        } else {
                                            setIsUploadModalOpen(false);
                                        }
                                    }}
                                    className="h-11 px-5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => {
                                        setShowSyncConfirm(true);
                                    }}
                                    disabled={rows.length === 0 || isSyncingCloud}
                                    className="h-11 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                                >
                                    {isSyncingCloud ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
                                    {isSyncingCloud ? 'Sincronizando...' : 'Sincronizar com a Nuvem'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {isExportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
                    >
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50 dark:bg-slate-950/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                    <FileSpreadsheet className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">
                                        Exportar Dados
                                    </h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Escolha o formato e o tipo de dados que deseja baixar
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setIsExportModalOpen(false)} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Exportação Geral</h3>
                            <button
                                onClick={exportCompleteTable}
                                className="w-full text-left group flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-lg transition-all mb-8"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/30 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                        <Database className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Tabela Completa (Geral)</h4>
                                        <p className="text-sm text-slate-500">Baixar a planilha com todas as colunas de estoques, pendências e pedidos de todas as filiais.</p>
                                    </div>
                                </div>
                            </button>

                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Pedidos por Fábrica</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button
                                    onClick={() => exportFactoryOrders('pr', 'MK')}
                                    className="group flex flex-col p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-500 hover:shadow-md transition-all text-left"
                                >
                                    <div className="flex items-center justify-between w-full mb-3">
                                        <span className="font-black text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">MK</span>
                                        <Package className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">Somente itens com pedidos &gt; 0.<br/>Colunas: Código, Descrição e Quantidade.</p>
                                </button>

                                <button
                                    onClick={() => exportFactoryOrders('sc', 'Moleri')}
                                    className="group flex flex-col p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 hover:shadow-md transition-all text-left"
                                >
                                    <div className="flex items-center justify-between w-full mb-3">
                                        <span className="font-black text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Moleri</span>
                                        <Package className="w-4 h-4 text-slate-400 group-hover:text-emerald-500" />
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">Somente itens com pedidos &gt; 0.<br/>Colunas: Código, Descrição e Quantidade.</p>
                                </button>

                                <button
                                    onClick={() => exportFactoryOrders('cm', 'CM')}
                                    className="group flex flex-col p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-500 hover:shadow-md transition-all text-left"
                                >
                                    <div className="flex items-center justify-between w-full mb-3">
                                        <span className="font-black text-slate-800 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">CM</span>
                                        <Package className="w-4 h-4 text-slate-400 group-hover:text-amber-500" />
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">Somente itens com pedidos &gt; 0.<br/>Colunas: Código, Descrição e Quantidade.</p>
                                </button>

                                <button
                                    onClick={() => exportFactoryOrders('rs', 'Olimpo')}
                                    className="group flex flex-col p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-rose-500 hover:shadow-md transition-all text-left"
                                >
                                    <div className="flex items-center justify-between w-full mb-3">
                                        <span className="font-black text-slate-800 dark:text-slate-100 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">Olimpo</span>
                                        <Package className="w-4 h-4 text-slate-400 group-hover:text-rose-500" />
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">Somente itens com pedidos &gt; 0.<br/>Colunas: Código, Descrição e Quantidade.</p>
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {isSettingsModalOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-5xl h-[85vh] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col md:flex-row"
                    >
                        {/* Sidebar */}
                        <div className="w-full md:w-64 shrink-0 bg-slate-50 dark:bg-slate-950/50 border-r border-slate-200 dark:border-slate-800 flex flex-col">
                            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    <Settings className="w-5 h-5 text-indigo-500" />
                                    Configurações
                                </h2>
                                <button onClick={() => setIsSettingsModalOpen(false)} className="md:hidden p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <nav className="flex-1 overflow-auto p-4 space-y-1">
                                <button
                                    onClick={() => setActiveSettingsTab('vinculos')}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                                        activeSettingsTab === 'vinculos' 
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <Settings className="w-4 h-4" />
                                    Vínculos de Códigos
                                </button>
                                <button
                                    onClick={() => setActiveSettingsTab('regras')}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                                        activeSettingsTab === 'regras' 
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <Sliders className="w-4 h-4" />
                                    Padrões Globais
                                </button>
                                <button
                                    onClick={() => setActiveSettingsTab('tags')}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                                        activeSettingsTab === 'tags' 
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <Tag className="w-4 h-4" />
                                    Gestão de Tags
                                </button>
                            </nav>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 relative">
                            <div className="hidden md:flex absolute top-4 right-4 z-10">
                                <button onClick={() => setIsSettingsModalOpen(false)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {activeSettingsTab === 'vinculos' && (
                                <div className="flex-1 flex flex-col h-full">
                                    <div className="p-8 border-b border-slate-200 dark:border-slate-800 shrink-0">
                                        <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">
                                            Vínculos de Códigos
                                        </h3>
                                        <p className="mt-2 text-sm text-slate-500 max-w-2xl">
                                            Gerencie os códigos importados das planilhas que foram vinculados manualmente à sua base fixa. Isso permite que o sistema identifique automaticamente itens com nomes ou códigos diferentes nos próximos uploads.
                                        </p>
                                    </div>
                                    <div className="p-8 flex-1 min-h-0 flex flex-col">
                                        {Object.keys(codeMappings).length === 0 ? (
                                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
                                                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 text-slate-400">
                                                    <Settings className="w-8 h-8" />
                                                </div>
                                                <p className="text-slate-600 dark:text-slate-300 font-black text-lg">Nenhum código vinculado no momento.</p>
                                                <p className="text-sm text-slate-500 mt-2 max-w-md">Quando você vincular um código desconhecido a um item da base durante um upload, ele aparecerá aqui para gerenciamento.</p>
                                            </div>
                                        ) : (
                                            <div className="flex-1 min-h-0 overflow-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-950 text-[10px] uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-800">
                                                        <tr>
                                                            <th className="p-4 font-black">Código da Planilha</th>
                                                            <th className="p-4 font-black">Vinculado a (Base Fixa)</th>
                                                            <th className="p-4 text-right w-32 font-black">Ações</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(Object.entries(codeMappings) as [string, string][])
                                                            .sort(([a], [b]) => a.localeCompare(b))
                                                            .map(([importedCode, fixedCode]) => (
                                                            <tr key={importedCode} className="border-b last:border-b-0 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                                                <td className="p-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                                                                    <div className="bg-slate-100 dark:bg-slate-800 inline-block px-2 py-1 rounded">
                                                                        {importedCode}
                                                                    </div>
                                                                </td>
                                                                <td className="p-4">
                                                                    <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                                        {fixedCode}
                                                                    </div>
                                                                    <div className="text-xs text-slate-500 mt-1 truncate max-w-[300px]" title={rows.find(r => r.codigo === fixedCode)?.descricao || 'Item não encontrado na base'}>
                                                                        {rows.find(r => r.codigo === fixedCode)?.descricao || 'Item não encontrado na base'}
                                                                    </div>
                                                                </td>
                                                                <td className="p-4">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <button 
                                                                            onClick={() => {
                                                                                if(window.confirm('Para alterar este vínculo, é recomendado excluí-lo e refazer no próximo upload. Deseja excluir agora?')) {
                                                                                    const newMappings = { ...codeMappings };
                                                                                    delete newMappings[importedCode];
                                                                                    persistCodeMappings(newMappings);
                                                                                    if (
                                                                                        exportCodeMappings[fixedCode]?.codigo === importedCode ||
                                                                                        normalizeUploadCode(exportCodeMappings[fixedCode]?.codigo || '', replacementRules) === importedCode
                                                                                    ) {
                                                                                        const nextExportMappings = { ...exportCodeMappings };
                                                                                        delete nextExportMappings[fixedCode];
                                                                                        persistExportCodeMappings(nextExportMappings);
                                                                                        deletePendenciaExportCodeMapping(fixedCode);
                                                                                    }
                                                                                    toast.success('Vínculo excluído com sucesso.');
                                                                                }
                                                                            }}
                                                                            className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-600 dark:hover:bg-indigo-900/30 transition-colors" 
                                                                            title="Editar Vínculo"
                                                                        >
                                                                            <Pencil className="w-4 h-4" />
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => {
                                                                                if(window.confirm('Excluir este vínculo? O código original voltará a aparecer nos itens não importados no próximo upload.')) {
                                                                                    const newMappings = { ...codeMappings };
                                                                                    delete newMappings[importedCode];
                                                                                    persistCodeMappings(newMappings);
                                                                                    if (
                                                                                        exportCodeMappings[fixedCode]?.codigo === importedCode ||
                                                                                        normalizeUploadCode(exportCodeMappings[fixedCode]?.codigo || '', replacementRules) === importedCode
                                                                                    ) {
                                                                                        const nextExportMappings = { ...exportCodeMappings };
                                                                                        delete nextExportMappings[fixedCode];
                                                                                        persistExportCodeMappings(nextExportMappings);
                                                                                        deletePendenciaExportCodeMapping(fixedCode);
                                                                                    }
                                                                                    toast.success('Vínculo excluído com sucesso.');
                                                                                }
                                                                            }}
                                                                            className="p-2 rounded-lg hover:bg-red-50 text-red-600 dark:hover:bg-red-900/30 transition-colors" 
                                                                            title="Excluir Vínculo"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeSettingsTab === 'regras' && (
                                <div className="flex-1 flex flex-col h-full">
                                    <div className="p-8 border-b border-slate-200 dark:border-slate-800 shrink-0">
                                        <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                                            Padrões Globais
                                        </h3>
                                        <p className="mt-2 text-sm text-slate-500 max-w-2xl">
                                            Estas são as regras de substituição automática de códigos. Elas são aplicadas sempre que você faz o upload de uma planilha para normalizar os prefixos e sufixos antes da vinculação.
                                        </p>
                                    </div>
                                    <div className="p-8 flex-1 min-h-0 overflow-auto">
                                        <div className="grid grid-cols-1 gap-4 max-w-3xl">
                                            {replacementRules.map(rule => (
                                                <div key={rule.id} className={`p-5 rounded-2xl border transition-all ${rule.active ? 'bg-white dark:bg-slate-800/80 border-indigo-200 dark:border-indigo-900 shadow-sm' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-75'}`}>
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-3 mb-1">
                                                                <h4 className={`font-black text-base ${rule.active ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
                                                                    {rule.description}
                                                                </h4>
                                                                {rule.type === 'prefix_swap' && <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Trocar Prefixo</span>}
                                                                {rule.type === 'suffix_replace' && <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">Trocar Sufixo</span>}
                                                                {rule.type === 'remove_char' && <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">Remover Letra</span>}
                                                                {rule.type === 'remove_asterisk' && <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">Remover (*)</span>}
                                                            </div>
                                                            <p className="text-xs text-slate-500 mb-3">
                                                                Aplica-se em: {rule.targetPrefixes.length > 0 ? <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{rule.targetPrefixes.join(', ')}</span> : 'Todos os códigos (Condicional)'}
                                                            </p>
                                                            
                                                            {rule.type === 'prefix_swap' && (
                                                                <div className="flex items-center gap-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800 inline-flex">
                                                                    <span className="text-rose-500 font-bold">{rule.oldPrefix}</span>
                                                                    <span className="text-slate-400">→</span>
                                                                    <span className="text-emerald-500 font-bold">{rule.newPrefix}</span>
                                                                </div>
                                                            )}
                                                            {rule.type === 'suffix_replace' && (
                                                                <div className="flex items-center gap-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800 inline-flex">
                                                                    <span className="text-rose-500 font-bold">{rule.oldSuffix}</span>
                                                                    <span className="text-slate-400">→</span>
                                                                    <span className="text-emerald-500 font-bold">{rule.newSuffix}</span>
                                                                </div>
                                                            )}
                                                            {rule.type === 'remove_char' && (
                                                                <div className="flex items-center gap-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800 inline-flex">
                                                                    <span className="text-slate-600 dark:text-slate-400">Remover:</span>
                                                                    <span className="text-rose-500 font-bold">"{rule.charToRemove}"</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="shrink-0 flex items-center">
                                                            <button 
                                                                onClick={() => toggleRuleActive(rule.id)}
                                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${rule.active ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                                                            >
                                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${rule.active ? 'translate-x-6' : 'translate-x-1'}`} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeSettingsTab === 'tags' && (
                                <div className="flex-1 flex flex-col h-full">
                                    <div className="p-8 border-b border-slate-200 dark:border-slate-800 shrink-0">
                                        <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                                            Biblioteca de Tags
                                        </h3>
                                        <p className="mt-2 text-sm text-slate-500 max-w-2xl">
                                            Personalize as etiquetas globais que poderão ser vinculadas aos itens do catálogo para facilitar a busca.
                                        </p>
                                    </div>
                                    <div className="p-8 flex-1 overflow-y-auto">
                                        <div className="flex gap-2 mb-6 max-w-md">
                                            <input 
                                                type="text"
                                                placeholder="Nova etiqueta..."
                                                value={newTagName}
                                                onChange={e => setNewTagName(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                                                className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 transition-all uppercase"
                                            />
                                            <button 
                                                onClick={handleAddTag}
                                                className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                                            >
                                                Add
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                            {globalTags.map(tag => (
                                                <div key={tag} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 group">
                                                    <span className="text-sm font-black text-slate-600 dark:text-slate-300 tracking-wider">
                                                        {tag}
                                                    </span>
                                                    <button 
                                                        onClick={() => handleDeleteTag(tag)}
                                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all active:scale-90"
                                                        title="Excluir etiqueta"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            ))}
                                            {globalTags.length === 0 && (
                                                <p className="text-center py-4 text-slate-400 text-sm italic col-span-full">Nenhuma tag cadastrada.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}

            {isPhotoModalOpen && photoTarget && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"
                    >
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    <Camera className="w-5 h-5 text-indigo-500" />
                                    Personalizar Foto
                                </h2>
                                <p className="mt-1 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    {photoTarget.codigo} - {photoTarget.model} {photoTarget.finish}
                                </p>
                            </div>
                            <button onClick={() => setIsPhotoModalOpen(false)} className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-5 mb-5">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Foto atual</p>
                                    <div className="aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800">
                                        <img
                                            src={getWheelPhotoUrl(photoTarget.description, photoTarget.codigo)}
                                            alt="Foto atual"
                                            className="w-full h-full object-cover"
                                            onError={(event) => (event.currentTarget.src = 'https://placehold.co/300x300/e2e8f0/64748b?text=SEM+FOTO')}
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col justify-center gap-4">
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                                        <p className="text-xs text-indigo-700 dark:text-indigo-300 font-bold leading-relaxed">
                                            Escolha uma foto abaixo ou envie uma nova. Depois aplique apenas no código {photoTarget.codigo} ou em todo o grupo {photoTarget.model} {photoTarget.finish}.
                                        </p>
                                    </div>

                                    <label
                                        className={cn(
                                            'flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed rounded-lg cursor-pointer transition-all',
                                            isPhotoUploading
                                                ? 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 cursor-not-allowed'
                                                : 'border-indigo-200 dark:border-indigo-900/50 hover:border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/10'
                                        )}
                                    >
                                        {isPhotoUploading ? (
                                            <>
                                                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                                                <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">Enviando...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-6 h-6 text-indigo-600" />
                                                <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Upload de nova foto</span>
                                                <span className="text-[10px] text-slate-400 text-center">A imagem será compactada antes de enviar</span>
                                            </>
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            disabled={isPhotoUploading}
                                            className="hidden"
                                            onChange={handlePhotoUpload}
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Fotos disponíveis</p>
                                {availablePhotos.length === 0 ? (
                                    <p className="py-8 text-center text-sm text-slate-400 font-bold">
                                        Nenhuma foto cadastrada para esta linha. Envie uma nova foto acima.
                                    </p>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                        {availablePhotos.map((url, index) => (
                                            <div key={`${url}-${index}`} className="group relative rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 border-transparent hover:border-indigo-500 transition-all shadow-sm">
                                                <div className="aspect-square w-full">
                                                    <img
                                                        src={url}
                                                        alt={`Opção ${index + 1}`}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                        onError={(event) => (event.currentTarget.src = 'https://placehold.co/200x200/e2e8f0/64748b?text=FOTO')}
                                                    />
                                                </div>
                                                <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-center items-center gap-2 p-3">
                                                    <button
                                                        onClick={() => savePhotoSelection(url, 'item')}
                                                        className="w-full py-2 bg-white text-indigo-600 text-[10px] font-black uppercase rounded-lg shadow-lg hover:bg-indigo-600 hover:text-white transition-all active:scale-95"
                                                    >
                                                        Apenas este
                                                    </button>
                                                    <button
                                                        onClick={() => savePhotoSelection(url, 'model')}
                                                        className="w-full py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-lg shadow-lg hover:bg-slate-900 transition-all active:scale-95"
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
                    </motion.div>
                </div>
            )}

            {editingCode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xl"
                    >
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">
                                {editingCode === 'new' ? 'Adicionar Roda' : 'Editar Roda'}
                            </h2>
                            <button onClick={() => setEditingCode(null)} className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5">
                            <div className="space-y-3">
                                <div className="aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800">
                                    <img
                                        src={getWheelPhotoUrl(draft.descricao, draft.codigo)}
                                        alt={draft.descricao || 'Foto da roda'}
                                        className="w-full h-full object-cover"
                                        onError={(event) => (event.currentTarget.src = 'https://placehold.co/300x300/e2e8f0/64748b?text=SEM+FOTO')}
                                    />
                                </div>
                                <button
                                    onClick={() => openPhotoSelection(draft)}
                                    className="w-full h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 text-slate-700 dark:text-slate-200 rounded-lg font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
                                >
                                    <Camera className="w-4 h-4" />
                                    Ajustar Foto
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-4 content-start">
                                <label className="space-y-1">
                                    <span className="text-xs font-black uppercase text-slate-400">Código</span>
                                    <input
                                        value={draft.codigo}
                                        disabled={editingCode !== 'new'}
                                        onChange={(event) => setDraft((current) => ({ ...current, codigo: event.target.value }))}
                                        className="w-full h-11 px-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:border-indigo-500 disabled:opacity-60"
                                    />
                                </label>
                                <label className="space-y-1">
                                    <span className="text-xs font-black uppercase text-slate-400">Descrição</span>
                                    <input
                                        value={draft.descricao}
                                        onChange={(event) => setDraft((current) => ({ ...current, descricao: event.target.value }))}
                                        className="w-full h-11 px-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:border-indigo-500"
                                    />
                                </label>
                                <label className="space-y-1">
                                    <span className="text-xs font-black uppercase text-slate-400">Custo</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={draft.custo || ''}
                                        onChange={(event) => setDraft((current) => ({ ...current, custo: parseNumber(event.target.value) }))}
                                        className="w-full h-11 px-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:border-indigo-500"
                                    />
                                </label>
                            </div>
                        </div>
                        <div className="p-5 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                            <button onClick={() => setEditingCode(null)} className="h-11 px-4 rounded-lg font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                                Cancelar
                            </button>
                            <button onClick={saveDraft} className="h-11 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black flex items-center gap-2">
                                <Save className="w-4 h-4" />
                                Salvar
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
            {showUnsyncedWarning && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden"
                    >
                        <div className="p-8 text-center">
                            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                                <AlertTriangle className="w-8 h-8 text-amber-500" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">Atenção!</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                                Você carregou planilhas mas ainda <strong className="text-slate-700 dark:text-slate-200">NÃO sincronizou</strong> com a nuvem. Se você sair agora, os vendedores continuarão vendo o estoque antigo. Tem certeza que deseja sair sem sincronizar?
                            </p>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => {
                                        setShowUnsyncedWarning(false);
                                        setIsUploadModalOpen(false);
                                    }}
                                    className="w-full h-12 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-colors shadow-lg shadow-rose-500/20 active:scale-95"
                                >
                                    Sair sem Sincronizar
                                </button>
                                <button
                                    onClick={() => setShowUnsyncedWarning(false)}
                                    className="w-full h-12 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-black text-xs uppercase tracking-widest transition-colors active:scale-95"
                                >
                                    Voltar
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
            {showSyncConfirm && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden"
                    >
                        <div className="p-8 text-center">
                            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CloudUpload className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">Sincronizar Nuvem</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                                Você está prestes a atualizar o estoque para todos os vendedores. Deseja sincronizar as tabelas agora mesmo?
                            </p>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={syncToSupabase}
                                    className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-colors shadow-lg shadow-indigo-500/20 active:scale-95 flex justify-center items-center gap-2"
                                >
                                    <CloudUpload className="w-4 h-4" />
                                    Confirmar Sincronização
                                </button>
                                <button
                                    onClick={() => setShowSyncConfirm(false)}
                                    className="w-full h-12 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-black text-xs uppercase tracking-widest transition-colors active:scale-95"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
            
            <AnimatePresence>
                {showSyncSuccess && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 flex flex-col items-center justify-center relative overflow-hidden"
                        >
                            {/* Colorful background glow */}
                            <div className="absolute inset-0 opacity-20 dark:opacity-10 pointer-events-none">
                                <motion.div 
                                    animate={{ rotate: 360 }} 
                                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                    className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-[conic-gradient(from_0deg,#4285F4,#34A853,#FBBC05,#EA4335,#4285F4)] blur-3xl"
                                />
                            </div>

                            <motion.div
                                initial={{ y: 20 }}
                                animate={{ y: 0 }}
                                className="relative w-48 h-48 mb-2 flex items-center justify-center drop-shadow-2xl"
                            >
                                <Lottie animationData={cloudSyncAnimation} loop={false} />
                            </motion.div>

                            <motion.h2 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.7 }}
                                className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2 relative z-10"
                            >
                                Sincronizado!
                            </motion.h2>
                            <motion.p 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.8 }}
                                className="text-center text-slate-500 dark:text-slate-400 text-sm font-medium relative z-10"
                            >
                                Os dados já estão na nuvem e visíveis para os vendedores.
                            </motion.p>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <SketchModal
                isOpen={sketchModalOpen}
                onClose={() => {
                    setSketchModalOpen(false);
                    setActiveSketchItem(null);
                }}
                codigo={activeSketchItem?.codigo || ''}
                title={activeSketchItem?.title || ''}
                initialDataUrl={activeSketchItem ? sketches[activeSketchItem.codigo] : undefined}
                readOnly={true}
            />

            <AudioPlayerModal
                isOpen={audioPlayerOpen}
                onClose={() => {
                    setAudioPlayerOpen(false);
                    setActiveAudioItem(null);
                }}
                codigo={activeAudioItem?.codigo || ''}
                title={activeAudioItem?.title || ''}
                audioUrl={activeAudioItem ? audios[activeAudioItem.codigo] : ''}
                readOnly={true}
            />
        </>
    );
};
