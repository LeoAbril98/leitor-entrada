import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'react-hot-toast';
import {
    AlertTriangle,
    ArrowLeft,
    Camera,
    CloudUpload,
    Database,
    Download,
    FileSpreadsheet,
    Filter,
    History as HistoryIcon,
    Info,
    LayoutGrid,
    Loader2,
    Package,
    Pencil,
    Plus,
    Printer,
    RefreshCw,
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
    getPendenciasInventory,
    getPendenciaCompletaBaseRows,
    savePendenciaCompletaBaseRows,
    getPendenciaImportCodeMappings,
    savePendenciaImportCodeMappings,
    deletePendenciaImportCodeMapping,
    clearAllPendenciaImportCodeMappings,
    getPendenciaExportCodeMappings,
    savePendenciaExportCodeMappings,
    deletePendenciaExportCodeMapping,
    clearAllPendenciaExportCodeMappings,
    getItemTags,
    saveItemTags,
    getItemCosts,
    saveItemCosts,
    saveCloudSketch,
    deleteCloudSketch,
    saveCloudAudio,
    deleteCloudAudio,
    getCloudAudio,
    getAllCloudSketches,
    getAllCloudAudios,
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
    fixa: boolean;
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

const UPLOAD_SUMMARY_STORAGE_KEY = '@MK_PENDENCIA_COMPLETA_UPLOAD_SUMMARY';
const CODE_MAPPING_STORAGE_KEY = '@MK_PENDENCIA_COMPLETA_CODE_MAPPINGS';
const EXPORT_CODE_MAPPING_STORAGE_KEY = '@MK_PENDENCIA_COMPLETA_EXPORT_CODE_MAPPINGS';
const CLOUD_SYNC_STATUS_STORAGE_KEY = '@MK_PENDENCIA_COMPLETA_LAST_SYNC';

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

type ReplacementRuleType = 'prefix_swap' | 'suffix_replace' | 'remove_char' | 'remove_asterisk';

interface ReplacementRule {
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

const DEFAULT_REPLACEMENT_RULES: ReplacementRule[] = [
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
        active: false,
        targetPrefixes: ['C55', 'C56', 'C58', 'C63', 'C64', 'C87', 'C90'],
        oldPrefix: 'C',
        newPrefix: 'E'
    },
    {
        id: 'c56-lbd-to-bd',
        description: 'Corrigir sufixo LBD para BD',
        type: 'suffix_replace',
        active: false,
        targetPrefixes: ['E56', 'C56'],
        oldSuffix: 'LBD',
        newSuffix: 'BD'
    },
    {
        id: 'c56-bd-to-d',
        description: 'Corrigir sufixo BD para D',
        type: 'suffix_replace',
        active: false,
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
const WEEKLY_BASE_INSERT_AFTER = 'GAUCHA1510P4P25';
const WEEKLY_BASE_INSERT_BEFORE = 'F51860B4A38HG';

const emptyRow = (): CompleteWheelRow => ({
    codigo: '',
    descricao: '',
    custo: 0,
    ordem: 0,
    ordemOrigem: undefined,
    fixa: true,
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

const normalizeCodeKey = (value: unknown) => String(value || '').replace(/\s+/g, '').toUpperCase();

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

const getFallbackOriginalExportCode = (codigo: string, descricao = '') => {
    const normalized = codigo.trim().toUpperCase();
    const prefix = normalized.slice(0, 3);
    const eToCPrefixes = ['E55', 'E56', 'E58', 'E63', 'E64', 'E87', 'E90'];
    let fallback = normalized;

    if (eToCPrefixes.includes(prefix)) {
        fallback = `C${normalized.slice(1)}`;
    }

    // Reverse all global replacement rules to restore original code
    fallback = revertReplacementRules(fallback);

    return fallback || codigo;
};;

const findValue = (row: Record<string, unknown>, aliases: string[]) => {
    const normalizedAliases = aliases.map(normalize);
    const key = Object.keys(row).find((candidate) => normalizedAliases.includes(normalize(candidate)));
    return key ? row[key] : undefined;
};

const getColumnValue = (row: Record<string, unknown>, index: number) => Object.values(row)[index];

const readWorkbookRows = async (file: File): Promise<Record<string, unknown>[]> => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', raw: true });
    const sheetName = workbook.SheetNames.find((name) => normalize(name) === 'PRINCIPAL') || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true });
};

const readWorkbookAs2DArray = async (file: File): Promise<unknown[][]> => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', raw: true });
    const sheetName = workbook.SheetNames.find((name) => normalize(name) === 'PRINCIPAL') || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true });
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

const mergeExportCodeMappings = (...sources: Record<string, ExportMapping>[]) => (
    sources.reduce<Record<string, ExportMapping>>((acc, source) => {
        Object.entries(source || {}).forEach(([fixedCode, mapping]) => {
            if (!mapping?.codigo) return;
            const current = acc[fixedCode];

            // Prioritize original codes that are different from the normalized/fixed base code.
            // A no-op mapping (where original code equals fixed base code) should never overwrite
            // a real mapped original code that is already registered.
            let finalCodigo = mapping.codigo;
            if (mapping.codigo === fixedCode && current?.codigo && current.codigo !== fixedCode) {
                finalCodigo = current.codigo;
            }

            acc[fixedCode] = {
                codigo: finalCodigo,
                descricao: mapping.descricao || current?.descricao
            };
        });
        return acc;
    }, {})
);

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

// Helper to reverse the global replacement rules applied during import.
const revertReplacementRules = (codigo: string): string => {
    let result = codigo;
    let activeRules = DEFAULT_REPLACEMENT_RULES.filter(r => r.active);
    try {
        const stored = localStorage.getItem(REPLACEMENT_RULES_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                activeRules = parsed.filter((r: any) => r.active);
            }
        }
    } catch {
        // Fallback to defaults
    }
    // Process in reverse order to undo transformations correctly.
    for (let i = activeRules.length - 1; i >= 0; i--) {
        const rule = activeRules[i];
        const matchesPrefix = rule.targetPrefixes.length === 0 || rule.targetPrefixes.some(p => result.startsWith(p));
        if (!matchesPrefix) continue;
        switch (rule.type) {
            case 'remove_asterisk':
                if (/^[CR]/.test(result) && !result.endsWith('*')) {
                    result = `${result}*`;
                }
                break;
            case 'prefix_swap':
                if (rule.oldPrefix && rule.newPrefix && result.startsWith(rule.newPrefix)) {
                    result = rule.oldPrefix + result.slice(rule.newPrefix.length);
                }
                break;
            case 'suffix_replace':
                if (rule.oldSuffix && rule.newSuffix && result.endsWith(rule.newSuffix)) {
                    result = result.slice(0, -rule.newSuffix.length) + rule.oldSuffix;
                }
                break;
            // remove_char cannot be reliably reversed; leave as is.
            default:
                break;
        }
    }
    return result;
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
    const [rows, setRows] = useState<CompleteWheelRow[]>([]);
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
    const [activeSettingsTab, setActiveSettingsTab] = useState<'vinculos' | 'regras' | 'tags' | 'custo'>('vinculos');
    const [itemCosts, setItemCosts] = useState<Record<string, number>>({});
    const [itemCostsSearchQuery, setItemCostsSearchQuery] = useState('');
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
    const [isPhotoUploading, setIsPhotoUploading] = useState(false);
    const [importReport, setImportReport] = useState<ImportReport | null>(null);
    const [uploadSummaries, setUploadSummaries] = useState<Record<string, UploadSummary>>(loadUploadSummaries);
    const [codeMappings, setCodeMappings] = useState<Record<string, string>>(loadCodeMappings);
    const [exportCodeMappings, setExportCodeMappings] = useState<Record<string, ExportMapping>>(loadExportCodeMappings);
    const [replacementRules, setReplacementRules] = useState<ReplacementRule[]>(loadReplacementRules);
    const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});
    const [linkTargetItem, setLinkTargetItem] = useState<MissingImportItem | null>(null);
    const [isLinkingCode, setIsLinkingCode] = useState(false);
    const [linkSearch, setLinkSearch] = useState('');
    const [addTargetItem, setAddTargetItem] = useState<MissingImportItem | null>(null);
    const [resetUploadSlot, setResetUploadSlot] = useState<UploadSlot | null>(null);
    const [expandedMobileCode, setExpandedMobileCode] = useState<string | null>(null);
    const [photoTarget, setPhotoTarget] = useState<PhotoTarget | null>(null);
    const [availablePhotos, setAvailablePhotos] = useState<string[]>([]);
    const [lastUploads, setLastUploads] = useState<Record<string, string>>({});
    const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(() => localStorage.getItem(CLOUD_SYNC_STATUS_STORAGE_KEY));
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
    const costFileInputRef = useRef<HTMLInputElement | null>(null);
    const tableContainerRef = useRef<HTMLDivElement | null>(null);

    const markCloudSaved = () => {
        const timestamp = new Date().toISOString();
        localStorage.setItem(CLOUD_SYNC_STATUS_STORAGE_KEY, timestamp);
        setLastCloudSyncAt(timestamp);
    };

    const refreshSystem = () => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then((registrations) => {
                registrations.forEach((registration) => registration.update());
            }).finally(() => window.location.reload());
            return;
        }

        window.location.reload();
    };

    const formatCloudSyncStatus = () => {
        if (!lastCloudSyncAt) return 'Status da nuvem indisponível';
        return `Salvo na nuvem às ${new Date(lastCloudSyncAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    };

    // Lógicas de Carregamento
    const loadItemTags = async () => {
        const tags = await getItemTags();
        setItemTags(tags);
    };

    const loadSavedCodeMappings = async () => {
        const cloudImportMappings = await getPendenciaImportCodeMappings();
        const localImportMappings = loadCodeMappings();
        const next = { ...localImportMappings, ...cloudImportMappings };
        if (Object.keys(next).length === 0) return;

        setCodeMappings(next);
        localStorage.setItem(CODE_MAPPING_STORAGE_KEY, JSON.stringify(next));
    };

    const loadExportMappings = async () => {
        const cloudMappings = await getPendenciaExportCodeMappings();
        const localExportMappings = loadExportCodeMappings();
        const nextExportMappings = mergeExportCodeMappings(localExportMappings, cloudMappings);
        if (Object.keys(nextExportMappings).length === 0) return;

        setExportCodeMappings((current) => {
            const next = mergeExportCodeMappings(current, nextExportMappings);
            localStorage.setItem(EXPORT_CODE_MAPPING_STORAGE_KEY, JSON.stringify(next));
            return next;
        });
        savePendenciaExportCodeMappings(nextExportMappings);
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

    const loadItemCosts = async () => {
        const costs = await getItemCosts();
        setItemCosts(costs);
    };

    useEffect(() => {
        loadCatalogOrder().then(setCatalogOrder);
        getGlobalTags().then(setGlobalTags);
        loadItemTags();
        loadItemCosts();
        loadSavedCodeMappings();
        loadExportMappings();
        loadSketches();
        loadAudios();
    }, []);

    useEffect(() => {
        let isMounted = true;

        const loadBaseRowsFromCloud = async () => {
            const [cloudRows, costs] = await Promise.all([
                getPendenciaCompletaBaseRows(),
                getItemCosts()
            ]);
            if (!isMounted) return;

            setItemCosts(costs);

            if (cloudRows.length === 0) {
                setRows([]);
                return;
            }

            const stockRows = await getPendenciasInventory();
            const stockByCode = new Map(stockRows.map((row: any) => [normalizeCodeKey(row.codigo), row]));

            const baseRows = cloudRows.map((row, index) => {
                const stockRow = stockByCode.get(normalizeCodeKey(row.codigo)) || {};
                const persistentCusto = costs[row.codigo] !== undefined ? costs[row.codigo] : (Number(row.custo ?? stockRow.preco) || 0);

                return {
                    ...emptyRow(),
                    codigo: row.codigo,
                    descricao: row.descricao,
                    custo: persistentCusto,
                    ordem: Number(row.ordem ?? index),
                    ordemOrigem: row.ordem_origem === 'importada' ? 'importada' as const : undefined,
                    fixa: row.ordem_origem !== 'temporaria' && row.ordem_origem !== 'importada',
                    estoque_pr: Number(stockRow.est_mk ?? stockRow.quantidade) || 0,
                    pendencia_pr: Number(stockRow.pend_mk) || 0,
                    estoque_sc: Number(stockRow.est_moleri) || 0,
                    pendencia_sc: Number(stockRow.pend_moleri) || 0,
                    estoque_cm: Number(stockRow.est_cm) || 0,
                    pendencia_cm: Number(stockRow.pend_cm) || 0,
                    estoque_rs: Number(stockRow.est_olimpo) || 0,
                    pendencia_rs: Number(stockRow.pend_olimpo) || 0
                };
            });

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
            toast.success('Tabela carregada da nuvem.', { duration: 2000 });
        };

        loadBaseRowsFromCloud();

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
        return savePendenciaCompletaBaseRows(nextRows.map((row, index) => ({
            codigo: row.codigo,
            descricao: row.descricao,
            custo: row.custo,
            ordem: row.ordem ?? index,
            ordem_origem: row.ordemOrigem || null,
            fixa: row.fixa !== false
        }))).then((success) => {
            if (!success) console.warn('Falha ao sincronizar tabela da Pendência Completa.');
            if (success) markCloudSaved();
            return success;
        });
    };

    const persistUploadSummaries = (nextSummaries: Record<string, UploadSummary>) => {
        setUploadSummaries(nextSummaries);
        localStorage.setItem(UPLOAD_SUMMARY_STORAGE_KEY, JSON.stringify(nextSummaries));
    };

    const persistCodeMappings = async (
        nextMappings: Record<string, string>,
        descriptions: Record<string, string | undefined> = {},
        importedCodesToSync?: string[]
    ) => {
        setCodeMappings(nextMappings);
        localStorage.setItem(CODE_MAPPING_STORAGE_KEY, JSON.stringify(nextMappings));
        const mappingsToSync = importedCodesToSync
            ? importedCodesToSync.reduce<Record<string, string>>((acc, importedCode) => {
                if (nextMappings[importedCode]) acc[importedCode] = nextMappings[importedCode];
                return acc;
            }, {})
            : nextMappings;
        const success = await savePendenciaImportCodeMappings(mappingsToSync, descriptions);
        if (!success) console.warn('Falha ao sincronizar vínculos de importação com o Supabase.');
        return success;
    };

    const handleClearAllCodeMappings = async () => {
        if (!window.confirm('ATENÇÃO: Isso irá excluir TODOS os vínculos de códigos salvos no sistema. O sistema deixará de associar os códigos alternativos nos próximos uploads.\n\nDeseja continuar?')) return;

        setCodeMappings({});
        localStorage.setItem(CODE_MAPPING_STORAGE_KEY, JSON.stringify({}));
        setExportCodeMappings({});
        localStorage.setItem(EXPORT_CODE_MAPPING_STORAGE_KEY, JSON.stringify({}));
        const importSuccess = await clearAllPendenciaImportCodeMappings();
        const exportSuccess = await clearAllPendenciaExportCodeMappings();
        if (!importSuccess || !exportSuccess) {
            toast.error('Erro ao excluir vínculos na nuvem.');
            return;
        }
        toast.success('Todos os vínculos de códigos foram excluídos.');
    };

    const persistExportCodeMappings = async (nextMappings: Record<string, ExportMapping>) => {
        setExportCodeMappings(nextMappings);
        localStorage.setItem(EXPORT_CODE_MAPPING_STORAGE_KEY, JSON.stringify(nextMappings));
        const success = await savePendenciaExportCodeMappings(nextMappings);
        if (!success) console.warn('Falha ao sincronizar vínculos de exportação com o Supabase.');
        return success;
    };

    const deleteCodeMapping = async (importedCode: string, fixedCode: string) => {
        const newMappings = { ...codeMappings };
        delete newMappings[importedCode];

        setCodeMappings(newMappings);
        localStorage.setItem(CODE_MAPPING_STORAGE_KEY, JSON.stringify(newMappings));
        const importDeleted = await deletePendenciaImportCodeMapping(importedCode);

        let exportDeleted = true;
        if (
            exportCodeMappings[fixedCode]?.codigo === importedCode ||
            normalizeUploadCode(exportCodeMappings[fixedCode]?.codigo || '', replacementRules) === importedCode
        ) {
            const nextExportMappings = { ...exportCodeMappings };
            delete nextExportMappings[fixedCode];
            setExportCodeMappings(nextExportMappings);
            localStorage.setItem(EXPORT_CODE_MAPPING_STORAGE_KEY, JSON.stringify(nextExportMappings));
            exportDeleted = await deletePendenciaExportCodeMapping(fixedCode);
        }

        if (!importDeleted || !exportDeleted) {
            toast.error('Vínculo removido localmente, mas falhou ao remover da nuvem.');
            return;
        }

        toast.success('Vínculo excluído com sucesso.');
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

        const getOrder = (row: CompleteWheelRow) => row.ordem;

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
    const getCodeLinkSuggestions = (search: string, limit?: number) => {
        const terms = String(search || '')
            .split(/\s+/)
            .map(normalizeDescriptionSearch)
            .filter(Boolean);
        if (terms.length === 0) return limit ? rows.slice(0, limit) : rows;

        const matches = rows.filter((row) => {
            const haystack = `${normalizeDescriptionSearch(row.codigo)} ${normalizeDescriptionSearch(row.descricao)}`;
            return terms.every((term) => haystack.includes(term));
        });

        return limit ? matches.slice(0, limit) : matches;
    };
    const linkSearchResults = useMemo(() => getCodeLinkSuggestions(linkSearch, 80), [linkSearch, rows]);
    const linkSuggestionCounts = useMemo(() => {
        if (!importReport) return {};

        return importReport.missingItems.reduce<Record<string, number>>((acc, item) => {
            const search = item.descricao === '-' ? item.codigo : item.descricao;
            acc[item.codigo] = getCodeLinkSuggestions(search).length;
            return acc;
        }, {});
    }, [importReport?.missingItems, rows]);

    const handleUpdateCost = async (codigo: string, value: string) => {
        const numericVal = parseNumber(value);
        const nextCosts = { ...itemCosts, [codigo]: numericVal };
        setItemCosts(nextCosts);

        await saveItemCosts(nextCosts);

        setRows(currentRows => currentRows.map(row =>
            row.codigo === codigo ? { ...row, custo: numericVal } : row
        ));
    };

    const handleDeleteCost = async (codigo: string) => {
        if (!window.confirm(`Excluir o custo associado ao código ${codigo}?`)) return;
        const nextCosts = { ...itemCosts };
        delete nextCosts[codigo];
        setItemCosts(nextCosts);
        await saveItemCosts(nextCosts);

        setRows(currentRows => currentRows.map(row =>
            row.codigo === codigo ? { ...row, custo: 0 } : row
        ));
        toast.success(`Custo do código ${codigo} removido.`);
    };

    const importCostsFile = async (file: File) => {
        const toastId = toast.loading('Lendo planilha de custos...');
        try {
            const rows2d = await readWorkbookAs2DArray(file);
            if (rows2d.length === 0) {
                toast.error('A planilha está vazia.', { id: toastId });
                return;
            }

            let headerRowIndex = -1;
            let codeColIndex = -1;
            let costColIndex = -1;

            const codeAliases = ['PRODUTO', 'PRODUTOS', 'CODIGO', 'CÓDIGO', 'COD', 'CÓD', 'ITEM', 'PCE_ITEM', 'REFERENCIA', 'REFERÊNCIA'];
            const costAliases = [
                'CUSTO', 'PRECO', 'PREÇO', 'VALOR',
                'VALOR UNITARIO', 'VALOR UNITÁRIO',
                'VLR UNITARIO', 'VLR UNITÁRIO',
                'VLR UNITARI', 'VLR UNITÁRI',
                'CUSTO UNITARIO', 'CUSTO UNITÁRIO'
            ];

            // Scan first 30 rows to detect headers
            for (let i = 0; i < Math.min(rows2d.length, 30); i++) {
                const row = rows2d[i];
                if (!Array.isArray(row)) continue;

                let foundCodeIndex = -1;
                let foundCostIndex = -1;

                for (let j = 0; j < row.length; j++) {
                    const cellVal = normalize(String(row[j] || ''));
                    if (!cellVal) continue;

                    if (foundCodeIndex === -1 && codeAliases.some(alias => normalize(alias) === cellVal || cellVal.includes(normalize(alias)))) {
                        foundCodeIndex = j;
                    }
                    if (foundCostIndex === -1 && costAliases.some(alias => normalize(alias) === cellVal || cellVal.includes(normalize(alias)))) {
                        foundCostIndex = j;
                    }
                }

                if (foundCodeIndex !== -1 && foundCostIndex !== -1) {
                    headerRowIndex = i;
                    codeColIndex = foundCodeIndex;
                    costColIndex = foundCostIndex;
                    break;
                }
            }

            // Fallback: If no headers found, check if column F (index 5) has codes and column W (index 22) has data
            if (headerRowIndex === -1) {
                for (let i = 0; i < Math.min(rows2d.length, 15); i++) {
                    const row = rows2d[i];
                    if (row && row[5] && String(row[5]).trim()) {
                        headerRowIndex = i;
                        codeColIndex = 5;
                        costColIndex = 22;
                        break;
                    }
                }
            }

            if (codeColIndex === -1 || costColIndex === -1 || headerRowIndex === -1) {
                toast.error('Não foi possível identificar as colunas de Código e Custo na planilha.', { id: toastId });
                return;
            }

            const nextCosts = { ...itemCosts };
            let importedCount = 0;
            const startIdx = headerRowIndex + 1;

            for (let i = startIdx; i < rows2d.length; i++) {
                const row = rows2d[i];
                if (!row || !Array.isArray(row)) continue;

                const rawCodigo = String(row[codeColIndex] || '').trim();
                if (!rawCodigo || rawCodigo === 'Produto' || rawCodigo === 'CODIGO') continue;

                const rawCusto = row[costColIndex];
                const custo = parseNumber(rawCusto);

                const codigo = normalizeUploadCode(rawCodigo, replacementRules);
                const mappedCodigo = codeMappings[codigo] || codigo;

                nextCosts[mappedCodigo] = custo;
                importedCount++;
            }

            if (importedCount === 0) {
                toast.error('Nenhum custo válido encontrado na planilha.', { id: toastId });
                return;
            }

            setItemCosts(nextCosts);
            const saved = await saveItemCosts(nextCosts);
            if (!saved) {
                toast.error('Erro de sincronização: Custos salvos localmente, mas falhou ao salvar na nuvem. Verifique se a tabela "item_costs" foi criada no Supabase.', { duration: 6000 });
            }

            // Also update any matching rows in current dashboard rows
            setRows((currentRows) => {
                const updatedRows = currentRows.map((row) => {
                    const persistentCusto = nextCosts[row.codigo];
                    if (persistentCusto !== undefined) {
                        return { ...row, custo: persistentCusto };
                    }
                    return row;
                });

                savePendenciaCompletaBaseRows(updatedRows.map((row, index) => ({
                    codigo: row.codigo,
                    descricao: row.descricao,
                    custo: row.custo,
                    ordem: row.ordem ?? index,
                    ordem_origem: row.ordemOrigem || null,
                    fixa: row.fixa !== false
                })));

                return updatedRows;
            });

            toast.success(`${importedCount} custos importados e atualizados com sucesso.`, { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error('Erro ao ler a planilha de custos.', { id: toastId });
        } finally {
            if (costFileInputRef.current) costFileInputRef.current.value = '';
        }
    };

    const importBaseFile = async (file: File) => {
        const toastId = toast.loading('Importando base semanal...');
        try {
            const sheetRows = await readWorkbookRows(file);
            const mapped = sheetRows
                .map((sheetRow, index) => {
                    const codigo = String(findValue(sheetRow, ['PRODUTO', 'PCE_ITEM', 'CODIGO', 'CÓDIGO', 'COD', 'CÓD']) || '').trim();
                    const descricao = String(findValue(sheetRow, ['DESCRICAO', 'DESCRIÇÃO', 'CATALOGO', 'CATÁLOGO']) || '').trim();
                    const quantidade = parseNumber(findValue(sheetRow, ['QUANTIDADE', 'QTDE', 'QTD']));
                    const sheetCusto = parseNumber(findValue(sheetRow, ['CUSTO', 'PRECO', 'PREÇO', 'PRECO FABRICA', 'PREÇO FÁBRICA']));
                    const finalCusto = itemCosts[codigo] !== undefined ? itemCosts[codigo] : sheetCusto;
                    return { ...emptyRow(), codigo, descricao, custo: finalCusto, estoque_pr: quantidade, ordem: index, ordemOrigem: 'importada' as const, fixa: false };
                })
                .filter((row) => row.codigo && row.descricao);

            if (mapped.length === 0) {
                toast.error('Nenhum item com código e descrição foi encontrado.', { id: toastId });
                return;
            }

            const currentByCode = new Map<string, CompleteWheelRow>(rows.map((row) => [row.codigo, row]));
            const preservedRows = rows.filter((row) => row.fixa !== false);
            const fixedCodes = new Set(preservedRows.map((row) => row.codigo));
            const mergedRows = mapped.filter((baseRow) => !fixedCodes.has(baseRow.codigo)).map((baseRow) => {
                const current = currentByCode.get(baseRow.codigo);
                return {
                    ...baseRow,
                    fixa: false,
                    ...Object.fromEntries(
                        Object.entries(current || {}).filter(([key]) => key.startsWith('pedido_') || key.startsWith('estoque_') || key.startsWith('pendencia_'))
                    ),
                    estoque_pr: baseRow.estoque_pr
                };
            });
            const insertIndex = (() => {
                const afterIndex = preservedRows.findIndex((row) => normalizeCodeKey(row.codigo) === normalizeCodeKey(WEEKLY_BASE_INSERT_AFTER));
                if (afterIndex >= 0) return afterIndex + 1;

                const beforeIndex = preservedRows.findIndex((row) => normalizeCodeKey(row.codigo) === normalizeCodeKey(WEEKLY_BASE_INSERT_BEFORE));
                if (beforeIndex >= 0) return beforeIndex;

                return preservedRows.length;
            })();
            const merged = [
                ...preservedRows.slice(0, insertIndex),
                ...mergedRows,
                ...preservedRows.slice(insertIndex)
            ].map((row, index) => ({ ...row, ordem: index }));

            const saved = await persistRows(merged);
            if (!saved) {
                toast.error('Erro ao salvar a base semanal na nuvem.', { id: toastId });
                return;
            }

            await syncPendenciasToCloud(rowsToStockItems(merged), 'BaseSemanal_Completa');
            markCloudSaved();
            toast.success(`${mergedRows.length} rodas semanais importadas. ${preservedRows.length} fixas mantidas. ${merged.length} itens salvos na nuvem.`, { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error('Erro ao ler a planilha da base semanal.', { id: toastId });
        } finally {
            if (baseInputRef.current) baseInputRef.current.value = '';
        }
    };

    const importMetricFile = async (file: File, slot: UploadSlot) => {
        if (rows.length === 0) {
            toast.error('Importe a base semanal ou adicione uma roda antes de carregar estoque ou pendência.');
            return;
        }

        const toastId = toast.loading(`Lendo ${slot.label}...`);
        try {
            const sheetRows = await readWorkbookRows(file);
            const quantities = new Map<string, { descricao: string; quantidade: number; custo: number; codigoOriginal?: string }>();
            const uploadExportCodeMappings: Record<string, ExportMapping> = {};
            const isPrStockUpload = slot.metric === 'estoque' && slot.depot === 'pr';
            const rowCodes = new Set(rows.map((row) => isPrStockUpload ? normalizeCodeKey(row.codigo) : row.codigo));

            sheetRows.forEach((sheetRow) => {
                const isStockUpload = slot.metric === 'estoque';
                const productCode = String(findValue(sheetRow, ['PRODUTO', 'PRODUTOS', 'PRDUTOS']) || '').trim();
                const rawSourceCodigo = String(
                    (isPrStockUpload ? productCode : '')
                    || findValue(sheetRow, ['PCE_ITEM', 'CODIGO', 'CÓDIGO', 'COD', 'CÓD', 'ITEM', 'REFERENCIA', 'REFERÊNCIA'])
                    || getColumnValue(sheetRow, 0)
                    || ''
                ).trim();
                const sourceCodigo = isPrStockUpload
                    ? normalizeCodeKey(rawSourceCodigo)
                    : normalizeUploadCode(rawSourceCodigo, replacementRules);
                const codigo = isPrStockUpload
                    ? sourceCodigo
                    : (codeMappings[sourceCodigo] || sourceCodigo);
                const descricao = String(
                    findValue(sheetRow, ['NOME_ITEM', 'DESCRICAO', 'DESCRIÇÃO', 'DESCPRODUTO', 'DESC PRODUTO', 'DESCRICAO PRODUTO', 'DESCRIÇÃO PRODUTO', 'NOME', 'PRODUTO DESCRICAO', 'PRODUTO DESCRIÇÃO'])
                    || getColumnValue(sheetRow, 1)
                    || ''
                ).trim();
                const qty = parseNumber(
                    isPrStockUpload
                        ? findValue(sheetRow, ['QTDE'])
                        : (
                            findValue(sheetRow, ['QUANTIDADE_PEDIDOS', 'QUANTIDADE', 'QTDE', 'QTD', 'QTDE DISPONIVEL', 'QTDE DISPONÍVEL', 'SALDO', 'ESTOQUE', 'ESTOQUE DISPONIVEL', 'ESTOQUE DISPONÍVEL', 'PENDENCIA', 'PENDÊNCIA'])
                            ?? getColumnValue(sheetRow, 2)
                        )
                );
                const custo = isPrStockUpload
                    ? 0
                    : parseNumber(findValue(sheetRow, ['VLR UNITARIO', 'VLR UNITÁRIO', 'VALOR UNITARIO', 'VALOR UNITÁRIO', 'PRECO', 'PREÇO', 'CUSTO']));
                if (!sourceCodigo) return;
                // Only register an export mapping if the raw code from the sheet is different from the normalized/fixed base code
                if (rawSourceCodigo && rawSourceCodigo !== codigo) {
                    const currentMapping = uploadExportCodeMappings[codigo];
                    const existingCode = currentMapping?.codigo;
                    // Prefer keeping the original code that has the most differences (e.g. starts with C or ends with *)
                    const finalCode = (existingCode && existingCode !== codigo) ? existingCode : rawSourceCodigo;
                    uploadExportCodeMappings[codigo] = {
                        codigo: finalCode,
                        descricao: currentMapping?.descricao || descricao || undefined
                    };
                }

                const current = quantities.get(codigo);
                quantities.set(codigo, {
                    descricao: current?.descricao || descricao || (codigo !== sourceCodigo ? `Vínculo: ${sourceCodigo}` : ''),
                    quantidade: (current?.quantidade || 0) + qty,
                    custo: current?.custo || custo,
                    codigoOriginal: current?.codigoOriginal || rawSourceCodigo || sourceCodigo
                });
            });

            const field = getUploadField(slot);
            const missingItems = isPrStockUpload
                ? []
                : Array.from(quantities.entries())
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
                const lookupCode = isPrStockUpload ? normalizeCodeKey(row.codigo) : row.codigo;
                const item = quantities.get(lookupCode);
                if (item === undefined) return row;
                matched += 1;
                importedQuantity += item.quantidade;
                return {
                    ...row,
                    [field]: item.quantidade,
                    custo: isPrStockUpload ? row.custo : (item.custo || row.custo)
                };
            });
            const missingQuantity = isPrStockUpload ? 0 : missingItems.reduce((sum, item) => sum + item.quantidade, 0);

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
        setDraft(row ? { ...row } : { ...emptyRow(), fixa: true });
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
            fixa: false,
            [importReport.field]: item.quantidade
        } as CompleteWheelRow;

        setImportReport({
            ...importReport,
            totalImportado: importReport.totalImportado + 1,
            quantidadeImportada: importReport.quantidadeImportada + item.quantidade,
            quantidadeNaoImportada: Math.max(0, importReport.quantidadeNaoImportada - item.quantidade),
            missingItems: importReport.missingItems.filter((missingItem) => missingItem.codigo !== item.codigo),
            pendingRows: [...importReport.pendingRows, newRow],
            exportCodeMappings: mergeExportCodeMappings(
                importReport.exportCodeMappings,
                {
                    [newRow.codigo]: {
                        codigo: item.codigoOriginal || item.codigo,
                        descricao: item.descricao === '-' ? undefined : item.descricao
                    }
                }
            )
        });
        setAddTargetItem(null);
        toast.success(`${item.codigo} adicionado como roda semanal pendente.`);
    };

    const linkMissingItemToExistingCode = (item: MissingImportItem, targetCodigoInput?: string) => {
        if (!importReport) return;

        const targetCodigo = (targetCodigoInput || linkDrafts[item.codigo] || '').trim();
        const targetRow = importReport.pendingRows.find((row) => row.codigo === targetCodigo);
        if (!targetRow) {
            toast.error('Informe um código existente da tabela para vincular.');
            return;
        }

        setIsLinkingCode(true);
        window.setTimeout(async () => {
            try {
                const nextRows = importReport.pendingRows.map((row) => (
                    row.codigo === targetCodigo
                        ? { ...row, [importReport.field]: Number(row[importReport.field] || 0) + item.quantidade }
                        : row
                ));
                const nextMappings = { ...codeMappings, [item.codigo]: targetCodigo };
                const targetExportMapping = {
                    [targetCodigo]: {
                        codigo: item.codigoOriginal || item.codigo,
                        descricao: item.descricao === '-' ? undefined : item.descricao
                    }
                };
                const nextExportMappings = mergeExportCodeMappings(exportCodeMappings, importReport.exportCodeMappings, targetExportMapping);

                const savedImportMappings = await persistCodeMappings(nextMappings, {
                    [item.codigo]: item.descricao === '-' ? undefined : item.descricao
                }, [item.codigo]);
                if (!savedImportMappings) {
                    toast.error('Vínculo salvo localmente, mas falhou ao salvar a memória fixa na nuvem.');
                }
                const savedExportMappings = await persistExportCodeMappings(nextExportMappings);
                if (!savedExportMappings) {
                    toast.error('Vínculo salvo localmente, mas falhou ao salvar na nuvem.');
                    return;
                }
                setImportReport({
                    ...importReport,
                    totalImportado: importReport.totalImportado + 1,
                    quantidadeImportada: importReport.quantidadeImportada + item.quantidade,
                    quantidadeNaoImportada: Math.max(0, importReport.quantidadeNaoImportada - item.quantidade),
                    missingItems: importReport.missingItems.filter((missingItem) => missingItem.codigo !== item.codigo),
                    pendingRows: nextRows,
                    exportCodeMappings: mergeExportCodeMappings(importReport.exportCodeMappings, targetExportMapping)
                });
                setLinkDrafts((current) => {
                    const next = { ...current };
                    delete next[item.codigo];
                    return next;
                });
                setLinkTargetItem(null);
                setLinkSearch('');
                if (savedImportMappings) {
                    toast.success(`${item.codigo} vinculado ao código ${targetCodigo}.`);
                }
            } finally {
                setIsLinkingCode(false);
            }
        }, 80);
    };

    const cancelPendingUpload = () => {
        setImportReport(null);
        toast('Upload cancelado. Nada foi salvo.');
    };

    const confirmPendingUpload = async () => {
        if (!importReport) return;

        const saved = await persistRows(importReport.pendingRows);
        if (!saved) {
            toast.error('Erro ao salvar o upload na nuvem.');
            return;
        }
        const savedExportMappings = await persistExportCodeMappings(mergeExportCodeMappings(exportCodeMappings, importReport.exportCodeMappings));
        if (!savedExportMappings) {
            toast.error('Upload salvo, mas falhou ao salvar os códigos originais para exportação.');
            return;
        }
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
        toast.success(`${importReport.totalImportado} itens confirmados. Quantidade total ${importReport.quantidadeImportada}. Salvo na nuvem.`);
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

        const normalizedDraft = { ...draft, codigo, descricao, custo: Number(draft.custo) || 0, fixa: draft.fixa !== false };
        const exists = rows.some((row) => row.codigo === codigo);
        if (editingCode === 'new' && exists) {
            toast.error('Já existe uma roda com esse código.');
            return;
        }

        const nextRows = editingCode === 'new'
            ? [...rows, { ...normalizedDraft, ordem: rows.length, fixa: normalizedDraft.fixa !== false }]
            : rows.map((row) => (row.codigo === editingCode ? normalizedDraft : row));

        // Update persistent costs
        const nextCosts = { ...itemCosts, [codigo]: normalizedDraft.custo };
        setItemCosts(nextCosts);
        saveItemCosts(nextCosts);

        persistRows(nextRows);
        setEditingCode(null);
        toast.success(editingCode === 'new' ? 'Item adicionado.' : 'Item atualizado.');
    };

    const deleteRow = (codigo: string) => {
        if (!window.confirm('Apagar este item da tabela?')) return;
        persistRows(rows.filter((row) => row.codigo !== codigo));
        toast.success('Item removido da base.');
    };

    const rowsToStockItems = (sourceRows: CompleteWheelRow[]) => {
        const getOrder = (row: CompleteWheelRow) => row.ordem;

        return [...sourceRows]
            .sort((left, right) => getOrder(left) - getOrder(right))
            .map(row => ({
                codigo: row.codigo,
                descricao: row.descricao,
                local: 'SISTEMA',
                quantidade: row.estoque_pr || 0,
                preco: row.custo || 0,
                fixa: row.fixa !== false,
                est_mk: row.estoque_pr || 0,
                pend_mk: row.pendencia_pr || 0,
                est_moleri: row.estoque_sc || 0,
                pend_moleri: row.pendencia_sc || 0,
                est_cm: row.estoque_cm || 0,
                pend_cm: row.pendencia_cm || 0,
                est_olimpo: row.estoque_rs || 0,
                pend_olimpo: row.pendencia_rs || 0,
            }));
    };

    const clearVariableValues = async () => {
        if (!window.confirm('ATENÇÃO: isso vai arquivar os pedidos atuais no histórico, zerar pedidos, estoques e pendências do Painel Completo, remover as rodas semanais da tela atual e limpar áudios, rascunhos e tags. A base semanal continuará salva no banco até você importar uma nova base.\n\nDeseja continuar?')) return;

        const toastId = toast.loading('Limpando dados e arquivos...');
        try {
            const nextRows = rows
                .filter((row) => row.fixa !== false)
                .map((row) => ({
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
            setRows(nextRows);
            setLastUploads({});
            persistUploadSummaries({});

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
                audios: audioHistory,
                inventorySnapshot: rowsToStockItems(rows)
            });

            const savedBase = await persistRows(nextRows);
            if (!savedBase) {
                throw new Error('Falha ao salvar a base zerada na nuvem.');
            }
            await syncPendenciasToCloud(rowsToStockItems(nextRows), 'BaseFixa_Zerada');
            markCloudSaved();

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

            localStorage.removeItem('inventory_cache');
            toast.success('Pedidos arquivados. Rodas semanais removidas e estoque/pendência zerados na nuvem.', { id: toastId });
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
            await syncPendenciasToCloud(rowsToStockItems(rows), 'BaseFixa_Completa');
            markCloudSaved();

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

    const exportCompleteTable = async (blankOrders = false) => {
        const toastId = toast.loading(blankOrders ? 'Gerando planilha para impressão...' : 'Gerando planilha completa...');
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(blankOrders ? 'Tabela para Impressão' : 'Tabela Completa');

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
                printArea: `A1:N${rows.length + 3}`
            };

            // Definir Colunas
            worksheet.columns = [
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
            worksheet.mergeCells('A1:N1');
            const titleCell = worksheet.getCell('A1');
            const today = new Date().toLocaleDateString('pt-BR').split('/').join(' ');
            titleCell.value = `${blankOrders ? 'TABELA PARA IMPRESSÃO' : 'TABELA COMPLETA (GERAL)'} - ${today}`;
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
            const getOrder = (row: CompleteWheelRow) => row.ordem;
            const orderedRows = [...rows].sort((left, right) => getOrder(left) - getOrder(right));

            orderedRows.forEach((item) => {
                const row = worksheet.addRow({
                    descricao: item.descricao,
                    custo: item.custo || 0,
                    est_pr: item.estoque_pr || 0,
                    pend_pr: item.pendencia_pr || 0,
                    order_pr: blankOrders ? '' : item.pedido_pr || 0,
                    est_sc: item.estoque_sc || 0,
                    pend_sc: item.pendencia_sc || 0,
                    order_sc: blankOrders ? '' : item.pedido_sc || 0,
                    est_cm: item.estoque_cm || 0,
                    pend_cm: item.pendencia_cm || 0,
                    order_cm: blankOrders ? '' : item.pedido_cm || 0,
                    est_rs: item.estoque_rs || 0,
                    pend_rs: item.pendencia_rs || 0,
                    order_rs: blankOrders ? '' : item.pedido_rs || 0
                });

                row.height = 23;
                row.eachCell((cell, colNumber) => {
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FF000000' } },
                        left: { style: 'thin', color: { argb: 'FF000000' } },
                        bottom: { style: 'thin', color: { argb: 'FF000000' } },
                        right: { style: 'thin', color: { argb: 'FF000000' } }
                    };
                    cell.font = { size: 11 };
                    cell.alignment = { vertical: 'middle' };

                    if (colNumber >= 3) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    }

                    if (colNumber === 2) {
                        cell.numFmt = '"R$ " #,##0.00';
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    }
                });
            });

            // Totais
            const lastDataRowIndex = orderedRows.length + 2;
            const totalRowIndex = lastDataRowIndex + 1;
            const totalRow = worksheet.addRow({});
            totalRow.height = 23;
            totalRow.getCell(1).value = 'TOTAL GERAL';
            totalRow.getCell(1).font = { bold: true, size: 10 };
            totalRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
            worksheet.mergeCells(`A${totalRowIndex}:B${totalRowIndex}`);

            const orderColumnIndexes = new Set([5, 8, 11, 14]);
            for (let i = 3; i <= 14; i++) {
                const cell = totalRow.getCell(i);
                const colLetter = worksheet.getColumn(i).letter;
                cell.value = blankOrders && orderColumnIndexes.has(i)
                    ? ''
                    : { formula: `SUM(${colLetter}3:${colLetter}${lastDataRowIndex})` };
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
            saveAs(blob, `${blankOrders ? 'Tabela_Para_Impressao' : 'Tabela_Completa_Geral'}_${dateStr}.xlsx`);

            setIsExportModalOpen(false);
            toast.success(blankOrders ? 'Tabela para impressão exportada com sucesso!' : 'Tabela completa exportada com sucesso!', { id: toastId });
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
            const latestExportMappings = mergeExportCodeMappings(exportCodeMappings, loadExportCodeMappings(), cloudMappings);
            if (Object.keys(cloudMappings).length > 0) {
                setExportCodeMappings(latestExportMappings);
                localStorage.setItem(EXPORT_CODE_MAPPING_STORAGE_KEY, JSON.stringify(latestExportMappings));
                savePendenciaExportCodeMappings(latestExportMappings);
            }
            const manualReverseMappings = (Object.entries(codeMappings) as [string, string][]).reduce<Record<string, string>>((acc, [sourceCode, fixedCode]) => {
                if (!acc[fixedCode]) acc[fixedCode] = sourceCode;
                return acc;
            }, {});
            const getExportInfo = (row: CompleteWheelRow) => {
                const mapping = latestExportMappings[row.codigo];
                return {
                    codigo: mapping?.codigo || manualReverseMappings[row.codigo] || getFallbackOriginalExportCode(row.codigo, row.descricao),
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
                <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 px-2 py-2 transition-colors">
                    <div className="w-full max-w-[110rem] mx-auto flex-1 flex flex-col min-h-0">
                        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setView('dashboard')}
                                    className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 transition-all shadow-sm active:scale-95"
                                    title="Voltar ao Dashboard"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                </button>
                                <div>
                                    <h1 className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5 leading-tight">
                                        <Database className="w-4 h-4 text-indigo-500" />
                                        Tabela semanal
                                    </h1>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <span className={cn(
                                            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                                            lastCloudSyncAt
                                                ? "border-emerald-100 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300"
                                                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400"
                                        )}>
                                            <CloudUpload className="w-3 h-3" />
                                            {formatCloudSyncStatus()}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={refreshSystem}
                                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                            title="Buscar a versão mais nova do sistema"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                            Atualizar sistema
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
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
                                    className="h-10 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm active:scale-95 transition-all"
                                >
                                    <Upload className="w-4 h-4" />
                                    Importar tabela
                                </button>
                                <button
                                    onClick={() => setIsUploadModalOpen(true)}
                                    disabled={rows.length === 0}
                                    className="h-10 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 rounded-lg font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm active:scale-95 transition-all"
                                >
                                    <FileSpreadsheet className="w-4 h-4" />
                                    Uploads
                                </button>
                                <button
                                    onClick={() => startEdit()}
                                    className="h-10 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-lg font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm active:scale-95 transition-all"
                                >
                                    <Plus className="w-4 h-4" />
                                    Adicionar
                                </button>
                                <button
                                    onClick={() => setIsExportModalOpen(true)}
                                    disabled={rows.length === 0}
                                    className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 rounded-lg font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm active:scale-95 transition-all"
                                >
                                    <FileSpreadsheet className="w-4 h-4" />
                                    Exportar
                                </button>
                            </div>
                        </header>

                        <section className="flex-1 flex flex-col min-h-0">
                            <main className="flex-1 flex flex-col min-h-0">
                                <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm">
                                    <div className="px-2 py-1.5 border-b border-slate-200 dark:border-slate-800">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5">
                                                <div className="relative w-full sm:max-w-xs md:max-w-sm">
                                                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <input
                                                        value={query}
                                                        onChange={(event) => setQuery(event.target.value)}
                                                        placeholder="Buscar por código ou descrição"
                                                        className="w-full h-8 pl-8 pr-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs outline-none focus:border-indigo-500"
                                                    />
                                                </div>

                                                <button
                                                    onClick={() => setShowFilters(!showFilters)}
                                                    className={cn(
                                                        "px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors flex items-center gap-1 h-8",
                                                        showFilters ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-700" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                                                    )}
                                                >
                                                    <Filter className="w-3.5 h-3.5" /> Filtros
                                                </button>

                                                {(filterLinha || filterAro || filterFuracao || filterModelo || filterAcabamento || query) && (
                                                    <button onClick={() => { setFilterLinha(""); setFilterAro(""); setFilterFuracao(""); setFilterModelo(""); setFilterAcabamento(""); setQuery(""); }} className="px-2 py-1 text-[10px] uppercase tracking-wider font-black text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-red-200 dark:border-red-900/40 h-8">
                                                        Limpar
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[11px] font-bold text-slate-500">
                                                    {filteredRows.length} de {rows.length} itens
                                                </span>
                                            </div>
                                        </div>
                                        {showFilters && (
                                            <div className="flex flex-wrap items-center gap-1.5 pt-2 mt-1.5 border-t border-slate-100 dark:border-slate-800">
                                                <select value={filterLinha} onChange={e => setFilterLinha(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer shadow-sm">
                                                    <option value="">Linhas</option>
                                                    {uniqueLinhas.map(o => <option key={o} value={o}>Linha {o}</option>)}
                                                </select>

                                                <select value={filterModelo} onChange={e => setFilterModelo(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer shadow-sm">
                                                    <option value="">Modelos</option>
                                                    {uniqueModelos.map(o => <option key={o} value={o}>{o}</option>)}
                                                </select>

                                                <select value={filterAro} onChange={e => setFilterAro(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer shadow-sm">
                                                    <option value="">Aros / Talas</option>
                                                    {uniqueAros.map(o => <option key={o} value={o}>{o}</option>)}
                                                </select>

                                                <select value={filterFuracao} onChange={e => setFilterFuracao(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer shadow-sm">
                                                    <option value="">Furações</option>
                                                    {uniqueFuracoes.map(o => <option key={o} value={o}>{o}</option>)}
                                                </select>

                                                <select value={filterAcabamento} onChange={e => setFilterAcabamento(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer shadow-sm">
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
                                                Importe a base semanal para começar.
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
                                        <table className="w-full min-w-[1390px] text-[13px] text-left whitespace-nowrap border-separate border-spacing-0">
                                            <thead className="sticky top-0 z-20 text-[10px] font-black uppercase bg-white dark:bg-slate-900 shadow-sm text-slate-500 dark:text-slate-300">
                                                <tr className="h-8">
                                                    <th rowSpan={2} className="sticky left-0 top-0 z-40 px-2 py-0 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 min-w-[56px] align-middle">Foto</th>
                                                    <th rowSpan={2} className="sticky left-[56px] top-0 z-40 px-2 py-0 border-b border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 min-w-[250px] lg:min-w-[310px] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] align-middle">Identificação do produto</th>
                                                    <th rowSpan={2} className="top-0 px-2 py-0 border-b border-r border-slate-200 dark:border-slate-700 text-right min-w-[82px] align-middle bg-white dark:bg-slate-900">Custo</th>
                                                    {DEPOTS.map((depot) => (
                                                        <th
                                                            key={depot.key}
                                                            className={cn('top-0 px-1.5 py-0 border-r border-slate-200 dark:border-slate-700 text-center tracking-[0.18em] align-middle', DEPOT_STYLES[depot.key].group)}
                                                            colSpan={3}
                                                        >
                                                            <div className="p-1 text-center font-black">{depot.label}</div>
                                                        </th>
                                                    ))}
                                                    <th className="p-1.5 w-16">Ações</th>
                                                </tr>
                                                <tr className="h-6 text-[8px] uppercase tracking-widest">
                                                    {DEPOTS.map((depot) => (
                                                        <React.Fragment key={depot.key}>
                                                            <th className={cn('px-1.5 py-0 border-b border-r border-slate-200 dark:border-slate-700 text-center', DEPOT_STYLES[depot.key].group)}>Est.</th>
                                                            <th className={cn('px-1.5 py-0 border-b border-r border-slate-200 dark:border-slate-700 text-center', DEPOT_STYLES[depot.key].group)}>Pend.</th>
                                                            <th className={cn('px-1.5 py-0 border-b border-r border-slate-200 dark:border-slate-700 text-center', DEPOT_STYLES[depot.key].order)}>Pedido</th>
                                                        </React.Fragment>
                                                    ))}
                                                    <th />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredRows.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={16} className="p-10 text-center text-slate-400 font-bold">
                                                            Importe a base semanal para começar.
                                                        </td>
                                                    </tr>
                                                ) : currentPageRows.map((row, index) => {
                                                    const isEven = index % 2 === 0;
                                                    const bgNormal = isEven ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800';
                                                    const photoUrl = getWheelPhotoUrl(row.descricao, row.codigo);
                                                    const modelCode = row.descricao.split(' ')[0].toUpperCase();

                                                    return (
                                                        <tr key={row.codigo} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors group">
                                                            <td className={cn('sticky left-0 z-10 px-2 py-1 min-w-[56px]', bgNormal)}>
                                                                <img
                                                                    src={photoUrl}
                                                                    alt={`Foto ${modelCode}`}
                                                                    className="w-12 h-12 rounded object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
                                                                />
                                                            </td>
                                                            <td className={cn('sticky left-[56px] z-[5] px-2 py-1 min-w-[250px] lg:min-w-[310px] border-r border-slate-200 dark:border-slate-700/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]', bgNormal)}>
                                                                <div className="flex flex-col gap-0.5">
                                                                    <span className="text-slate-700 dark:text-slate-200 font-bold text-[15px] leading-tight">{row.descricao}</span>
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">{row.codigo}</span>
                                                                        <span className={cn(
                                                                            "px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border",
                                                                            row.fixa === false
                                                                                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                                                                                : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800"
                                                                        )}>
                                                                            {row.fixa === false ? 'Semanal' : 'Fixa'}
                                                                        </span>
                                                                    </div>

                                                                    {/* Tags List */}
                                                                    {itemTags[row.codigo]?.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {itemTags[row.codigo].map(tag => (
                                                                                <span
                                                                                    key={tag}
                                                                                    className="px-1.5 py-0.5 text-[9px] font-black bg-slate-100 dark:bg-slate-800 text-slate-600 rounded border border-slate-200 dark:border-slate-700 flex items-center shadow-sm"
                                                                                >
                                                                                    {tag}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}

                                                                    {/* Action Hub (Only Read/Preview) */}
                                                                    {(sketches[row.codigo] || audios[row.codigo]) && (
                                                                    <div className="flex items-center gap-1 mt-0.5">
                                                                        {/* Sketch Preview */}
                                                                        {sketches[row.codigo] && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setActiveSketchItem({ codigo: row.codigo, title: row.descricao });
                                                                                    setSketchModalOpen(true);
                                                                                }}
                                                                                className="w-5 h-5 rounded border border-amber-200 bg-amber-50 overflow-hidden shadow-sm hover:scale-115 transition-all"
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
                                                                                className="p-0.5 rounded-full bg-rose-50 dark:bg-rose-900/30 text-rose-500 hover:bg-rose-100 hover:scale-115 transition-all border border-rose-100 dark:border-rose-800 shadow-sm"
                                                                                title="Ouvir Nota de Voz"
                                                                            >
                                                                                <Volume2 className="w-2.5 h-2.5" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className={cn('px-2 py-1 text-right font-semibold text-slate-500 text-xs', bgNormal)}>
                                                                {row.custo ? row.custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                                                            </td>
                                                            {DEPOTS.map((depot) => (
                                                                <React.Fragment key={depot.key}>
                                                                    <td className={cn('px-1.5 py-1 text-center font-bold text-slate-500 text-[15px]', DEPOT_STYLES[depot.key].body)}>{row[`estoque_${depot.key}`] || 0}</td>
                                                                    <td className={cn('px-1.5 py-1 text-center text-slate-400 text-[15px]', DEPOT_STYLES[depot.key].body)}>{row[`pendencia_${depot.key}`] || 0}</td>
                                                                    <td className={cn('px-1.5 py-1 text-center border-x border-slate-200 dark:border-slate-700 font-black text-red-600 dark:text-red-400', DEPOT_STYLES[depot.key].body)}>
                                                                        <div className="flex items-center justify-center mx-auto w-12 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 rounded-md py-0.5 shadow-sm">
                                                                            <span className="text-[17px]">{row[`pedido_${depot.key}`] || 0}</span>
                                                                        </div>
                                                                    </td>
                                                                </React.Fragment>
                                                            ))}
                                                            <td className={cn('p-1', bgNormal)}>
                                                                <div className="flex items-center justify-center gap-0.5">
                                                                    <button onClick={() => startEdit(row)} className="p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600" title="Editar">
                                                                        <Pencil className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button onClick={() => deleteRow(row.codigo)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600" title="Apagar">
                                                                        <Trash2 className="w-3.5 h-3.5" />
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

                                        <div className="hidden md:flex px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 overflow-x-auto items-center justify-between gap-4">
                                            <div className="flex items-center justify-start gap-4 min-w-max">
                                                {DEPOTS.map((depot) => (
                                                    <div key={depot.key} className="flex items-center gap-2 border-r last:border-r-0 border-slate-200 dark:border-slate-700 pr-4 last:pr-0">
                                                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{depot.label}</span>
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex items-baseline gap-1">
                                                                <span className="text-[9px] text-slate-500 uppercase">Est</span>
                                                                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{totals[depot.key].estoque}</span>
                                                            </div>
                                                            <div className="flex items-baseline gap-1">
                                                                <span className="text-[9px] text-slate-500 uppercase">Pnd</span>
                                                                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{totals[depot.key].pendencia}</span>
                                                            </div>
                                                            <div className="flex items-baseline gap-1 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                                                <span className="text-[9px] text-amber-700 dark:text-amber-400 font-bold uppercase">Ped</span>
                                                                <span className="text-sm font-black text-amber-800 dark:text-amber-300">{totals[depot.key].pedido}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <button
                                                onClick={clearVariableValues}
                                                disabled={rows.length === 0}
                                                className="shrink-0 h-9 px-3 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 rounded-lg font-black text-[11px] uppercase tracking-widest flex items-center gap-2 shadow-sm active:scale-95 transition-all"
                                            >
                                                <RotateCcw className="w-4 h-4" />
                                                Zerar Valores
                                            </button>
                                        </div>

                                        <div className="px-3 py-1.5 flex flex-col sm:flex-row items-center justify-between gap-2 bg-white dark:bg-slate-900">
                                            <div className="flex items-center gap-4">
                                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                    Mostrando {firstVisibleItem} - {lastVisibleItem} de {filteredRows.length} rodas
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700 shadow-sm">
                                                <button
                                                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                                    disabled={currentPage === 1}
                                                    className="px-3 py-1 text-sm font-semibold rounded cursor-pointer transition-colors text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 dark:active:bg-slate-600"
                                                >
                                                    Anterior
                                                </button>
                                                <div className="text-sm font-black text-amber-600 dark:text-amber-500 px-3 py-0.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded shadow-inner">
                                                    {currentPage} <span className="text-slate-400 font-medium">/ {totalPages}</span>
                                                </div>
                                                <button
                                                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                                                    disabled={currentPage === totalPages}
                                                    className="px-3 py-1 text-sm font-semibold rounded cursor-pointer transition-colors text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 dark:active:bg-slate-600"
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
                                        Todos os códigos do arquivo foram encontrados na tabela.
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
                                                                {linkDrafts[item.codigo]
                                                                    ? `Vinculado: ${linkDrafts[item.codigo]}`
                                                                    : `Vincular código (${linkSuggestionCounts[item.codigo] || 0})`}
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
                                    Adicionar à tabela
                                </h2>
                                <p className="mt-1 text-xs text-slate-500">
                                    Confirme apenas se esse item realmente deve entrar na tabela.
                                </p>
                            </div>
                            <button onClick={() => setAddTargetItem(null)} className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                                Ao clicar em adicionar, este item será incluído na prévia da tabela como roda semanal com a quantidade deste upload. Depois, ao clicar em <strong>Confirmar upload</strong>, ele será salvo na lista principal e poderá ser usado nos próximos uploads.
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
                                Adicionar à tabela
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
                                    placeholder="Buscar pela descrição da tabela"
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
                                                        disabled={isLinkingCode}
                                                        className="h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest disabled:cursor-wait disabled:opacity-60"
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

            {isLinkingCode && (
                <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/70 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.94, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 8 }}
                        className="w-full max-w-sm rounded-lg border border-indigo-200 bg-white p-6 text-center shadow-2xl dark:border-indigo-900 dark:bg-slate-900"
                    >
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
                            <Loader2 className="h-7 w-7 animate-spin" />
                        </div>
                        <h3 className="mt-4 text-lg font-black text-slate-800 dark:text-slate-100">
                            Vinculando código
                        </h3>
                        <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                            Aplicando a sugestão, salvando o código original e atualizando a prévia do upload.
                        </p>
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
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Tabelas</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                                <button
                                    onClick={() => exportCompleteTable(true)}
                                    className="cursor-pointer text-left group flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-sm transition-all active:scale-[0.99]"
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="w-11 h-11 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
                                            <Printer className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-slate-800 dark:text-slate-100 transition-colors">Tabela para impressão</h4>
                                            <p className="text-sm text-slate-500">Pedidos em branco para preenchimento manual.</p>
                                        </div>
                                    </div>
                                    <div className="shrink-0 w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 flex items-center justify-center group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">
                                        <Download className="w-4 h-4" />
                                    </div>
                                </button>

                                <button
                                    onClick={() => exportCompleteTable(false)}
                                    className="cursor-pointer text-left group flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-sm transition-all active:scale-[0.99]"
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="w-11 h-11 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
                                            <Database className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-slate-800 dark:text-slate-100 transition-colors">Tabela completa</h4>
                                            <p className="text-sm text-slate-500">Tabela com estoques, pendências e pedidos preenchidos.</p>
                                        </div>
                                    </div>
                                    <div className="shrink-0 w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 flex items-center justify-center group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">
                                        <Download className="w-4 h-4" />
                                    </div>
                                </button>
                            </div>

                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Pedidos</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button
                                    onClick={() => exportFactoryOrders('pr', 'MK')}
                                    className="cursor-pointer group flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-sm transition-all text-left active:scale-[0.99]"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Package className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200" />
                                            <span className="font-black text-slate-800 dark:text-slate-100 transition-colors">Pedidos MK</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-relaxed">Pedidos da MK.<br />Código, descrição e quantidade.</p>
                                    </div>
                                    <div className="shrink-0 w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 flex items-center justify-center group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">
                                        <Download className="w-4 h-4" />
                                    </div>
                                </button>

                                <button
                                    onClick={() => exportFactoryOrders('sc', 'Moleri')}
                                    className="cursor-pointer group flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-sm transition-all text-left active:scale-[0.99]"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Package className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200" />
                                            <span className="font-black text-slate-800 dark:text-slate-100 transition-colors">Pedidos Moleri</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-relaxed">Pedidos da Moleri.<br />Código, descrição e quantidade.</p>
                                    </div>
                                    <div className="shrink-0 w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 flex items-center justify-center group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">
                                        <Download className="w-4 h-4" />
                                    </div>
                                </button>

                                <button
                                    onClick={() => exportFactoryOrders('cm', 'CM')}
                                    className="cursor-pointer group flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-sm transition-all text-left active:scale-[0.99]"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Package className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200" />
                                            <span className="font-black text-slate-800 dark:text-slate-100 transition-colors">Pedidos CM</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-relaxed">Pedidos da CM.<br />Código, descrição e quantidade.</p>
                                    </div>
                                    <div className="shrink-0 w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 flex items-center justify-center group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">
                                        <Download className="w-4 h-4" />
                                    </div>
                                </button>

                                <button
                                    onClick={() => exportFactoryOrders('rs', 'Olimpo')}
                                    className="cursor-pointer group flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-sm transition-all text-left active:scale-[0.99]"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Package className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200" />
                                            <span className="font-black text-slate-800 dark:text-slate-100 transition-colors">Pedidos Olimpo</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-relaxed">Pedidos da Olimpo.<br />Código, descrição e quantidade.</p>
                                    </div>
                                    <div className="shrink-0 w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 flex items-center justify-center group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">
                                        <Download className="w-4 h-4" />
                                    </div>
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
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeSettingsTab === 'vinculos'
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                                        }`}
                                >
                                    <Settings className="w-4 h-4" />
                                    Vínculos de Códigos
                                </button>
                                <button
                                    onClick={() => setActiveSettingsTab('regras')}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeSettingsTab === 'regras'
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                                        }`}
                                >
                                    <Sliders className="w-4 h-4" />
                                    Padrões Globais
                                </button>
                                <button
                                    onClick={() => setActiveSettingsTab('tags')}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeSettingsTab === 'tags'
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                                        }`}
                                >
                                    <Tag className="w-4 h-4" />
                                    Gestão de Tags
                                </button>
                                <button
                                    onClick={() => setActiveSettingsTab('custo')}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeSettingsTab === 'custo'
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                                        }`}
                                >
                                    <TrendingUp className="w-4 h-4" />
                                    Custo dos Itens
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
                                    <div className="p-8 border-b border-slate-200 dark:border-slate-800 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <div>
                                            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">
                                                Vínculos de Códigos
                                            </h3>
                                            <p className="mt-2 text-sm text-slate-500 max-w-2xl">
                                                Gerencie os códigos importados das planilhas que foram vinculados manualmente à sua tabela. Isso permite que o sistema identifique automaticamente itens com nomes ou códigos diferentes nos próximos uploads.
                                            </p>
                                        </div>
                                        {Object.keys(codeMappings).length > 0 && (
                                            <button
                                                onClick={handleClearAllCodeMappings}
                                                className="shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 font-bold text-sm rounded-xl transition-all shadow-sm active:scale-95"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Limpar Todos
                                            </button>
                                        )}
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
                                                            <th className="p-4 font-black">Vinculado a (Tabela)</th>
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
                                                                                onClick={async () => {
                                                                                    if (window.confirm('Para alterar este vínculo, é recomendado excluí-lo e refazer no próximo upload. Deseja excluir agora?')) {
                                                                                        await deleteCodeMapping(importedCode, fixedCode);
                                                                                    }
                                                                                }}
                                                                                className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-600 dark:hover:bg-indigo-900/30 transition-colors"
                                                                                title="Editar Vínculo"
                                                                            >
                                                                                <Pencil className="w-4 h-4" />
                                                                            </button>
                                                                            <button
                                                                                onClick={async () => {
                                                                                    if (window.confirm('Excluir este vínculo? O código original voltará a aparecer nos itens não importados no próximo upload.')) {
                                                                                        await deleteCodeMapping(importedCode, fixedCode);
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

                            {activeSettingsTab === 'custo' && (
                                <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-900">
                                    <div className="p-8 border-b border-slate-200 dark:border-slate-800 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50/50 dark:bg-slate-950/20">
                                        <div>
                                            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                                                <TrendingUp className="w-6 h-6 text-indigo-500" />
                                                Gerenciamento de Custos
                                            </h3>
                                            <p className="mt-2 text-sm text-slate-500 max-w-2xl">
                                                Cadastre e edite custos de itens da base. Os custos cadastrados aqui persistirão mesmo após as limpezas de estoques e pedidos ("Zerar Semana").
                                            </p>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <button
                                                onClick={() => costFileInputRef.current?.click()}
                                                className="flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                                            >
                                                <Upload className="w-4 h-4" />
                                                Importar Planilha
                                            </button>
                                            <input
                                                type="file"
                                                ref={costFileInputRef}
                                                accept=".xlsx,.xls,.xlsm,.csv"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) importCostsFile(file);
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="p-8 flex-1 min-h-0 flex flex-col">
                                        <div className="mb-6">
                                            <input
                                                type="text"
                                                placeholder="Buscar por código ou descrição..."
                                                value={itemCostsSearchQuery}
                                                onChange={(e) => setItemCostsSearchQuery(e.target.value)}
                                                className="w-full max-w-md px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 transition-all"
                                            />
                                        </div>

                                        {Object.keys(itemCosts).length === 0 ? (
                                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
                                                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 text-slate-400">
                                                    <TrendingUp className="w-8 h-8" />
                                                </div>
                                                <p className="text-slate-600 dark:text-slate-300 font-black text-lg">Nenhum custo cadastrado.</p>
                                                <p className="text-sm text-slate-500 mt-2 max-w-md">Importe uma planilha de custos ou defina custos diretamente nos itens da tabela principal para vê-los aqui.</p>
                                            </div>
                                        ) : (
                                            <div className="flex-1 min-h-0 overflow-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-950 text-[10px] uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-800">
                                                        <tr>
                                                            <th className="p-4 font-black">Código</th>
                                                            <th className="p-4 font-black">Descrição</th>
                                                            <th className="p-4 font-black w-48">Custo (R$)</th>
                                                            <th className="p-4 text-right w-24 font-black">Ações</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {Object.entries(itemCosts)
                                                            .filter(([codigo]) => {
                                                                const desc = rows.find(r => r.codigo === codigo)?.descricao || '';
                                                                const normQuery = normalize(itemCostsSearchQuery);
                                                                return normalize(codigo).includes(normQuery) || normalize(desc).includes(normQuery);
                                                            })
                                                            .sort(([a], [b]) => a.localeCompare(b))
                                                            .map(([codigo, custo]) => {
                                                                const matchingRow = rows.find(r => r.codigo === codigo);
                                                                return (
                                                                    <tr key={codigo} className="border-b last:border-b-0 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                                                        <td className="p-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                                                                            <div className="bg-slate-100 dark:bg-slate-800 inline-block px-2 py-1 rounded">
                                                                                {codigo}
                                                                            </div>
                                                                        </td>
                                                                        <td className="p-4 text-slate-600 dark:text-slate-400 font-medium">
                                                                            {matchingRow?.descricao || <span className="text-slate-400 italic">Não cadastrado na base ativa</span>}
                                                                        </td>
                                                                        <td className="p-4">
                                                                            <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 focus-within:border-indigo-500 transition-colors bg-white dark:bg-slate-900">
                                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                                                                                <input
                                                                                    type="number"
                                                                                    step="0.01"
                                                                                    min="0"
                                                                                    defaultValue={custo}
                                                                                    onBlur={(e) => handleUpdateCost(codigo, e.target.value)}
                                                                                    onKeyDown={(e) => {
                                                                                        if (e.key === 'Enter') {
                                                                                            handleUpdateCost(codigo, e.currentTarget.value);
                                                                                            e.currentTarget.blur();
                                                                                        }
                                                                                    }}
                                                                                    className="w-full pl-9 pr-3 py-1.5 bg-transparent text-sm font-bold outline-none text-slate-800 dark:text-slate-100"
                                                                                />
                                                                            </div>
                                                                        </td>
                                                                        <td className="p-4">
                                                                            <div className="flex items-center justify-end gap-2">
                                                                                <button
                                                                                    onClick={() => handleDeleteCost(codigo)}
                                                                                    className="p-2 rounded-lg hover:bg-red-50 text-red-600 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
                                                                                    title="Excluir Custo"
                                                                                >
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
                                        )}
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
                                <div className="md:col-span-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3">
                                    <div>
                                        <span className="block text-xs font-black uppercase text-slate-500 dark:text-slate-300">Tipo da roda</span>
                                        <span className="block text-xs text-slate-400">Semana sai no zerar; fixa permanece até você excluir.</span>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setDraft((current) => ({ ...current, fixa: false }))}
                                            className={cn(
                                                "h-10 rounded-lg border text-xs font-black uppercase tracking-widest transition-colors",
                                                draft.fixa === false
                                                    ? "bg-amber-500 text-white border-amber-500"
                                                    : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                                            )}
                                        >
                                            Semana
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDraft((current) => ({ ...current, fixa: true }))}
                                            className={cn(
                                                "h-10 rounded-lg border text-xs font-black uppercase tracking-widest transition-colors",
                                                draft.fixa !== false
                                                    ? "bg-indigo-600 text-white border-indigo-600"
                                                    : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                                            )}
                                        >
                                            Fixa
                                        </button>
                                    </div>
                                </div>
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
                                Os dados já estão na nuvem e visíveis.
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
