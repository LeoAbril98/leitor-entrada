import * as XLSX from 'xlsx';
import {
    getInventory,
    getCloudCargaCodeMappings,
    saveCloudCargaCodeMapping,
    getCloudRomaneios,
    saveCloudRomaneio,
    saveCloudRomaneiosBatch,
    deleteCloudRomaneio
} from '../lib/supabase';
import { StockItem } from '../types';
import { findStockMatchForItem } from '../components/ConferenceModule';

export interface RomaneioItem {
    id: string;
    codigo: string;
    codigoOriginal?: string;   // Código bruto como veio na planilha
    descricao: string;
    quantidade: number;        // Quantidade total solicitada no romaneio (soma das planilhas)
    conferido: number;         // Quantidade já conferida
    local: string;             // Localização no estoque (rua / prateleira do banco de dados)
    estoqueDb: number;         // Saldo em estoque no banco de dados (MK / Supabase)
    isIdentified?: boolean;    // Se foi localizado e vinculado no banco MK
    observacao?: string;
    arquivosOrigem?: string[]; // Arquivos onde esse código apareceu
}

export interface Romaneio {
    id: string;
    numero: string;
    titulo: string;
    clienteOuDestino?: string;
    dataCriacao: string;
    dataAtualizacao: string;
    status: 'pendente' | 'em_conferencia' | 'concluido';
    totalItens: number;        // Quantidade de códigos distintos
    totalPecas: number;        // Soma de todas as quantidades
    totalConferido: number;    // Soma de peças já conferidas
    itens: RomaneioItem[];
    arquivos: string[];        // Lista de arquivos Excel anexados
}

const STORAGE_KEY = 'mkr_romaneios_v1';

// Obter todos os romaneios salvos
export function getRomaneios(): Romaneio[] {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];
        return JSON.parse(data) as Romaneio[];
    } catch (error) {
        console.error('Erro ao carregar romaneios do localStorage:', error);
        return [];
    }
}

// Obter romaneio por ID
export function getRomaneioById(id: string): Romaneio | null {
    const list = getRomaneios();
    return list.find(r => r.id === id) || null;
}

// Salvar / Criar novo romaneio consolidado
export function saveRomaneio(romaneioData: {
    titulo: string;
    numero?: string;
    clienteOuDestino?: string;
    itens: Omit<RomaneioItem, 'id' | 'conferido'>[];
    arquivos?: string[];
}): Romaneio {
    const list = getRomaneios();

    const itensFormatados: RomaneioItem[] = romaneioData.itens.map((it, idx) => ({
        id: `item_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        codigo: String(it.codigo).trim().toUpperCase(),
        descricao: it.descricao || 'Sem descrição',
        quantidade: Math.max(1, Math.round(Number(it.quantidade) || 1)),
        conferido: 0,
        local: it.local || 'N/A',
        estoqueDb: Number(it.estoqueDb) || 0,
        observacao: it.observacao || '',
        arquivosOrigem: it.arquivosOrigem || []
    }));

    const totalPecas = itensFormatados.reduce((acc, it) => acc + it.quantidade, 0);

    const now = new Date().toISOString();
    const novoRomaneio: Romaneio = {
        id: `rom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        numero: romaneioData.numero?.trim() || `ROM-${new Date().getFullYear()}-${String(list.length + 1).padStart(3, '0')}`,
        titulo: romaneioData.titulo.trim() || 'Romaneio de Expedição',
        clienteOuDestino: romaneioData.clienteOuDestino?.trim() || '',
        dataCriacao: now,
        dataAtualizacao: now,
        status: 'pendente',
        totalItens: itensFormatados.length,
        totalPecas,
        totalConferido: 0,
        itens: itensFormatados,
        arquivos: romaneioData.arquivos || []
    };

    const novaLista = [novoRomaneio, ...list];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(novaLista));

    window.dispatchEvent(new CustomEvent('mkr_romaneios_updated'));

    // Sincronizar criação na nuvem (Supabase) em segundo plano
    saveCloudRomaneio(novoRomaneio, novaLista).catch(err => {
        console.warn('Alerta ao persistir novo romaneio no Supabase:', err);
    });

    return novoRomaneio;
}

// Anexar / Mesclar novos arquivos a um romaneio existente
export async function appendFilesToExistingRomaneio(
    romaneioId: string,
    files: File[]
): Promise<Romaneio | null> {
    const current = getRomaneioById(romaneioId);
    if (!current) return null;

    const parsed = await parseMultipleExcelRomaneios(files);

    // Mapa dos itens existentes
    const itensMap = new Map<string, RomaneioItem>();
    current.itens.forEach(it => {
        itensMap.set(it.codigo, { ...it });
    });

    // Mesclar novos itens
    parsed.itensConsolidados.forEach(novo => {
        if (itensMap.has(novo.codigo)) {
            const existing = itensMap.get(novo.codigo)!;
            existing.quantidade += novo.quantidade;
            existing.estoqueDb = novo.estoqueDb; // Atualiza estoque do banco
            if (novo.local && novo.local !== 'N/A') existing.local = novo.local;
            if (novo.descricao && existing.descricao === 'Sem descrição') existing.descricao = novo.descricao;

            // Unir arquivos de origem
            const mergedArquivos = Array.from(new Set([...(existing.arquivosOrigem || []), ...(novo.arquivosOrigem || [])]));
            existing.arquivosOrigem = mergedArquivos;
        } else {
            itensMap.set(novo.codigo, {
                id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                codigo: novo.codigo,
                descricao: novo.descricao,
                quantidade: novo.quantidade,
                conferido: 0,
                local: novo.local,
                estoqueDb: novo.estoqueDb,
                observacao: '',
                arquivosOrigem: novo.arquivosOrigem
            });
        }
    });

    const itensAtualizados = Array.from(itensMap.values());
    const novosArquivos = Array.from(new Set([...current.arquivos, ...parsed.arquivosProcessados]));

    return updateRomaneio(romaneioId, {
        itens: itensAtualizados,
        arquivos: novosArquivos
    });
}

// Atualizar romaneio existente
export function updateRomaneio(id: string, updates: Partial<Romaneio>): Romaneio | null {
    const list = getRomaneios();
    const index = list.findIndex(r => r.id === id);
    if (index === -1) return null;

    const current = list[index];
    const updated: Romaneio = {
        ...current,
        ...updates,
        dataAtualizacao: new Date().toISOString()
    };

    if (updates.itens) {
        updated.totalItens = updated.itens.length;
        updated.totalPecas = updated.itens.reduce((acc, it) => acc + it.quantidade, 0);
        updated.totalConferido = updated.itens.reduce((acc, it) => acc + (it.conferido || 0), 0);

        if (updated.totalConferido === 0) {
            updated.status = 'pendente';
        } else if (updated.totalConferido >= updated.totalPecas) {
            updated.status = 'concluido';
        } else {
            updated.status = 'em_conferencia';
        }
    }

    list[index] = updated;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('mkr_romaneios_updated'));

    // Sincronizar atualização na nuvem (Supabase) em segundo plano
    saveCloudRomaneio(updated, list).catch(err => {
        console.warn('Alerta ao persistir atualização do romaneio no Supabase:', err);
    });

    return updated;
}

// Atualizar quantidade conferida de um item
export function updateItemConference(romaneioId: string, itemId: string, novaQtdConferida: number): Romaneio | null {
    const romaneio = getRomaneioById(romaneioId);
    if (!romaneio) return null;

    const itens = romaneio.itens.map(it => {
        if (it.id === itemId) {
            const clampQtd = Math.max(0, Math.min(it.quantidade, novaQtdConferida));
            return { ...it, conferido: clampQtd };
        }
        return it;
    });

    return updateRomaneio(romaneioId, { itens });
}

// Incrementar conferência por código de barras
export function scanItemBarcode(romaneioId: string, codigoEscaneado: string): { success: boolean; message: string; romaneio: Romaneio | null } {
    const romaneio = getRomaneioById(romaneioId);
    if (!romaneio) return { success: false, message: 'Romaneio não encontrado', romaneio: null };

    const cleanCode = codigoEscaneado.trim().toUpperCase();
    const item = romaneio.itens.find(it => it.codigo.toUpperCase() === cleanCode);

    if (!item) {
        return {
            success: false,
            message: `Código ${cleanCode} não consta neste romaneio!`,
            romaneio
        };
    }

    if (item.conferido >= item.quantidade) {
        return {
            success: false,
            message: `Item ${cleanCode} já atingiu a quantidade máxima (${item.quantidade} un).`,
            romaneio
        };
    }

    const updated = updateItemConference(romaneioId, item.id, item.conferido + 1);
    return {
        success: true,
        message: `+1 ${cleanCode} conferido! (${item.conferido + 1}/${item.quantidade})`,
        romaneio: updated
    };
}

// Excluir romaneio
export function deleteRomaneio(id: string): boolean {
    const list = getRomaneios();
    const filtrados = list.filter(r => r.id !== id);
    if (filtrados.length === list.length) return false;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtrados));
    window.dispatchEvent(new CustomEvent('mkr_romaneios_updated'));

    // Sincronizar exclusão na nuvem (Supabase)
    deleteCloudRomaneio(id, filtrados).catch(err => {
        console.warn('Alerta ao deletar romaneio no Supabase:', err);
    });

    return true;
}

// Exportar romaneio para Excel (.xlsx) com todas as colunas
export function exportRomaneioToExcel(romaneio: Romaneio) {
    const dataToExport = romaneio.itens.map(it => ({
        'Código': it.codigo,
        'Descrição': it.descricao || '',
        'Quantidade Romaneio': it.quantidade,
        'Conferido': it.conferido,
        'Local': it.local || 'N/A',
        'Estoque no Banco': it.estoqueDb,
        'Status': it.conferido >= it.quantidade ? 'CONFERIDO' : it.conferido > 0 ? 'PARCIAL' : 'PENDENTE',
        'Arquivos de Origem': (it.arquivosOrigem || []).join(', ')
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Romaneio_Consolidado');

    const cleanName = romaneio.titulo.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Romaneio_${cleanName}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

// Normalizador de texto
const norm = (str: unknown) => String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

// Parser de múltiplos arquivos Excel / CSV consolidando para a mesma carga com conferência automática
export async function parseMultipleExcelRomaneios(files: File[]): Promise<{
    nomeSugerido: string;
    arquivosProcessados: string[];
    itensConsolidados: (Omit<RomaneioItem, 'id' | 'conferido'> & { id?: string })[];
    totalPecas: number;
    totalCodigos: number;
    totalIdentificados: number;
    totalNaoIdentificados: number;
}> {
    if (!files || files.length === 0) {
        throw new Error('Nenhum arquivo fornecido para importação');
    }

    // 1. Carregar catálogo de estoque do Supabase/Local para enriquecer (descrição, local e estoque do banco)
    let inventoryList: StockItem[] = [];
    const catalogMap = new Map<string, StockItem>();
    try {
        const inventory = await getInventory();
        if (inventory && Array.isArray(inventory)) {
            inventoryList = inventory as StockItem[];
            inventoryList.forEach(it => {
                if (it.codigo) {
                    catalogMap.set(String(it.codigo).trim().toUpperCase(), it);
                }
            });
        }
    } catch (e) {
        console.warn('Não foi possível carregar o inventário para enriquecer os itens:', e);
    }

    // Carregar mapeamentos históricos salvos localmente e na nuvem
    let codeMappings: Record<string, string> = {};
    try {
        const saved = localStorage.getItem('@MK_WHEEL_CODE_MAPPINGS');
        if (saved) codeMappings = JSON.parse(saved);
    } catch (e) {}

    try {
        const cloudMappings = await getCloudCargaCodeMappings();
        codeMappings = { ...codeMappings, ...cloudMappings };
    } catch (e) {}

    const CODE_KEYWORDS = ['codigo', 'cod', 'referencia', 'ref', 'produto', 'item', 'part_number', 'modelo'];
    const QTD_KEYWORDS = ['quantidade', 'qtd', 'qtde', 'quant', 'qnt', 'volume', 'volumes', 'pecas', 'total', 'unidades', 'un', 'saldo'];
    const DESC_KEYWORDS = ['descricao', 'desc', 'especificacao', 'nome'];

    const itensMap = new Map<string, {
        id: string;
        codigo: string;
        codigoOriginal: string;
        descricao: string;
        quantidade: number;
        local: string;
        estoqueDb: number;
        isIdentified: boolean;
        arquivosOrigem: string[];
    }>();

    const arquivosProcessados: string[] = [];

    // 2. Processar cada arquivo Excel/CSV
    for (const file of files) {
        try {
            arquivosProcessados.push(file.name);
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array', raw: true });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true });
            if (!rawRows || rawRows.length === 0) continue;

            // Procurar linha de cabeçalho
            let headerRowIdx = 0;
            let foundHeaders: string[] = [];

            for (let r = 0; r < Math.min(10, rawRows.length); r++) {
                const row = rawRows[r] as string[];
                if (Array.isArray(row)) {
                    const hasCode = row.some(cell => CODE_KEYWORDS.some(k => norm(cell).includes(k)));
                    const hasQtd = row.some(cell => QTD_KEYWORDS.some(k => norm(cell).includes(k)));

                    if (hasCode || hasQtd) {
                        headerRowIdx = r;
                        foundHeaders = row.map(c => String(c || '').trim());
                        break;
                    }
                }
            }

            if (foundHeaders.length === 0 && rawRows.length > 0) {
                foundHeaders = (rawRows[0] as string[]).map((c, i) => String(c || `Coluna ${i + 1}`).trim());
            }

            // Identificar colunas
            let colCodigo = '';
            let colQtd = '';
            let colDesc = '';

            for (const h of foundHeaders) {
                const normalized = norm(h);
                if (!colCodigo && CODE_KEYWORDS.some(k => normalized === k || normalized.includes(k))) {
                    colCodigo = h;
                } else if (!colQtd && QTD_KEYWORDS.some(k => normalized === k || normalized.includes(k))) {
                    colQtd = h;
                } else if (!colDesc && DESC_KEYWORDS.some(k => normalized === k || normalized.includes(k))) {
                    colDesc = h;
                }
            }

            if (!colCodigo && foundHeaders.length > 0) colCodigo = foundHeaders[0];
            if (!colQtd && foundHeaders.length > 1) colQtd = foundHeaders[1];

            // Ler linhas de dados
            const dataObjects = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
                range: headerRowIdx,
                defval: '',
                raw: true
            });

            for (const row of dataObjects) {
                const rawCode = String(row[colCodigo] || '').trim().toUpperCase();
                if (!rawCode || rawCode === 'TOTAL' || rawCode === 'SUBTOTAL') continue;

                // Parse da quantidade
                const rawQtd = row[colQtd];
                let qtd = 1;
                if (typeof rawQtd === 'number') {
                    qtd = Math.max(1, Math.round(rawQtd));
                } else if (typeof rawQtd === 'string') {
                    const parsed = parseInt(rawQtd.replace(/[^0-9]/g, ''), 10);
                    if (!isNaN(parsed) && parsed > 0) qtd = parsed;
                }

                const rawDesc = String(row[colDesc] || '').trim();

                // Tentativa de Cruzamento / Identificação com o Banco MK:
                // 1. Busca Direta por Código Exato
                let matchedStock: StockItem | null = catalogMap.get(rawCode) || null;

                // 2. Histórico de Vínculos Salvo (Code Mappings)
                if (!matchedStock && codeMappings[rawCode]) {
                    const mappedTargetCode = codeMappings[rawCode].trim().toUpperCase();
                    matchedStock = catalogMap.get(mappedTargetCode) || null;
                }

                // 3. Busca Inteligente por 4 Pilares (Modelo, Aro, PCD, Acabamento) ou Descrição
                if (!matchedStock && inventoryList.length > 0) {
                    matchedStock = findStockMatchForItem(rawDesc, rawCode, inventoryList, codeMappings);
                }

                const finalCode = matchedStock ? matchedStock.codigo : rawCode;
                const finalDesc = matchedStock ? matchedStock.descricao : (rawDesc || 'Sem descrição');
                const local = matchedStock?.local || 'N/A';
                const estoqueDb = Number(matchedStock?.quantidade) || 0;
                const isIdentified = Boolean(matchedStock);

                const itemKey = finalCode;

                if (itensMap.has(itemKey)) {
                    // Item repetido em outra planilha ou na mesma: SOMAR quantidade!
                    const existing = itensMap.get(itemKey)!;
                    existing.quantidade += qtd;
                    if (!existing.arquivosOrigem.includes(file.name)) {
                        existing.arquivosOrigem.push(file.name);
                    }
                    if (existing.local === 'N/A' && local !== 'N/A') existing.local = local;
                    if (existing.descricao === 'Sem descrição' && finalDesc !== 'Sem descrição') existing.descricao = finalDesc;
                    if (matchedStock) {
                        existing.estoqueDb = estoqueDb;
                        existing.isIdentified = true;
                    }
                } else {
                    itensMap.set(itemKey, {
                        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                        codigo: finalCode,
                        codigoOriginal: rawCode,
                        descricao: finalDesc,
                        quantidade: qtd,
                        local,
                        estoqueDb,
                        isIdentified,
                        arquivosOrigem: [file.name]
                    });
                }
            }
        } catch (err) {
            console.error(`Erro ao processar arquivo ${file.name}:`, err);
        }
    }

    const itensConsolidados = Array.from(itensMap.values());
    const totalPecas = itensConsolidados.reduce((acc, it) => acc + it.quantidade, 0);
    const totalIdentificados = itensConsolidados.filter(i => i.isIdentified).length;
    const totalNaoIdentificados = itensConsolidados.filter(i => !i.isIdentified).length;

    // Sugerir título baseado no(s) arquivo(s)
    let nomeSugerido = 'Carga Consolidada';
    if (files.length === 1) {
        nomeSugerido = files[0].name.replace(/\.(xlsx|xls|csv)$/i, '').replace(/[-_]/g, ' ').trim();
    } else {
        const firstClean = files[0].name.replace(/\.(xlsx|xls|csv)$/i, '').replace(/[-_]/g, ' ').trim();
        nomeSugerido = `${firstClean} (+${files.length - 1} planilhas)`;
    }

    return {
        nomeSugerido,
        arquivosProcessados,
        itensConsolidados,
        totalPecas,
        totalCodigos: itensConsolidados.length,
        totalIdentificados,
        totalNaoIdentificados
    };
}

// Vincular um item de um romaneio existente a um produto oficial do banco MK
export async function linkRomaneioItemToStock(
    romaneioId: string,
    itemId: string,
    selectedStock: StockItem,
    rawCodeToSave?: string
): Promise<Romaneio | null> {
    const list = getRomaneios();
    const rIdx = list.findIndex(r => r.id === romaneioId);
    if (rIdx === -1) return null;

    const romaneio = list[rIdx];
    const itIdx = romaneio.itens.findIndex(it => it.id === itemId);
    if (itIdx === -1) return null;

    const currentItem = romaneio.itens[itIdx];
    const oldCode = currentItem.codigo;

    // Atualizar item no romaneio com os dados reais do estoque MK
    romaneio.itens[itIdx] = {
        ...currentItem,
        codigo: selectedStock.codigo,
        codigoOriginal: currentItem.codigoOriginal || oldCode,
        descricao: selectedStock.descricao,
        local: selectedStock.local || 'SEM LOCAL',
        estoqueDb: Number(selectedStock.quantidade) || 0,
        isIdentified: true
    };

    // Salvar o vínculo permanentemente no LocalStorage e no Supabase
    const keyToMap = (rawCodeToSave || oldCode).toUpperCase().trim();
    if (keyToMap && keyToMap !== selectedStock.codigo.toUpperCase().trim()) {
        try {
            const saved = localStorage.getItem('@MK_WHEEL_CODE_MAPPINGS');
            const map = saved ? JSON.parse(saved) : {};
            map[keyToMap] = selectedStock.codigo;
            localStorage.setItem('@MK_WHEEL_CODE_MAPPINGS', JSON.stringify(map));
            await saveCloudCargaCodeMapping(keyToMap, selectedStock.codigo, selectedStock.descricao);
        } catch (e) {
            console.warn('Erro ao salvar vínculo de código:', e);
        }
    }

    romaneio.dataAtualizacao = new Date().toISOString();
    list[rIdx] = romaneio;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('mkr_romaneios_updated'));

    // Sincronizar romaneio com o novo vínculo na nuvem
    saveCloudRomaneio(romaneio, list).catch(err => {
        console.warn('Alerta ao atualizar romaneio vinculado no Supabase:', err);
    });

    return romaneio;
}

// Sincronizar romaneios e vínculos com a nuvem (Supabase) para todos os dispositivos
export async function fetchAndSyncRomaneios(): Promise<Romaneio[]> {
    try {
        // 1. Sincronizar vínculos de códigos da nuvem
        try {
            const cloudMappings = await getCloudCargaCodeMappings();
            if (cloudMappings && Object.keys(cloudMappings).length > 0) {
                const saved = localStorage.getItem('@MK_WHEEL_CODE_MAPPINGS');
                const localMap = saved ? JSON.parse(saved) : {};
                const merged = { ...localMap, ...cloudMappings };
                localStorage.setItem('@MK_WHEEL_CODE_MAPPINGS', JSON.stringify(merged));
            }
        } catch (mapErr) {
            console.warn('Aviso ao sincronizar mapeamentos de códigos:', mapErr);
        }

        // 2. Buscar romaneios da nuvem
        const cloudRomaneios = await getCloudRomaneios();
        const localRomaneios = getRomaneios();

        if (cloudRomaneios && cloudRomaneios.length > 0) {
            const map = new Map<string, Romaneio>();
            // Lista local como base
            localRomaneios.forEach(r => map.set(r.id, r));

            // Nuvem tem precedência se mais recente ou novo
            cloudRomaneios.forEach(cloudR => {
                const localR = map.get(cloudR.id);
                if (!localR) {
                    map.set(cloudR.id, cloudR);
                } else {
                    const localTime = new Date(localR.dataAtualizacao || 0).getTime();
                    const cloudTime = new Date(cloudR.dataAtualizacao || 0).getTime();
                    if (cloudTime >= localTime) {
                        map.set(cloudR.id, cloudR);
                    }
                }
            });

            const mergedList = Array.from(map.values()).sort(
                (a, b) => new Date(b.dataAtualizacao || 0).getTime() - new Date(a.dataAtualizacao || 0).getTime()
            );

            localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedList));
            window.dispatchEvent(new CustomEvent('mkr_romaneios_updated'));
            return mergedList;
        } else if (cloudRomaneios !== null && cloudRomaneios.length === 0 && localRomaneios.length > 0) {
            // Nuvem está vazia mas este dispositivo tem romaneios locais: subir para a nuvem
            await saveCloudRomaneiosBatch(localRomaneios);
            return localRomaneios;
        }

        return localRomaneios;
    } catch (err) {
        console.warn('Erro ao sincronizar romaneios com o Supabase:', err);
        return getRomaneios();
    }
}
