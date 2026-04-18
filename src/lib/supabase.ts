/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js'

export const clearLocalInventoryCache = () => {
    localStorage.removeItem('@MK_INVENTORY_CACHE');
    localStorage.removeItem('@MK_INVENTORY_LAST_SYNC');
    localStorage.removeItem('inventory_cache');
    window.location.reload();
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Toggle para Banco de Dados Local (CSV + LocalStorage) para desenvolvimento
export const USE_LOCAL_DB = false; // Forçado para testes finais em Cloud

// Importações dinâmicas/condicionais para evitar carregar localDb se não necessário
// Nota: Em Vite, import.meta.env é substituído em tempo de build, permitindo Tree Shaking
import * as localDb from './localDb';

export async function getInventory() {
  let allData: any[] = []
  let hasMore = true
  let page = 0
  const pageSize = 1000

  // The PostgREST API limits single queries to 1000 rows by default.
  // We need to paginate to get all items.
  try {
    if (USE_LOCAL_DB) {
      return await localDb.getLocalInventory();
    }

    while (hasMore) {
      const { data, error } = await supabase
        .from('inventario_itens')
        .select('codigo, descricao, local, quantidade')
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        allData = [...allData, ...data]
        page++
        hasMore = data.length === pageSize
      } else {
        hasMore = false
      }
    }

    const mapped = mapData(allData);
    // Salvar cache local para modo offline
    localStorage.setItem('@MK_INVENTORY_CACHE', JSON.stringify(mapped));
    localStorage.setItem('@MK_INVENTORY_LAST_SYNC', new Date().toISOString());
    return mapped;

  } catch (error: any) {
    console.warn('Erro ao buscar inventário online (Supabase). Tentando cache local...', error);
    
    // Tentar carregar do cache offline
    const cached = localStorage.getItem('@MK_INVENTORY_CACHE');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error('Cache local corrompido.');
        return [];
      }
    }
    
    return [];
  }
}

function mapData(data: any[]) {
  return data.map(item => {
    let localFormatado = String(item.local || '').trim();
    
    // Se for vazio ou contiver sequências de traços ou underscores
    if (!localFormatado || /^[-_]+$/.test(localFormatado)) {
      localFormatado = 'Sem local';
    }

    return {
      codigo: String(item.codigo || '').trim(),
      descricao: String(item.descricao || 'Sem descrição').trim(),
      local: localFormatado,
      quantidade: Number(item.quantidade) || 0
    };
  })
}

/**
 * Busca o estoque exclusivo das PENDÊNCIAS (carregado via Excel)
 */
export async function getPendenciasInventory() {
  let allData: any[] = []
  let hasMore = true
  let page = 0
  const pageSize = 1000

  // Puxa da tabela separada para não interferir no robô
  try {
    if (USE_LOCAL_DB) {
      console.log('Modo Desenvolvimento: Carregando inventário do CSV local...');
      return await localDb.getLocalPendenciasInventory();
    }

    while (hasMore) {
      const { data, error } = await supabase
        .from('pendencias_estoque')
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (error) throw error;
      if (data && data.length > 0) {
        allData = [...allData, ...data]
        page++
        hasMore = data.length === pageSize
      } else {
        hasMore = false
      }
    }
    return allData;
  } catch (error) {
    console.warn('Erro ao buscar estoque de pendências:', error);
    return [];
  }
}

/**
 * Sincroniza o estoque das PENDÊNCIAS em tabela separada
 */
export async function syncPendenciasToCloud(data: import('../types').StockItem[], fileName: string) {
  try {
    if (USE_LOCAL_DB) {
      console.log('Modo Desenvolvimento: Simulando sucesso no sync cloud...');
      return true;
    }

    // 1. Criar cabeçalho para registro de data e nome do arquivo
    const { data: invData, error: invError } = await supabase
      .from('inventarios')
      .insert({ 
        criado_em: new Date().toISOString(),
        nome_arquivo: fileName
      })
      .select('id')
      .single();

    if (invError) throw invError;
    const inventario_id = invData.id;

    // 2. Limpar APENAS a tabela de pendências (o robô fica em outra tabela)
    await supabase.from('pendencias_estoque').delete().neq('codigo', 'dummy_val');

    // 3. Batch insert
    const batchSize = 500;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize).map(item => ({
        codigo: item.codigo,
        descricao: item.descricao,
        local: item.local,
        quantidade: item.quantidade || 0,
        est_mk: item.est_mk || 0,
        pend_mk: item.pend_mk || 0,
        est_moleri: item.est_moleri || 0,
        pend_moleri: item.pend_moleri || 0,
        est_cm: item.est_cm || 0,
        pend_cm: item.pend_cm || 0,
        est_olimpo: item.est_olimpo || 0,
        pend_olimpo: item.pend_olimpo || 0,
        preco: item.preco || 0,
        inventario_id: inventario_id
      }));

      const { error } = await supabase
        .from('pendencias_estoque')
        .insert(batch);

      if (error) throw error;
    }
    return true;
  } catch (error) {
    console.error('Erro sync pendências:', error);
    throw error;
  }
}

export async function getLastUpdate(): Promise<{ date: string, fileName?: string } | null> {
  try {
    if (USE_LOCAL_DB) {
      const date = await localDb.getLocalLastUpdate();
      return { date };
    }

    const { data, error } = await supabase
      .from('inventarios')
      .select('criado_em, nome_arquivo')
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) throw error;
    if (!data) return null;

    return { 
        date: data.criado_em, 
        fileName: data.nome_arquivo 
    };
  } catch (error) {
    console.error('Erro ao buscar última atualização do inventário (Supabase):', error);
    return null;
  }
}

export async function loadPedidosFabrica() {
  try {
    if (USE_LOCAL_DB) {
      return await localDb.loadLocalPedidosFabrica();
    }

    const { data, error } = await supabase
      .from('pedidos_fabrica')
      .select('codigo, factory, quantidade')

    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Erro ao buscar pedidos do Supabase:', error);
    return [];
  }
}

export async function upsertPedidoFabrica(codigo: string, factory: string, quantidade: number) {
  try {
    if (USE_LOCAL_DB) {
      return await localDb.upsertLocalPedidoFabrica(codigo, factory, quantidade);
    }

    const { error } = await supabase
      .from('pedidos_fabrica')
      .upsert(
        { 
          codigo: String(codigo).trim(), 
          factory, 
          quantidade, 
          updated_at: new Date().toISOString() 
        },
        { onConflict: 'codigo, factory' }
      )

    if (error) {
      console.error('Erro detalhado do Supabase:', error.message, error.details, error.hint);
      throw error;
    }
    return true;
  } catch (error: any) {
    console.error('Falha ao sincronizar com a nuvem:', error);
    return false;
  }
}

export async function archiveAndClearPedidos(
  metadata?: { 
    tags?: Record<string, string[]>, 
    sketches?: Record<string, string>, 
    audios?: Record<string, string> 
  }
) {
  try {
    if (USE_LOCAL_DB) {
      return await localDb.archiveAndClearLocalPedidos(metadata);
    }

    // 1. Buscar dados atuais
    const { data: currentData, error: fetchError } = await supabase
      .from('pedidos_fabrica')
      .select('codigo, factory, quantidade')

    if (fetchError) throw fetchError;
    if (!currentData || currentData.length === 0) return true;

    // 2. Buscar descrições e preços para o histórico
    const { data: stockData } = await supabase
      .from('pendencias_estoque')
      .select('codigo, descricao, preco');

    const stockMap = new Map(stockData?.map(s => [s.codigo, s]) || []);

    // 3. Preparar dados para o histórico com metadados
    const now = new Date();
    const batchName = `Semana de ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    const historyData = currentData.map(item => {
      const details = stockMap.get(item.codigo);
      return {
        ...item,
        descricao: details?.descricao || 'N/A',
        preco: details?.preco || 0,
        lote_nome: batchName,
        arquivado_em: new Date().toISOString(),
        tags: metadata?.tags?.[item.codigo] || null,
        sketch_data: metadata?.sketches?.[item.codigo] || null,
        audio_data: metadata?.audios?.[item.codigo] || null
      };
    });

    // 3. Inserir no histórico
    const { error: historyError } = await supabase
      .from('pedidos_fabrica_historico')
      .insert(historyData);

    if (historyError) {
      console.error('Falha ao inserir no histórico:', historyError);
      throw new Error(`Erro no arquivamento: ${historyError.message}`);
    }

    const codigosParaLimpar = Array.from(new Set(currentData.map(d => d.codigo)));
    console.log(`Limpando ${codigosParaLimpar.length} códigos das tabelas ativas...`);

    // 4. Limpar metadados ativos (Etiquetas, Rascunhos, Áudios)
    try {
      await supabase.from('item_tags').delete().in('codigo', codigosParaLimpar);
      await supabase.from('stock_sketches').delete().in('codigo', codigosParaLimpar);
      await supabase.from('stock_audios').delete().in('codigo', codigosParaLimpar);
    } catch (e) {
      console.warn('Falha parcial ao limpar metadados:', e);
    }

    // 5. Limpar tabela principal de pedidos
    const { error: deleteError } = await supabase
      .from('pedidos_fabrica')
      .delete()
      .in('codigo', codigosParaLimpar);

    if (deleteError) {
      console.error('Erro ao deletar pedidos principais:', deleteError);
      throw new Error(`Erro na limpeza: ${deleteError.message}`);
    }

    return true;
  } catch (error) {
    console.error('Erro ao arquivar e limpar pedidos:', error);
    return false;
  }
}

export async function getHistoryBatches() {
  if (USE_LOCAL_DB) return localDb.getHistoryBatches();

  try {
    const { data, error } = await supabase
      .from('pedidos_fabrica_historico')
      .select('lote_nome, arquivado_em')
      // Note: No Postgres original, o distinct on seria ideal, mas no JS vamos agregar
    
    if (error) throw error;
    
    // Agrupar por lote_nome e pegar a data mais recente
    const batches = data.reduce((acc: any[], curr) => {
      const existing = acc.find(b => b.lote_nome === curr.lote_nome);
      if (!existing) {
        acc.push({ lote_nome: curr.lote_nome, arquivado_em: curr.arquivado_em });
      }
      return acc;
    }, []);

    return batches.sort((a, b) => new Date(b.arquivado_em).getTime() - new Date(a.arquivado_em).getTime());
  } catch (err) {
    console.error('Erro ao buscar lotes de histórico:', err);
    return [];
  }
}

export async function getHistoryItems(lote_nome: string) {
  if (USE_LOCAL_DB) return localDb.getHistoryItems(lote_nome);

  try {
    const { data, error } = await supabase
      .from('pedidos_fabrica_historico')
      .select('*')
      .eq('lote_nome', lote_nome);
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar itens do histórico:', err);
    return [];
  }
}

export async function restoreHistoryBatch(lote_nome: string): Promise<{ success: boolean, items: any[] }> {
  if (USE_LOCAL_DB) return localDb.restoreHistoryBatch(lote_nome);

  try {
    // 1. Buscar itens do lote
    const items = await getHistoryItems(lote_nome);
    if (!items || items.length === 0) return { success: false, items: [] };

    // 2. Limpar pedidos atuais
    await supabase.from('pedidos_fabrica').delete().gte('quantidade', -1);
    
    // 3. Restaurar metadados se existirem
    const tagsToRestore: Record<string, string[]> = {};
    const sketchesToRestore: Record<string, string> = {};
    const audiosToRestore: Record<string, string> = {};

    items.forEach((it: any) => {
        if (it.tags) tagsToRestore[it.codigo] = it.tags;
        if (it.sketch_data) sketchesToRestore[it.codigo] = it.sketch_data;
        if (it.audio_data) audiosToRestore[it.codigo] = it.audio_data;
    });

    // Salvar tags (função já existente)
    if (Object.keys(tagsToRestore).length > 0) await saveItemTags(tagsToRestore);
    
    // Salvar sketches/audios (precisamos garantir que o frontend receba e salve no sketchStore ou via nova API cloud)
    // Para simplificar, o restoreHistoryBatch retornará os metadados para o frontend salvar localmente
    // ou usaremos novas funções syncCloud
    for (const [codigo, data] of Object.entries(sketchesToRestore)) await saveCloudSketch(codigo, data);
    for (const [codigo, data] of Object.entries(audiosToRestore)) await saveCloudAudio(codigo, data);

    // 4. Inserir itens restaurados
    const batchToInsert = items.map((it: any) => ({
      codigo: it.codigo,
      factory: it.factory,
      quantidade: it.quantidade,
      updated_at: new Date().toISOString()
    }));

    const { error: insertError } = await supabase.from('pedidos_fabrica').insert(batchToInsert);
    if (insertError) throw insertError;

    return { success: true, items };
  } catch (err) {
    console.error('Erro ao restaurar lote:', err);
    return { success: false, items: [] };
  }
}

// Funções Auxiliares de Sincronização de Mídia (Persistência em tabelas dedicadas)
export async function saveCloudSketch(codigo: string, dataUrl: string) {
    if (USE_LOCAL_DB) return true;
    const { error } = await supabase
        .from('stock_sketches')
        .upsert({ 
            codigo: String(codigo).trim(), 
            data_url: dataUrl,
            updated_at: new Date().toISOString()
        }, { onConflict: 'codigo' });
    return !error;
}

export async function getCloudSketch(codigo: string): Promise<string | null> {
    if (USE_LOCAL_DB) return null;
    const { data, error } = await supabase
        .from('stock_sketches')
        .select('data_url')
        .eq('codigo', codigo)
        .single();
    if (error) return null;
    return data?.data_url || null;
}

export async function deleteCloudSketch(codigo: string) {
    if (USE_LOCAL_DB) return true;
    const { error } = await supabase.from('stock_sketches').delete().eq('codigo', codigo);
    return !error;
}

export async function getAllCloudSketches(): Promise<Record<string, string>> {
    if (USE_LOCAL_DB) return {};
    const { data, error } = await supabase.from('stock_sketches').select('codigo, data_url');
    if (error) return {};
    
    const map: Record<string, string> = {};
    data?.forEach(row => {
        map[row.codigo] = row.data_url;
    });
    return map;
}

export async function saveCloudAudio(codigo: string, audioBase64: string) {
    if (USE_LOCAL_DB) return true;
    const { error } = await supabase
        .from('stock_audios')
        .upsert({ 
            codigo: String(codigo).trim(), 
            audio_data: audioBase64,
            updated_at: new Date().toISOString()
        }, { onConflict: 'codigo' });
    return !error;
}

export async function getCloudAudio(codigo: string): Promise<string | null> {
    if (USE_LOCAL_DB) return null;
    const { data, error } = await supabase
        .from('stock_audios')
        .select('audio_data')
        .eq('codigo', codigo)
        .single();
    if (error) return null;
    return data?.audio_data || null;
}

export async function deleteCloudAudio(codigo: string) {
    if (USE_LOCAL_DB) return true;
    const { error } = await supabase.from('stock_audios').delete().eq('codigo', codigo);
    return !error;
}

export async function getAllCloudAudios(): Promise<Record<string, string>> {
    if (USE_LOCAL_DB) return {};
    const { data, error } = await supabase.from('stock_audios').select('codigo, audio_data');
    if (error) return {};
    
    const map: Record<string, string> = {};
    data?.forEach(row => {
        map[row.codigo] = row.audio_data;
    });
    return map;
}

/**
 * Funções para Etiquetas (Tags) de Itens
 */
export async function getItemTags(): Promise<Record<string, string[]>> {
  if (USE_LOCAL_DB) {
    return await localDb.getLocalItemTags();
  }
  
  try {
    const { data, error } = await supabase.from('item_tags').select('codigo, tags');
    if (error) throw error;

    const tagsMap: Record<string, string[]> = {};
    data?.forEach(row => {
      tagsMap[row.codigo] = row.tags;
    });
    return tagsMap;
  } catch (err) {
    console.error('Erro ao buscar etiquetas do Supabase:', err);
    return {};
  }
}

export async function saveItemTags(tagsMap: Record<string, string[]>) {
  if (USE_LOCAL_DB) {
    return await localDb.saveLocalItemTags(tagsMap);
  }

  try {
    // Transformar o mapa em array para upsert individual ou batch
    // Para simplificar e garantir precisão, faremos upsert dos itens que mudaram.
    // No contexto do App, geralmente salvamos o mapa inteiro.
    const entries = Object.entries(tagsMap).map(([codigo, tags]) => ({
      codigo,
      tags,
      updated_at: new Date().toISOString()
    }));

    if (entries.length === 0) return true;

    // Supabase upsert lida com conflitos de código se definido como PK
    const { error } = await supabase.from('item_tags').upsert(entries, { onConflict: 'codigo' });
    if (error) throw error;

    return true;
  } catch (err) {
    console.error('Erro ao salvar etiquetas no Supabase:', err);
    return false;
  }
}
/**
 * Funções para Catálogo Global de Etiquetas (Tags)
 */
export async function getGlobalTags(): Promise<string[]> {
    if (USE_LOCAL_DB) return ['VÍDEO', 'PEDIR', 'FOTO', 'WILLIAM', 'SP'];
    
    try {
        const { data, error } = await supabase
            .from('tags_disponiveis')
            .select('nome')
            .order('nome', { ascending: true });
        
        if (error) throw error;
        return data?.map(row => row.nome) || [];
    } catch (err) {
        console.error('Erro ao buscar catálogo de tags:', err);
        return ['VÍDEO', 'PEDIR', 'FOTO', 'WILLIAM', 'SP'];
    }
}

export async function addGlobalTag(nome: string): Promise<boolean> {
    if (USE_LOCAL_DB) return false;
    try {
        const { error } = await supabase
            .from('tags_disponiveis')
            .insert([{ nome: nome.toUpperCase() }]);
        
        if (error) throw error;
        return true;
    } catch (err) {
        console.error('Erro ao adicionar tag global:', err);
        return false;
    }
}

export async function deleteGlobalTag(nome: string): Promise<boolean> {
    if (USE_LOCAL_DB) return false;
    try {
        const { error } = await supabase
            .from('tags_disponiveis')
            .delete()
            .eq('nome', nome);
        
        if (error) throw error;
        return true;
    } catch (err) {
        console.error('Erro ao excluir tag global:', err);
        return false;
    }
}

/**
 * Funções para Inventário Sincronizado (Contagem Cloud)
 */
export async function saveCloudReading(codigo: string, quantidade: number): Promise<boolean> {
    try {
        if (USE_LOCAL_DB) return true;

        const { error } = await supabase
            .from('leituras_estoque')
            .insert([{ codigo, quantidade }]);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Erro ao salvar leitura na nuvem:', error);
        return false;
    }
}

export async function getCloudReadings(): Promise<{ codigo: string, quantidade: number }[]> {
    try {
        if (USE_LOCAL_DB) return [];

        // Busca e agrupa por código somando as quantidades
        const { data, error } = await supabase
            .from('leituras_estoque')
            .select('codigo, quantidade');

        if (error) throw error;
        if (!data) return [];

        // Consolidação local dos bipes
        const consolidated: Record<string, number> = {};
        data.forEach((row: any) => {
            consolidated[row.codigo] = (consolidated[row.codigo] || 0) + Number(row.quantidade);
        });

        return Object.entries(consolidated).map(([codigo, quantidade]) => ({
            codigo,
            quantidade
        }));
    } catch (error) {
        console.error('Erro ao buscar leituras da nuvem:', error);
        return [];
    }
}

export async function clearCloudReadings(): Promise<boolean> {
    try {
        if (USE_LOCAL_DB) return true;

        const { error } = await supabase
            .from('leituras_estoque')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Deleta tudo na tabela

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Erro ao limpar leituras da nuvem:', error);
        return false;
    }
}
