/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js'

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
