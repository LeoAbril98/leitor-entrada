import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    ArrowLeft, 
    Printer, 
    Download, 
    Plus, 
    Trash2, 
    Copy, 
    Search, 
    Sliders, 
    RotateCcw, 
    Check, 
    Tag, 
    Truck, 
    MapPin, 
    Barcode as BarcodeIcon, 
    Layers, 
    Eye, 
    Sparkles, 
    Package, 
    X,
    FileText,
    Image as ImageIcon,
    ChevronRight,
    QrCode,
    AlertTriangle,
    ShieldAlert,
    CheckCircle2,
    Scissors,
    Grid,
    Square,
    UserPlus,
    Users,
    Phone,
    Building2,
    Loader2,
    Pencil
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import domtoimage from 'dom-to-image';

import { getInventory } from '../lib/supabase';
import { getWheelPhotoUrl, getModelAndFinish, NO_PHOTO_IMAGE } from '../utils/photoUtils';
import { 
    extractModel, 
    extractAro, 
    extractTala, 
    extractMedida, 
    extractFuracao, 
    extractET 
} from '../utils/wheelVariations';
import { BarcodeDisplay } from '../utils/barcodeUtils';
import { StockItem } from '../types';

interface LabelsModuleProps {
    onBackToMenu: () => void;
}

type LabelType = 'wheel' | 'volume' | 'location' | 'custom';
type LabelSize = '100x50' | '100x80' | '80x40';
export type PrintFormatMode = 'normal' | 'thermal';
export type PreviewViewMode = 'sheet' | 'single';

export interface ShippingCustomer {
    id: string;
    name: string;
    phone?: string;
    doc?: string; // CPF ou CNPJ
    cep: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    carrier?: string;
    notes?: string;
}

export const CUSTOMERS_STORAGE_KEY = 'mkr_shipping_customers';

export const DEFAULT_CUSTOMERS: ShippingCustomer[] = [
    {
        id: 'cust-1',
        name: 'AUTO PEÇAS CURITIBA LTDA',
        phone: '(41) 99876-5432',
        doc: '12.345.678/0001-90',
        cep: '80010-000',
        street: 'Rua XV de Novembro',
        number: '1200',
        complement: 'Galpão 2',
        neighborhood: 'Centro',
        city: 'Curitiba',
        state: 'PR',
        carrier: 'Rodonaves',
        notes: 'Horário comercial'
    },
    {
        id: 'cust-2',
        name: 'MKR SÃO PAULO DISTRIBUIDORA',
        phone: '(11) 98765-4321',
        doc: '98.765.432/0001-10',
        cep: '01001-000',
        street: 'Praça da Sé',
        number: '100',
        complement: 'Bloco A',
        neighborhood: 'Sé',
        city: 'São Paulo',
        state: 'SP',
        carrier: 'Braspress',
        notes: 'Entregar na doca dos fundos'
    }
];

export interface LabelData {
    id: string;
    type: LabelType;
    title: string;
    subtitle?: string;
    code: string;
    details?: string;
    model?: string;
    finish?: string;
    aro?: string;
    tala?: string;
    furacao?: string;
    et?: string;
    photoUrl?: string;
    volumeCurrent?: number;
    volumeTotal?: number;
    client?: string;
    destination?: string;
    carrier?: string;
    copies: number;
    date: string;
    hasDefect?: boolean;
    defectReason?: string;
    // Dados de Envio / Volume (Endereço Completo)
    phone?: string;
    cep?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
}

const COMMON_DEFECTS = [
    'Arranhão na Face',
    'Defeito de Pintura',
    'Borda Amassada',
    'Roda Empenada',
    'Porosidade / Bolha',
    'Usinagem Incorreta',
    'Furação Incorreta',
    'Desbalanceada'
];

const formatDefectText = (reason?: string): string => {
    const clean = (reason || 'REPROVADA QC').trim().toUpperCase();
    if (clean.startsWith('DEFEITO')) return clean;
    return `DEFEITO: ${clean}`;
};

interface A4CardProps {
    label: LabelData;
    index: number;
    showLogo: boolean;
    showDate: boolean;
    showPhoto: boolean;
    showBarcode: boolean;
    className?: string;
}

const A4CardComponent: React.FC<A4CardProps> = ({
    label,
    index,
    showLogo,
    showDate,
    showPhoto,
    showBarcode,
    className = ""
}) => {
    return (
        <div 
            className={`a4-print-card p-3 rounded-xl border-2 border-dashed relative flex flex-col justify-between transition-all select-none text-slate-900 bg-white ${
                label.hasDefect
                    ? 'border-rose-400 bg-rose-50/20'
                    : 'border-slate-300 bg-white'
            } ${className}`}
            style={{ minHeight: '195px', boxSizing: 'border-box' }}
        >
            {/* Faixa de defeito se houver */}
            {label.hasDefect && (
                <div 
                    className="w-full bg-black text-white px-2 py-1 rounded-md mb-2 flex items-center justify-center gap-1.5 shadow-sm"
                    style={{ minHeight: '22px' }}
                >
                    <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                    <span 
                        className={`font-black uppercase tracking-wide text-center leading-tight whitespace-nowrap shrink-0 ${
                            formatDefectText(label.defectReason).length > 28 ? 'text-[7px]' : 'text-[8px] sm:text-[8.5px]'
                        }`}
                    >
                        {formatDefectText(label.defectReason)}
                    </span>
                </div>
            )}

            {/* Header da Etiqueta */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1.5">
                <div className="flex items-center gap-1.5">
                    <span className="font-black text-[11px] tracking-tight text-slate-900 whitespace-nowrap shrink-0">
                        {showLogo ? "MKR RODAS" : label.title}
                    </span>
                    {label.type === 'volume' && (
                        <span className="text-[7.5px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-900 text-white whitespace-nowrap">
                            EXPEDIÇÃO
                        </span>
                    )}
                </div>
                {showDate && (
                    <span className="text-[8.5px] font-mono font-bold text-slate-500 whitespace-nowrap shrink-0">
                        {label.date}
                    </span>
                )}
            </div>

            {/* Se for etiqueta de Volume: Layout Logístico Completo */}
            {label.type === 'volume' ? (
                <div className="flex-1 flex flex-col justify-between my-0.5 min-h-0">
                    {/* Destaque do Volume */}
                    <div className="flex items-center justify-between bg-slate-900 text-white px-2 py-1 rounded-md mb-1 shadow-sm">
                        <span className="text-[8px] font-black uppercase tracking-wider text-slate-300">VOLUME DE ENVIO</span>
                        <div className="flex items-center gap-1">
                            <span className="text-[9px] font-bold text-slate-400">VOL:</span>
                            <span className="text-sm font-black text-amber-300">
                                {label.volumeCurrent} / {label.volumeTotal}
                            </span>
                        </div>
                    </div>

                    {/* Destinatário */}
                    <div className="mb-1">
                        <span className="text-[7.5px] font-black uppercase text-slate-400 block tracking-wider">DESTINATÁRIO:</span>
                        <div className="font-black text-[11.5px] leading-tight text-slate-900 truncate">
                            {label.client}
                        </div>
                        {label.phone && (
                            <div className="text-[8px] font-bold text-slate-600">
                                Tel: {label.phone}
                            </div>
                        )}
                    </div>

                    {/* Endereço Completo */}
                    <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200 text-[8.5px] leading-tight text-slate-800 mb-1">
                        <div className="font-bold text-slate-900 truncate">
                            {label.street ? `${label.street}${label.number ? ', nº ' + label.number : ''}${label.complement ? ' (' + label.complement + ')' : ''}` : 'Endereço não informado'}
                        </div>
                        <div className="text-slate-600 truncate">
                            {label.neighborhood ? `${label.neighborhood} • ` : ''}CEP: {label.cep || '---'}
                        </div>
                        <div className="font-black text-slate-900 uppercase text-[9.5px] mt-0.5 truncate">
                            {label.city || label.destination || 'CIDADE'}{label.state ? ` - ${label.state}` : ''}
                        </div>
                    </div>

                    {/* Rodapé: Pedido / Transportadora / Observações */}
                    <div className="flex items-center justify-between text-[7.5px] font-bold text-slate-600 border-t border-slate-200 pt-1">
                        <span className="truncate max-w-[50%]">
                            {label.code && !label.code.startsWith('VOL-') ? label.code : (label.details ? `CONTEÚDO: ${label.details}` : 'CARGA REGISTRADA')}
                        </span>
                        {label.carrier && (
                            <span className="uppercase text-slate-800 truncate max-w-[48%] font-black">
                                TRANS: {label.carrier}
                            </span>
                        )}
                    </div>
                </div>
            ) : (
                /* Corpo da Etiqueta Padrão de Roda / Local / Custom */
                <div className="flex gap-2.5 items-center my-1 flex-1">
                    {label.type === 'wheel' && showPhoto && label.photoUrl && (
                        <div className="w-13 h-13 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                            <img 
                                src={label.photoUrl} 
                                alt="Roda" 
                                crossOrigin="anonymous" 
                                className="w-full h-full object-cover" 
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        {label.type === 'wheel' && (
                            <>
                                <div className="font-black text-[11px] leading-snug text-slate-900 line-clamp-2">
                                    {label.subtitle}
                                </div>
                                <div className="text-[9.5px] font-mono font-bold text-slate-900 whitespace-nowrap block mt-1">
                                    COD: {label.code}
                                </div>
                            </>
                        )}

                        {label.type === 'location' && (
                            <div className="text-center py-1">
                                <div className="text-[8px] uppercase text-slate-400 font-black">POSIÇÃO</div>
                                <div className="text-sm font-black text-slate-900">{label.details}</div>
                            </div>
                        )}

                        {label.type === 'custom' && (
                            <div>
                                <div className="font-black text-[10.5px] text-slate-900">{label.title}</div>
                                <div className="text-[8.5px] text-slate-500">{label.subtitle}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Código de barras: NÃO exibe em volume */}
            {showBarcode && label.type !== 'volume' && (
                <div className="pt-1.5 border-t border-slate-200 mt-auto flex justify-center">
                    <BarcodeDisplay value={label.code} height={24} barWidth={1.15} showText={true} />
                </div>
            )}
        </div>
    );
};

interface ThermalCardProps {
    label: LabelData;
    index: number;
    labelSize: LabelSize;
    showLogo: boolean;
    showDate: boolean;
    showPhoto: boolean;
    showBarcode: boolean;
    isPrintOrExport?: boolean;
    className?: string;
}

const ThermalCardComponent: React.FC<ThermalCardProps> = ({
    label,
    index,
    labelSize,
    showLogo,
    showDate,
    showPhoto,
    showBarcode,
    isPrintOrExport = false,
    className = ""
}) => {
    const isSquare = labelSize === '100x80';
    const isCompact = labelSize === '80x40';

    return (
        <div 
            className={`thermal-export-card bg-white text-slate-900 rounded-xl flex flex-col justify-between select-none relative overflow-hidden ${
                isPrintOrExport 
                    ? 'border-2 border-slate-400' 
                    : `border-2 shadow-xl p-3.5 sm:p-5 ${label.hasDefect ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-300'} ${
                        isSquare 
                            ? 'w-full sm:w-[420px] min-h-[300px]' 
                            : isCompact 
                            ? 'w-full sm:w-[340px] min-h-[180px]' 
                            : 'w-full sm:w-[400px] min-h-[220px]'
                    }`
            } ${className}`}
            style={isPrintOrExport ? {
                width: isCompact ? '80mm' : '100mm',
                minWidth: isCompact ? '80mm' : '100mm',
                maxWidth: isCompact ? '80mm' : '100mm',
                height: isCompact ? '40mm' : isSquare ? '80mm' : '50mm',
                minHeight: isCompact ? '40mm' : isSquare ? '80mm' : '50mm',
                maxHeight: isCompact ? '40mm' : isSquare ? '80mm' : '50mm',
                boxSizing: 'border-box',
                padding: isCompact ? '2mm' : '3mm'
            } : undefined}
        >
            {/* FAIXA DESTACADA DE DEFEITO SE ATIVO */}
            {label.hasDefect && (
                <div 
                    className={`w-full bg-black text-white px-2 py-1 rounded-md mb-2 flex items-center justify-center gap-1.5 shadow-sm ${
                        !isPrintOrExport ? '-mx-4 -mt-4 sm:-mx-5 sm:-mt-5 mb-2' : ''
                    }`}
                    style={{ minHeight: '24px' }}
                >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span 
                        className={`font-black uppercase tracking-wide text-center leading-tight whitespace-nowrap shrink-0 ${
                            formatDefectText(label.defectReason).length > 28 ? 'text-[8px]' : 'text-[9px] sm:text-[9.5px]'
                        }`}
                    >
                        {formatDefectText(label.defectReason)}
                    </span>
                </div>
            )}

            {/* Cabeçalho da Etiqueta */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-1 mb-1">
                {showLogo ? (
                    <div className="flex items-center gap-1.5">
                        <span className="font-black tracking-tighter text-xs sm:text-sm text-slate-900 whitespace-nowrap shrink-0">
                            MKR RODAS
                        </span>
                        <span className={`text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded text-white whitespace-nowrap shrink-0 ${label.hasDefect ? 'bg-rose-700' : 'bg-slate-900'}`}>
                            {label.hasDefect ? 'BLOQUEADA' : 'EXPEDIÇÃO'}
                        </span>
                    </div>
                ) : (
                    <span className="font-black text-xs uppercase text-slate-900 whitespace-nowrap shrink-0">
                        {label.title}
                    </span>
                )}

                {showDate && (
                    <span className="text-[9px] font-mono font-bold text-slate-600 whitespace-nowrap shrink-0">
                        {label.date}
                    </span>
                )}
            </div>

            {/* Se for etiqueta de Volume: Layout Logístico Térmico Dedicado */}
            {label.type === 'volume' ? (
                <div className="flex-1 flex flex-col justify-between my-0.5 min-h-0">
                    {/* Destaque do Volume */}
                    <div className="flex items-center justify-between bg-slate-900 text-white px-2.5 py-1 rounded-md mb-1 shadow-sm">
                        <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-300">EXPEDIÇÃO MKR</span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold text-slate-400">VOL:</span>
                            <span className="text-base sm:text-lg font-black text-amber-300">
                                {label.volumeCurrent} de {label.volumeTotal}
                            </span>
                        </div>
                    </div>

                    {/* Destinatário */}
                    <div className="mb-0.5">
                        <span className="text-[7.5px] font-black uppercase text-slate-500 block tracking-wider">DESTINATÁRIO:</span>
                        <h4 className="font-black text-xs sm:text-sm text-slate-900 leading-tight truncate">
                            {label.client}
                        </h4>
                        {label.phone && (
                            <span className="text-[8.5px] font-bold text-slate-600 block">
                                Tel: {label.phone}
                            </span>
                        )}
                    </div>

                    {/* Endereço Completo */}
                    <div className="bg-slate-50 p-1.5 rounded-md border border-slate-200 text-[8.5px] sm:text-[9.5px] leading-tight text-slate-800 mb-0.5">
                        <div className="font-bold text-slate-900 truncate">
                            {label.street ? `${label.street}${label.number ? ', nº ' + label.number : ''}${label.complement ? ' (' + label.complement + ')' : ''}` : 'Endereço não informado'}
                        </div>
                        <div className="text-slate-600 truncate">
                            {label.neighborhood ? `${label.neighborhood} • ` : ''}CEP: {label.cep || '---'}
                        </div>
                        <div className="font-black text-slate-900 uppercase text-[9.5px] sm:text-[10.5px] mt-0.5 truncate">
                            {label.city || label.destination || 'CIDADE'}{label.state ? ` - ${label.state}` : ''}
                        </div>
                    </div>

                    {/* Rodapé: Pedido, Transportadora e Observações */}
                    <div className="flex items-center justify-between text-[8px] font-bold text-slate-600 border-t border-slate-200 pt-1 mt-0.5">
                        <span className="truncate max-w-[50%]">
                            {label.code && !label.code.startsWith('VOL-') ? label.code : (label.details ? `CONTEÚDO: ${label.details}` : 'CARGA REGISTRADA')}
                        </span>
                        {label.carrier && (
                            <span className="uppercase text-slate-800 truncate max-w-[48%] font-black">
                                TRANS: {label.carrier}
                            </span>
                        )}
                    </div>
                </div>
            ) : (
                /* Corpo da Etiqueta Padrão de Roda / Local / Custom */
                <div className="flex-1 flex gap-2.5 items-center my-0.5 min-h-0">
                    {/* Foto da Roda */}
                    {label.type === 'wheel' && showPhoto && label.photoUrl && (
                        <div className={`${isCompact ? 'w-11 h-11' : isSquare ? 'w-16 h-16' : 'w-13 h-13'} rounded-lg overflow-hidden bg-slate-50 border border-slate-200 shrink-0`}>
                            <img 
                                src={label.photoUrl} 
                                alt="Roda" 
                                crossOrigin="anonymous" 
                                className="w-full h-full object-cover" 
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                        </div>
                    )}

                    <div className="flex-1 min-w-0">
                        {label.type === 'wheel' && (
                            <>
                                <h4 className="font-black text-xs sm:text-sm text-slate-900 leading-snug line-clamp-2">
                                    {label.subtitle}
                                </h4>
                                <div className="text-[10px] font-mono font-bold text-slate-900 mt-1 whitespace-nowrap block">
                                    COD: {label.code}
                                </div>
                            </>
                        )}

                        {label.type === 'location' && (
                            <div className="text-center py-1">
                                <div className="text-[8px] font-black uppercase text-slate-500">LOCALIZAÇÃO DE ESTOQUE</div>
                                <h4 className="font-black text-lg sm:text-xl text-slate-900 tracking-tight my-0.5">
                                    {label.details}
                                </h4>
                                <p className="text-[10px] font-medium text-slate-600">{label.subtitle}</p>
                            </div>
                        )}

                        {label.type === 'custom' && (
                            <div>
                                <h4 className="font-black text-sm text-slate-900">{label.title}</h4>
                                <p className="text-[10px] text-slate-600 font-medium">{label.subtitle}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Rodapé da Etiqueta: Código de Barras (NÃO exibe em volume) */}
            {showBarcode && label.type !== 'volume' && (
                <div className="pt-1 border-t border-slate-200 mt-1 flex flex-col items-center justify-center">
                    <BarcodeDisplay 
                        value={label.code} 
                        height={isCompact ? 22 : isSquare ? 36 : 28}
                        barWidth={isCompact ? 1.1 : 1.3}
                        showText={true}
                    />
                </div>
            )}
        </div>
    );
};

export const LabelsModule: React.FC<LabelsModuleProps> = ({ onBackToMenu }) => {
    const [stock, setStock] = useState<StockItem[]>([]);
    const [isLoadingStock, setIsLoadingStock] = useState(false);
    
    // Tipo de etiqueta ativo
    const [activeType, setActiveType] = useState<LabelType>('wheel');
    const [labelSize, setLabelSize] = useState<LabelSize>('100x50');
    
    // Modo de impressão: normal (A4 com várias na página) ou thermal (térmica rolo individual)
    const [printFormat, setPrintFormat] = useState<PrintFormatMode>('normal');
    const [previewView, setPreviewView] = useState<PreviewViewMode>('sheet');
    
    // Opções de layout
    const [showLogo, setShowLogo] = useState(true);
    const [showBarcode, setShowBarcode] = useState(true);
    const [showPhoto, setShowPhoto] = useState(true);
    const [showDate, setShowDate] = useState(true);

    // Formulário: Etiqueta de Roda
    const [wheelSearchQuery, setWheelSearchQuery] = useState("");
    const [selectedAroFilter, setSelectedAroFilter] = useState<string>("");
    const [selectedWheel, setSelectedWheel] = useState<StockItem | null>(null);
    const [wheelCopies, setWheelCopies] = useState<number>(4); // Padrão: 4 cópias para 1 jogo de rodas
    
    // Defeito / Avaria QC
    const [hasDefect, setHasDefect] = useState(false);
    const [defectReason, setDefectReason] = useState("");

    // Formulário: Etiqueta de Volume & Destinatário
    const [volOrderNumber, setVolOrderNumber] = useState("");
    const [volClient, setVolClient] = useState("");
    const [volPhone, setVolPhone] = useState("");
    const [volCep, setVolCep] = useState("");
    const [volStreet, setVolStreet] = useState("");
    const [volNumber, setVolNumber] = useState("");
    const [volComplement, setVolComplement] = useState("");
    const [volNeighborhood, setVolNeighborhood] = useState("");
    const [volCity, setVolCity] = useState("");
    const [volState, setVolState] = useState("");
    const [volCarrier, setVolCarrier] = useState("");
    const [volTotal, setVolTotal] = useState<number>(4);
    const [volNotes, setVolNotes] = useState("");
    const [isLoadingCep, setIsLoadingCep] = useState(false);

    // Cadastro e Gestão de Clientes
    const [customers, setCustomers] = useState<ShippingCustomer[]>(() => {
        try {
            const saved = localStorage.getItem(CUSTOMERS_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {
            console.error("Erro ao carregar clientes salvos:", e);
        }
        return DEFAULT_CUSTOMERS;
    });
    const [customerSearch, setCustomerSearch] = useState("");
    const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [customerModalMode, setCustomerModalMode] = useState<'list' | 'create' | 'edit'>('list');
    const [editingCustomer, setEditingCustomer] = useState<ShippingCustomer | null>(null);

    // Form do Modal de Clientes
    const [custModalName, setCustModalName] = useState("");
    const [custModalDoc, setCustModalDoc] = useState("");
    const [custModalPhone, setCustModalPhone] = useState("");
    const [custModalCep, setCustModalCep] = useState("");
    const [custModalStreet, setCustModalStreet] = useState("");
    const [custModalNumber, setCustModalNumber] = useState("");
    const [custModalComplement, setCustModalComplement] = useState("");
    const [custModalNeighborhood, setCustModalNeighborhood] = useState("");
    const [custModalCity, setCustModalCity] = useState("");
    const [custModalState, setCustModalState] = useState("");
    const [custModalCarrier, setCustModalCarrier] = useState("");
    const [custModalNotes, setCustModalNotes] = useState("");
    const [isLoadingModalCep, setIsLoadingModalCep] = useState(false);

    // Formulário: Etiqueta de Localização
    const [locPosition, setLocPosition] = useState("RUA A - PRAT 01");
    const [locSection, setLocSection] = useState("Almoxarifado Central");
    const [locCopies, setLocCopies] = useState<number>(2);

    // Formulário: Etiqueta Personalizada
    const [customTitle, setCustomTitle] = useState("MKR RODAS");
    const [customSubtitle, setCustomSubtitle] = useState("Produto para Expedição");
    const [customCode, setCustomCode] = useState("MKR-12345");
    const [customCopies, setCustomCopies] = useState<number>(1);

    useEffect(() => {
        loadStockData();
    }, []);

    const loadStockData = async () => {
        setIsLoadingStock(true);
        try {
            const data = await getInventory();
            setStock(data || []);
            if (data && data.length > 0) {
                setSelectedWheel(data[0]);
            }
        } catch (error) {
            console.error("Erro ao carregar estoque para etiquetas:", error);
        } finally {
            setIsLoadingStock(false);
        }
    };

    const saveCustomersToStorage = (updatedList: ShippingCustomer[]) => {
        setCustomers(updatedList);
        try {
            localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(updatedList));
        } catch (e) {
            console.error("Erro ao salvar clientes:", e);
        }
    };

    // Consulta de CEP via API pública ViaCEP
    const handleSearchCep = async (cepOverride?: string) => {
        const targetCep = (cepOverride || volCep).replace(/\D/g, '');
        if (targetCep.length !== 8) {
            toast.error("Informe um CEP com 8 dígitos.");
            return;
        }

        setIsLoadingCep(true);
        const toastId = toast.loading("Buscando CEP no ViaCEP...");
        try {
            const res = await fetch(`https://viacep.com.br/ws/${targetCep}/json/`);
            if (!res.ok) throw new Error("Erro de conexão com ViaCEP");
            const data = await res.json();
            if (data.erro) {
                toast.error("CEP não localizado. Preencha manualmente.", { id: toastId });
                return;
            }

            setVolStreet(data.logradouro || "");
            setVolNeighborhood(data.bairro || "");
            setVolCity(data.localidade || "");
            setVolState(data.uf || "");
            setVolCep(`${targetCep.slice(0, 5)}-${targetCep.slice(5)}`);
            toast.success(`Endereço localizado: ${data.localidade}/${data.uf}`, { id: toastId });
        } catch (err) {
            console.error("Erro ao buscar CEP:", err);
            toast.error("Falha ao buscar CEP. Preencha os campos manualmente.", { id: toastId });
        } finally {
            setIsLoadingCep(false);
        }
    };

    // Consulta de CEP para o Modal de Clientes
    const handleSearchModalCep = async () => {
        const targetCep = custModalCep.replace(/\D/g, '');
        if (targetCep.length !== 8) {
            toast.error("Informe um CEP com 8 dígitos.");
            return;
        }

        setIsLoadingModalCep(true);
        const toastId = toast.loading("Buscando CEP...");
        try {
            const res = await fetch(`https://viacep.com.br/ws/${targetCep}/json/`);
            if (!res.ok) throw new Error("Erro de conexão");
            const data = await res.json();
            if (data.erro) {
                toast.error("CEP não localizado.", { id: toastId });
                return;
            }

            setCustModalStreet(data.logradouro || "");
            setCustModalNeighborhood(data.bairro || "");
            setCustModalCity(data.localidade || "");
            setCustModalState(data.uf || "");
            setCustModalCep(`${targetCep.slice(0, 5)}-${targetCep.slice(5)}`);
            toast.success(`Endereço: ${data.localidade}/${data.uf}`, { id: toastId });
        } catch (err) {
            console.error("Erro ao buscar CEP:", err);
            toast.error("Falha ao consultar CEP.", { id: toastId });
        } finally {
            setIsLoadingModalCep(false);
        }
    };

    // Selecionar cliente para preencher a etiqueta de envio
    const handleSelectCustomer = (cust: ShippingCustomer) => {
        setVolClient(cust.name);
        setVolPhone(cust.phone || "");
        setVolCep(cust.cep || "");
        setVolStreet(cust.street || "");
        setVolNumber(cust.number || "");
        setVolComplement(cust.complement || "");
        setVolNeighborhood(cust.neighborhood || "");
        setVolCity(cust.city || "");
        setVolState(cust.state || "");
        if (cust.carrier) setVolCarrier(cust.carrier);
        if (cust.notes) setVolNotes(cust.notes);
        
        setIsSearchingCustomer(false);
        setCustomerSearch("");
        setShowCustomerModal(false);
        toast.success(`Cliente "${cust.name}" carregado!`);
    };

    // Salvar os dados digitados na tela de volume diretamente como cliente
    const handleSaveCurrentAsCustomer = () => {
        if (!volClient.trim()) {
            toast.error("Preencha o nome do cliente antes de salvar.");
            return;
        }

        const existingIndex = customers.findIndex(
            c => c.name.trim().toLowerCase() === volClient.trim().toLowerCase()
        );

        const newCustomer: ShippingCustomer = {
            id: existingIndex >= 0 ? customers[existingIndex].id : `cust-${Date.now()}`,
            name: volClient.trim(),
            phone: volPhone.trim(),
            cep: volCep.trim(),
            street: volStreet.trim(),
            number: volNumber.trim(),
            complement: volComplement.trim(),
            neighborhood: volNeighborhood.trim(),
            city: volCity.trim(),
            state: volState.trim(),
            carrier: volCarrier.trim(),
            notes: volNotes.trim()
        };

        let updatedList: ShippingCustomer[];
        if (existingIndex >= 0) {
            updatedList = [...customers];
            updatedList[existingIndex] = newCustomer;
            toast.success(`Cadastro de "${volClient}" atualizado!`);
        } else {
            updatedList = [newCustomer, ...customers];
            toast.success(`Cliente "${volClient}" cadastrado com sucesso!`);
        }

        saveCustomersToStorage(updatedList);
    };

    // Salvar do Modal (Novo ou Edição)
    const handleSaveModalCustomer = () => {
        if (!custModalName.trim()) {
            toast.error("O nome do cliente é obrigatório.");
            return;
        }

        const newCustomer: ShippingCustomer = {
            id: editingCustomer ? editingCustomer.id : `cust-${Date.now()}`,
            name: custModalName.trim(),
            doc: custModalDoc.trim(),
            phone: custModalPhone.trim(),
            cep: custModalCep.trim(),
            street: custModalStreet.trim(),
            number: custModalNumber.trim(),
            complement: custModalComplement.trim(),
            neighborhood: custModalNeighborhood.trim(),
            city: custModalCity.trim(),
            state: custModalState.trim(),
            carrier: custModalCarrier.trim(),
            notes: custModalNotes.trim()
        };

        let updatedList: ShippingCustomer[];
        if (editingCustomer) {
            updatedList = customers.map(c => c.id === editingCustomer.id ? newCustomer : c);
            toast.success("Cliente atualizado com sucesso!");
        } else {
            updatedList = [newCustomer, ...customers];
            toast.success("Cliente cadastrado com sucesso!");
        }

        saveCustomersToStorage(updatedList);
        setCustomerModalMode('list');
        setEditingCustomer(null);
    };

    const handleOpenEditCustomer = (cust: ShippingCustomer) => {
        setEditingCustomer(cust);
        setCustModalName(cust.name || "");
        setCustModalDoc(cust.doc || "");
        setCustModalPhone(cust.phone || "");
        setCustModalCep(cust.cep || "");
        setCustModalStreet(cust.street || "");
        setCustModalNumber(cust.number || "");
        setCustModalComplement(cust.complement || "");
        setCustModalNeighborhood(cust.neighborhood || "");
        setCustModalCity(cust.city || "");
        setCustModalState(cust.state || "");
        setCustModalCarrier(cust.carrier || "");
        setCustModalNotes(cust.notes || "");
        setCustomerModalMode('edit');
    };

    const handleOpenCreateCustomer = () => {
        setEditingCustomer(null);
        setCustModalName("");
        setCustModalDoc("");
        setCustModalPhone("");
        setCustModalCep("");
        setCustModalStreet("");
        setCustModalNumber("");
        setCustModalComplement("");
        setCustModalNeighborhood("");
        setCustModalCity("");
        setCustModalState("");
        setCustModalCarrier("");
        setCustModalNotes("");
        setCustomerModalMode('create');
    };

    const handleDeleteCustomer = (id: string, name: string) => {
        if (!window.confirm(`Deseja remover o cliente "${name}" do cadastro?`)) return;
        const updatedList = customers.filter(c => c.id !== id);
        saveCustomersToStorage(updatedList);
        toast.success("Cliente removido.");
    };

    // Filtro de clientes para autocomplete e busca
    const filteredCustomers = useMemo(() => {
        const query = customerSearch.trim().toLowerCase();
        if (!query) return customers;
        return customers.filter(c => 
            c.name.toLowerCase().includes(query) ||
            c.city.toLowerCase().includes(query) ||
            (c.doc && c.doc.includes(query)) ||
            (c.phone && c.phone.includes(query))
        );
    }, [customers, customerSearch]);

    // Aros disponíveis no estoque para filtro rápido
    const availableAros = useMemo(() => {
        const set = new Set<string>();
        stock.forEach(item => {
            const aro = extractAro(item.descricao).replace('"', '');
            if (aro) set.add(aro);
        });
        return Array.from(set).sort((a, b) => Number(a) - Number(b));
    }, [stock]);

    // Filtro inteligente de rodas do catálogo (Multi-token: busca "15 4x100", "c10 bd", etc.)
    const filteredWheels = useMemo(() => {
        let list = stock;

        // Filtro por Aro rápido se selecionado
        if (selectedAroFilter) {
            list = list.filter(item => {
                const aro = extractAro(item.descricao).replace('"', '');
                return aro === selectedAroFilter;
            });
        }

        if (!wheelSearchQuery.trim()) return list.slice(0, 20);

        // Divide a busca em múltiplos termos: ex: "15 4X100" -> ["15", "4X100"]
        const tokens = wheelSearchQuery
            .toLowerCase()
            .trim()
            .split(/\s+/)
            .filter(Boolean);

        return list.filter(item => {
            const desc = item.descricao.toLowerCase();
            const code = item.codigo.toLowerCase();
            const model = extractModel(item.descricao, item.codigo).toLowerCase();
            const aro = extractAro(item.descricao).replace('"', '').toLowerCase();
            const tala = extractTala(item.descricao).toLowerCase();
            const medida = extractMedida(item.descricao).toLowerCase();
            const furacao = extractFuracao(item.descricao).toLowerCase();
            const { finishAbbr } = getModelAndFinish(item.descricao);
            const finish = (finishAbbr || '').toLowerCase();

            // Normalização de furação e aro para garantir correspondência com barras, traços ou X
            const furacaoNorm = furacao.replace(/[\/\-]/g, 'x');
            const descNorm = desc.replace(/[\/\-]/g, 'x');

            const searchable = `${code} ${desc} ${descNorm} ${model} aro ${aro} ${aro} ${tala} ${medida} ${furacao} ${furacaoNorm} ${finish}`;

            // Cada token digitado pelo usuário deve estar presente na representação da roda
            return tokens.every(token => {
                const cleanToken = token.replace(/[\/\-]/g, 'x');
                return searchable.includes(token) || searchable.includes(cleanToken);
            });
        }).slice(0, 30);
    }, [stock, wheelSearchQuery, selectedAroFilter]);

    // Extrair detalhes completos da roda selecionada
    const currentWheelDetails = useMemo(() => {
        if (!selectedWheel) return null;
        const { modelCode, finishAbbr } = getModelAndFinish(selectedWheel.descricao);
        const photoUrl = getWheelPhotoUrl(selectedWheel.descricao, selectedWheel.codigo);
        
        const aro = extractAro(selectedWheel.descricao).replace('"', '');
        const tala = extractTala(selectedWheel.descricao);
        const medida = extractMedida(selectedWheel.descricao);
        const furacao = extractFuracao(selectedWheel.descricao);
        const et = extractET(selectedWheel.descricao);

        return {
            codigo: selectedWheel.codigo,
            descricao: selectedWheel.descricao,
            model: modelCode,
            finish: finishAbbr,
            aro,
            tala,
            medida,
            furacao,
            et,
            photoUrl,
            quantidade: selectedWheel.quantidade || 0
        };
    }, [selectedWheel]);

    // Gerar lista de etiquetas ativas para pré-visualização e impressão
    const activeLabels = useMemo<LabelData[]>(() => {
        const currentDate = new Date().toLocaleDateString('pt-BR');

        if (activeType === 'wheel') {
            if (!currentWheelDetails) return [];
            const labels: LabelData[] = [];
            for (let i = 1; i <= wheelCopies; i++) {
                labels.push({
                    id: `wheel-${currentWheelDetails.codigo}-${i}`,
                    type: 'wheel',
                    title: `RODA ${currentWheelDetails.model || ''}`,
                    subtitle: currentWheelDetails.descricao,
                    code: currentWheelDetails.codigo,
                    model: currentWheelDetails.model,
                    finish: currentWheelDetails.finish,
                    aro: currentWheelDetails.aro,
                    tala: currentWheelDetails.tala,
                    furacao: currentWheelDetails.furacao,
                    et: currentWheelDetails.et,
                    photoUrl: currentWheelDetails.photoUrl,
                    copies: wheelCopies,
                    date: currentDate,
                    hasDefect: hasDefect,
                    defectReason: hasDefect ? (defectReason.trim() || 'PEÇA AVARIADA / REPROVADA QC') : undefined
                });
            }
            return labels;
        }

        if (activeType === 'volume') {
            const labels: LabelData[] = [];
            const total = Math.max(1, volTotal);
            for (let i = 1; i <= total; i++) {
                labels.push({
                    id: `vol-${volOrderNumber || 'PED'}-${i}`,
                    type: 'volume',
                    title: `EXPEDIÇÃO MKR RODAS`,
                    subtitle: volClient || 'CLIENTE GERAL',
                    code: volOrderNumber ? `PED-${volOrderNumber}-${i}` : `VOL-${i}/${total}`,
                    client: volClient || 'CLIENTE NÃO INFORMADO',
                    destination: volCity ? `${volCity}${volState ? ' - ' + volState : ''}` : '',
                    carrier: volCarrier || 'RETIRADA',
                    details: volNotes,
                    volumeCurrent: i,
                    volumeTotal: total,
                    copies: 1,
                    date: currentDate,
                    phone: volPhone,
                    cep: volCep,
                    street: volStreet,
                    number: volNumber,
                    complement: volComplement,
                    neighborhood: volNeighborhood,
                    city: volCity,
                    state: volState
                });
            }
            return labels;
        }

        if (activeType === 'location') {
            const labels: LabelData[] = [];
            for (let i = 1; i <= locCopies; i++) {
                labels.push({
                    id: `loc-${locPosition}-${i}`,
                    type: 'location',
                    title: 'ENDEREÇO DE ESTOQUE',
                    subtitle: locSection,
                    code: locPosition.toUpperCase().replace(/\s+/g, '-'),
                    details: locPosition,
                    copies: locCopies,
                    date: currentDate
                });
            }
            return labels;
        }

        // Custom
        const labels: LabelData[] = [];
        for (let i = 1; i <= customCopies; i++) {
            labels.push({
                id: `custom-${i}`,
                type: 'custom',
                title: customTitle,
                subtitle: customSubtitle,
                code: customCode,
                copies: customCopies,
                date: currentDate
            });
        }
        return labels;
    }, [
        activeType, 
        currentWheelDetails, 
        wheelCopies, 
        hasDefect, 
        defectReason,
        volOrderNumber, 
        volClient, 
        volPhone,
        volCep,
        volStreet,
        volNumber,
        volComplement,
        volNeighborhood,
        volCity, 
        volState,
        volCarrier, 
        volTotal, 
        volNotes,
        locPosition,
        locSection,
        locCopies,
        customTitle,
        customSubtitle,
        customCode,
        customCopies
    ]);

    // Imprimir via Janela do Navegador (suporta Normal A4 com várias na página e Térmica Rolo)
    const handlePrint = (overrideFormat?: PrintFormatMode) => {
        if (activeLabels.length === 0) {
            toast.error("Nenhuma etiqueta para imprimir.");
            return;
        }
        if (overrideFormat && overrideFormat !== printFormat) {
            setPrintFormat(overrideFormat);
        }
        setTimeout(() => {
            window.print();
        }, 60);
    };

    // Agrupamento de etiquetas em folhas A4 (máximo 8 etiquetas por folha: 2 colunas x 4 linhas)
    const a4Pages = useMemo(() => {
        const pages: LabelData[][] = [];
        const pageSize = 8;
        for (let i = 0; i < activeLabels.length; i += pageSize) {
            pages.push(activeLabels.slice(i, i + pageSize));
        }
        return pages.length > 0 ? pages : [[]];
    }, [activeLabels]);

    // Exportar em PDF idêntico à pré-visualização (Folha A4 completa ou Etiquetas Térmicas individuais)
    const handleExportPdf = async () => {
        if (activeLabels.length === 0) {
            toast.error("Nenhuma etiqueta para exportar.");
            return;
        }

        const toastId = toast.loading(
            printFormat === 'normal' 
                ? "Gerando PDF da Folha A4 idêntico à prévia..." 
                : "Gerando PDF Térmico idêntico à prévia..."
        );

        const containerId = printFormat === 'normal' ? 'normal-a4-print-area' : 'thermal-print-area';
        const container = document.getElementById(containerId);

        if (!container) {
            toast.error("Área de impressão não encontrada.", { id: toastId });
            return;
        }

        // Salvar estado visual original do container
        const wasHidden = container.classList.contains('hidden');
        const origPosition = container.style.position;
        const origLeft = container.style.left;
        const origTop = container.style.top;
        const origZIndex = container.style.zIndex;
        const origOpacity = container.style.opacity;
        const origVisibility = container.style.visibility;
        const origDisplay = container.style.display;
        const origWidth = container.style.width;
        const origMaxWidth = container.style.maxWidth;

        try {
            // Tornar o container renderizável pelo domtoimage (posicionado atrás da tela para não piscar)
            if (wasHidden) {
                container.classList.remove('hidden');
            }
            const isSquareThermal = labelSize === '100x80';
            const isCompactThermal = labelSize === '80x40';
            const thermalWidthMm = isCompactThermal ? 80 : 100;

            container.style.position = 'fixed';
            container.style.left = '0';
            container.style.top = '0';
            container.style.zIndex = '-9999';
            container.style.opacity = '1';
            container.style.visibility = 'visible';
            container.style.display = 'block';
            container.style.width = printFormat === 'normal' ? '210mm' : `${thermalWidthMm}mm`;
            container.style.maxWidth = 'none';

            // Aguarda o carregamento de fontes e renderização do layout
            if (document.fonts) {
                await document.fonts.ready;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));

            if (printFormat === 'normal') {
                // PDF FOLHA A4 (210 x 297 mm)
                const doc = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: 'a4'
                });

                const pageElements = container.querySelectorAll<HTMLElement>('.a4-export-page');
                if (pageElements.length === 0) {
                    throw new Error("Nenhuma página A4 encontrada para exportar.");
                }

                // Resolução 3x para folha A4 (794 x 1123 px em 96 DPI -> 2382 x 3369 px, ~300 DPI de qualidade gráfica)
                const a4W = 794;
                const a4H = 1123;
                const scale = 3;

                for (let i = 0; i < pageElements.length; i++) {
                    const pageEl = pageElements[i];
                    toast.loading(`Renderizando folha A4 (${i + 1} de ${pageElements.length})...`, { id: toastId });

                    const imgData = await domtoimage.toPng(pageEl, {
                        bgcolor: '#ffffff',
                        width: a4W * scale,
                        height: a4H * scale,
                        style: {
                            transform: `scale(${scale})`,
                            transformOrigin: 'top left',
                            width: `${a4W}px`,
                            height: `${a4H}px`,
                            minHeight: `${a4H}px`,
                            maxHeight: `${a4H}px`,
                            backgroundColor: '#ffffff'
                        },
                        imagePlaceholder: NO_PHOTO_IMAGE
                    });

                    if (i > 0) {
                        doc.addPage('a4', 'portrait');
                    }

                    // A imagem preenche exatamente a folha A4 (210 x 297 mm)
                    doc.addImage(imgData, 'PNG', 0, 0, 210, 297);
                }

                doc.save(`etiquetas-folha-a4-mkr-${Date.now()}.pdf`);
                toast.success("PDF da Folha A4 baixado com sucesso!", { id: toastId });

            } else {
                // PDF TÉRMICO INDIVIDUAL (1 página por etiqueta)
                const isSquare = labelSize === '100x80';
                const isCompact = labelSize === '80x40';
                const widthMm = isCompact ? 80 : 100;
                const heightMm = isCompact ? 40 : isSquare ? 80 : 50;

                const doc = new jsPDF({
                    orientation: 'landscape',
                    unit: 'mm',
                    format: [widthMm, heightMm]
                });

                const cardElements = container.querySelectorAll<HTMLElement>('.thermal-export-card');
                if (cardElements.length === 0) {
                    throw new Error("Nenhuma etiqueta térmica encontrada para exportar.");
                }

                // Resolução 3x para impressão térmica de alta nitidez
                const widthPx = Math.round((widthMm * 96) / 25.4);
                const heightPx = Math.round((heightMm * 96) / 25.4);
                const scale = 3;

                for (let i = 0; i < cardElements.length; i++) {
                    const cardEl = cardElements[i];
                    toast.loading(`Renderizando etiqueta térmica (${i + 1} de ${cardElements.length})...`, { id: toastId });

                    const imgData = await domtoimage.toPng(cardEl, {
                        bgcolor: '#ffffff',
                        width: widthPx * scale,
                        height: heightPx * scale,
                        style: {
                            transform: `scale(${scale})`,
                            transformOrigin: 'top left',
                            width: `${widthPx}px`,
                            height: `${heightPx}px`,
                            minHeight: `${heightPx}px`,
                            maxHeight: `${heightPx}px`,
                            backgroundColor: '#ffffff'
                        },
                        imagePlaceholder: NO_PHOTO_IMAGE
                    });

                    if (i > 0) {
                        doc.addPage([widthMm, heightMm], 'landscape');
                    }

                    doc.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm);
                }

                doc.save(`etiquetas-termica-mkr-${Date.now()}.pdf`);
                toast.success("PDF Térmico baixado com sucesso!", { id: toastId });
            }
        } catch (err) {
            console.error("Erro ao gerar PDF:", err);
            toast.error("Erro ao gerar PDF das etiquetas", { id: toastId });
        } finally {
            // Restaurar estado visual original do container
            if (wasHidden) {
                container.classList.add('hidden');
            }
            container.style.position = origPosition;
            container.style.left = origLeft;
            container.style.top = origTop;
            container.style.zIndex = origZIndex;
            container.style.opacity = origOpacity;
            container.style.visibility = origVisibility;
            container.style.display = origDisplay;
            container.style.width = origWidth;
            container.style.maxWidth = origMaxWidth;
        }
    };

    return (
        <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 transition-colors duration-300 ${printFormat === 'normal' ? 'print-format-normal' : 'print-format-thermal'}`}>
            {/* ESTILOS DE IMPRESSÃO DINÂMICOS (FOLHA NORMAL A4 vs TÉRMICA ROLO) */}
            <style>{`
                @media print {
                    body, html {
                        background: #ffffff !important;
                        color: #000000 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    body * {
                        visibility: hidden;
                    }

                    /* MODO FOLHA NORMAL / A4 */
                    .print-format-normal #normal-a4-print-area,
                    .print-format-normal #normal-a4-print-area * {
                        visibility: visible;
                    }
                    .print-format-normal #normal-a4-print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        margin: 0;
                        padding: 0;
                        display: block !important;
                    }
                    .print-format-normal .a4-print-page {
                        width: 100% !important;
                        box-sizing: border-box !important;
                        page-break-after: always !important;
                        break-after: page !important;
                        padding: 0 !important;
                    }
                    .print-format-normal .a4-print-page:last-child {
                        page-break-after: avoid !important;
                        break-after: avoid !important;
                    }
                    .print-format-normal .a4-print-grid {
                        display: grid !important;
                        grid-template-columns: repeat(2, 1fr) !important;
                        gap: 3mm !important;
                        width: 100% !important;
                        box-sizing: border-box !important;
                    }
                    .print-format-normal .a4-print-card {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        box-sizing: border-box !important;
                    }

                    /* MODO IMPRESSORA TÉRMICA (ROLO 1 POR FOLHA) */
                    .print-format-thermal #thermal-print-area,
                    .print-format-thermal #thermal-print-area * {
                        visibility: visible;
                    }
                    .print-format-thermal #thermal-print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        margin: 0;
                        padding: 0;
                        display: block !important;
                    }
                    .print-format-thermal .thermal-label-page {
                        page-break-after: always !important;
                        break-after: page !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        box-sizing: border-box !important;
                    }
                    .print-format-thermal .thermal-label-page:last-child {
                        page-break-after: avoid !important;
                        break-after: avoid !important;
                    }

                    @page {
                        size: ${printFormat === 'normal' ? 'A4 portrait' : labelSize === '100x80' ? '100mm 80mm' : labelSize === '80x40' ? '80mm 40mm' : '100mm 50mm'};
                        margin: ${printFormat === 'normal' ? '6mm' : '0'};
                    }
                }
            `}</style>

            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 print:hidden">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={onBackToMenu}
                            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all shadow-sm active:scale-95"
                            title="Voltar ao Início"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="p-2 bg-gradient-to-br from-indigo-500 to-sky-600 text-white rounded-xl shadow-md shadow-indigo-600/20">
                                    <Tag className="w-6 h-6" />
                                </span>
                                <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                                    Gerador de Etiquetas
                                </h1>
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
                                Crie etiquetas térmicas para rodas normais ou avariadas, volumes de despacho e posições de estoque.
                            </p>
                        </div>
                    </div>

                    {/* Ações de Impressão */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Seletor Rápido de Formato */}
                        <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl shadow-sm">
                            <button
                                type="button"
                                onClick={() => {
                                    setPrintFormat('normal');
                                    setPreviewView('sheet');
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                                    printFormat === 'normal'
                                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                                }`}
                                title="Imprimir várias etiquetas juntas na mesma folha A4"
                            >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Folha A4 (Normal)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setPrintFormat('thermal');
                                    setPreviewView('single');
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                                    printFormat === 'thermal'
                                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                                }`}
                                title="Imprimir 1 etiqueta por página para impressora térmica"
                            >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Térmica (Rolo)</span>
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={handleExportPdf}
                            className="px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all active:scale-95"
                            title={printFormat === 'normal' ? "Baixar PDF em Folha A4 com todas as etiquetas" : "Baixar PDF Térmico individual"}
                        >
                            <Download className="w-4 h-4 text-slate-500" />
                            <span className="hidden sm:inline">PDF</span>
                            <span className="text-[10px] font-bold text-slate-400">({printFormat === 'normal' ? 'A4' : 'Térmico'})</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handlePrint()}
                            className={`px-4 sm:px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 shadow-md transition-all active:scale-95 ${
                                hasDefect
                                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/25'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                            }`}
                        >
                            <Printer className="w-4 h-4" />
                            <span>
                                {printFormat === 'normal' 
                                    ? `Imprimir A4 (${activeLabels.length})` 
                                    : `Imprimir Térmica (${activeLabels.length})`
                                }
                            </span>
                        </button>
                    </div>
                </header>

                {/* Abas / Tipos de Etiquetas */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 print:hidden">
                    <button
                        onClick={() => setActiveType('wheel')}
                        className={`p-4 rounded-2xl border text-left transition-all duration-200 flex items-center gap-3.5 ${
                            activeType === 'wheel'
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                                : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-indigo-300'
                        }`}
                    >
                        <div className={`p-2.5 rounded-xl ${activeType === 'wheel' ? 'bg-white/20' : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600'}`}>
                            <Package className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-black text-sm">Etiqueta de Roda</h3>
                            <p className="text-[11px] opacity-75 font-medium leading-tight">Jogo, avulsa ou defeito</p>
                        </div>
                    </button>

                    <button
                        onClick={() => setActiveType('volume')}
                        className={`p-4 rounded-2xl border text-left transition-all duration-200 flex items-center gap-3.5 ${
                            activeType === 'volume'
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                                : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-indigo-300'
                        }`}
                    >
                        <div className={`p-2.5 rounded-xl ${activeType === 'volume' ? 'bg-white/20' : 'bg-sky-50 dark:bg-sky-950/50 text-sky-600'}`}>
                            <Truck className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-black text-sm">Volume / Envio</h3>
                            <p className="text-[11px] opacity-75 font-medium leading-tight">Volume 1 de X, cliente</p>
                        </div>
                    </button>

                    <button
                        onClick={() => setActiveType('location')}
                        className={`p-4 rounded-2xl border text-left transition-all duration-200 flex items-center gap-3.5 ${
                            activeType === 'location'
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                                : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-indigo-300'
                        }`}
                    >
                        <div className={`p-2.5 rounded-xl ${activeType === 'location' ? 'bg-white/20' : 'bg-purple-50 dark:bg-purple-950/50 text-purple-600'}`}>
                            <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-black text-sm">Localização / Rua</h3>
                            <p className="text-[11px] opacity-75 font-medium leading-tight">Prateleiras e corredores</p>
                        </div>
                    </button>

                    <button
                        onClick={() => setActiveType('custom')}
                        className={`p-4 rounded-2xl border text-left transition-all duration-200 flex items-center gap-3.5 ${
                            activeType === 'custom'
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                                : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-indigo-300'
                        }`}
                    >
                        <div className={`p-2.5 rounded-xl ${activeType === 'custom' ? 'bg-white/20' : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600'}`}>
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-black text-sm">Personalizada</h3>
                            <p className="text-[11px] opacity-75 font-medium leading-tight">Texto e código livres</p>
                        </div>
                    </button>
                </div>

                {/* Grid Principal */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 print:hidden">
                    
                    {/* COLUNA ESQUERDA: Formulário & Seletor da Roda (5 Colunas) */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 p-6 md:p-7 shadow-sm space-y-6">
                            
                            {/* FORMULÁRIO DE RODA (APRIMORADO) */}
                            {activeType === 'wheel' && (
                                <div className="space-y-5">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                                            <Package className="w-4 h-4 text-indigo-500" />
                                            Buscar &amp; Selecionar Roda
                                        </h3>
                                        <span className="text-[10px] font-bold text-slate-400">
                                            {stock.length} cadastradas
                                        </span>
                                    </div>

                                    {/* Campo de Busca Inteligente (Suporta "15 4x100", "C10 BD", "1204") */}
                                    <div className="space-y-2">
                                        <div className="relative">
                                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input 
                                                type="text"
                                                placeholder="Digite aro, furação ou modelo (ex: 15 4X100, C10, BD)..."
                                                value={wheelSearchQuery}
                                                onChange={e => setWheelSearchQuery(e.target.value)}
                                                className="w-full pl-10 pr-9 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                                            />
                                            {wheelSearchQuery && (
                                                <button
                                                    onClick={() => setWheelSearchQuery("")}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Chips Rápidos de Filtro por Aro */}
                                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-[11px]">
                                            <button
                                                onClick={() => setSelectedAroFilter("")}
                                                className={`px-2 py-0.5 rounded-lg font-bold shrink-0 transition-all ${
                                                    selectedAroFilter === ""
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                                                }`}
                                            >
                                                Todos
                                            </button>
                                            {availableAros.map(aro => (
                                                <button
                                                    key={aro}
                                                    onClick={() => setSelectedAroFilter(selectedAroFilter === aro ? "" : aro)}
                                                    className={`px-2 py-0.5 rounded-lg font-bold shrink-0 transition-all ${
                                                        selectedAroFilter === aro
                                                            ? 'bg-indigo-600 text-white'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    Aro {aro}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Lista de Resultados Encontrados com Cards Ricos */}
                                    <div className="space-y-1.5">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                                            <span>Resultados Encontrados ({filteredWheels.length})</span>
                                            {filteredWheels.length > 0 && <span className="text-[9px]">Toque para selecionar</span>}
                                        </span>

                                        <div className="max-h-56 overflow-y-auto space-y-1.5 custom-scrollbar pr-1 border border-slate-150 dark:border-slate-800 rounded-2xl p-2 bg-slate-50/50 dark:bg-slate-850/30">
                                            {isLoadingStock ? (
                                                <p className="text-center py-6 text-xs text-slate-400 animate-pulse">Carregando catálogo...</p>
                                            ) : filteredWheels.length === 0 ? (
                                                <div className="text-center py-6 text-xs text-slate-400">
                                                    <p className="font-bold">Nenhuma roda encontrada para "{wheelSearchQuery}".</p>
                                                    <p className="text-[10px] text-slate-400 mt-1">Tente pesquisar apenas "15" ou "4x100" ou limpar o filtro.</p>
                                                </div>
                                            ) : (
                                                filteredWheels.map(item => {
                                                    const isSelected = selectedWheel?.codigo === item.codigo;
                                                    const aro = extractAro(item.descricao).replace('"', '');
                                                    const furacao = extractFuracao(item.descricao);
                                                    const { finishAbbr } = getModelAndFinish(item.descricao);
                                                    const photo = getWheelPhotoUrl(item.descricao, item.codigo);

                                                    return (
                                                        <div
                                                            key={item.codigo}
                                                            onClick={() => setSelectedWheel(item)}
                                                            className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-center gap-3 ${
                                                                isSelected
                                                                    ? 'bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-500 shadow-xs ring-1 ring-indigo-500'
                                                                    : 'bg-white dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/60 hover:border-indigo-300'
                                                            }`}
                                                        >
                                                            {/* Miniatura */}
                                                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 shrink-0 border border-slate-200 dark:border-slate-600">
                                                                <img 
                                                                    src={photo} 
                                                                    alt="" 
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => (e.currentTarget.src = "https://placehold.co/100x100?text=RODA")}
                                                                />
                                                            </div>

                                                            {/* Info */}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                                    <span className="font-mono text-[10px] font-black px-1.5 py-0.2 bg-slate-900 text-white rounded">
                                                                        {item.codigo}
                                                                    </span>
                                                                    {aro && (
                                                                        <span className="text-[9px] font-black px-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded">
                                                                            Aro {aro}
                                                                        </span>
                                                                    )}
                                                                    {furacao && (
                                                                        <span className="text-[9px] font-black px-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded">
                                                                            {furacao}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate leading-snug">
                                                                    {item.descricao}
                                                                </h4>
                                                            </div>

                                                            {isSelected && (
                                                                <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* CARD EM DESTAQUE DA RODA SELECIONADA */}
                                    {currentWheelDetails && (
                                        <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-900/50 rounded-2xl flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-white dark:bg-slate-800 border border-indigo-200 shrink-0 shadow-xs">
                                                <img 
                                                    src={currentWheelDetails.photoUrl} 
                                                    alt="Roda Selecionada"
                                                    className="w-full h-full object-cover" 
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">
                                                        Roda Selecionada ({currentWheelDetails.codigo})
                                                    </span>
                                                </div>
                                                <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                                                    {currentWheelDetails.descricao}
                                                </p>
                                                <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 mt-1">
                                                    {currentWheelDetails.aro && <span>Aro: {currentWheelDetails.aro}</span>}
                                                    {currentWheelDetails.furacao && <span>• {currentWheelDetails.furacao}</span>}
                                                    {currentWheelDetails.finish && <span>• {currentWheelDetails.finish}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* SEÇÃO: CONTROLE DE QUALIDADE / COM DEFEITO */}
                                    <div className={`p-4 rounded-2xl border transition-all duration-200 space-y-3 ${
                                        hasDefect
                                            ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900/60 shadow-xs'
                                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60'
                                    }`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <ShieldAlert className={`w-4 h-4 ${hasDefect ? 'text-rose-600' : 'text-slate-400'}`} />
                                                <span className={`text-xs font-black uppercase tracking-wider ${hasDefect ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                    Roda com Defeito / Avaria
                                                </span>
                                            </div>

                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={hasDefect} 
                                                    onChange={e => setHasDefect(e.target.checked)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-10 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                                            </label>
                                        </div>

                                        {/* Detalhes do Defeito quando ativado */}
                                        {hasDefect && (
                                            <div className="space-y-2.5 pt-2 border-t border-rose-200 dark:border-rose-900/40">
                                                <label className="text-[10px] font-black text-rose-700 dark:text-rose-300 uppercase tracking-widest block">
                                                    Descrição do Defeito / Motivo do Bloqueio:
                                                </label>
                                                <input 
                                                    type="text"
                                                    placeholder="Descreva o defeito (ex: Arranhão na borda, defeito na pintura)..."
                                                    value={defectReason}
                                                    onChange={e => setDefectReason(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-900 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 outline-none focus:ring-2 focus:ring-rose-500 placeholder:text-rose-300"
                                                />

                                                {/* Sugestões Rápidas de Defeito */}
                                                <div>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                                                        Sugestões Rápidas:
                                                    </span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {COMMON_DEFECTS.map(item => (
                                                            <button
                                                                key={item}
                                                                type="button"
                                                                onClick={() => setDefectReason(item)}
                                                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                                                    defectReason === item
                                                                        ? 'bg-rose-600 text-white shadow-xs'
                                                                        : 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 hover:bg-rose-100'
                                                                }`}
                                                            >
                                                                {item}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Quantidade de Cópias (Jogo de Rodas) */}
                                    <div className="pt-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                                            Quantidade de Etiquetas a Imprimir
                                        </label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {[1, 2, 4, 8].map(qty => (
                                                <button
                                                    key={qty}
                                                    onClick={() => setWheelCopies(qty)}
                                                    className={`py-2 rounded-xl text-xs font-black transition-all ${
                                                        wheelCopies === qty
                                                            ? hasDefect ? 'bg-rose-600 text-white shadow-xs' : 'bg-indigo-600 text-white shadow-xs'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    {qty === 4 ? '4 (Jogo)' : qty === 2 ? '2 (Par)' : `${qty} un.`}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* FORMULÁRIO DE VOLUME & DESTINATÁRIO */}
                            {activeType === 'volume' && (
                                <div className="space-y-4">
                                    {/* Topo: Título e Ações Rápidas de Clientes */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                                            <Truck className="w-4 h-4 text-indigo-500" />
                                            Dados da Expedição / Volumes
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingCustomer(null);
                                                    setCustomerModalMode('list');
                                                    setShowCustomerModal(true);
                                                }}
                                                className="px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                                            >
                                                <Users className="w-3.5 h-3.5" />
                                                Gerenciar Clientes ({customers.length})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSaveCurrentAsCustomer}
                                                className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                                                title="Salvar os dados preenchidos no cadastro de clientes"
                                            >
                                                <UserPlus className="w-3.5 h-3.5 text-emerald-500" />
                                                Salvar Cliente
                                            </button>
                                        </div>
                                    </div>

                                    {/* Campo de Busca Rápida de Clientes Cadastrados */}
                                    <div className="relative">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                            Buscar Cliente Cadastrado (Preenchimento Rápido)
                                        </label>
                                        <div className="relative">
                                            <input 
                                                type="text"
                                                placeholder="Digite nome, cidade, CPF/CNPJ ou telefone..."
                                                value={customerSearch}
                                                onChange={e => {
                                                    setCustomerSearch(e.target.value);
                                                    setIsSearchingCustomer(true);
                                                }}
                                                onFocus={() => setIsSearchingCustomer(true)}
                                                className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                                            {customerSearch && (
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        setCustomerSearch("");
                                                        setIsSearchingCustomer(false);
                                                    }}
                                                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Dropdown de Clientes Encontrados */}
                                        {isSearchingCustomer && customerSearch.trim().length > 0 && (
                                            <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                                                {filteredCustomers.length === 0 ? (
                                                    <div className="p-3 text-center text-xs text-slate-500">
                                                        Nenhum cliente cadastrado com esse nome. Preencha os campos abaixo e clique em <b>"Salvar Cliente"</b>.
                                                    </div>
                                                ) : (
                                                    filteredCustomers.map(cust => (
                                                        <button
                                                            key={cust.id}
                                                            type="button"
                                                            onClick={() => handleSelectCustomer(cust)}
                                                            className="w-full text-left p-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors flex items-center justify-between"
                                                        >
                                                            <div className="min-w-0 pr-2">
                                                                <div className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">{cust.name}</div>
                                                                <div className="text-[10px] text-slate-500 truncate">
                                                                    {cust.city}/{cust.state} • {cust.street}, {cust.number}
                                                                    {cust.phone ? ` • 📞 ${cust.phone}` : ''}
                                                                </div>
                                                            </div>
                                                            <span className="shrink-0 text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 rounded">
                                                                Usar
                                                            </span>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Identificação do Cliente */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="sm:col-span-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                Cliente / Destinatário *
                                            </label>
                                            <input 
                                                type="text"
                                                placeholder="Nome completo ou Razão Social..."
                                                value={volClient}
                                                onChange={e => setVolClient(e.target.value)}
                                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                Telefone / WhatsApp
                                            </label>
                                            <input 
                                                type="text"
                                                placeholder="(00) 00000-0000"
                                                value={volPhone}
                                                onChange={e => setVolPhone(e.target.value)}
                                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Bloco de Endereço Completo & Buscador de CEP */}
                                    <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/60 rounded-2xl space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                                <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                                                Endereço Completo de Entrega
                                            </span>
                                        </div>

                                        {/* Linha CEP e Logradouro */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                    CEP (Buscador Automático)
                                                </label>
                                                <div className="relative flex items-center">
                                                    <input 
                                                        type="text"
                                                        maxLength={9}
                                                        placeholder="00000-000"
                                                        value={volCep}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            setVolCep(val);
                                                            const digits = val.replace(/\D/g, '');
                                                            if (digits.length === 8) {
                                                                handleSearchCep(digits);
                                                            }
                                                        }}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleSearchCep();
                                                            }
                                                        }}
                                                        className="w-full pl-3 pr-10 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSearchCep()}
                                                        disabled={isLoadingCep}
                                                        className="absolute right-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black transition-colors cursor-pointer flex items-center gap-1"
                                                        title="Buscar CEP no ViaCEP"
                                                    >
                                                        {isLoadingCep ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <Search className="w-3 h-3" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="sm:col-span-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                    Rua / Logradouro *
                                                </label>
                                                <input 
                                                    type="text"
                                                    placeholder="Ex: Av. Brasil, Rua das Flores..."
                                                    value={volStreet}
                                                    onChange={e => setVolStreet(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </div>

                                        {/* Linha Número, Complemento, Bairro */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                    Número *
                                                </label>
                                                <input 
                                                    type="text"
                                                    placeholder="Ex: 1200 ou S/N"
                                                    value={volNumber}
                                                    onChange={e => setVolNumber(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                    Complemento
                                                </label>
                                                <input 
                                                    type="text"
                                                    placeholder="Galpão, Apto, Sala..."
                                                    value={volComplement}
                                                    onChange={e => setVolComplement(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                    Bairro
                                                </label>
                                                <input 
                                                    type="text"
                                                    placeholder="Ex: Centro, Industrial..."
                                                    value={volNeighborhood}
                                                    onChange={e => setVolNeighborhood(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </div>

                                        {/* Linha Cidade e UF */}
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                            <div className="col-span-2 sm:col-span-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                    Cidade *
                                                </label>
                                                <input 
                                                    type="text"
                                                    placeholder="Ex: Curitiba, São Paulo..."
                                                    value={volCity}
                                                    onChange={e => setVolCity(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                    UF / Estado *
                                                </label>
                                                <input 
                                                    type="text"
                                                    maxLength={2}
                                                    placeholder="PR"
                                                    value={volState}
                                                    onChange={e => setVolState(e.target.value.toUpperCase())}
                                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-black uppercase text-center outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Dados da Expedição */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                Número do Pedido / NF
                                            </label>
                                            <input 
                                                type="text"
                                                placeholder="Ex: PED-8945 ou ROM-12"
                                                value={volOrderNumber}
                                                onChange={e => setVolOrderNumber(e.target.value)}
                                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                Transportadora
                                            </label>
                                            <input 
                                                type="text"
                                                placeholder="Ex: Braspress, Rodonaves..."
                                                value={volCarrier}
                                                onChange={e => setVolCarrier(e.target.value)}
                                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                Total de Volumes
                                            </label>
                                            <input 
                                                type="number"
                                                min={1}
                                                max={100}
                                                value={volTotal}
                                                onChange={e => setVolTotal(Number(e.target.value) || 1)}
                                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500 text-indigo-600 dark:text-indigo-400"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                            Observações / Conteúdo da Embalagem
                                        </label>
                                        <input 
                                            type="text"
                                            placeholder="Ex: 4x RODAS C10 ARO 15 4X100 BD"
                                            value={volNotes}
                                            onChange={e => setVolNotes(e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* FORMULÁRIO DE LOCALIZAÇÃO */}
                            {activeType === 'location' && (
                                <div className="space-y-4">
                                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-indigo-500" />
                                        Endereçamento de Estoque
                                    </h3>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                            Identificação da Posição / Rua
                                        </label>
                                        <input 
                                            type="text"
                                            value={locPosition}
                                            onChange={e => setLocPosition(e.target.value)}
                                            placeholder="Ex: RUA A - PRAT. 04 ou A-01-01"
                                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                            Setor / Almoxarifado
                                        </label>
                                        <input 
                                            type="text"
                                            value={locSection}
                                            onChange={e => setLocSection(e.target.value)}
                                            placeholder="Ex: Almoxarifado Central"
                                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                            Quantidade de Cópias
                                        </label>
                                        <input 
                                            type="number"
                                            min={1}
                                            max={50}
                                            value={locCopies}
                                            onChange={e => setLocCopies(Number(e.target.value) || 1)}
                                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* FORMULÁRIO PERSONALIZADO */}
                            {activeType === 'custom' && (
                                <div className="space-y-4">
                                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-indigo-500" />
                                        Etiqueta Livre
                                    </h3>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                            Título Principal
                                        </label>
                                        <input 
                                            type="text"
                                            value={customTitle}
                                            onChange={e => setCustomTitle(e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                            Subtítulo / Descrição
                                        </label>
                                        <input 
                                            type="text"
                                            value={customSubtitle}
                                            onChange={e => setCustomSubtitle(e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                Código / Barcode
                                            </label>
                                            <input 
                                                type="text"
                                                value={customCode}
                                                onChange={e => setCustomCode(e.target.value)}
                                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                Cópias
                                            </label>
                                            <input 
                                                type="number"
                                                min={1}
                                                max={100}
                                                value={customCopies}
                                                onChange={e => setCustomCopies(Number(e.target.value) || 1)}
                                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* MODO DE IMPRESSÃO (NORMAL A4 vs TÉRMICA) */}
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                                    Modo de Impressão
                                </label>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPrintFormat('normal');
                                            setPreviewView('sheet');
                                        }}
                                        className={`p-3 rounded-2xl border text-left transition-all relative ${
                                            printFormat === 'normal'
                                                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-600 ring-2 ring-indigo-500/20 text-indigo-900 dark:text-indigo-200'
                                                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <FileText className={`w-4 h-4 ${printFormat === 'normal' ? 'text-indigo-600' : 'text-slate-400'}`} />
                                            <span className="text-xs font-black">Folha A4</span>
                                        </div>
                                        <p className="text-[10px] opacity-75 leading-tight font-medium">
                                            Várias na mesma folha (Comum / Laser / Jato / Adesiva)
                                        </p>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPrintFormat('thermal');
                                            setPreviewView('single');
                                        }}
                                        className={`p-3 rounded-2xl border text-left transition-all relative ${
                                            printFormat === 'thermal'
                                                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-600 ring-2 ring-indigo-500/20 text-indigo-900 dark:text-indigo-200'
                                                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <Printer className={`w-4 h-4 ${printFormat === 'thermal' ? 'text-indigo-600' : 'text-slate-400'}`} />
                                            <span className="text-xs font-black">Térmica</span>
                                        </div>
                                        <p className="text-[10px] opacity-75 leading-tight font-medium">
                                            1 por etiqueta / rolo contínuo (Zebra / Elgin)
                                        </p>
                                    </button>
                                </div>
                            </div>

                            {/* SE FOR TÉRMICA: TAMANHO DA ETIQUETA */}
                            {printFormat === 'thermal' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                                        Dimensões da Etiqueta Térmica
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: '100x50', label: '100 x 50 mm', desc: 'Padrão Zebra' },
                                            { id: '100x80', label: '100 x 80 mm', desc: 'Grande c/ Foto' },
                                            { id: '80x40', label: '80 x 40 mm', desc: 'Compacta' }
                                        ].map(size => (
                                            <button
                                                key={size.id}
                                                type="button"
                                                onClick={() => setLabelSize(size.id as LabelSize)}
                                                className={`p-2.5 rounded-xl border text-center transition-all ${
                                                    labelSize === size.id
                                                        ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-600 text-indigo-600 dark:text-indigo-400 font-black'
                                                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold'
                                                }`}
                                            >
                                                <div className="text-xs">{size.label}</div>
                                                <div className="text-[9px] opacity-70 mt-0.5">{size.desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* SE FOR FOLHA NORMAL A4: INFORMAÇÕES DE CORTE */}
                            {printFormat === 'normal' && (
                                <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40 rounded-xl flex items-start gap-2.5">
                                    <Scissors className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                                    <div className="text-[11px] text-slate-600 dark:text-slate-300">
                                        <span className="font-bold text-slate-900 dark:text-white block mb-0.5">Grade em Folha A4 (2 Colunas)</span>
                                        Todas as etiquetas são agrupadas na mesma página com marcações tracejadas para corte com tesoura ou estilete.
                                    </div>
                                </div>
                            )}

                            {/* OPÇÕES VISUAIS */}
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                    Elementos Visuais
                                </label>
                                <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    <label className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">
                                        <input 
                                            type="checkbox" 
                                            checked={showLogo} 
                                            onChange={e => setShowLogo(e.target.checked)}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span>Logo MKR</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">
                                        <input 
                                            type="checkbox" 
                                            checked={showBarcode} 
                                            onChange={e => setShowBarcode(e.target.checked)}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span>Código de Barras</span>
                                    </label>

                                    {activeType === 'wheel' && (
                                        <label className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">
                                            <input 
                                                type="checkbox" 
                                                checked={showPhoto} 
                                                onChange={e => setShowPhoto(e.target.checked)}
                                                className="rounded text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span>Foto da Roda</span>
                                        </label>
                                    )}

                                    <label className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">
                                        <input 
                                            type="checkbox" 
                                            checked={showDate} 
                                            onChange={e => setShowDate(e.target.checked)}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span>Data Atual</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* COLUNA DIREITA: Pré-visualização ao Vivo em Escala Real (7 Colunas) */}
                    <div className="lg:col-span-7 space-y-6">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                                <div>
                                    <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                        <Eye className="w-5 h-5 text-indigo-500" />
                                        Pré-visualização
                                    </h3>
                                    <p className="text-xs text-slate-400 font-medium">
                                        {printFormat === 'normal' 
                                            ? `Folha A4 com ${activeLabels.length} ${activeLabels.length === 1 ? 'etiqueta' : 'etiquetas'} na mesma página` 
                                            : `Rolo Térmico individual (${labelSize} mm)`
                                        }
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Alternador de visualização da prévia */}
                                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                        <button
                                            type="button"
                                            onClick={() => setPreviewView('sheet')}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                                                previewView === 'sheet'
                                                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                            }`}
                                            title="Ver todas as etiquetas dispostas na folha A4"
                                        >
                                            <Grid className="w-3.5 h-3.5" />
                                            <span>Folha A4</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPreviewView('single')}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                                                previewView === 'single'
                                                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                            }`}
                                            title="Ver etiqueta individual em destaque"
                                        >
                                            <Square className="w-3.5 h-3.5" />
                                            <span>Individual</span>
                                        </button>
                                    </div>

                                    {hasDefect && (
                                        <span className="px-2.5 py-1 bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 text-xs font-black rounded-lg border border-rose-200 dark:border-rose-900">
                                            ⚠️ DEFEITO
                                        </span>
                                    )}

                                    {printFormat === 'thermal' && (
                                        <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-black rounded-lg">
                                            {labelSize === '100x50' ? '100x50' : labelSize === '100x80' ? '100x80' : '80x40'} mm
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* CONTAINER DE PRÉ-VISUALIZAÇÃO */}
                            <div className="flex flex-col items-center justify-center p-4 sm:p-7 bg-slate-100/70 dark:bg-slate-950/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                                {activeLabels.length === 0 ? (
                                    <p className="text-sm font-bold text-slate-400">Nenhuma etiqueta para exibir.</p>
                                ) : previewView === 'sheet' ? (
                                    /* PRÉVIA DA FOLHA A4 COMPLETA COM TODAS AS ETIQUETAS JUNTAS */
                                    <div className="w-full max-w-[580px] bg-white text-slate-900 rounded-2xl shadow-xl border border-slate-300 p-4 sm:p-5 relative select-none">
                                        {/* Barra de identificação da folha */}
                                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                                            <div className="flex items-center gap-2">
                                                <span className="p-1 bg-indigo-50 text-indigo-600 rounded">
                                                    <FileText className="w-4 h-4" />
                                                </span>
                                                <span className="text-xs font-black text-slate-800">
                                                    Folha A4 (Padrão 210 x 297 mm)
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                {activeLabels.length} {activeLabels.length === 1 ? 'etiqueta na folha' : 'etiquetas na mesma folha'}
                                            </span>
                                        </div>

                                        {/* Grade de 2 colunas com as etiquetas na mesma folha */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {activeLabels.map((lbl, idx) => (
                                                <A4CardComponent 
                                                    key={lbl.id} 
                                                    label={lbl} 
                                                    index={idx}
                                                    showLogo={showLogo}
                                                    showDate={showDate}
                                                    showPhoto={showPhoto}
                                                    showBarcode={showBarcode}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    /* Renderização da Primeira Etiqueta em Destaque (Individual) */
                                    <ThermalCardComponent
                                        label={activeLabels[0]}
                                        index={0}
                                        labelSize={labelSize}
                                        showLogo={showLogo}
                                        showDate={showDate}
                                        showPhoto={showPhoto}
                                        showBarcode={showBarcode}
                                    />
                                )}
                            </div>

                            {/* Lista de Cópias / Volumes Gerados */}
                            {activeLabels.length > 1 && (
                                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs font-bold text-slate-500">
                                            Todas as {activeLabels.length} etiquetas que serão impressas:
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                        {activeLabels.map((lbl, idx) => (
                                            <div 
                                                key={lbl.id}
                                                className={`p-2.5 border rounded-xl text-center ${
                                                    lbl.hasDefect
                                                        ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900'
                                                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60'
                                                }`}
                                            >
                                                <span className={`text-[10px] font-black block mb-0.5 ${lbl.hasDefect ? 'text-rose-600' : 'text-slate-400'}`}>
                                                    {lbl.hasDefect ? '⚠️ COM DEFEITO' : `ETIQUETA #${idx + 1}`}
                                                </span>
                                                <span className="text-xs font-black text-slate-800 dark:text-slate-100 truncate block">
                                                    {lbl.type === 'volume' ? `Vol. ${lbl.volumeCurrent}/${lbl.volumeTotal}` : lbl.code}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            {/* MODAL DE GERENCIAMENTO DE CLIENTES */}
            <AnimatePresence>
                {showCustomerModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
                        >
                            {/* Header do Modal */}
                            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-base text-slate-900 dark:text-white">
                                            {customerModalMode === 'list' && "Cadastro de Clientes de Envio"}
                                            {customerModalMode === 'create' && "Novo Cliente de Envio"}
                                            {customerModalMode === 'edit' && "Editar Cliente"}
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            {customerModalMode === 'list' && `${customers.length} cliente(s) cadastrados no sistema`}
                                            {customerModalMode !== 'list' && "Preencha os dados e o endereço completo"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {customerModalMode === 'list' ? (
                                        <button
                                            type="button"
                                            onClick={handleOpenCreateCustomer}
                                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Novo Cliente
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCustomerModalMode('list');
                                                setEditingCustomer(null);
                                            }}
                                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                        >
                                            Ver Lista
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setShowCustomerModal(false)}
                                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Conteúdo do Modal */}
                            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
                                {customerModalMode === 'list' ? (
                                    <>
                                        {/* Barra de Busca no Modal */}
                                        <div className="relative">
                                            <input 
                                                type="text"
                                                placeholder="Filtrar por nome, cidade ou telefone..."
                                                value={customerSearch}
                                                onChange={e => setCustomerSearch(e.target.value)}
                                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                                        </div>

                                        {/* Lista de Clientes */}
                                        {filteredCustomers.length === 0 ? (
                                            <div className="text-center py-10 text-slate-400">
                                                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                                <p className="text-sm font-bold">Nenhum cliente cadastrado.</p>
                                                <p className="text-xs text-slate-500 mt-1">Clique no botão "+ Novo Cliente" para adicionar.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2.5">
                                                {filteredCustomers.map(cust => (
                                                    <div 
                                                        key={cust.id}
                                                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <h4 className="font-black text-sm text-slate-900 dark:text-white truncate">
                                                                    {cust.name}
                                                                </h4>
                                                                {cust.doc && (
                                                                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded font-bold">
                                                                        {cust.doc}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                                                                {cust.street ? `${cust.street}, nº ${cust.number || 'S/N'}${cust.complement ? ' (' + cust.complement + ')' : ''}` : 'Endereço pendente'}
                                                            </p>
                                                            <p className="text-[11px] text-slate-500">
                                                                {cust.neighborhood ? `${cust.neighborhood} • ` : ''}
                                                                <b>{cust.city}/{cust.state}</b>
                                                                {cust.cep ? ` • CEP: ${cust.cep}` : ''}
                                                                {cust.phone ? ` • Tel: ${cust.phone}` : ''}
                                                                {cust.carrier ? ` • Transp: ${cust.carrier}` : ''}
                                                            </p>
                                                        </div>

                                                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSelectCustomer(cust)}
                                                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                                            >
                                                                <Check className="w-3.5 h-3.5" />
                                                                Usar
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenEditCustomer(cust)}
                                                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 transition-colors cursor-pointer"
                                                                title="Editar cliente"
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteCustomer(cust.id, cust.name)}
                                                                className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                                                                title="Excluir cliente"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    /* Formulário de Criação / Edição de Cliente no Modal */
                                    <div className="space-y-3.5">
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div className="sm:col-span-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                    Nome / Razão Social *
                                                </label>
                                                <input 
                                                    type="text"
                                                    placeholder="Nome completo do cliente ou empresa..."
                                                    value={custModalName}
                                                    onChange={e => setCustModalName(e.target.value)}
                                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                    CPF / CNPJ
                                                </label>
                                                <input 
                                                    type="text"
                                                    placeholder="000.000.000-00"
                                                    value={custModalDoc}
                                                    onChange={e => setCustModalDoc(e.target.value)}
                                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                    Telefone / WhatsApp
                                                </label>
                                                <input 
                                                    type="text"
                                                    placeholder="(00) 00000-0000"
                                                    value={custModalPhone}
                                                    onChange={e => setCustModalPhone(e.target.value)}
                                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                    Transportadora Preferencial
                                                </label>
                                                <input 
                                                    type="text"
                                                    placeholder="Ex: Braspress, Rodonaves..."
                                                    value={custModalCarrier}
                                                    onChange={e => setCustModalCarrier(e.target.value)}
                                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </div>

                                        {/* Endereço */}
                                        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl space-y-3">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                                                Endereço de Entrega
                                            </span>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div>
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                        CEP (ViaCEP)
                                                    </label>
                                                    <div className="relative flex items-center">
                                                        <input 
                                                            type="text"
                                                            maxLength={9}
                                                            placeholder="00000-000"
                                                            value={custModalCep}
                                                            onChange={e => setCustModalCep(e.target.value)}
                                                            className="w-full pl-3 pr-9 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={handleSearchModalCep}
                                                            disabled={isLoadingModalCep}
                                                            className="absolute right-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black transition-colors cursor-pointer"
                                                            title="Buscar CEP"
                                                        >
                                                            {isLoadingModalCep ? (
                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                            ) : (
                                                                <Search className="w-3 h-3" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="sm:col-span-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                        Rua / Logradouro *
                                                    </label>
                                                    <input 
                                                        type="text"
                                                        placeholder="Ex: Av. Central..."
                                                        value={custModalStreet}
                                                        onChange={e => setCustModalStreet(e.target.value)}
                                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                <div>
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                        Número *
                                                    </label>
                                                    <input 
                                                        type="text"
                                                        placeholder="120 ou S/N"
                                                        value={custModalNumber}
                                                        onChange={e => setCustModalNumber(e.target.value)}
                                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                        Complemento
                                                    </label>
                                                    <input 
                                                        type="text"
                                                        placeholder="Galpão, Sala..."
                                                        value={custModalComplement}
                                                        onChange={e => setCustModalComplement(e.target.value)}
                                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                        Bairro
                                                    </label>
                                                    <input 
                                                        type="text"
                                                        placeholder="Bairro..."
                                                        value={custModalNeighborhood}
                                                        onChange={e => setCustModalNeighborhood(e.target.value)}
                                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                                <div className="col-span-2 sm:col-span-3">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                        Cidade *
                                                    </label>
                                                    <input 
                                                        type="text"
                                                        placeholder="Cidade..."
                                                        value={custModalCity}
                                                        onChange={e => setCustModalCity(e.target.value)}
                                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                        UF *
                                                    </label>
                                                    <input 
                                                        type="text"
                                                        maxLength={2}
                                                        placeholder="UF"
                                                        value={custModalState}
                                                        onChange={e => setCustModalState(e.target.value.toUpperCase())}
                                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-black uppercase text-center outline-none focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Ações do Form */}
                                        <div className="flex items-center justify-end gap-2 pt-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setCustomerModalMode('list');
                                                    setEditingCustomer(null);
                                                }}
                                                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSaveModalCustomer}
                                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                                            >
                                                <Check className="w-3.5 h-3.5" />
                                                Salvar Cliente
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ÁREA DE IMPRESSÃO / EXPORTAÇÃO FOLHA A4 (ATÉ 8 ETIQUETAS POR FOLHA) */}
            <div id="normal-a4-print-area" className="hidden print:block">
                {a4Pages.map((pageLabels, pageIdx) => (
                    <div 
                        key={pageIdx} 
                        className="a4-export-page a4-print-page bg-white text-slate-900"
                        style={{
                            width: '210mm',
                            minWidth: '210mm',
                            minHeight: '297mm',
                            padding: '8mm',
                            boxSizing: 'border-box',
                            backgroundColor: '#ffffff'
                        }}
                    >
                        <div className="a4-print-grid grid grid-cols-2 gap-3">
                            {pageLabels.map((lbl, idx) => (
                                <A4CardComponent 
                                    key={lbl.id} 
                                    label={lbl} 
                                    index={pageIdx * 8 + idx}
                                    showLogo={showLogo}
                                    showDate={showDate}
                                    showPhoto={showPhoto}
                                    showBarcode={showBarcode}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* ÁREA DE IMPRESSÃO / EXPORTAÇÃO TÉRMICA (1 ETIQUETA POR PÁGINA) */}
            <div id="thermal-print-area" className="hidden print:block">
                {activeLabels.map((label, idx) => (
                    <div key={label.id} className="thermal-label-page flex justify-center items-center">
                        <ThermalCardComponent
                            label={label}
                            index={idx}
                            labelSize={labelSize}
                            showLogo={showLogo}
                            showDate={showDate}
                            showPhoto={showPhoto}
                            showBarcode={showBarcode}
                            isPrintOrExport={true}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};
