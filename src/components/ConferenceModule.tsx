import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { 
    ArrowLeft, 
    ClipboardCheck, 
    Truck, 
    Boxes, 
    Search, 
    RefreshCcw, 
    Camera, 
    Barcode, 
    CheckCircle2, 
    AlertTriangle, 
    AlertOctagon,
    FileSpreadsheet, 
    Upload, 
    Plus, 
    Minus, 
    Trash2, 
    Hash, 
    Check, 
    RotateCcw, 
    ChevronRight,
    FileText,
    Copy,
    Sparkles,
    UserCheck,
    X,
    FileCode,
    PlusCircle,
    FilePlus,
    Link as LinkIcon,
    Unlink,
    History,
    BookmarkCheck,
    ListCheck,
    Edit3,
    ArrowRight,
    Settings,
    Cloud,
    Database,
    Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { ConferenceExportModal, createConferencePDFDoc } from './ConferenceExportModal';

import { ScannerInput } from './ScannerInput';
import { ManualAddModal } from './ManualAddModal';
import { CameraScannerModal } from './CameraScannerModal';
import { 
    getInventory,
    getCloudCargaCodeMappings,
    saveCloudCargaCodeMapping,
    deleteCloudCargaCodeMapping,
    clearAllCloudCargaCodeMappings,
    getCloudCargaItems,
    saveCloudCargaItems,
    updateCloudCargaItemQty,
    clearCloudCargaItems
} from '../lib/supabase';
import { StockItem } from '../types';
import { cn } from '../utils';

interface ConferenceModuleProps {
    onBackToMenu: () => void;
}

type SubMode = 'menu' | 'carga-cm' | 'estoque';
type FilterStatus = 'todos' | 'ok' | 'divergentes' | 'pendentes' | 'erros';

export interface UnmatchedScan {
    id: string;
    code: string;
    reason: string;
    timestamp: string;
    count: number;
}

export interface CargaItem {
    id: string;
    codigo: string;
    descricao: string;
    cliente: string;
    qtdEsperada: number;
    qtdConferida: number;
    destino: string;
}

export interface ImportPreviewItem {
    id: string;
    rawDesc: string;
    cliente: string;
    qtdEsperada: number;
    selectedStock: StockItem | null;
}

// Amostra do "CAMINHAO DO DIA 20-08" (Curitiba p CM)
const SAMPLE_CURITIBA_CM = `CURITIBA P CM
13 M30 20X8 5x112 BD
(2 ULTRA REB, 11 ESTOQUE)

2 M30 20X8 5x112 Black
(ULTRA REBOQUES)

4 SURF 17 4X100 GF
(GP RODAS)

8 M37 20X9,0 6X139 BLACK
(4 FORTAL E 4 ESTOQUE)

4 M37 20X9,0 6X139,7 U BDS
(FORTAL)

4 M37 20X9,0 5X108 BDS
(FORTAL)

18 M6 15x7 5x112 HD
(MARCEL, ESTOQUE)

12 M02 15X6 4X98 42 SS
(4 RODOLFO E 8 ESTOQUE)

1 R87 20 5x120 Black
(ZAMBELLO)

8 M30 20 5x110 Black
(4 VN RODAS, 4 ESTOQUE)

1 R87 20 5x120 BD
(GABRIEL PARRA)

4 S50 18X7,5 6x139 BF
(FELIPE BRANDÃO)`;

/**
 * DICIONÁRIO E NORMALIZAÇÃO DE ACABAMENTOS
 * BD: Black Diamond
 * B: Black
 * BDS: Black Diamond Smoke / Smokle
 * HG: Hyper Gloss
 * HD: Hyper Diamond
 * GF: Grafite / Graphite
 * SS: Super Silver / Silver
 * BF: Black Face
 */
const FINISHING_MAP: Array<[RegExp, string]> = [
    [/\bBLACK\s+DIAMOND\s+SMOKLE?\b/gi, 'BDS'],
    [/\bBLACK\s+DIAMOND\b/gi, 'BD'],
    [/\bBLACK\s+FOSCO\b|\bBLACK\s+FACE\b/gi, 'BF'],
    [/\bHYPER\s+GLOSS\b/gi, 'HG'],
    [/\bHYPER\s+DIAMOND\b/gi, 'HD'],
    [/\bGLOSS\s+SHADOW\b/gi, 'GS'],
    [/\bGOLD\b|\bDOURAD[OA]\b/gi, 'GV'],
    [/\bGRAFITE\s+FOSCO\b|\bGRAFITE\b|\bGRAPHITE\b/gi, 'GF'],
    [/\bSUPER\s+SILVER\b|\bSILVER\b/gi, 'SS'],
    [/\bBLACK\b/gi, 'B']
];

export function normalizeWheelText(text: string): string {
    if (!text) return '';
    let normalized = text.toUpperCase().replace(/[×✕✖]/g, 'X');

    // Substituir acabamentos por siglas padronizadas
    for (const [regex, shortCode] of FINISHING_MAP) {
        normalized = normalized.replace(regex, shortCode);
    }

    // Limpar pontuações e hífens para dar espaço
    normalized = normalized.replace(/[-_.,/]/g, ' ');
    return normalized.replace(/\s+/g, ' ').trim();
}

/**
 * Busca inteligente multi-palavra que ignora variações como 17X7 vs 17X7,0 / 17X7.0
 * e permite termos em qualquer ordem (ex: "S56 17 5x100")
 */
export function isMatchSearchQuery(textToSearch: string, searchQuery: string): boolean {
    if (!searchQuery || !searchQuery.trim()) return true;
    if (!textToSearch) return false;

    // Normaliza o texto de busca e o alvo (substitui × por X)
    let cleanQuery = searchQuery.toUpperCase().replace(/[×✕✖]/g, 'X');
    // Trata X7,0 ou X7.0 como X7 para busca flexível de tala
    cleanQuery = cleanQuery.replace(/X(\d+)[,.]0\b/g, 'X$1');

    let cleanText = textToSearch.toUpperCase().replace(/[×✕✖]/g, 'X');
    cleanText = cleanText.replace(/X(\d+)[,.]0\b/g, 'X$1');

    const queryTokens = cleanQuery.split(/\s+/).filter(Boolean);

    return queryTokens.every(token => {
        if (cleanText.includes(token)) return true;

        const tokenWithZero = token.replace(/X(\d+)\b/g, 'X$1,0');
        if (cleanText.includes(tokenWithZero)) return true;

        const tokenWithDotZero = token.replace(/X(\d+)\b/g, 'X$1.0');
        if (cleanText.includes(tokenWithDotZero)) return true;

        return false;
    });
}

export function getFinishingToken(textNorm: string): string {
    if (!textNorm) return '';
    const upper = textNorm.toUpperCase();

    if (/\bBDS\b/.test(upper)) return 'BDS';
    if (/\bBD\b/.test(upper)) return 'BD';
    if (/\bBF\b|\bBLACK\s+FOSCO\b/.test(upper)) return 'BF';
    if (/\bHD\b/.test(upper)) return 'HD';
    if (/\bHG\b/.test(upper)) return 'HG';
    if (/\bGS\b/.test(upper)) return 'GS';
    if (/\bGV\b/.test(upper)) return 'GV';
    if (/\bGF\b|\bGRAFITE\s+FOSCO\b/.test(upper)) return 'GF';
    if (/\bSS\b/.test(upper)) return 'SS';
    if (/\bBLACK\b|\bB\b/.test(upper)) return 'B';
    return '';
}

/**
 * Normaliza códigos de modelo (ex: M02 -> M2, M06 -> M6)
 */
export function normalizeModelToken(model: string): string {
    if (!model) return '';
    let m = model.toUpperCase().trim();
    return m.replace(/^M0(\d)/, 'M$1');
}

/**
 * Extrai o número do Aro (diâmetro: 15, 17, 18, 20, etc.)
 */
export function extractDiameterToken(text: string): string {
    if (!text) return '';
    const upper = text.toUpperCase().replace(/[×✕✖]/g, 'X').trim();

    // 1. Padrão X: ex "20X8", "17X7", "15X6", "18X7,5", "20X9,0"
    const xMatch = upper.match(/\b(1[3-9]|2[0-4])\s*X\s*\d/);
    if (xMatch) return xMatch[1];

    // 2. Padrão de código do estoque MK: ex "M301770..." (Aro 17), "M372090..." (Aro 20), "M61570..." (Aro 15)
    const codeMatch = upper.match(/^[A-Z]+\d*(1[3-9]|2[0-4])\d{2}/);
    if (codeMatch) return codeMatch[1];

    // 3. Número isolado de Aro: ex "SURF 17 4X100" ou "M30 20 5X110" ou "M02 15 4X98"
    const standaloneMatch = upper.match(/\b(1[3-9]|2[0-4])\b/);
    if (standaloneMatch) return standaloneMatch[1];

    return '';
}

/**
 * Extrai o PCD / Furação da roda (ex: 5X112, 6X139, 5X108, 4X100, 4X98, 5X98, 5X110, 5X120)
 */
export function extractPcdToken(text: string): string {
    if (!text) return '';
    const upper = text.toUpperCase().replace(/[×✕✖]/g, 'X').replace(/\s+/g, '');

    // 1. Padrão explícito: ex 5X112, 6X139, 6X139.7, 6X139,7, 5X108, 4X100, 4X98, 5X98, 5X110, 5X120
    const match = upper.match(/([3-8]\s*X\s*\d{2,3}(?:[,.]\d)?)/);
    if (match) {
        let pcd = match[1].replace(',', '.');
        if (pcd.startsWith('6X139')) return '6X139';
        return pcd;
    }

    // 2. Padrão em código MK: ex 5112, 6139, 5108, 4100, 498, 598, 5110, 5120, 5114, 4108, 5100
    const codeMatch = upper.match(/(5112|6139|5108|4100|498|598|5110|5120|4108|5114|5100)/);
    if (codeMatch) {
        const val = codeMatch[1];
        if (val === '5112') return '5X112';
        if (val === '6139') return '6X139';
        if (val === '5108') return '5X108';
        if (val === '4100') return '4X100';
        if (val === '498') return '4X98';
        if (val === '598') return '5X98';
        if (val === '5110') return '5X110';
        if (val === '5120') return '5X120';
        if (val === '5100') return '5X100';
        if (val === '4108') return '4X108';
        if (val === '5114') return '5X114';
    }

    return '';
}

/**
 * Limpa chaves genéricas curtas (ex: "M30", "M37", "M6", "R87") do dicionário de vínculos para evitar falsos positivos.
 */
export function cleanUpBadMappings(rawMap: Record<string, string>): Record<string, string> {
    const cleaned: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawMap || {})) {
        const trimmedKey = key.trim().toUpperCase();
        if (trimmedKey.length <= 4 || /^[A-Z]{1,3}\d{1,3}$/.test(trimmedKey)) {
            continue;
        }
        cleaned[key] = value;
    }
    return cleaned;
}

export function isWheelMatch(
    queryCodeOrDesc: string,
    targetDesc: string,
    targetCode: string,
    codeMappings: Record<string, string> = {}
): boolean {
    if (!queryCodeOrDesc || (!targetDesc && !targetCode)) return false;

    const qNorm = normalizeWheelText(queryCodeOrDesc);
    const tDescNorm = targetDesc ? normalizeWheelText(targetDesc) : '';
    const tCodeNorm = targetCode ? normalizeWheelText(targetCode) : '';

    if (qNorm && (qNorm === tDescNorm || qNorm === tCodeNorm)) return true;

    for (const [mapKey, mappedCode] of Object.entries(codeMappings || {})) {
        if (normalizeWheelText(mapKey) === qNorm) {
            if (mappedCode === targetCode || normalizeWheelText(mappedCode) === tCodeNorm) return true;
        }
    }

    return isMatchSearchQuery(targetDesc, queryCodeOrDesc) || isMatchSearchQuery(targetCode, queryCodeOrDesc);
}

export function extractModelFromCode(code: string): string {
    if (!code) return '';
    const upper = code.toUpperCase().trim();
    // Padrão do código MK: [MODELO](ARO 13-24)(TALA 2 digitos)...
    // Ex: K721560... -> K72
    // Ex: S501875... -> S50
    // Ex: G17411760... -> G1741
    const match = upper.match(/^([A-Z0-9]+?)(1[3-9]|2[0-4])\d{2}/);
    if (match) return match[1];

    const fallback = upper.match(/^([A-Z]+\d{1,3})/);
    return fallback ? fallback[1] : upper.split(/\s+/)[0] || '';
}

export function hasManualLinkCheck(itemDesc: string, codeMappings: Record<string, string> = {}): boolean {
    if (!itemDesc) return false;
    const norm = normalizeWheelText(itemDesc);
    return Object.keys(codeMappings).some(k => normalizeWheelText(k) === norm);
}

export function findStockMatchForItem(
    itemDesc: string,
    itemCode: string,
    stock: StockItem[],
    codeMappings: Record<string, string> = {}
): StockItem | null {
    if (!itemDesc && !itemCode) return null;

    const itemDescNorm = itemDesc ? normalizeWheelText(itemDesc) : '';
    const itemCodeNorm = itemCode ? itemCode.toUpperCase().trim() : '';

    // 0. VERIFICAÇÃO DIRETA: Se o código ou a descrição do item JÁ é um item cadastrado no banco de estoque
    if (itemCodeNorm) {
        const directCodeMatch = stock.find(s => s.codigo && s.codigo.toUpperCase().trim() === itemCodeNorm);
        if (directCodeMatch) return directCodeMatch;
    }
    if (itemDescNorm) {
        const directDescMatch = stock.find(s => s.descricao && normalizeWheelText(s.descricao) === itemDescNorm);
        if (directDescMatch) return directDescMatch;
    }

    // 1. PRIORIDADE MÁXIMA HISTÓRICO: Verificar se há vínculo salvo no Supabase/codeMappings
    for (const [mapKey, mappedCode] of Object.entries(codeMappings || {})) {
        if (normalizeWheelText(mapKey) === itemDescNorm) {
            const match = stock.find(s => s.codigo && s.codigo.toUpperCase().trim() === mappedCode.toUpperCase().trim());
            if (match) return match;
        }
    }

    // 2. BUSCA AUTOMÁTICA RIGOROSA POR 4 PILARES (Modelo + Aro + PCD + Acabamento)
    const rawItemModel = itemCode || (itemDesc ? itemDesc.trim().split(/\s+/)[0] : '') || '';
    const itemModel = normalizeModelToken(rawItemModel);
    const itemDiam = extractDiameterToken(itemDesc) || extractDiameterToken(itemCode);
    const itemPcd = extractPcdToken(itemDesc) || extractPcdToken(itemCode);
    const itemFinish = getFinishingToken(itemDescNorm);

    for (const s of stock) {
        const stockDescNorm = s.descricao ? normalizeWheelText(s.descricao) : '';
        const stockCodeNorm = s.codigo ? normalizeWheelText(s.codigo) : '';
        
        // Prioridade 1: Extrai o modelo diretamente da DESCRIÇÃO no Banco de Dados (ex: "K72", "M30", "S50", "SURF")
        // Fallback: Se a descrição estiver vazia, tenta extrair do código do item
        const firstWordStock = s.descricao ? s.descricao.trim().split(/\s+/)[0] : '';
        const stockRawModel = firstWordStock || extractModelFromCode(s.codigo) || '';
        const stockModel = normalizeModelToken(stockRawModel);

        // PILAR 1: Modelo DEVE ser idêntico (ex: K72 vs K72, M30 vs M30)
        if (!stockModel || !itemModel || stockModel !== itemModel) {
            continue;
        }

        // PILAR 2: Aro (Diâmetro) extraído da descrição (ou fallback do código)
        const stockDiam = extractDiameterToken(s.descricao) || extractDiameterToken(s.codigo);
        if (stockDiam && itemDiam && stockDiam !== itemDiam) {
            continue;
        }

        // PILAR 3: PCD (Furação) extraído da descrição (ou fallback do código)
        const stockPcd = extractPcdToken(s.descricao) || extractPcdToken(s.codigo);
        if (stockPcd && itemPcd && stockPcd !== itemPcd) {
            continue;
        }

        // PILAR 4: Acabamento/Cor extraído da descrição (ou fallback do código)
        const stockFinish = getFinishingToken(stockDescNorm) || getFinishingToken(stockCodeNorm);
        if (stockFinish && itemFinish && stockFinish !== itemFinish) {
            continue;
        }

        return s;
    }

    return null;
}

/**
 * Extrator nativo para arquivos Word (.docx) sem gerar caracteres corrompidos.
 */
async function decompressDeflate(compressedBytes: Uint8Array): Promise<string> {
    const chunk = compressedBytes as unknown as BufferSource;
    try {
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        writer.write(chunk);
        writer.close();
        const response = new Response(ds.readable);
        const buffer = await response.arrayBuffer();
        return new TextDecoder('utf-8').decode(buffer);
    } catch (e) {
        try {
            const ds = new DecompressionStream('deflate');
            const writer = ds.writable.getWriter();
            writer.write(chunk);
            writer.close();
            const response = new Response(ds.readable);
            const buffer = await response.arrayBuffer();
            return new TextDecoder('utf-8').decode(buffer);
        } catch (err) {
            console.error('Erro de descompactação Deflate:', err);
            return '';
        }
    }
}

async function extractDocxText(file: File): Promise<string> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const view = new DataView(arrayBuffer);

        let offset = 0;
        while (offset < bytes.length - 30) {
            if (view.getUint32(offset, true) === 0x04034b50) {
                const compressionMethod = view.getUint16(offset + 8, true);
                const compressedSize = view.getUint32(offset + 18, true);
                const fileNameLen = view.getUint16(offset + 26, true);
                const extraLen = view.getUint16(offset + 28, true);

                const fileNameBytes = bytes.subarray(offset + 30, offset + 30 + fileNameLen);
                const fileName = new TextDecoder('utf-8').decode(fileNameBytes);

                const dataOffset = offset + 30 + fileNameLen + extraLen;

                if (fileName === 'word/document.xml') {
                    const compressedData = bytes.subarray(dataOffset, dataOffset + compressedSize);
                    let xmlText = '';

                    if (compressionMethod === 0) {
                        xmlText = new TextDecoder('utf-8').decode(compressedData);
                    } else if (compressionMethod === 8) {
                        xmlText = await decompressDeflate(compressedData);
                    }

                    if (xmlText) {
                        const textWithLines = xmlText
                            .replace(/<\/w:p>/g, '\n')
                            .replace(/<w:tr[^>]*>/g, '\n')
                            .replace(/<\/w:tc>/g, ' ');

                        const plainText = textWithLines.replace(/<[^>]+>/g, '');
                        return plainText;
                    }
                }

                offset = dataOffset + compressedSize;
            } else {
                offset++;
            }
        }
    } catch (err) {
        console.error('Erro ao ler docx:', err);
    }
    return '';
}

/**
 * Função de parsing para extrair itens da Carga CM.
 */
export function parseCargaText(rawText: string, targetDestino: string = 'CURITIBA P CM'): CargaItem[] {
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    
    let currentDestino = 'CURITIBA P CM';
    const items: CargaItem[] = [];
    let pendingItem: Partial<CargaItem> | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (/CURITIBA/i.test(line)) {
            currentDestino = 'CURITIBA P CM';
            continue;
        } else if (/JOINVILLE/i.test(line)) {
            currentDestino = 'JOINVILLE P CM';
            continue;
        }

        if (/total\s+\d+/i.test(line)) continue;

        const matchNumberStart = line.match(/^(\d+)\s+(.+)$/);
        
        if (matchNumberStart) {
            if (pendingItem && pendingItem.descricao) {
                items.push({
                    id: `item_${Date.now()}_${items.length}_${Math.random().toString(36).substring(2, 6)}`,
                    codigo: extractModelCode(pendingItem.descricao),
                    descricao: pendingItem.descricao,
                    cliente: pendingItem.cliente || 'Sem obs',
                    qtdEsperada: pendingItem.qtdEsperada || 1,
                    qtdConferida: 0,
                    destino: pendingItem.destino || currentDestino
                });
                pendingItem = null;
            }

            const qtd = parseInt(matchNumberStart[1], 10);
            let remainder = matchNumberStart[2].trim();

            let cliente = '';
            const parenMatch = remainder.match(/\(([^)]+)\)/);
            if (parenMatch) {
                cliente = parenMatch[1].trim();
                remainder = remainder.replace(/\([^)]+\)/, '').trim();
            }

            pendingItem = {
                qtdEsperada: qtd,
                descricao: remainder,
                cliente: cliente,
                destino: currentDestino
            };
        } else if (pendingItem) {
            const parenMatch = line.match(/\(([^)]+)\)/) || line.match(/^(.+)$/);
            if (parenMatch) {
                const textInside = (parenMatch[1] || line).replace(/[()]/g, '').trim();
                if (pendingItem.cliente) {
                    pendingItem.cliente += ' ' + textInside;
                } else {
                    pendingItem.cliente = textInside;
                }
            }
        }
    }

    if (pendingItem && pendingItem.descricao) {
        items.push({
            id: `item_${Date.now()}_${items.length}_${Math.random().toString(36).substring(2, 6)}`,
            codigo: extractModelCode(pendingItem.descricao),
            descricao: pendingItem.descricao,
            cliente: pendingItem.cliente || 'Sem obs',
            qtdEsperada: pendingItem.qtdEsperada || 1,
            qtdConferida: 0,
            destino: pendingItem.destino || currentDestino
        });
    }

    if (targetDestino && items.some(it => it.destino === targetDestino)) {
        return items.filter(it => it.destino === targetDestino);
    }

    return items;
}

function extractModelCode(desc: string): string {
    const firstWord = desc.split(/\s+/)[0] || '';
    return firstWord.toUpperCase();
}

export function generateConferencePDF(
    cargaDocName: string,
    cargaItems: CargaItem[],
    stock: StockItem[],
    codeMappings: Record<string, string>,
    unmatchedScans: UnmatchedScan[] = []
) {
    try {
        const doc = createConferencePDFDoc(cargaDocName, cargaItems, stock, codeMappings, unmatchedScans);
        const cleanDocName = cargaDocName.replace(/[^a-zA-Z0-9_-]/g, '_');
        doc.save(`Relatorio_Conferencia_${cleanDocName}.pdf`);
        toast.success('Relatório PDF gerado com sucesso!');
    } catch (err) {
        console.error('Erro ao gerar PDF:', err);
        toast.error('Erro ao gerar o relatório PDF');
    }
}

export const ConferenceModule: React.FC<ConferenceModuleProps> = ({ onBackToMenu }) => {
    const [subMode, setSubMode] = useState<SubMode>('menu');

    // -------------------------------------------------------------
    // ESTADO DE ESTOQUE SUPABASE & HISTÓRICO DE VÍNCULOS
    // -------------------------------------------------------------
    const [stock, setStock] = useState<StockItem[]>([]);
    const [scannedMap, setScannedMap] = useState<Record<string, number>>(() => {
        const saved = localStorage.getItem('@MK_CONFERENCE_READINGS');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { return {}; }
        }
        return {};
    });

    // Mapeamento Histórico Permanente (Ex: { "COD_BIPADO": "CODIGO_ESTOQUE" })
    const [codeMappings, setCodeMappings] = useState<Record<string, string>>(() => {
        const saved = localStorage.getItem('@MK_WHEEL_CODE_MAPPINGS');
        if (saved) {
            try { 
                const parsed = JSON.parse(saved); 
                return cleanUpBadMappings(parsed);
            } catch (e) { return {}; }
        }
        return {};
    });

    // -------------------------------------------------------------
    // ESTADO PARA CARGA DE CM (OPÇÃO 1)
    // -------------------------------------------------------------
    const [cargaItems, setCargaItems] = useState<CargaItem[]>(() => {
        const saved = localStorage.getItem('@MK_CARGA_CM_ITEMS_LIST');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { return []; }
        }
        return parseCargaText(SAMPLE_CURITIBA_CM, 'CURITIBA P CM');
    });
    const [cargaDocName, setCargaDocName] = useState<string>(() => {
        return localStorage.getItem('@MK_CARGA_CM_DOCNAME') || 'CAMINHAO DO DIA (Curitiba p CM)';
    });

    // Estado do Modal de Exportação em PDF
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

    const handleExportClick = () => {
        if (cargaItems.length === 0) {
            toast.error('Nenhuma carga importada para exportar');
            return;
        }
        setIsExportModalOpen(true);
    };

    // Navegação interna da Carga CM: 'conferencia' vs 'mappings' (Configurações e Histórico de Vínculos)
    const [cargaTab, setCargaTab] = useState<'conferencia' | 'mappings'>('conferencia');
    const [mappingSearchTerm, setMappingSearchTerm] = useState('');
    const [isCloudSyncing, setIsCloudSyncing] = useState(false);

    // -------------------------------------------------------------
    // MODAIS DE IMPORTAÇÃO, ADIÇÃO MANUAL, PRÉVIA E VINCULAÇÃO
    // -------------------------------------------------------------
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [importPreviewItems, setImportPreviewItems] = useState<ImportPreviewItem[]>([]);
    const [pendingDocName, setPendingDocName] = useState<string>('');
    const [stockSelectorRowId, setStockSelectorRowId] = useState<string | null>(null);
    const [previewSearchTerm, setPreviewSearchTerm] = useState<string>('');

    const [isAddLineModalOpen, setIsAddLineModalOpen] = useState(false);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [linkingTargetItem, setLinkingTargetItem] = useState<CargaItem | null>(null);
    const [stockSearchTerm, setStockSearchTerm] = useState('');
    const [pasteText, setPasteText] = useState('');

    // Formulário manual para adicionar item à carga CM
    const [newItemDesc, setNewItemDesc] = useState('');
    const [newItemCliente, setNewItemCliente] = useState('');
    const [newItemQtd, setNewItemQtd] = useState(1);

    // -------------------------------------------------------------
    // ESTADOS COMPARTILHADOS (INPUT, MODAIS, SOM)
    // -------------------------------------------------------------
    const [inputValue, setInputValue] = useState('');
    const [scanError, setScanError] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState<FilterStatus>('todos');
    const [isManualAddOpen, setIsManualAddOpen] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    // Lista de leituras erradas / não previstas na conferência
    const [unmatchedScans, setUnmatchedScans] = useState<UnmatchedScan[]>(() => {
        const saved = localStorage.getItem('@MK_CARGA_CM_UNMATCHED_SCANS');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { return []; }
        }
        return [];
    });

    useEffect(() => {
        localStorage.setItem('@MK_CARGA_CM_UNMATCHED_SCANS', JSON.stringify(unmatchedScans));
    }, [unmatchedScans]);

    const addUnmatchedScan = (code: string, reason: string) => {
        setUnmatchedScans(prev => {
            const existingIndex = prev.findIndex(item => item.code === code);
            const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            if (existingIndex !== -1) {
                const updated = [...prev];
                updated[existingIndex] = {
                    ...updated[existingIndex],
                    count: updated[existingIndex].count + 1,
                    timestamp: now,
                    reason
                };
                return updated;
            } else {
                return [
                    {
                        id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                        code,
                        reason,
                        timestamp: now,
                        count: 1
                    },
                    ...prev
                ];
            }
        });
    };

    const handleRemoveUnmatchedScan = (id: string) => {
        setUnmatchedScans(prev => prev.filter(i => i.id !== id));
        toast.success('Leitura errada removida da lista');
    };

    const handleClearAllUnmatchedScans = () => {
        setUnmatchedScans([]);
        toast.success('Lista de erros limpa com sucesso');
    };

    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const successSound = useRef<HTMLAudioElement | null>(null);
    const errorSound = useRef<HTMLAudioElement | null>(null);

    // Carregar estoque Supabase
    useEffect(() => {
        successSound.current = new Audio('/sounds/success.mp3');
        errorSound.current = new Audio('/sounds/error.mp3');
        if (successSound.current) successSound.current.load();
        if (errorSound.current) errorSound.current.load();

        const fetchStock = async () => {
            try {
                const data = await getInventory();
                if (data && data.length > 0) {
                    setStock(data as StockItem[]);
                }
            } catch (err) {
                console.error('Erro ao buscar estoque', err);
            }
        };
        fetchStock();
    }, []);

    // Sincronização inicial com o Supabase (Mapeamentos de Código + Lista Ativa da Carga CM)
    useEffect(() => {
        async function syncCloudOnMount() {
            setIsCloudSyncing(true);
            try {
                // 1. Buscar vínculos do Supabase
                const cloudMappings = await getCloudCargaCodeMappings();
                if (Object.keys(cloudMappings).length > 0) {
                    setCodeMappings(prev => {
                        const merged = cleanUpBadMappings({ ...prev, ...cloudMappings });
                        localStorage.setItem('@MK_WHEEL_CODE_MAPPINGS', JSON.stringify(merged));
                        return merged;
                    });
                }

                // 2. Buscar lista ativa da carga CM do Supabase (PC -> Celular)
                const cloudCarga = await getCloudCargaItems();
                if (cloudCarga && cloudCarga.items.length > 0) {
                    setCargaItems(cloudCarga.items);
                    setCargaDocName(cloudCarga.docName);
                    localStorage.setItem('@MK_CARGA_CM_ITEMS_LIST', JSON.stringify(cloudCarga.items));
                    localStorage.setItem('@MK_CARGA_CM_DOCNAME', cloudCarga.docName);
                }
            } catch (e) {
                console.warn('Erro na sincronização inicial do Supabase:', e);
            } finally {
                setIsCloudSyncing(false);
            }
        }
        syncCloudOnMount();
    }, []);

    // Persistência de Mapeamentos e Bipagens
    useEffect(() => {
        localStorage.setItem('@MK_CONFERENCE_READINGS', JSON.stringify(scannedMap));
    }, [scannedMap]);

    useEffect(() => {
        localStorage.setItem('@MK_WHEEL_CODE_MAPPINGS', JSON.stringify(codeMappings));
    }, [codeMappings]);

    useEffect(() => {
        localStorage.setItem('@MK_CARGA_CM_ITEMS_LIST', JSON.stringify(cargaItems));
        localStorage.setItem('@MK_CARGA_CM_DOCNAME', cargaDocName);
    }, [cargaItems, cargaDocName]);

    // Auto-foco inteligente (apenas quando no topo da página para evitar pulos de scroll)
    useEffect(() => {
        if (subMode !== 'menu' && !isManualAddOpen && !isCameraOpen && !isImportModalOpen && !isPreviewModalOpen && !isAddLineModalOpen && !isLinkModalOpen && !isExportModalOpen) {
            const focusInput = () => {
                if (window.scrollY > 120) return;
                if (document.activeElement?.tagName !== 'INPUT' || document.activeElement === inputRef.current) {
                    inputRef.current?.focus({ preventScroll: true });
                }
            };
            focusInput();
            const interval = setInterval(focusInput, 1000);
            return () => clearInterval(interval);
        }
    }, [subMode, isManualAddOpen, isCameraOpen, isImportModalOpen, isPreviewModalOpen, isAddLineModalOpen, isLinkModalOpen, isExportModalOpen]);

    // -------------------------------------------------------------
    // LÓGICA DE ESCANEAMENTO INTELIGENTE (COM ACABAMENTOS E VÍNCULOS)
    // -------------------------------------------------------------
    const handleScan = (e?: React.FormEvent) => {
        e?.preventDefault();
        const code = inputValue.trim();
        if (!code) return;

        if (subMode === 'estoque') {
            addEstoqueCount(code, 1);
        } else if (subMode === 'carga-cm') {
            addCargaCount(code, 1);
        }
        setInputValue('');
    };

    const addEstoqueCount = (code: string, qty: number = 1) => {
        const itemExists = stock.some(s => isWheelMatch(code, s.descricao, s.codigo, codeMappings));
        setScannedMap(prev => ({ ...prev, [code]: (prev[code] || 0) + qty }));

        if (itemExists) {
            playSuccess();
            toast.success(`Conferido: ${code} (+${qty})`, { duration: 1200 });
        } else {
            triggerError();
            addUnmatchedScan(code, 'Item não cadastrado no banco de estoque');
            toast.error(`Item não cadastrado no estoque: ${code}`, { duration: 2000 });
        }
    };

    const addCargaCount = (code: string, qty: number = 1) => {
        const stockMatch = findStockMatchForItem(code, code, stock, codeMappings) || 
                           stock.find(s => isWheelMatch(code, s.descricao, s.codigo, codeMappings));
        const codeToMatch = stockMatch ? stockMatch.descricao : code;

        // 1ª Passada: Buscar item que ainda não atingiu a quantidade esperada
        const matchingIndex = cargaItems.findIndex(item => {
            const isMatch = isWheelMatch(codeToMatch, item.descricao, item.codigo, codeMappings);
            return isMatch && item.qtdConferida < item.qtdEsperada;
        });

        if (matchingIndex !== -1) {
            const targetItem = cargaItems[matchingIndex];
            updateCargaItemQty(targetItem.id, targetItem.qtdConferida + qty);
            playSuccess();
            toast.success(`Carga CM - Lido: ${targetItem.descricao} (${targetItem.cliente}) (+${qty})`, { duration: 1500 });
        } else {
            // 2ª Passada: Se já atingiu a cota de todos os clientes com essa roda/acabamento
            const fallbackIndex = cargaItems.findIndex(item => {
                return isWheelMatch(codeToMatch, item.descricao, item.codigo, codeMappings);
            });

            if (fallbackIndex !== -1) {
                const targetItem = cargaItems[fallbackIndex];
                updateCargaItemQty(targetItem.id, targetItem.qtdConferida + qty);
                playSuccess();
                addUnmatchedScan(code, `Cota da Carga Excedida (${targetItem.descricao})`);
                toast(`Roda ${targetItem.descricao} excedeu a quantidade prevista! (+${qty})`, { icon: '⚠️', duration: 2000 });
            } else {
                triggerError();
                addUnmatchedScan(code, 'Roda não consta no manifesto da Carga CM');
                toast.error(`Roda não consta na Carga CM: ${code}`, { duration: 2500 });
            }
        }
    };

    const updateCargaItemQty = (id: string, newQty: number) => {
        const currentScroll = window.scrollY;
        const targetQty = Math.max(0, newQty);
        setCargaItems(prev => prev.map(item => {
            if (item.id === id) {
                return { ...item, qtdConferida: targetQty };
            }
            return item;
        }));
        updateCloudCargaItemQty(id, targetQty);
        requestAnimationFrame(() => {
            window.scrollTo({ top: currentScroll, behavior: 'instant' as ScrollBehavior });
        });
    };

    const updateEstoqueQty = (codigo: string, delta: number) => {
        const currentScroll = window.scrollY;
        setScannedMap(prev => ({ ...prev, [codigo]: Math.max(0, (prev[codigo] || 0) + delta) }));
        requestAnimationFrame(() => {
            window.scrollTo({ top: currentScroll, behavior: 'instant' as ScrollBehavior });
        });
    };

    const deleteCargaItemRow = (id: string) => {
        const currentScroll = window.scrollY;
        setCargaItems(prev => {
            const next = prev.filter(i => i.id !== id);
            saveCloudCargaItems(next, cargaDocName);
            return next;
        });
        toast.success('Linha removida da lista');
        requestAnimationFrame(() => {
            window.scrollTo({ top: currentScroll, behavior: 'instant' as ScrollBehavior });
        });
    };

    // -------------------------------------------------------------
    // SALVAR VÍNCULO NO HISTÓRICO PERMANENTE
    // -------------------------------------------------------------
    const handleSaveCodeLink = (stockItem: StockItem) => {
        if (!linkingTargetItem) return;

        const cargoDescKey = linkingTargetItem.descricao.toUpperCase().trim();

        const updated = cleanUpBadMappings({
            ...codeMappings,
            [cargoDescKey]: stockItem.codigo
        });

        setCodeMappings(updated);
        localStorage.setItem('@MK_WHEEL_CODE_MAPPINGS', JSON.stringify(updated));
        
        // Persistir no Supabase
        saveCloudCargaCodeMapping(cargoDescKey, stockItem.codigo, stockItem.descricao);

        setIsLinkModalOpen(false);
        setLinkingTargetItem(null);
        setStockSearchTerm('');

        toast.success(`Vínculo salvo no Supabase! "${linkingTargetItem.descricao}" associado ao código ${stockItem.codigo}`);
    };

    const handleRemoveLink = async (item: CargaItem) => {
        const key = item.descricao.toUpperCase().trim();
        const newMap = { ...codeMappings };
        delete newMap[key];
        setCodeMappings(newMap);
        localStorage.setItem('@MK_WHEEL_CODE_MAPPINGS', JSON.stringify(newMap));
        
        await deleteCloudCargaCodeMapping(key);
        toast.success(`Vínculo removido para ${item.descricao}`);
    };

    const handleDeleteMapping = async (docText: string) => {
        const key = docText.toUpperCase().trim();
        const updated = { ...codeMappings };
        delete updated[key];
        setCodeMappings(updated);
        localStorage.setItem('@MK_WHEEL_CODE_MAPPINGS', JSON.stringify(updated));
        
        await deleteCloudCargaCodeMapping(key);
        toast.success(`Vínculo "${docText}" removido do Supabase com sucesso!`);
    };

    const handleClearAllMappings = async () => {
        if (!window.confirm('Tem certeza que deseja APAGAR TODOS os vínculos salvos no Supabase?')) return;
        setCodeMappings({});
        localStorage.removeItem('@MK_WHEEL_CODE_MAPPINGS');
        await clearAllCloudCargaCodeMappings();
        toast.success('Todos os vínculos salvos no Supabase foram limpos!');
    };

    const playSuccess = () => {
        if (successSound.current) {
            successSound.current.currentTime = 0;
            successSound.current.play().catch(() => {});
        }
    };

    const triggerError = () => {
        setScanError(true);
        setTimeout(() => setScanError(false), 400);
        if (errorSound.current) {
            errorSound.current.currentTime = 0;
            errorSound.current.play().catch(() => {});
        }
    };

    // -------------------------------------------------------------
    // OPERAÇÕES DE ZERAR E ADICIONAR NOVA CARGA
    // -------------------------------------------------------------
    const handleZerarBipagensCarga = () => {
        if (window.confirm('Deseja zerar todas as bipagens já lidas desta carga?')) {
            setCargaItems(prev => prev.map(i => ({ ...i, qtdConferida: 0 })));
            toast.success('Contagem bipada zerada!');
        }
    };

    const handleNovaCargaLimparTudo = () => {
        if (window.confirm('Deseja APAGAR a lista atual e iniciar uma NOVA Carga CM?')) {
            setCargaItems([]);
            setCargaDocName('Nova Carga CM');
            localStorage.removeItem('@MK_CARGA_CM_ITEMS_LIST');
            localStorage.removeItem('@MK_CARGA_CM_DOCNAME');
            clearCloudCargaItems();
            setIsImportModalOpen(true);
            toast.success('Carga antiga removida da nuvem e local. Importe ou cole a nova lista.');
        }
    };

    const handleAddManualItemToCarga = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemDesc.trim()) {
            toast.error('Informe a descrição/modelo da roda');
            return;
        }

        const newItem: CargaItem = {
            id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            codigo: extractModelCode(newItemDesc),
            descricao: newItemDesc.trim(),
            cliente: newItemCliente.trim() || 'Estoque',
            qtdEsperada: Math.max(1, newItemQtd),
            qtdConferida: 0,
            destino: 'CURITIBA P CM'
        };

        setCargaItems(prev => {
            const next = [...prev, newItem];
            saveCloudCargaItems(next, cargaDocName);
            return next;
        });
        setIsAddLineModalOpen(false);
        setNewItemDesc('');
        setNewItemCliente('');
        setNewItemQtd(1);
        toast.success(`Roda "${newItem.descricao}" adicionada à carga e enviada ao Supabase!`);
    };

    // -------------------------------------------------------------
    // ETAPA 1: LER E EXTRAIR DOCUMENTO -> PASSA PARA A PRÉVIA DE VALIDAÇÃO
    // -------------------------------------------------------------
    const processExtractedTextToPreview = (rawText: string, docName: string) => {
        const parsed = parseCargaText(rawText, 'CURITIBA P CM');
        if (parsed.length === 0) {
            toast.error('Nenhum item reconhecido no documento. Verifique o arquivo/texto.');
            return;
        }

        // Criar lista da prévia tentando relacionar cada item com o estoque DB
        const previewList: ImportPreviewItem[] = parsed.map(item => {
            const stockMatch = findStockMatchForItem(item.descricao, item.codigo, stock, codeMappings);

            return {
                id: item.id,
                rawDesc: item.descricao,
                cliente: item.cliente,
                qtdEsperada: item.qtdEsperada,
                selectedStock: stockMatch
            };
        });

        setImportPreviewItems(previewList);
        setPendingDocName(docName);
        setIsImportModalOpen(false);
        setIsPreviewModalOpen(true);
        toast.success(`${parsed.length} itens extraídos! Verifique os códigos abaixo antes de gerar a carga.`);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const docName = file.name;

        try {
            let textContent = '';

            if (file.name.toLowerCase().endsWith('.docx')) {
                textContent = await extractDocxText(file);
            } else if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls') || file.name.toLowerCase().endsWith('.csv')) {
                const buffer = await file.arrayBuffer();
                const wb = XLSX.read(buffer, { type: 'array' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                textContent = XLSX.utils.sheet_to_txt(ws);
            } else {
                textContent = await file.text();
            }

            if (!textContent.trim()) {
                toast.error('Não foi possível ler texto do arquivo.');
                return;
            }

            processExtractedTextToPreview(textContent, docName);
        } catch (err) {
            console.error(err);
            toast.error('Erro ao processar arquivo.');
        }

        e.target.value = '';
    };

    const handlePasteImport = () => {
        if (!pasteText.trim()) {
            toast.error('Cole o texto da lista primeiro.');
            return;
        }
        processExtractedTextToPreview(pasteText, 'Texto Colado (Curitiba p CM)');
        setPasteText('');
    };

    const handleLoadSample = () => {
        processExtractedTextToPreview(SAMPLE_CURITIBA_CM, 'CAMINHAO DO DIA (Curitiba p CM)');
    };

    // -------------------------------------------------------------
    // ETAPA 2: AÇÕES NA TABELA DE PRÉVIA / CONFERÊNCIA DA IMPORTAÇÃO
    // -------------------------------------------------------------
    const handleUpdatePreviewQty = (id: string, newQty: number) => {
        setImportPreviewItems(prev => prev.map(p => p.id === id ? { ...p, qtdEsperada: Math.max(1, newQty) } : p));
    };

    const handleRemovePreviewRow = (id: string) => {
        setImportPreviewItems(prev => prev.filter(p => p.id !== id));
    };

    const handleSelectStockForPreviewRow = (rowId: string, stockItem: StockItem | null) => {
        setImportPreviewItems(prev => prev.map(p => {
            if (p.id === rowId) {
                return { ...p, selectedStock: stockItem };
            }
            return p;
        }));
        setStockSelectorRowId(null);
        setPreviewSearchTerm('');
    };

    const handleAddBlankPreviewRow = () => {
        const newItem: ImportPreviewItem = {
            id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            rawDesc: 'NOVA RODA',
            cliente: 'Estoque',
            qtdEsperada: 1,
            selectedStock: null
        };
        setImportPreviewItems(prev => [...prev, newItem]);
    };

    const handleConfirmImportPreview = () => {
        if (importPreviewItems.length === 0) {
            toast.error('Nenhum item na lista para confirmar.');
            return;
        }

        const newMappings = { ...codeMappings };

        const finalCargaItems: CargaItem[] = importPreviewItems.map(p => {
            const stockItem = p.selectedStock;

            // Se o usuário associou uma roda do estoque DB, cria a chave persistente
            if (stockItem) {
                const rawKey = p.rawDesc.toUpperCase().trim();
                newMappings[rawKey] = stockItem.codigo;
            }

            const finalDesc = stockItem ? stockItem.descricao : p.rawDesc;
            const finalCode = stockItem ? stockItem.codigo : extractModelCode(p.rawDesc);

            return {
                id: p.id,
                codigo: finalCode,
                descricao: finalDesc,
                cliente: p.cliente,
                qtdEsperada: p.qtdEsperada,
                qtdConferida: 0,
                destino: 'CURITIBA P CM'
            };
        });

        // Salvar mapeamentos persistentes local + Supabase
        const cleaned = cleanUpBadMappings(newMappings);
        setCodeMappings(cleaned);
        localStorage.setItem('@MK_WHEEL_CODE_MAPPINGS', JSON.stringify(cleaned));

        for (const p of importPreviewItems) {
            if (p.selectedStock) {
                const rawKey = p.rawDesc.toUpperCase().trim();
                saveCloudCargaCodeMapping(rawKey, p.selectedStock.codigo, p.selectedStock.descricao);
            }
        }

        const docTitle = pendingDocName || cargaDocName;
        setCargaItems(finalCargaItems);
        setCargaDocName(docTitle);
        setIsPreviewModalOpen(false);

        // Salvar itens da carga no Supabase para sincronização PC -> Celular
        saveCloudCargaItems(finalCargaItems, docTitle);

        toast.success(`Carga CM gerada com sucesso! ${finalCargaItems.length} itens prontos e sincronizados no Supabase.`, { duration: 3000 });
    };

    // -------------------------------------------------------------
    // CÁLCULOS E ESTATÍSTICAS
    // -------------------------------------------------------------
    const cargaStats = useMemo(() => {
        let totalDoc = cargaItems.reduce((acc, i) => acc + i.qtdEsperada, 0);
        let totalConferidos = cargaItems.reduce((acc, i) => acc + i.qtdConferida, 0);
        let okCount = 0;
        let divergentesCount = 0;
        let pendentesCount = 0;

        cargaItems.forEach(item => {
            if (item.qtdConferida === item.qtdEsperada && item.qtdEsperada > 0) okCount++;
            else if (item.qtdConferida > 0 && item.qtdConferida !== item.qtdEsperada) divergentesCount++;
            else if (item.qtdConferida === 0) pendentesCount++;
        });

        return { totalDoc, totalConferidos, okCount, divergentesCount, pendentesCount };
    }, [cargaItems]);

    const estoqueList = useMemo(() => {
        const allCodes = new Set([...stock.map(s => s.codigo), ...Object.keys(scannedMap)]);
        const stockMap = new Map<string, StockItem>(stock.map(s => [s.codigo, s]));

        return Array.from(allCodes).map(codigo => {
            const stockItem = stockMap.get(codigo);
            const qtdSistema = stockItem ? stockItem.quantidade : 0;
            const qtdConferida = scannedMap[codigo] || 0;
            const descricao = stockItem ? stockItem.descricao : 'Item Não Cadastrado';
            const local = stockItem ? stockItem.local : '---';

            let status: 'ok' | 'divergente' | 'sobra' | 'pendente' = 'pendente';
            if (qtdConferida === 0) {
                status = 'pendente';
            } else if (qtdConferida === qtdSistema) {
                status = 'ok';
            } else if (qtdConferida > qtdSistema || !stockItem) {
                status = 'sobra';
            } else {
                status = 'divergente';
            }

            return { codigo, descricao, local, qtdSistema, qtdConferida, status };
        });
    }, [stock, scannedMap]);

    const estoqueStats = useMemo(() => {
        let totalItems = stock.length;
        let totalConferidos = 0;
        let okCount = 0;
        let divergentesCount = 0;
        let pendentesCount = 0;

        estoqueList.forEach(item => {
            if (item.qtdConferida > 0) totalConferidos++;
            if (item.status === 'ok') okCount++;
            if (item.status === 'divergente' || item.status === 'sobra') divergentesCount++;
            if (item.status === 'pendente') pendentesCount++;
        });

        return { totalItems, totalConferidos, okCount, divergentesCount, pendentesCount };
    }, [stock, estoqueList]);

    const filteredCodeMappings = useMemo(() => {
        const entries = Object.entries(codeMappings) as [string, string][];
        if (!mappingSearchTerm.trim()) return entries;
        const term = mappingSearchTerm.toUpperCase().trim();
        return entries.filter(([docText, stockCode]) => {
            const stockDesc = stock.find(s => s.codigo === stockCode)?.descricao || '';
            return docText.toUpperCase().includes(term) || stockCode.toUpperCase().includes(term) || stockDesc.toUpperCase().includes(term);
        });
    }, [codeMappings, stock, mappingSearchTerm]);

    const filteredCargaList = useMemo(() => {
        return cargaItems.filter(item => {
            if (searchTerm) {
                const match = isWheelMatch(searchTerm, item.descricao, item.codigo, codeMappings) ||
                              item.cliente.toUpperCase().includes(searchTerm.toUpperCase().trim());
                if (!match) return false;
            }
            if (activeFilter === 'ok') return item.qtdConferida === item.qtdEsperada && item.qtdEsperada > 0;
            if (activeFilter === 'divergentes') return item.qtdConferida > 0 && item.qtdConferida !== item.qtdEsperada;
            if (activeFilter === 'pendentes') return item.qtdConferida === 0;
            return true;
        });
    }, [cargaItems, searchTerm, activeFilter, codeMappings]);

    const filteredEstoqueList = useMemo(() => {
        return estoqueList.filter(item => {
            if (searchTerm) {
                const match = isWheelMatch(searchTerm, item.descricao, item.codigo, codeMappings) ||
                              item.local.toUpperCase().includes(searchTerm.toUpperCase().trim());
                if (!match) return false;
            }
            if (activeFilter === 'ok') return item.status === 'ok';
            if (activeFilter === 'divergentes') return item.status === 'divergente' || item.status === 'sobra';
            if (activeFilter === 'pendentes') return item.status === 'pendente';
            return true;
        });
    }, [estoqueList, searchTerm, activeFilter, codeMappings]);

    // Filtragem de estoque para modal de vinculação
    const filteredStockForLink = useMemo(() => {
        if (!stockSearchTerm.trim()) return stock.slice(0, 15);
        return stock.filter(s => {
            return isMatchSearchQuery(s.descricao, stockSearchTerm) ||
                   isMatchSearchQuery(s.codigo, stockSearchTerm);
        }).slice(0, 30);
    }, [stock, stockSearchTerm]);

    // Filtragem de estoque para modal de prévia
    const filteredStockForPreview = useMemo(() => {
        if (!previewSearchTerm.trim()) return stock.slice(0, 15);
        return stock.filter(s => {
            return isMatchSearchQuery(s.descricao, previewSearchTerm) ||
                   isMatchSearchQuery(s.codigo, previewSearchTerm);
        }).slice(0, 30);
    }, [stock, previewSearchTerm]);

    // Exportação Excel
    const handleExportCargaExcel = () => {
        if (cargaItems.length === 0) {
            toast.error('Nenhum dado para exportar');
            return;
        }

        const dataToExport = cargaItems.map(item => ({
            'Item / Roda': item.descricao,
            'Código Modelo': item.codigo,
            'Cliente / Observação': item.cliente,
            'Qtd Esperada (Doc)': item.qtdEsperada,
            'Qtd Bipada': item.qtdConferida,
            'Diferença': item.qtdConferida - item.qtdEsperada,
            'Status Carga': item.qtdConferida === item.qtdEsperada ? 'OK' :
                           item.qtdConferida > item.qtdEsperada ? 'SOBRA / EXTRA' :
                           item.qtdConferida > 0 ? 'INCOMPLETO' : 'PENDENTE'
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        ws['!cols'] = [
            { wch: 35 }, { wch: 15 }, { wch: 30 }, { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 18 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Conferência Carga CM");

        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `conferencia_carga_CM_${dateStr}.xlsx`);
        toast.success('Relatório da Carga CM exportado!');
    };

    const handleExportEstoqueExcel = () => {
        if (estoqueList.length === 0) {
            toast.error('Nenhum dado para exportar');
            return;
        }

        const dataToExport = estoqueList.map(item => ({
            'Código': item.codigo,
            'Descrição': item.descricao,
            'Local': item.local,
            'Qtd Sistema': item.qtdSistema,
            'Qtd Conferida': item.qtdConferida,
            'Diferença': item.qtdConferida - item.qtdSistema,
            'Status Estoque': item.status === 'ok' ? 'OK' :
                              item.status === 'sobra' ? 'SOBRA / EXTRA' :
                              item.status === 'divergente' ? 'FALTANDO' : 'PENDENTE'
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        ws['!cols'] = [
            { wch: 18 }, { wch: 45 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 18 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Conferência Estoque");

        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `conferencia_estoque_${dateStr}.xlsx`);
        toast.success('Relatório de Estoque exportado!');
    };

    // -------------------------------------------------------------
    // SUB-MENU DE SELEÇÃO INICIAL
    // -------------------------------------------------------------
    if (subMode === 'menu') {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors flex flex-col items-center">
                <Toaster position="top-center" />

                <header className="w-full max-w-5xl mx-auto px-6 py-4 flex justify-between items-center bg-transparent">
                    <button
                        onClick={onBackToMenu}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all font-bold text-sm shadow-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Voltar ao Menu Principal</span>
                    </button>
                </header>

                <main className="w-full max-w-4xl mx-auto px-6 flex-1 flex flex-col items-center justify-center pb-12">
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
                        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/10">
                            <ClipboardCheck className="w-8 h-8" />
                        </div>
                        <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                            Módulo de Conferência
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 text-base font-medium">
                            Selecione o tipo de conferência que deseja realizar agora
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
                        {/* OPÇÃO 1: CARGA DE CM */}
                        <motion.button
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                            onClick={() => setSubMode('carga-cm')}
                            className="group bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 hover:border-blue-600 dark:hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-500/10 transition-all text-left flex flex-col justify-between active:scale-[0.98] relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/20 rounded-bl-full -z-0 transition-transform group-hover:scale-110" />

                            <div className="relative z-10">
                                <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm">
                                    <Truck className="w-7 h-7" />
                                </div>

                                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-extrabold text-[11px] rounded-full uppercase tracking-wider mb-3 inline-block">
                                    Opção 1
                                </span>

                                <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">
                                    Conferência da Carga de CM
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm leading-relaxed font-medium">
                                    Confira as rodas enviadas pela fábrica CM. Suporta a lista "Curitiba p CM" separando quantidade e cliente.
                                </p>
                            </div>

                            <div className="mt-8 flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm group-hover:translate-x-2 transition-transform relative z-10">
                                <span>Acessar Carga CM</span>
                                <ChevronRight className="w-5 h-5" />
                            </div>
                        </motion.button>

                        {/* OPÇÃO 2: ESTOQUE */}
                        <motion.button
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                            onClick={() => setSubMode('estoque')}
                            className="group bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 hover:border-emerald-600 dark:hover:border-emerald-500 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all text-left flex flex-col justify-between active:scale-[0.98] relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 dark:bg-emerald-900/20 rounded-bl-full -z-0 transition-transform group-hover:scale-110" />

                            <div className="relative z-10">
                                <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm">
                                    <Boxes className="w-7 h-7" />
                                </div>

                                <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-extrabold text-[11px] rounded-full uppercase tracking-wider mb-3 inline-block">
                                    Opção 2
                                </span>

                                <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">
                                    Conferência de Estoque
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm leading-relaxed font-medium">
                                    Bipe itens do estoque físico e compare instantaneamente com as quantidades do banco de dados (Supabase/MK).
                                </p>
                            </div>

                            <div className="mt-8 flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm group-hover:translate-x-2 transition-transform relative z-10">
                                <span>Acessar Estoque</span>
                                <ChevronRight className="w-5 h-5" />
                            </div>
                        </motion.button>
                    </div>
                </main>
            </div>
        );
    }

    // -------------------------------------------------------------
    // TELA OPÇÃO 1: CONFERÊNCIA DA CARGA DE CM
    // -------------------------------------------------------------
    if (subMode === 'carga-cm') {
        return (
            <div className={cn(
                "min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors pb-24",
                scanError && "bg-red-500/20 dark:bg-red-900/40"
            )}>
                {scanError && (
                    <div className="fixed inset-0 z-50 pointer-events-none border-8 border-red-500/50 animate-pulse" />
                )}
                <Toaster position="top-center" />

                {/* Top Header */}
                <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20 shadow-sm">
                    <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setSubMode('menu')}
                                className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-bold flex items-center gap-2 active:scale-95"
                            >
                                <ArrowLeft className="w-5 h-5" />
                                <span className="hidden sm:inline">Opções</span>
                            </button>
                            <div>
                                <h1 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    <Truck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                    Conferência Carga CM (Curitiba)
                                </h1>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* BOTÃO ZERAR BIPAGEM */}
                            <button
                                onClick={handleZerarBipagensCarga}
                                className="px-3 py-2 bg-amber-100 dark:bg-amber-950/50 hover:bg-amber-200 text-amber-800 dark:text-amber-300 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors border border-amber-200 dark:border-amber-800"
                                title="Zerar apenas a contagem lida"
                            >
                                <RotateCcw className="w-4 h-4 text-amber-600" />
                                <span className="hidden sm:inline">Zerar Bipagem</span>
                            </button>

                            {/* BOTÃO NOVA CARGA / LIMPAR TUDO */}
                            <button
                                onClick={handleNovaCargaLimparTudo}
                                className="px-3 py-2 bg-red-100 dark:bg-red-950/50 hover:bg-red-200 text-red-800 dark:text-red-300 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors border border-red-200 dark:border-red-800"
                                title="Apagar lista e carregar nova carga"
                            >
                                <FilePlus className="w-4 h-4 text-red-600" />
                                <span className="hidden sm:inline">Nova Carga</span>
                            </button>

                            {/* BOTÃO EXPORTAR */}
                            <button
                                onClick={handleExportClick}
                                disabled={cargaItems.length === 0}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20 active:scale-95 disabled:opacity-40"
                            >
                                <Share2 className="w-4 h-4" />
                                <span className="hidden sm:inline">Exportar</span>
                            </button>
                        </div>
                    </div>
                </header>

                <main className="max-w-6xl mx-auto px-4 mt-6">
                    {/* SELETOR DE ABA (CONFERÊNCIA VS VÍNCULOS SALVOS SUPABASE) */}
                    <div className="flex items-center gap-2 mb-6 border-b border-slate-200 dark:border-slate-800 pb-3">
                        <button
                            onClick={() => setCargaTab('conferencia')}
                            className={cn(
                                "px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all",
                                cargaTab === 'conferencia'
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                            )}
                        >
                            <Truck className="w-4 h-4" />
                            <span>Conferência da Carga ({cargaItems.length})</span>
                        </button>

                        <button
                            onClick={() => setCargaTab('mappings')}
                            className={cn(
                                "px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all",
                                cargaTab === 'mappings'
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                            )}
                        >
                            <Settings className="w-4 h-4" />
                            <span>Configuração & Vínculos Salvos ({Object.keys(codeMappings).length})</span>
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-extrabold text-[10px] rounded-full flex items-center gap-1">
                                <Cloud className="w-3 h-3" /> Supabase
                            </span>
                        </button>
                    </div>

                    {cargaTab === 'mappings' ? (
                        /* ABA DE GERENCIAMENTO DE VÍNCULOS SALVOS NO SUPABASE */
                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-extrabold text-[10px] rounded-full uppercase tracking-wider flex items-center gap-1">
                                            <Cloud className="w-3 h-3" /> Sincronizado com Supabase
                                        </span>
                                    </div>
                                    <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1 flex items-center gap-2">
                                        <Settings className="w-6 h-6 text-blue-600" />
                                        Mapeamentos de Rodas Salvos no Sistema
                                    </h2>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mt-0.5">
                                        Estes relacionamentos associam o texto lido dos manifestos Word ao código exato no banco de dados. Sincronizados em tempo real entre PC e Celular.
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleClearAllMappings}
                                        disabled={Object.keys(codeMappings).length === 0}
                                        className="px-4 py-2 bg-red-100 dark:bg-red-950/50 hover:bg-red-200 text-red-700 dark:text-red-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40"
                                    >
                                        <Trash2 className="w-4 h-4 text-red-600" />
                                        <span>Apagar Todos os Vínculos</span>
                                    </button>
                                </div>
                            </div>

                            {/* BUSCA DE VÍNCULOS */}
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Filtrar por texto do documento ou código do estoque..."
                                    value={mappingSearchTerm}
                                    onChange={(e) => setMappingSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* TABELA DE VÍNCULOS */}
                            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase tracking-wider font-black border-b border-slate-200 dark:border-slate-800">
                                        <tr>
                                            <th className="p-3">Texto no Documento (Word)</th>
                                            <th className="p-3 text-center">Associação</th>
                                            <th className="p-3">Roda Vinculada no Estoque BD</th>
                                            <th className="p-3 text-right">Ação</th>
                                        </tr>
                                    </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                                        {filteredCodeMappings.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="p-8 text-center text-slate-400 font-bold">
                                                    {Object.keys(codeMappings).length === 0
                                                        ? "Nenhum vínculo salvo ainda. Ao mapear uma roda na prévia de importação ou na tabela, ela aparecerá aqui automaticamente!"
                                                        : "Nenhum vínculo encontrado para a busca atual."}
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredCodeMappings.map(([docText, stockCode]) => {
                                                const stockItem = stock.find(s => s.codigo === stockCode);
                                                return (
                                                    <tr key={docText} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors">
                                                        <td className="p-3 font-extrabold text-slate-800 dark:text-slate-100">
                                                            {docText}
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <ArrowRight className="w-4 h-4 text-blue-500 mx-auto" />
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="space-y-1">
                                                                <div className="font-extrabold text-slate-800 dark:text-slate-100 text-xs">
                                                                    {stockItem?.descricao || 'Roda do Estoque'}
                                                                </div>
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold rounded-lg border border-emerald-200/80 dark:border-emerald-800/80 text-[11px] font-mono">
                                                                    <Barcode className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                                                    <span>{stockCode}</span>
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            <button
                                                                onClick={() => handleDeleteMapping(docText)}
                                                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                                                                title="Apagar este vínculo"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <>
                        {/* BANNER DE DOCUMENTO / CONFIGURAÇÃO DE LISTA */}
                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm mb-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
                                        <span>Documento da Carga:</span>
                                        <span className="text-blue-600 dark:text-blue-400 font-extrabold">{cargaDocName}</span>
                                    </h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mt-0.5">
                                        {cargaItems.length} linhas de produtos ({cargaStats.totalDoc} rodas no total)
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const toastId = toast.loading('Sincronizando lista com Supabase...');
                                        const ok = await saveCloudCargaItems(cargaItems, cargaDocName);
                                        if (ok) {
                                            toast.success('Lista enviada para o Supabase com sucesso!', { id: toastId });
                                        } else {
                                            toast.error('Falha ao enviar. Verifique a tabela carga_cm_itens no Supabase.', { id: toastId });
                                        }
                                    }}
                                    className="px-3.5 py-2.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-bold rounded-2xl flex items-center gap-1.5 transition-all text-xs border border-emerald-200 dark:border-emerald-800"
                                    title="Enviar lista atual para o banco de dados do Supabase"
                                >
                                    <Cloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    <span>Sincronizar Cloud</span>
                                </button>

                                <button
                                    onClick={() => setIsAddLineModalOpen(true)}
                                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold rounded-2xl flex items-center gap-1.5 transition-all text-xs border border-slate-200 dark:border-slate-700"
                                >
                                    <PlusCircle className="w-4 h-4 text-blue-600" />
                                    <span>Adicionar Roda</span>
                                </button>

                                <button
                                    onClick={() => setIsImportModalOpen(true)}
                                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/20 active:scale-95 text-xs"
                                >
                                    <Upload className="w-4 h-4" />
                                    <span>Importar / Nova Lista</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* METRICS CARDS */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Total Esperado</p>
                            <p className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100">{cargaStats.totalDoc} <span className="text-xs text-slate-400 font-normal">rodas</span></p>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/50 shadow-sm">
                            <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Rodas Bipadas</p>
                            <p className="text-2xl sm:text-3xl font-black text-blue-700 dark:text-blue-300">{cargaStats.totalConferidos} <span className="text-xs text-blue-400 font-normal">lidas</span></p>
                        </div>

                        <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/50 shadow-sm">
                            <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Itens Totalmente OK</p>
                            <p className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-300">{cargaStats.okCount} <span className="text-xs text-emerald-400 font-normal">linhas</span></p>
                        </div>

                        <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/50 shadow-sm">
                            <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">Divergências</p>
                            <p className="text-2xl sm:text-3xl font-black text-amber-700 dark:text-amber-300">{cargaStats.divergentesCount} <span className="text-xs text-amber-400 font-normal">linhas</span></p>
                        </div>
                    </div>

                    {/* BIPAGEM */}
                    <section className="mb-6 flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
                            <h2 className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Barcode className="w-4 h-4 text-blue-500" /> Bipar código de barras ou modelo da roda (Ex: M30 BD, BLACK DIAMOND, SURF)
                            </h2>
                            <ScannerInput
                                ref={inputRef}
                                value={inputValue}
                                onChange={setInputValue}
                                onSubmit={handleScan}
                            />
                        </div>

                        <div className="flex sm:flex-col gap-3 shrink-0">
                            <button
                                onClick={() => setIsCameraOpen(true)}
                                className="flex-1 h-14 sm:w-44 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                            >
                                <Camera className="w-5 h-5" />
                                <span>Câmera</span>
                            </button>
                            <button
                                onClick={() => setIsManualAddOpen(true)}
                                className="flex-1 h-14 sm:w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95"
                            >
                                <Search className="w-4 h-4" />
                                <span>Busca Manual</span>
                            </button>
                        </div>
                    </section>

                    {/* FILTROS E BUSCA */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm mb-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                            {(['todos', 'ok', 'divergentes', 'pendentes', 'erros'] as FilterStatus[]).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveFilter(tab)}
                                    className={cn(
                                        "px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5",
                                        activeFilter === tab
                                            ? tab === 'erros'
                                                ? "bg-red-600 text-white shadow-md shadow-red-600/20"
                                                : "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm"
                                            : tab === 'erros' && unmatchedScans.length > 0
                                                ? "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 animate-pulse border border-red-300"
                                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                                    )}
                                >
                                    {tab === 'erros' && <AlertOctagon className="w-3.5 h-3.5" />}
                                    {tab === 'todos' ? `Todos (${cargaItems.length})` :
                                     tab === 'ok' ? `OK (${cargaStats.okCount})` :
                                     tab === 'divergentes' ? `Incompletos (${cargaStats.divergentesCount})` :
                                     tab === 'pendentes' ? `Não Bipados (${cargaStats.pendentesCount})` :
                                     `Bipados c/ Erro (${unmatchedScans.reduce((acc, i) => acc + i.count, 0)})`}
                                </button>
                            ))}
                        </div>

                        <div className="relative w-full sm:w-72">
                            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar roda ou cliente..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 border-none"
                            />
                        </div>
                    </div>

                    {/* ALERTA SE HOUVER LEITURAS COM ERRO */}
                    {unmatchedScans.length > 0 && activeFilter !== 'erros' && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-bold text-red-700 dark:text-red-400 shadow-sm">
                            <div className="flex items-center gap-2">
                                <AlertOctagon className="w-4 h-4 text-red-600 animate-bounce shrink-0" />
                                <span>Atenção: Existem <strong>{unmatchedScans.reduce((a, b) => a + b.count, 0)} bipagens com erro / não previstas</strong> nesta conferência!</span>
                            </div>
                            <button
                                onClick={() => setActiveFilter('erros')}
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[11px] font-extrabold transition-all shrink-0 active:scale-95"
                            >
                                Ver Bipagens com Erro →
                            </button>
                        </div>
                    )}

                    {activeFilter === 'erros' ? (
                        /* LISTA DE BIPAGENS COM ERRO OU NÃO PREVISTAS */
                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-red-200 dark:border-red-900/40 shadow-sm p-5 sm:p-6">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-red-100 dark:border-red-900/30">
                                <div>
                                    <span className="px-3 py-1 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-extrabold text-[10px] rounded-full uppercase tracking-wider mb-2 inline-flex items-center gap-1">
                                        <AlertOctagon className="w-3 h-3 text-red-600" /> Histórico de Erros na Leitura
                                    </span>
                                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                                        Rodas Bipadas Não Previstas / Com Erro
                                    </h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                                        Estes códigos foram lidos pelo leitor ou câmera mas não bateram com a Carga CM ou o banco de estoque.
                                    </p>
                                </div>

                                {unmatchedScans.length > 0 && (
                                    <button
                                        onClick={handleClearAllUnmatchedScans}
                                        className="px-4 py-2 bg-red-100 dark:bg-red-950/50 hover:bg-red-200 text-red-700 dark:text-red-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Limpar Todos os Erros</span>
                                    </button>
                                )}
                            </div>

                            {unmatchedScans.length === 0 ? (
                                <div className="py-12 text-center text-slate-400 text-xs font-bold flex flex-col items-center gap-2">
                                    <CheckCircle2 className="w-10 h-10 text-emerald-500 opacity-60" />
                                    <span>Nenhum erro de bipagem registrado! Todas as rodas lidas são válidas.</span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {unmatchedScans.map((err) => (
                                        <div
                                            key={err.id}
                                            className="bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-2xl p-4 flex flex-col justify-between gap-3 relative"
                                        >
                                            <div>
                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                    <span className="font-mono font-black text-red-700 dark:text-red-400 text-sm flex items-center gap-1.5">
                                                        <Barcode className="w-4 h-4 text-red-500" />
                                                        {err.code}
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-red-600 text-white rounded-full text-[10px] font-black">
                                                        {err.count}x lido
                                                    </span>
                                                </div>

                                                <p className="text-slate-700 dark:text-slate-300 text-xs font-medium mt-1">
                                                    🔴 <strong>Motivo:</strong> {err.reason}
                                                </p>
                                                <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                                                    Última leitura: {err.timestamp}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-red-100 dark:border-red-900/30">
                                                <button
                                                    onClick={() => {
                                                        setLinkingTargetItem({
                                                            id: `err_link_${Date.now()}`,
                                                            codigo: err.code,
                                                            descricao: err.code,
                                                            cliente: 'Leitura Incorreta',
                                                            qtdEsperada: 1,
                                                            qtdConferida: 0,
                                                            destino: 'CURITIBA P CM'
                                                        });
                                                        setStockSearchTerm(err.code);
                                                        setIsLinkModalOpen(true);
                                                    }}
                                                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-xl flex items-center gap-1 transition-all"
                                                >
                                                    <LinkIcon className="w-3 h-3" />
                                                    <span>Vincular Roda do Estoque</span>
                                                </button>

                                                <button
                                                    onClick={() => handleRemoveUnmatchedScan(err.id)}
                                                    title="Remover leitura da lista de erros"
                                                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        /* TABELA DA CARGA CM */
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 uppercase tracking-wider font-black border-b border-slate-200 dark:border-slate-800">
                                    <tr>
                                        <th className="p-4">Item / Roda</th>
                                        <th className="p-4">Cliente / Destino (Obs)</th>
                                        <th className="p-4 text-center">Qtd Doc CM</th>
                                        <th className="p-4 text-center">Bipado (Conferido)</th>
                                        <th className="p-4 text-center">Status Carga</th>
                                        <th className="p-4 text-right">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                                    {filteredCargaList.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">
                                                Nenhum item encontrado nesta visualização.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredCargaList.map((item) => {
                                            const isOk = item.qtdConferida === item.qtdEsperada && item.qtdEsperada > 0;
                                            const isSobra = item.qtdConferida > item.qtdEsperada;
                                            const isFalta = item.qtdConferida < item.qtdEsperada && item.qtdConferida > 0;

                                            // Buscar item correspondente no estoque com checagem de ARO (20 vs 17), MODELO e ACABAMENTO
                                            const stockMatch = findStockMatchForItem(item.descricao, item.codigo, stock, codeMappings);
                                            
                                            // Verificar se este item possui vínculo manual salvo no histórico
                                            const hasManualLink = hasManualLinkCheck(item.descricao, codeMappings);

                                            return (
                                                <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850 transition-colors">
                                                    <td className="p-4">
                                                        <div className="font-black text-slate-800 dark:text-slate-100 text-sm">
                                                            {item.descricao}
                                                        </div>

                                                        {/* EXIBIÇÃO DO CÓDIGO DA RODA BD + BOTAO DE VINCULAR */}
                                                        <div className="text-slate-400 font-mono text-[11px] flex flex-wrap items-center gap-2 mt-1">
                                                            {stockMatch ? (
                                                                <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-800/60">
                                                                    <Barcode className="w-3.5 h-3.5 text-blue-500" />
                                                                    <span>Cód. BD: <strong>{stockMatch.codigo}</strong></span>
                                                                    {hasManualLink ? (
                                                                        <button 
                                                                            onClick={() => handleRemoveLink(item)}
                                                                            title="Vínculo personalizado ativo (clique para desvincular)"
                                                                            className="ml-1 p-0.5 text-blue-600 hover:text-red-500 transition-colors"
                                                                        >
                                                                            <BookmarkCheck className="w-3.5 h-3.5 text-emerald-500" />
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => {
                                                                                setLinkingTargetItem(item);
                                                                                setStockSearchTerm(stockMatch.codigo || item.codigo);
                                                                                setIsLinkModalOpen(true);
                                                                            }}
                                                                            title="Alterar roda vinculada do banco de dados"
                                                                            className="ml-1 text-slate-400 hover:text-blue-600 transition-colors"
                                                                        >
                                                                            <Edit3 className="w-3 h-3" />
                                                                        </button>
                                                                    )}
                                                                </span>
                                                            ) : (
                                                                /* BOTÃO VINCULAR CÓDIGO SE NÃO ENCONTRAR MATCH AUTOMÁTICO */
                                                                <button
                                                                    onClick={() => {
                                                                        setLinkingTargetItem(item);
                                                                        setStockSearchTerm(item.codigo);
                                                                        setIsLinkModalOpen(true);
                                                                    }}
                                                                    className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 rounded-md border border-amber-200 dark:border-amber-800 font-bold transition-all text-[10px]"
                                                                    title="Vincular a um código do banco de dados (salva para sempre no histórico)"
                                                                >
                                                                    <LinkIcon className="w-3 h-3 text-amber-600" />
                                                                    <span>+ Vincular Código de Estoque</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="px-3 py-1 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 rounded-xl font-bold border border-blue-200/50 dark:border-blue-800/50 flex items-center gap-1.5 w-fit">
                                                            <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                                                            {item.cliente}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center font-black text-sm text-slate-600 dark:text-slate-400">
                                                        {item.qtdEsperada}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <div className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    updateCargaItemQty(item.id, item.qtdConferida - 1);
                                                                }}
                                                                disabled={item.qtdConferida === 0}
                                                                className="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg shadow-sm hover:bg-slate-200 disabled:opacity-30"
                                                            >
                                                                <Minus className="w-3.5 h-3.5" />
                                                            </button>
                                                            <span className={cn(
                                                                "w-8 text-center font-black text-sm",
                                                                item.qtdConferida > 0 ? "text-blue-600 dark:text-blue-400" : "text-slate-400"
                                                            )}>
                                                                {item.qtdConferida}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    updateCargaItemQty(item.id, item.qtdConferida + 1);
                                                                }}
                                                                className="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg shadow-sm hover:bg-slate-200"
                                                            >
                                                                <Plus className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        {isOk && (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full font-extrabold text-[11px]">
                                                                <Check className="w-3.5 h-3.5" /> OK (Completo)
                                                            </span>
                                                        )}
                                                        {isSobra && (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-full font-extrabold text-[11px]">
                                                                <AlertTriangle className="w-3.5 h-3.5" /> +{item.qtdConferida - item.qtdEsperada} Excedente
                                                            </span>
                                                        )}
                                                        {isFalta && (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-full font-extrabold text-[11px]">
                                                                <AlertTriangle className="w-3.5 h-3.5" /> Faltam {item.qtdEsperada - item.qtdConferida}
                                                            </span>
                                                        )}
                                                        {item.qtdConferida === 0 && (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full font-bold text-[11px]">
                                                                Não Bipado
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                deleteCargaItemRow(item.id);
                                                            }}
                                                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                            title="Excluir linha da lista"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    )}
                    </>
                    )}
                </main>

                {/* MODAL DE PRÉVIA E CONFERÊNCIA DA IMPORTAÇÃO (CONFIRMAÇÃO ANTES DE GERAR A TABELA) */}
                <AnimatePresence>
                    {isPreviewModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-md">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 relative flex flex-col max-h-[90vh]"
                            >
                                <button
                                    onClick={() => setIsPreviewModalOpen(false)}
                                    className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                <div className="mb-4 pr-8">
                                    <div className="flex items-center gap-2">
                                        <span className="px-3 py-1 bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-extrabold text-[10px] rounded-full uppercase tracking-wider">
                                            Passo 2 de 2 • Conferência Prévia
                                        </span>
                                    </div>
                                    <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 mt-1 flex items-center gap-2">
                                        <ListCheck className="w-7 h-7 text-blue-600" />
                                        Mapeamento dos Itens do Documento
                                    </h2>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 font-medium">
                                        Revise abaixo o texto lido no Word/Documento e altere a roda do sistema correspondente se necessário antes de gerar a carga.
                                    </p>
                                </div>

                                {/* TABELA DE PRÉVIA */}
                                <div className="overflow-y-auto flex-1 border border-slate-200 dark:border-slate-800 rounded-2xl mb-4 bg-slate-50/50 dark:bg-slate-950/40">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-500 uppercase tracking-wider font-black border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                                            <tr>
                                                <th className="p-3">Texto no Documento (Word)</th>
                                                <th className="p-3 text-center">Qtd Doc</th>
                                                <th className="p-3">Roda no Estoque BD (Sistema)</th>
                                                <th className="p-3 text-right">Ação</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800 font-medium">
                                            {importPreviewItems.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="p-8 text-center text-slate-400 font-bold">
                                                        Nenhum item na prévia. Adicione uma roda abaixo.
                                                    </td>
                                                </tr>
                                            ) : (
                                                importPreviewItems.map((item) => (
                                                    <tr key={item.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-850 transition-colors">
                                                        <td className="p-3 max-w-[220px] sm:max-w-[280px]">
                                                            <div className="font-bold text-slate-800 dark:text-slate-100 text-xs">
                                                                {item.rawDesc}
                                                            </div>
                                                            <div className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
                                                                Obs: {item.cliente}
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                value={item.qtdEsperada}
                                                                onChange={(e) => handleUpdatePreviewQty(item.id, parseInt(e.target.value) || 1)}
                                                                className="w-14 text-center px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-black text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                                                            />
                                                        </td>
                                                        <td className="p-3">
                                                            {stockSelectorRowId === item.id ? (
                                                                /* SELECTOR EMBUTIDO NA LINHA DA TABELA */
                                                                <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-blue-500 shadow-lg space-y-2">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <span className="font-bold text-[11px] text-slate-700 dark:text-slate-200">Selecionar Roda do Banco:</span>
                                                                        <button
                                                                            onClick={() => setStockSelectorRowId(null)}
                                                                            className="text-slate-400 hover:text-slate-600"
                                                                        >
                                                                            <X className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                    <input
                                                                        type="text"
                                                                        autoFocus
                                                                        placeholder="Buscar por código ou descrição no BD..."
                                                                        value={previewSearchTerm}
                                                                        onChange={(e) => setPreviewSearchTerm(e.target.value)}
                                                                        className="w-full px-3 py-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100"
                                                                    />
                                                                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                                                                        <button
                                                                            onClick={() => handleSelectStockForPreviewRow(item.id, null)}
                                                                            className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-slate-400"
                                                                        >
                                                                            Sem código no BD (Manter texto original)
                                                                        </button>
                                                                        {filteredStockForPreview.map(st => (
                                                                            <button
                                                                                key={st.id || st.codigo}
                                                                                onClick={() => handleSelectStockForPreviewRow(item.id, st)}
                                                                                className="w-full text-left p-2 hover:bg-blue-50 dark:hover:bg-blue-950/50 font-medium text-slate-800 dark:text-slate-200 flex flex-col"
                                                                            >
                                                                                <span className="font-bold text-blue-600 dark:text-blue-400">{st.descricao}</span>
                                                                                <span className="text-[10px] font-mono text-slate-400">Cód: {st.codigo}</span>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                item.selectedStock ? (
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <div className="space-y-1">
                                                                            <div className="font-extrabold text-slate-800 dark:text-slate-100 text-xs leading-snug">
                                                                                {item.selectedStock.descricao}
                                                                            </div>
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold rounded-lg border border-emerald-200/80 dark:border-emerald-800/80 text-[11px] font-mono">
                                                                                    <Barcode className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                                                                    <span>{item.selectedStock.codigo}</span>
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => {
                                                                                setStockSelectorRowId(item.id);
                                                                                setPreviewSearchTerm(item.selectedStock?.codigo || '');
                                                                            }}
                                                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                                                                            title="Alterar roda vinculada do banco de dados"
                                                                        >
                                                                            <Edit3 className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => {
                                                                            setStockSelectorRowId(item.id);
                                                                            setPreviewSearchTerm(extractModelCode(item.rawDesc));
                                                                        }}
                                                                        className="px-3 py-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold rounded-xl border border-amber-200 dark:border-amber-800 text-xs flex items-center gap-1 transition-all"
                                                                    >
                                                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                                                        <span>Selecionar Roda do Banco...</span>
                                                                    </button>
                                                                )
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            <button
                                                                onClick={() => handleRemovePreviewRow(item.id)}
                                                                className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                                title="Remover linha"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        onClick={handleAddBlankPreviewRow}
                                        className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all"
                                    >
                                        <PlusCircle className="w-4 h-4 text-blue-600" />
                                        <span>+ Adicionar Roda Manual</span>
                                    </button>

                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        <button
                                            onClick={() => setIsPreviewModalOpen(false)}
                                            className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl text-xs"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleConfirmImportPreview}
                                            className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20 active:scale-95"
                                        >
                                            <Check className="w-4 h-4" />
                                            <span>✓ Confirmar e Iniciar Carga</span>
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* MODAL PARA VINCULAR CÓDIGO AO ESTOQUE (SALVA HISTÓRICO PERMANENTE) */}
                <AnimatePresence>
                    {isLinkModalOpen && linkingTargetItem && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 relative flex flex-col max-h-[85vh]"
                            >
                                <button
                                    onClick={() => {
                                        setIsLinkModalOpen(false);
                                        setLinkingTargetItem(null);
                                    }}
                                    className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                <div className="mb-4">
                                    <span className="px-3 py-1 bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-extrabold text-[10px] rounded-full uppercase tracking-wider mb-2 inline-block">
                                        Histórico de Vincular Código
                                    </span>
                                    <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                        <LinkIcon className="w-6 h-6 text-amber-600" /> Vincular Código de Estoque
                                    </h2>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 font-medium">
                                        Selecione qual item do estoque corresponde a: <strong className="text-slate-800 dark:text-slate-100 font-bold">{linkingTargetItem.descricao}</strong>
                                    </p>
                                </div>

                                {/* PESQUISA DE ESTOQUE */}
                                <div className="relative mb-3">
                                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar por nome, modelo ou código no estoque..."
                                        value={stockSearchTerm}
                                        onChange={(e) => setStockSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 border-none"
                                    />
                                </div>

                                {/* LISTA DE RESULTADOS DO ESTOQUE */}
                                <div className="overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-800 pr-1 my-2">
                                    {filteredStockForLink.length === 0 ? (
                                        <div className="py-8 text-center text-slate-400 text-xs font-bold">
                                            Nenhum item de estoque encontrado para esta busca.
                                        </div>
                                    ) : (
                                        filteredStockForLink.map((s) => (
                                            <button
                                                key={s.id || s.codigo}
                                                onClick={() => handleSaveCodeLink(s)}
                                                className="w-full p-3 text-left hover:bg-amber-50/60 dark:hover:bg-amber-950/30 rounded-2xl transition-all flex items-center justify-between group"
                                            >
                                                <div>
                                                    <p className="font-bold text-slate-800 dark:text-slate-100 text-xs group-hover:text-amber-600 dark:group-hover:text-amber-400">
                                                        {s.descricao}
                                                    </p>
                                                    <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                                                        Cód: <strong className="text-slate-600 dark:text-slate-300">{s.codigo}</strong> • Local: {s.local}
                                                    </p>
                                                </div>
                                                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 group-hover:bg-amber-600 text-slate-600 dark:text-slate-300 group-hover:text-white font-bold text-xs rounded-xl transition-all">
                                                    Vincular
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </div>

                                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
                                    <p className="text-[11px] text-slate-400 font-medium flex items-center justify-center gap-1">
                                        <History className="w-3.5 h-3.5 text-amber-500" />
                                        Esta vinculação ficará salva para sempre. Nas próximas leituras o sistema lembrará automaticamente!
                                    </p>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* MODAL ADICIONAR ITEM MANUAL À CARGA */}
                <AnimatePresence>
                    {isAddLineModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 relative"
                            >
                                <button
                                    onClick={() => setIsAddLineModalOpen(false)}
                                    className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
                                    <PlusCircle className="w-6 h-6 text-blue-600" /> Adicionar Roda à Lista
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 text-xs mb-6 font-medium">
                                    Insira manualmente uma roda esperada na Carga CM
                                </p>

                                <form onSubmit={handleAddManualItemToCarga} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Roda / Descrição
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Ex: M30 20X8 5x112 BD"
                                            value={newItemDesc}
                                            onChange={(e) => setNewItemDesc(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Cliente / Observação (Ex: ULTRA REBOQUES)
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ex: GP RODAS, ESTOQUE, RODOLFO..."
                                            value={newItemCliente}
                                            onChange={(e) => setNewItemCliente(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Quantidade Esperada
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={newItemQtd}
                                            onChange={(e) => setNewItemQtd(parseInt(e.target.value) || 1)}
                                            className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs transition-all shadow-md shadow-blue-600/20 active:scale-95 mt-2"
                                    >
                                        Adicionar à Lista da Carga
                                    </button>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* MODAL DE IMPORTAÇÃO / COLAR TEXTO DA CARGA */}
                <AnimatePresence>
                    {isImportModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 relative"
                            >
                                <button
                                    onClick={() => setIsImportModalOpen(false)}
                                    className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
                                    <Upload className="w-6 h-6 text-blue-600" /> Nova Carga CM - Importar Lista
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 text-xs mb-6 font-medium">
                                    Escolha a melhor forma para carregar a nova lista "Curitiba p CM"
                                </p>

                                <div className="space-y-6">
                                    {/* OPÇÃO A: UPLOAD ARQUIVO */}
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                                        <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm mb-2 flex items-center gap-2">
                                            <FileCode className="w-4 h-4 text-blue-500" /> Enviar Arquivo (.docx, .xlsx, .csv)
                                        </h3>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileUpload}
                                            accept=".docx, .xlsx, .xls, .csv, .txt"
                                            className="hidden"
                                        />
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-blue-500 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
                                        >
                                            <Upload className="w-4 h-4 text-blue-500" />
                                            <span>Selecionar Arquivo no Computador / Celular</span>
                                        </button>
                                    </div>

                                    {/* OPÇÃO B: COLAR TEXTO */}
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                                        <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm mb-2 flex items-center gap-2">
                                            <Copy className="w-4 h-4 text-indigo-500" /> Colar Texto da Lista
                                        </h3>
                                        <textarea
                                            rows={4}
                                            value={pasteText}
                                            onChange={(e) => setPasteText(e.target.value)}
                                            placeholder="Cole aqui o texto da lista (ex: 13 M30 20X8 5x112 BD (2 ULTRA REB...))"
                                            className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-200 mb-3"
                                        />
                                        <button
                                            onClick={handlePasteImport}
                                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm"
                                        >
                                            Processar Texto Colado
                                        </button>
                                    </div>

                                    {/* OPÇÃO C: CARREGAR AMOSTRA DE EXEMPLO */}
                                    <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-2xl border border-blue-100 dark:border-blue-900/50 flex items-center justify-between">
                                        <div>
                                            <h4 className="font-bold text-blue-900 dark:text-blue-200 text-xs flex items-center gap-1.5">
                                                <Sparkles className="w-4 h-4 text-blue-600" /> Lista de Exemplo "CAMINHAO DO DIA 20-08"
                                            </h4>
                                            <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                                                Carrega as 12 rodas do exemplo (M30, SURF, M37, M6, M02, R87...)
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleLoadSample}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm"
                                        >
                                            Carregar Exemplo
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                <ManualAddModal
                    isOpen={isManualAddOpen}
                    onClose={() => setIsManualAddOpen(false)}
                    stock={stock}
                    onAdd={(codigo, qty) => addCargaCount(codigo, qty || 1)}
                />

                <CameraScannerModal
                    isOpen={isCameraOpen}
                    onClose={() => setIsCameraOpen(false)}
                    onScan={(codigo) => addCargaCount(codigo, 1)}
                />

                {/* Modal de Exportação Profissional (PDF e Excel) */}
                <ConferenceExportModal
                    isOpen={isExportModalOpen}
                    onClose={() => setIsExportModalOpen(false)}
                    cargaDocName={cargaDocName}
                    cargaItems={cargaItems}
                    stock={stock}
                    codeMappings={codeMappings}
                    unmatchedScans={unmatchedScans}
                />
            </div>
        );
    }

    // -------------------------------------------------------------
    // TELA OPÇÃO 2: CONFERÊNCIA DE ESTOQUE
    // -------------------------------------------------------------
    return (
        <div className={cn(
            "min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors pb-24",
            scanError && "bg-red-500/20 dark:bg-red-900/40"
        )}>
            {scanError && (
                <div className="fixed inset-0 z-50 pointer-events-none border-8 border-red-500/50 animate-pulse" />
            )}
            <Toaster position="top-center" />

            {/* Top Bar Header */}
            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20 shadow-sm">
                <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSubMode('menu')}
                            className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-bold flex items-center gap-2 active:scale-95"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span className="hidden sm:inline">Opções</span>
                        </button>
                        <div>
                            <h1 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <Boxes className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                                Conferência de Estoque
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                if (window.confirm('Zerar conferência de estoque?')) {
                                    setScannedMap({});
                                    localStorage.removeItem('@MK_CONFERENCE_READINGS');
                                    toast.success('Conferência zerada');
                                }
                            }}
                            disabled={Object.keys(scannedMap).length === 0}
                            className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-colors border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                            title="Zerar Conferência"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleExportEstoqueExcel}
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl flex items-center gap-2 transition-all shadow-md shadow-emerald-600/20 active:scale-95"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span className="hidden sm:inline">Exportar Relatório</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 mt-6">
                
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Cadastrados no BD</p>
                        <p className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100">{estoqueStats.totalItems}</p>
                    </div>

                    <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/50 shadow-sm">
                        <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Itens Bipados</p>
                        <p className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-300">{estoqueStats.totalConferidos}</p>
                    </div>

                    <div className="bg-indigo-50 dark:bg-indigo-950/30 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 shadow-sm">
                        <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">Totalmente OK</p>
                        <p className="text-2xl sm:text-3xl font-black text-indigo-700 dark:text-indigo-300">{estoqueStats.okCount}</p>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/50 shadow-sm">
                        <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">Divergências</p>
                        <p className="text-2xl sm:text-3xl font-black text-amber-700 dark:text-amber-300">{estoqueStats.divergentesCount}</p>
                    </div>
                </div>

                {/* Bipagem / Entrada */}
                <section className="mb-6 flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
                        <h2 className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Barcode className="w-4 h-4 text-emerald-500" /> Bipar ou digitar código do estoque
                        </h2>
                        <ScannerInput
                            ref={inputRef}
                            value={inputValue}
                            onChange={setInputValue}
                            onSubmit={handleScan}
                        />
                    </div>

                    <div className="flex sm:flex-col gap-3 shrink-0">
                        <button
                            onClick={() => setIsCameraOpen(true)}
                            className="flex-1 h-14 sm:w-44 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                        >
                            <Camera className="w-5 h-5" />
                            <span>Câmera</span>
                        </button>
                        <button
                            onClick={() => setIsManualAddOpen(true)}
                            className="flex-1 h-14 sm:w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95"
                        >
                            <Search className="w-4 h-4" />
                            <span>Busca Manual</span>
                        </button>
                    </div>
                </section>

                {/* Filtros e Busca */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm mb-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                        {(['todos', 'ok', 'divergentes', 'pendentes'] as FilterStatus[]).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveFilter(tab)}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all whitespace-nowrap",
                                    activeFilter === tab
                                        ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm"
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                                )}
                            >
                                {tab === 'todos' ? `Todos (${estoqueList.length})` :
                                 tab === 'ok' ? `OK (${estoqueStats.okCount})` :
                                 tab === 'divergentes' ? `Divergentes (${estoqueStats.divergentesCount})` :
                                 `Pendentes (${estoqueStats.pendentesCount})`}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full sm:w-72">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar código ou item..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 border-none"
                        />
                    </div>
                </div>

                {/* Tabela de Estoque */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 uppercase tracking-wider font-black border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="p-4">Item / Código</th>
                                    <th className="p-4">Local</th>
                                    <th className="p-4 text-center">Qtd BD</th>
                                    <th className="p-4 text-center">Conferido</th>
                                    <th className="p-4 text-center">Status</th>
                                    <th className="p-4 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                                {filteredEstoqueList.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">
                                            Nenhum item encontrado nesta visualização.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredEstoqueList.map((item) => (
                                        <tr key={item.codigo} className="hover:bg-slate-50/50 dark:hover:bg-slate-850 transition-colors">
                                            <td className="p-4">
                                                <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                                                    {item.descricao}
                                                </div>
                                                <div className="text-slate-400 font-mono text-[11px] flex items-center gap-1 mt-0.5">
                                                    <Hash className="w-3 h-3 text-emerald-500" /> {item.codigo}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg font-bold">
                                                    {item.local}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center font-bold text-sm text-slate-600 dark:text-slate-400">
                                                {item.qtdSistema}
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            updateEstoqueQty(item.codigo, -1);
                                                        }}
                                                        disabled={item.qtdConferida === 0}
                                                        className="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg shadow-sm hover:bg-slate-200 disabled:opacity-30"
                                                    >
                                                        <Minus className="w-3.5 h-3.5" />
                                                    </button>
                                                    <span className={cn(
                                                        "w-8 text-center font-black text-sm",
                                                        item.qtdConferida > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                                                    )}>
                                                        {item.qtdConferida}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            updateEstoqueQty(item.codigo, 1);
                                                        }}
                                                        className="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg shadow-sm hover:bg-slate-200"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                {item.status === 'ok' && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full font-extrabold text-[11px]">
                                                        <Check className="w-3.5 h-3.5" /> OK
                                                    </span>
                                                )}
                                                {item.status === 'sobra' && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-full font-extrabold text-[11px]">
                                                        <AlertTriangle className="w-3.5 h-3.5" /> +{item.qtdConferida - item.qtdSistema} Sobra
                                                    </span>
                                                )}
                                                {item.status === 'divergente' && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-full font-extrabold text-[11px]">
                                                        <AlertTriangle className="w-3.5 h-3.5" /> -{item.qtdSistema - item.qtdConferida} Faltando
                                                    </span>
                                                )}
                                                {item.status === 'pendente' && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full font-bold text-[11px]">
                                                        Pendente
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                {item.qtdConferida > 0 && (
                                                    <button
                                                        onClick={() => setScannedMap(prev => { const n = { ...prev }; delete n[item.codigo]; return n; })}
                                                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                        title="Limpar item"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* Modais */}
            <ManualAddModal
                isOpen={isManualAddOpen}
                onClose={() => setIsManualAddOpen(false)}
                stock={stock}
                onAdd={(codigo, qty) => addEstoqueCount(codigo, qty || 1)}
            />

            <CameraScannerModal
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onScan={(codigo) => addEstoqueCount(codigo, 1)}
            />
        </div>
    );
};
