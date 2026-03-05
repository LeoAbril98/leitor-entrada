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
