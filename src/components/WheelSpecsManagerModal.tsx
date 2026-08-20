import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Plus, Trash2, Edit2, RotateCcw, Search, Check, Disc, Settings, ChevronDown, Sparkles } from 'lucide-react';
import photoMap from '../data/photoMap.json';
import { StockItem } from '../types';
import { parseWheelSpecs } from '../utils/photoUtils';
import {
    WheelSpecOverride,
    getWheelSpecOverrides,
    saveWheelSpecOverride,
    deleteWheelSpecOverride,
    resetWheelSpecOverrides,
    getRingColorBySpecs
} from '../utils/wheelSpecsStore';
import {
    getCloudWheelSpecs,
    saveCloudWheelSpec,
    deleteCloudWheelSpec,
    saveCloudWheelSpecsBatch
} from '../lib/supabase';

interface WheelSpecsManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdated?: () => void;
    stock?: StockItem[];
}

const COLOR_PRESETS = [
    { label: 'Laranja (57.1mm)', value: '#f97316' },
    { label: 'Azul (56.6mm / 56.1mm)', value: '#2563eb' },
    { label: 'Amarelo (58.1mm)', value: '#eab308' },
    { label: 'Preto (64.1mm)', value: '#0f172a' },
    { label: 'Preto Claro (64.1mm)', value: '#475569' },
    { label: 'Cinza (106.1mm / 100.1mm)', value: '#64748b' },
    { label: 'Verde (63.4mm)', value: '#16a34a' },
    { label: 'Branco (65.1mm)', value: '#f8fafc' },
    { label: 'Vermelho (54.1mm)', value: '#ef4444' },
];

const MM_PRESETS = ['54.1', '56.1', '56.5', '56.6', '57.1', '58.1', '60.1', '63.4', '63.5', '64.1', '65.1', '66.1', '66.6', '67.1', '72.6', '74.1', '80.9', '83.8', '93.1', '100.1', '106.1'];
const PCD_PRESETS = ['4X98', '4X100', '4X108', '4X130', '5X98', '5X100', '5X105', '5X108', '5X110', '5X112', '5X114', '5X120', '5X139', '6X114', '6X139', '8X165'];
const ARO_PRESETS = ['13', '14', '15', '16', '17', '18', '19', '20', '22'];

const CustomMmSelect: React.FC<{
    value: string;
    type: 'ANEL' | 'CUBO';
    onChange: (mm: string) => void;
}> = ({ value, type, onChange }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        if (open) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    const currentColor = getRingColorBySpecs(value, type);

    return (
        <div className="relative w-full" ref={ref} onClick={(e) => e.stopPropagation()}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full h-8 px-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-800 dark:text-white flex items-center justify-between shadow-sm hover:border-indigo-400 transition-all"
            >
                <div className="flex items-center gap-1.5 overflow-hidden">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: currentColor }} />
                    <span className="truncate">{value || '57.1'} MM</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 max-h-56 overflow-y-auto p-1.5 space-y-0.5 animate-in fade-in">
                    {MM_PRESETS.map(m => {
                        const col = getRingColorBySpecs(m, type);
                        const isSelected = value === m;
                        return (
                            <button
                                key={m}
                                type="button"
                                onClick={() => {
                                    onChange(m);
                                    setOpen(false);
                                }}
                                className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center justify-between transition-colors ${
                                    isSelected 
                                        ? 'bg-indigo-600 text-white' 
                                        : 'text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: col }} />
                                    <span>{m} MM</span>
                                </div>
                                {isSelected && <Check className="w-3.5 h-3.5" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// Novo componente de múltipla seleção para Aros
const CustomMultiAroSelect: React.FC<{
    values: string[];
    onChange: (aros: string[]) => void;
}> = ({ values, onChange }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    const displayText = values.length === 0 || (values.length === 1 && values[0] === '') 
        ? 'Geral (Sem Aro)' 
        : `Aro(s) ${values.join(', ')}`;

    return (
        <div className="relative w-full" ref={ref} onClick={(e) => e.stopPropagation()}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white flex items-center justify-between shadow-sm hover:border-indigo-400 transition-all"
            >
                <span className="truncate">{displayText}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 max-h-52 overflow-y-auto p-1.5 space-y-0.5 animate-in fade-in">
                    <button
                        type="button"
                        onClick={() => { onChange([]); setOpen(false); }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black flex items-center justify-between transition-colors ${
                            values.length === 0 ? 'bg-indigo-600 text-white' : 'text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60'
                        }`}
                    >
                        <span>Geral (Sem Aro)</span>
                        {values.length === 0 && <Check className="w-3.5 h-3.5" />}
                    </button>
                    {ARO_PRESETS.map(a => {
                        const isSelected = values.includes(a);
                        return (
                            <button
                                key={a}
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (isSelected) {
                                        onChange(values.filter(v => v !== a));
                                    } else {
                                        onChange([...values.filter(v => v !== ''), a].sort((x, y) => parseInt(x) - parseInt(y)));
                                    }
                                }}
                                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black flex items-center justify-between transition-colors ${
                                    isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60'
                                }`}
                            >
                                <span className={isSelected ? 'text-indigo-600 dark:text-indigo-400' : ''}>Aro {a}</span>
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                    isSelected 
                                        ? 'bg-indigo-600 border-indigo-600' 
                                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                                }`}>
                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const CustomTypeSelect: React.FC<{
    value: 'ANEL' | 'CUBO';
    onChange: (type: 'ANEL' | 'CUBO') => void;
}> = ({ value, onChange }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    return (
        <div className="relative w-full" ref={ref} onClick={(e) => e.stopPropagation()}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white flex items-center justify-between shadow-sm hover:border-indigo-400 transition-all"
            >
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${value === 'ANEL' ? 'bg-amber-500' : 'bg-blue-600'}`} />
                    <span>{value === 'ANEL' ? 'ANEL CENTRALIZADOR' : 'CUBO ESP. (SEM ANEL)'}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 p-1.5 space-y-0.5 animate-in fade-in">
                    <button
                        type="button"
                        onClick={() => { onChange('ANEL'); setOpen(false); }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black flex items-center justify-between transition-colors ${
                            value === 'ANEL' ? 'bg-amber-500 text-white' : 'text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                            <span>ANEL CENTRALIZADOR</span>
                        </div>
                        {value === 'ANEL' && <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button
                        type="button"
                        onClick={() => { onChange('CUBO'); setOpen(false); }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black flex items-center justify-between transition-colors ${
                            value === 'CUBO' ? 'bg-blue-600 text-white' : 'text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-400" />
                            <span>CUBO ESP. (SEM ANEL)</span>
                        </div>
                        {value === 'CUBO' && <Check className="w-3.5 h-3.5" />}
                    </button>
                </div>
            )}
        </div>
    );
};

const CustomPcdSelect: React.FC<{
    value: string;
    onChange: (pcd: string) => void;
    options?: string[];
}> = ({ value, onChange, options }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    return (
        <div className="relative w-full" ref={ref} onClick={(e) => e.stopPropagation()}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full h-8 px-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-800 dark:text-white flex items-center justify-between shadow-sm hover:border-indigo-400 transition-all uppercase"
            >
                <span className="truncate">{value || '4X100'}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 max-h-56 overflow-y-auto p-1.5 space-y-0.5 animate-in fade-in">
                    {(options && options.length > 0 ? options : PCD_PRESETS).map(p => {
                        const isSelected = value === p;
                        return (
                            <button
                                key={p}
                                type="button"
                                onClick={() => {
                                    onChange(p);
                                    setOpen(false);
                                }}
                                className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center justify-between transition-colors ${
                                    isSelected 
                                        ? 'bg-indigo-600 text-white' 
                                        : 'text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60'
                                }`}
                            >
                                <span>{p}</span>
                                {isSelected && <Check className="w-3.5 h-3.5" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export const WheelSpecsManagerModal: React.FC<WheelSpecsManagerModalProps> = ({
    isOpen,
    onClose,
    onUpdated,
    stock = []
}) => {
    const [mappings, setMappings] = useState<WheelSpecOverride[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    const [selectedModel, setSelectedModel] = useState<string>('R06');
    const [modelSearchInput, setModelSearchInput] = useState<string>('R06');
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Mudança principal: aro agora é um array para suportar múltiplos. Vazio significa Geral (Todos os Aros)
    const [formAros, setFormAros] = useState<string[]>([]);
    const [pcd, setPcd] = useState<string>('4X100');
    const [type, setType] = useState<'ANEL' | 'CUBO'>('ANEL');
    const [mm, setMm] = useState<string>('57.1');
    const [ringColor, setRingColor] = useState<string>('#f97316');

    // Atualiza automaticamente as seleções padrão de furação/aro quando o modelo muda
    useEffect(() => {
        if (!selectedModel) return;
        const modelKey = selectedModel.trim().toUpperCase();
        const seenPcds = new Set<string>();
        
        stock.forEach(item => {
            const specs = parseWheelSpecs(item.descricao, item.codigo);
            if (specs.model?.toUpperCase() === modelKey && specs.furacao) {
                seenPcds.add(specs.furacao);
            }
        });
        
        const photoEntries = (photoMap as any)[modelKey];
        if (photoEntries) {
            Object.keys(photoEntries).forEach(key => {
                const upper = key.toUpperCase();
                const pcdMatch = upper.match(/\b(\d[XxX\*]\d{2,3}|\d[Ff])\b/);
                if (pcdMatch) {
                    const rawPcd = pcdMatch[1].replace('*', 'X');
                    if (rawPcd !== '4F' && rawPcd !== '5F' && rawPcd !== '6F') {
                        seenPcds.add(rawPcd);
                    }
                }
            });
        }
        
        const pcdList = Array.from(seenPcds);
        if (pcdList.length > 0) {
            setPcd(pcdList[0]);
        } else {
            setPcd('4X100');
        }
        
        setFormAros([]); // Inicia como Geral (Qualquer Aro)
    }, [selectedModel]);

    useEffect(() => {
        if (isOpen) {
            loadMappings();
        }
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (target && (target.tagName === 'SELECT' || target.tagName === 'OPTION' || target.closest('select'))) {
                return;
            }
            if (dropdownRef.current && !dropdownRef.current.contains(target as Node)) {
                setShowModelDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadMappings = async () => {
        // Carrega do localStorage imediatamente para a UI responder na hora
        const local = getWheelSpecOverrides();
        setMappings(local);

        try {
            // Busca os mapeamentos salvos no Supabase em segundo plano
            const cloudSpecs = await getCloudWheelSpecs();
            if (cloudSpecs && cloudSpecs.length > 0) {
                // Mescla as informações mantendo os dados da nuvem como prioritários
                const specMap = new Map<string, WheelSpecOverride>();
                local.forEach(item => specMap.set(item.id, item));
                cloudSpecs.forEach(item => specMap.set(item.id, item));
                const merged = Array.from(specMap.values());

                localStorage.setItem('leitor_wheel_specs_mappings_v5', JSON.stringify(merged));
                setMappings(merged);
            }
        } catch (err) {
            console.error('Erro ao carregar dados do Supabase:', err);
        }
    };

    const allKnownModels = useMemo(() => {
        const set = new Set<string>();
        Object.keys(photoMap || {}).forEach(m => set.add(m.toUpperCase()));
        stock.forEach(item => {
            const model = parseWheelSpecs(item.descricao, item.codigo).model;
            if (model) set.add(model.toUpperCase());
        });
        mappings.forEach(m => set.add(m.model.toUpperCase()));
        return Array.from(set).sort();
    }, [mappings, stock]);

    const popularModels = useMemo(() => {
        const priority = ['R06', 'K57', 'K58', 'M16', 'E55', 'R10', 'R82', 'R83', 'C10'];
        return priority.filter(m => allKnownModels.includes(m));
    }, [allKnownModels]);

    const suggestedModels = useMemo(() => {
        if (!modelSearchInput.trim()) return allKnownModels.slice(0, 15);
        const mUpper = modelSearchInput.trim().toUpperCase();
        return allKnownModels.filter(m => m.includes(mUpper)).slice(0, 15);
    }, [modelSearchInput, allKnownModels]);

    const catalogVariations = useMemo(() => {
        if (!selectedModel.trim()) return [];
        const modelKey = selectedModel.trim().toUpperCase();
        const photoEntries = (photoMap as any)[modelKey];

        const list: Array<{ id: string; aro: string; pcd: string; label: string }> = [];
        const seen = new Set<string>();

        const addVariation = (aroFound: string, pcdFound: string) => {
            if (!pcdFound) return;
            const vKey = `${aroFound}-${pcdFound}`;
            if (seen.has(vKey)) return;
            seen.add(vKey);
            list.push({
                id: vKey,
                aro: aroFound,
                pcd: pcdFound,
                label: `${aroFound ? `Aro ${aroFound}` : 'Geral'} - ${pcdFound}`
            });
        };

        stock.forEach(item => {
            const specs = parseWheelSpecs(item.descricao, item.codigo);
            if (specs.model?.toUpperCase() !== modelKey) return;
            addVariation(specs.aro || '', specs.furacao);
        });

        const FOUR_HOLE_PCDS = ['4X98', '4X100', '4X108'];
        const FIVE_HOLE_PCDS = ['5X100', '5X105', '5X108', '5X110', '5X112', '5X114', '5X120'];
        const SIX_HOLE_PCDS = ['6X114', '6X139'];

        if (list.length === 0 && photoEntries) {
            Object.keys(photoEntries).forEach(key => {
                const upper = key.toUpperCase();
                const pcdMatch = upper.match(/\b(\d[XxX\*]\d{2,3}|\d[Ff])\b/);
                const aroMatch = upper.match(/\b(\d{2}[Xx]\d{1,2}|\b1[3-9]\b|\b2[0-4]\b)\b/);

                const rawPcd = pcdMatch ? pcdMatch[1].replace('*', 'X') : '4X100';
                const aroFound = aroMatch ? aroMatch[1] : '';

                let pcdsToExpand = [rawPcd];
                if (rawPcd === '4F') pcdsToExpand = FOUR_HOLE_PCDS;
                else if (rawPcd === '5F') pcdsToExpand = FIVE_HOLE_PCDS;
                else if (rawPcd === '6F') pcdsToExpand = SIX_HOLE_PCDS;

                pcdsToExpand.forEach(pcdFound => addVariation(aroFound, pcdFound));
            });
        }

        mappings.filter(m => m.model === modelKey).forEach(m => {
            addVariation(m.aro || '', m.pcd);
        });

        if (list.length === 0) {
            list.push({ id: '15-4X100', aro: '15', pcd: '4X100', label: 'Aro 15 - 4X100' });
            list.push({ id: '17-4X100', aro: '17', pcd: '4X100', label: 'Aro 17 - 4X100' });
        }

        return list.sort((a, b) => parseInt(a.aro || '0') - parseInt(b.aro || '0'));
    }, [selectedModel, mappings, stock]);

    // Mapeia Aros e PCDs disponíveis no catálogo para exibição em lote
    const availablePcds = useMemo(() => {
        const pcds = Array.from(new Set(catalogVariations.map(v => v.pcd)))
            .filter((val): val is string => !!val)
            .sort();
        return pcds.length > 0 ? pcds : ['4X100', '4X108', '5X100', '5X112', '5X114'];
    }, [catalogVariations]);

    const availableAros = useMemo(() => {
        const aros = Array.from(new Set(catalogVariations.map(v => v.aro)))
            .filter((val): val is string => !!val)
            .sort((a, b) => parseInt(a) - parseInt(b));
        return aros.length > 0 ? aros : ['13', '14', '15', '16', '17', '18', '19', '20', '22'];
    }, [catalogVariations]);

    const pcdOptionsByAro = useMemo(() => {
        const allModelPcds = Array.from(new Set(catalogVariations.map(item => item.pcd))).filter(Boolean).sort();
        const byAro = new Map<string, string[]>();
        catalogVariations.forEach(item => {
            const key = item.aro || '';
            byAro.set(key, Array.from(new Set([...(byAro.get(key) || []), item.pcd])).filter(Boolean).sort());
        });
        return { all: allModelPcds, byAro };
    }, [catalogVariations]);

    if (!isOpen) return null;

    const chooseModel = (m: string) => {
        const mUpper = m.toUpperCase();
        setSelectedModel(mUpper);
        setModelSearchInput(mUpper);
        setShowModelDropdown(false);
        setEditingId(null);
    };

    const handleSaveSingle = async (overrideAro: string, overridePcd: string, overrideType: 'ANEL' | 'CUBO', overrideMm: string, overrideColor?: string) => {
        if (!selectedModel.trim()) return;

        const specData = {
            model: selectedModel.trim(),
            aro: overrideAro.trim() || undefined,
            pcd: overridePcd.trim(),
            type: overrideType,
            mm: overrideMm.trim(),
            ringColor: overrideColor || (overrideType === 'ANEL' ? '#f97316' : '#ea580c')
        };

        const updated = saveWheelSpecOverride(specData);
        setMappings(updated);
        if (onUpdated) onUpdated();

        // Envia para o Supabase em segundo plano
        const modelClean = specData.model.trim().toUpperCase();
        const pcdClean = specData.pcd.trim().toUpperCase();
        const aroClean = specData.aro ? specData.aro.trim().toUpperCase() : '';
        const id = `${modelClean}${aroClean ? `-${aroClean}` : ''}-${pcdClean}`;

        await saveCloudWheelSpec({
            id,
            ...specData
        });
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const arosToSave = formAros.length > 0 ? formAros : [''];
        const specsToSave: WheelSpecOverride[] = [];
        let updatedList = getWheelSpecOverrides();
        
        arosToSave.forEach(singleAro => {
            const modelClean = selectedModel.trim().toUpperCase();
            const pcdClean = pcd.trim().toUpperCase();
            const aroClean = singleAro.trim().toUpperCase();
            const id = `${modelClean}${aroClean ? `-${aroClean}` : ''}-${pcdClean}`;

            const spec: WheelSpecOverride = {
                id,
                model: selectedModel.trim(),
                aro: singleAro.trim() || undefined,
                pcd: pcd.trim(),
                type: type,
                mm: mm.trim(),
                ringColor: getRingColorBySpecs(mm.trim(), type)
            };

            updatedList = saveWheelSpecOverride(spec);
            specsToSave.push(spec);
        });
        
        setMappings(updatedList);
        if (onUpdated) onUpdated();

        // Envia o lote de dados para o Supabase
        await saveCloudWheelSpecsBatch(specsToSave);
        
        setEditingId(null);
        setFormAros([]);
    };

    const handleEditItem = (item: WheelSpecOverride) => {
        setEditingId(item.id);
        setSelectedModel(item.model);
        setModelSearchInput(item.model);
        setFormAros(item.aro ? [item.aro] : []);
        setPcd(item.pcd);
        setType(item.type);
        setMm(item.mm);
        setRingColor(item.ringColor || (item.type === 'ANEL' ? '#f97316' : '#ea580c'));
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja remover este mapeamento?')) {
            const updated = deleteWheelSpecOverride(id);
            setMappings(updated);
            if (editingId === id) setEditingId(null);
            if (onUpdated) onUpdated();

            // Remove do Supabase em segundo plano
            await deleteCloudWheelSpec(id);
        }
    };

    const handleReset = async () => {
        if (confirm('Deseja restaurar as configurações padrão do catálogo?')) {
            const updated = resetWheelSpecOverrides();
            setMappings(updated);
            setEditingId(null);
            if (onUpdated) onUpdated();

            // Salva as configurações padrão em lote na nuvem
            await saveCloudWheelSpecsBatch(updated);
        }
    };

    const filteredMappings = mappings.filter(m => 
        m.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.aro && m.aro.toLowerCase().includes(searchTerm.toLowerCase())) ||
        m.pcd.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.mm.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const selectedModelMappings = filteredMappings.filter(m => m.model === selectedModel);
    const savedMappingsToShow = selectedModelMappings.length > 0 || !searchTerm.trim()
        ? selectedModelMappings
        : filteredMappings;
    const mappedVariationCount = catalogVariations.filter(varItem => mappings.some(m =>
        m.model === selectedModel &&
        ((varItem.aro && m.aro === varItem.aro && m.pcd === varItem.pcd) || (!m.aro && m.pcd === varItem.pcd))
    )).length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 animate-in fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                            <Disc className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">
                                Mapeamento Técnico
                            </h2>
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                Cubo ou anel por modelo, aro e furação
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Main Content Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                    {/* Seletor de Modelo */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <label className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                                <Search className="w-4 h-4 text-indigo-500" />
                                Modelo
                            </label>
                            {selectedModel && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                        {mappedVariationCount}/{catalogVariations.length} mapeadas
                                    </span>
                                    <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-indigo-600 text-white shadow-sm">
                                        {selectedModel}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-3 items-start">
                            {/* Campo de Busca de Modelo com Autocomplete */}
                            <div className="relative" ref={dropdownRef}>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={modelSearchInput}
                                        onChange={(e) => {
                                            setModelSearchInput(e.target.value.toUpperCase());
                                            setSelectedModel(e.target.value.toUpperCase());
                                            setShowModelDropdown(true);
                                        }}
                                        onFocus={() => setShowModelDropdown(true)}
                                        placeholder="Digite o modelo. Ex: R06, K57, M16, E55"
                                        className="w-full h-11 pr-10 px-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-black text-sm uppercase text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowModelDropdown(!showModelDropdown)}
                                        className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    >
                                        <ChevronDown className="w-5 h-5" />
                                    </button>
                                </div>

                                {showModelDropdown && suggestedModels.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-30 max-h-52 overflow-y-auto p-1.5 space-y-0.5 animate-in fade-in">
                                        {suggestedModels.map(m => (
                                            <button
                                                key={m}
                                                type="button"
                                                onClick={() => chooseModel(m)}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-black flex items-center justify-between transition-colors ${
                                                    selectedModel === m 
                                                        ? 'bg-indigo-600 text-white' 
                                                        : 'text-slate-800 dark:text-slate-100 hover:bg-indigo-50 dark:hover:bg-indigo-900/40'
                                                }`}
                                            >
                                                <span>{m}</span>
                                                {mappings.some(map => map.model === m) && (
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                                        selectedModel === m 
                                                            ? 'bg-white/20 text-white' 
                                                            : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                                    }`}>
                                                        Configurado
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap lg:justify-end">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Rápidos:</span>
                                {popularModels.map(m => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => chooseModel(m)}
                                        className={`px-2.5 py-1.5 text-[11px] font-black rounded-lg border transition-all ${
                                            selectedModel === m 
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                                        }`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Painel de Configuração em Lote (Cadastro Rápido) */}
                    <form onSubmit={handleFormSubmit} className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 p-5 rounded-3xl border border-indigo-100 dark:border-indigo-900/60 space-y-4 shadow-sm">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-indigo-600/10">
                                <Sparkles className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">
                                    Configuração Rápida (Cadastro em Lote)
                                </h3>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                                    Defina o cubo/anel para múltiplos aros e furações do modelo <span className="text-indigo-600 dark:text-indigo-400 font-black">{selectedModel || '(Selecione)'}</span> de uma só vez
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr_3fr] gap-4 items-end">
                            {/* 1. Furação */}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                    1. Furação (PCD)
                                </label>
                                <div className="flex flex-wrap gap-1.5 p-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 min-h-[46px] items-center">
                                    {availablePcds.map(p => {
                                        const isSelected = pcd === p;
                                        return (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => setPcd(p)}
                                                className={`px-2.5 py-1 text-[11px] font-black rounded-lg transition-all ${
                                                    isSelected
                                                        ? 'bg-indigo-600 text-white shadow-sm'
                                                        : 'bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-700 dark:text-slate-300'
                                                }`}
                                            >
                                                {p}
                                            </button>
                                        );
                                    })}
                                    <input
                                        type="text"
                                        value={availablePcds.includes(pcd) ? '' : pcd}
                                        onChange={(e) => setPcd(e.target.value.toUpperCase())}
                                        placeholder="Outro..."
                                        className={`px-2 py-1 text-[11px] font-bold rounded-lg w-20 h-6 bg-slate-50 dark:bg-slate-800 border focus:outline-none focus:ring-1 focus:ring-indigo-500 uppercase ${
                                            !availablePcds.includes(pcd) && pcd ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-700 text-slate-500'
                                        }`}
                                    />
                                </div>
                            </div>

                            {/* 2. Aros */}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                    2. Aros Aplicáveis
                                </label>
                                <div className="flex flex-wrap gap-1.5 p-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 min-h-[46px] items-center">
                                    {/* Chip Geral (Sem Aro) */}
                                    <button
                                        type="button"
                                        onClick={() => setFormAros([])}
                                        className={`px-3 py-1 text-[11px] font-black rounded-lg transition-all flex items-center gap-1.5 ${
                                            formAros.length === 0
                                                ? 'bg-amber-500 text-white shadow-sm'
                                                : 'bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-900/30 text-slate-700 dark:text-slate-300'
                                        }`}
                                    >
                                        <Disc className="w-3.5 h-3.5" />
                                        Todos os Aros (Geral)
                                    </button>

                                    {availableAros.map(aro => {
                                        const isSelected = formAros.includes(aro);
                                        return (
                                            <button
                                                key={aro}
                                                type="button"
                                                onClick={() => {
                                                    if (isSelected) {
                                                        setFormAros(formAros.filter(a => a !== aro));
                                                    } else {
                                                        setFormAros([...formAros, aro].sort((x, y) => parseInt(x) - parseInt(y)));
                                                    }
                                                }}
                                                className={`px-2.5 py-1 text-[11px] font-black rounded-lg transition-all ${
                                                    isSelected
                                                        ? 'bg-indigo-600 text-white shadow-sm'
                                                        : 'bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-700 dark:text-slate-300'
                                                }`}
                                            >
                                                Aro {aro}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 3. Configuração do Cubo/Anel */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tipo</label>
                                    <CustomTypeSelect value={type} onChange={(newType) => setType(newType)} />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Medida (MM)</label>
                                    <CustomMmSelect value={mm} type={type} onChange={(newMm) => setMm(newMm)} />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-1">
                            <button
                                type="submit"
                                disabled={!selectedModel || !pcd}
                                className="px-5 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-black text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 transition-all active:scale-95"
                            >
                                <Check className="w-4 h-4" />
                                Aplicar Configuração
                            </button>
                        </div>
                    </form>

                    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4">
                        {/* Variações compactas */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase flex items-center gap-2">
                                        <Disc className="w-4 h-4 text-indigo-500" />
                                        Variações do Catálogo ({selectedModel})
                                    </h3>
                                    <p className="text-[11px] font-semibold text-slate-500">
                                        Verifique e ajuste o mapeamento específico para cada variação
                                    </p>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[760px] text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400">
                                        <tr>
                                            <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest">Aro</th>
                                            <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest">Furação</th>
                                            <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest">Tipo</th>
                                            <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest">Medida</th>
                                            <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest">Status</th>
                                            <th className="px-4 py-2.5 text-right text-[10px] font-black uppercase tracking-widest">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {catalogVariations.map(varItem => {
                                            const savedOverride = mappings.find(m => 
                                                m.model === selectedModel && m.aro === varItem.aro && m.pcd === varItem.pcd
                                            ) || mappings.find(m => 
                                                m.model === selectedModel && !m.aro && m.pcd === varItem.pcd
                                            );

                                            const currentType = savedOverride ? savedOverride.type : 'ANEL';
                                            const currentMm = savedOverride ? savedOverride.mm : '57.1';
                                            const currentColor = savedOverride?.ringColor || (currentType === 'ANEL' ? '#f97316' : '#ea580c');

                                            return (
                                                <tr key={varItem.id} className={savedOverride ? 'bg-indigo-50/30 dark:bg-indigo-950/10' : 'bg-white dark:bg-slate-900'}>
                                                    <td className="px-4 py-2.5">
                                                        <span className="font-black text-slate-800 dark:text-slate-100">{varItem.aro ? `Aro ${varItem.aro}` : 'Geral'}</span>
                                                    </td>
                                                    <td className="px-4 py-2.5 w-36">
                                                        <CustomPcdSelect
                                                            value={varItem.pcd}
                                                            onChange={(newPcd) => handleSaveSingle(varItem.aro, newPcd, currentType, currentMm, currentColor)}
                                                            options={pcdOptionsByAro.byAro.get(varItem.aro || '') || pcdOptionsByAro.all}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2.5 w-52">
                                                        <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSaveSingle(varItem.aro, varItem.pcd, 'ANEL', currentMm, currentColor === '#ea580c' ? '#f97316' : currentColor)}
                                                                className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                                                                    currentType === 'ANEL'
                                                                        ? 'bg-amber-500 text-white shadow-sm'
                                                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                                                }`}
                                                            >
                                                                ANEL
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSaveSingle(varItem.aro, varItem.pcd, 'CUBO', currentMm, currentColor === '#f97316' ? '#ea580c' : currentColor)}
                                                                className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                                                                    currentType === 'CUBO'
                                                                        ? 'bg-blue-600 text-white shadow-sm'
                                                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                                                }`}
                                                            >
                                                                CUBO
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2.5 w-36">
                                                        <CustomMmSelect
                                                            value={currentMm}
                                                            type={currentType}
                                                            onChange={(newMm) => handleSaveSingle(varItem.aro, varItem.pcd, currentType, newMm, getRingColorBySpecs(newMm, currentType))}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-2.5 h-7 rounded-md" style={{ backgroundColor: currentColor }} />
                                                            <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${
                                                                savedOverride
                                                                    ? savedOverride.aro 
                                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                                                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                                            }`}>
                                                                {savedOverride 
                                                                    ? savedOverride.aro 
                                                                        ? 'SALVO' 
                                                                        : 'GERAL' 
                                                                    : 'PADRÃO'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right">
                                                        <div className="flex justify-end gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSaveSingle(varItem.aro, varItem.pcd, currentType, currentMm, currentColor)}
                                                                className="h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl inline-flex items-center gap-1 shadow-sm transition-all active:scale-95"
                                                            >
                                                                <Check className="w-3.5 h-3.5" /> OK
                                                            </button>
                                                            {savedOverride && (
                                                                <button
                                                                    onClick={() => handleDelete(savedOverride.id)}
                                                                    className="h-8 w-8 inline-flex items-center justify-center text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                                                    title="Remover Mapeamento"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Regras salvas compactas */}
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase">Regras salvas</h3>
                                        <p className="text-[11px] font-semibold text-slate-500">Mostrando o modelo atual</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleReset}
                                        className="h-9 px-3 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-colors shrink-0 border border-slate-200 dark:border-slate-700"
                                        title="Restaurar padrões de fábrica"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" /> Padrões
                                    </button>
                                </div>
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Filtrar regras salvas..."
                                        className="w-full h-9 pl-9 pr-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            <div className="overflow-y-auto max-h-[520px] p-2 space-y-1.5">
                                {savedMappingsToShow.length === 0 ? (
                                    <div className="p-6 text-center bg-white dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                        <p className="text-xs font-bold text-slate-400">Nenhuma regra salva para {selectedModel}</p>
                                    </div>
                                ) : (
                                    savedMappingsToShow.map(item => (
                                        <div
                                            key={item.id}
                                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                                                editingId === item.id 
                                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700' 
                                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="w-2.5 h-8 rounded-md shrink-0" style={{ backgroundColor: item.ringColor || '#f97316' }} />
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-black text-xs text-slate-900 dark:text-white uppercase">{item.model}</span>
                                                        {item.aro && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">Aro {item.aro}</span>}
                                                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">{item.pcd}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                                                            item.type === 'ANEL' 
                                                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' 
                                                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                                                        }`}>
                                                            {item.type}
                                                        </span>
                                                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{item.mm} MM</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    onClick={() => handleEditItem(item)}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/40 rounded-lg transition-colors"
                                                    title="Remover"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
