import Papa from 'papaparse';
import { StockItem } from '../types';

const LOCAL_STORAGE_KEY = 'dev_pedidos_fabrica';

export async function getLocalPendenciasInventory(): Promise<StockItem[]> {
    try {
        const response = await fetch('/pendencias_estoque_rows.csv');
        const csvText = await response.text();
        
        const results = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true
        });

        return results.data as StockItem[];
    } catch (error) {
        console.error('Erro ao carregar banco local (CSV):', error);
        return [];
    }
}

export async function loadLocalPedidosFabrica() {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!saved) return [];
    try {
        return JSON.parse(saved);
    } catch (e) {
        console.error('Erro ao ler pedidos locais do localStorage');
        return [];
    }
}

export async function upsertLocalPedidoFabrica(codigo: string, factory: string, quantidade: number) {
    const current = await loadLocalPedidosFabrica();
    
    // Simular o comportamento do Supabase Upsert (onConflict: codigo, factory)
    const existingIdx = current.findIndex((item: any) => item.codigo === codigo && item.factory === factory);
    
    const newEntry = {
        codigo,
        factory,
        quantidade,
        updated_at: new Date().toISOString()
    };

    if (existingIdx >= 0) {
        current[existingIdx] = newEntry;
    } else {
        current.push(newEntry);
    }

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
    return true;
}

export async function getLocalInventory(): Promise<StockItem[]> {
    return await getLocalPendenciasInventory(); // Reutiliza a mesma fonte de dados CSV
}

export async function getLocalLastUpdate(): Promise<string> {
    return new Date().toISOString(); // Retorna data atual como timestamp de "hoje"
}

const HISTORY_STORAGE_KEY = 'dev_pedidos_historico';

export async function archiveAndClearLocalPedidos(
    metadata?: { 
        tags?: Record<string, string[]>, 
        sketches?: Record<string, string>, 
        audios?: Record<string, string> 
    }
) {
    const current = await loadLocalPedidosFabrica();
    if (!current || current.length === 0) return true;

    // 1. Simular o arquivamento no localStorage
    const history = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
    const now = new Date();
    const batchName = `Semana de ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    
    const historyData = current.map((item: any) => ({
        ...item,
        descricao: 'Item Local',
        preco: 0,
        lote_nome: batchName,
        arquivado_em: new Date().toISOString(),
        tags: metadata?.tags?.[item.codigo] || null,
        sketch_data: metadata?.sketches?.[item.codigo] || null,
        audio_data: metadata?.audios?.[item.codigo] || null
    }));

    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify([...history, ...historyData]));

    // 2. Limpar o localStorage principal e metadados ativos
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem(TAGS_STORAGE_KEY);
    return true;
}

export async function getHistoryBatches() {
    const history = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
    const batches: any[] = [];
    
    history.forEach((curr: any) => {
        if (!batches.find(b => b.lote_nome === curr.lote_nome)) {
            batches.push({ lote_nome: curr.lote_nome, arquivado_em: curr.arquivado_em });
        }
    });

    return batches.sort((a, b) => new Date(b.arquivado_em).getTime() - new Date(a.arquivado_em).getTime());
}

export async function getHistoryItems(lote_nome: string) {
    const history = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
    return history.filter((item: any) => item.lote_nome === lote_nome);
}

export async function restoreHistoryBatch(lote_nome: string): Promise<{ success: boolean, items: any[] }> {
    const items = await getHistoryItems(lote_nome);
    if (!items || items.length === 0) return { success: false, items: [] };

    // Restaurar metadados no LocalStorage
    const tagsToRestore: Record<string, string[]> = {};
    items.forEach((it: any) => {
        if (it.tags) tagsToRestore[it.codigo] = it.tags;
    });

    if (Object.keys(tagsToRestore).length > 0) {
        localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tagsToRestore));
    }

    const restored = items.map((it: any) => ({
        codigo: it.codigo,
        factory: it.factory,
        quantidade: it.quantidade,
        updated_at: new Date().toISOString()
    }));

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(restored));
    return { success: true, items };
}

const TAGS_STORAGE_KEY = 'dev_item_tags';

export async function getLocalItemTags(): Promise<Record<string, string[]>> {
    const saved = localStorage.getItem(TAGS_STORAGE_KEY);
    if (!saved) return {};
    try {
        return JSON.parse(saved);
    } catch (e) {
        console.error('Erro ao ler tags do localStorage');
        return {};
    }
}

export async function saveLocalItemTags(tagsMap: Record<string, string[]>) {
    localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tagsMap));
    return true;
}
