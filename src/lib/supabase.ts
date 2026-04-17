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

export async function getInventory() {
  let allData: any[] = []
  let hasMore = true
  let page = 0
  const pageSize = 1000

  // The PostgREST API limits single queries to 1000 rows by default.
  // We need to paginate to get all items.
  try {
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
export async function syncPendenciasToCloud(data: import('../types').StockItem[]) {
  try {
    // 1. Criar cabeçalho para registro de data
    const { data: invData, error: invError } = await supabase
      .from('inventarios')
      .insert({ criado_em: new Date().toISOString() })
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

export async function getLastUpdate(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('inventarios')
      .select('criado_em')
      .order('criado_em', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      throw error;
    }
    return data?.criado_em || null;
  } catch (error) {
    console.error('Erro ao buscar última atualização do inventário (Supabase):', error);
    return null;
  }
}

export async function loadPedidosFabrica() {
  try {
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

export async function archiveAndClearPedidos() {
  try {
    // 1. Buscar dados atuais
    const { data: currentData, error: fetchError } = await supabase
      .from('pedidos_fabrica')
      .select('codigo, factory, quantidade')

    if (fetchError) throw fetchError;
    if (!currentData || currentData.length === 0) return true;

    // 2. Preparar dados para o histórico
    const batchName = `Semana de ${new Date().toLocaleDateString('pt-BR')}`;
    const historyData = currentData.map(item => ({
      ...item,
      lote_nome: batchName,
      arquivado_em: new Date().toISOString()
    }));

    // 3. Inserir no histórico
    const { error: historyError } = await supabase
      .from('pedidos_fabrica_historico')
      .insert(historyData)

    if (historyError) throw historyError;

    // 4. Limpar tabela principal
    const { error: deleteError } = await supabase
      .from('pedidos_fabrica')
      .delete()
      .neq('codigo', 'dummy_value_to_allow_unfiltered_delete') 

    if (deleteError) {
      // Tentar deletar todos de forma simples se o acima falhar (algumas configs de Supabase exigem filtro)
      const { error: deleteError2 } = await supabase
        .from('pedidos_fabrica')
        .delete()
        .gte('quantidade', -1); 
      if (deleteError2) throw deleteError2;
    }

    return true;
  } catch (error) {
    console.error('Erro ao arquivar e limpar pedidos:', error);
    return false;
  }
}
