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
  while (hasMore) {
    const { data, error } = await supabase
      .from('inventario_itens')
      .select('codigo, descricao, local')
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (error) {
      console.error('Erro ao buscar inventário do Supabase:', error.message)
      return allData.length > 0 ? mapData(allData) : []
    }

    if (data && data.length > 0) {
      allData = [...allData, ...data]
      page++
      // If we got exactly the page size, there might be more
      hasMore = data.length === pageSize
    } else {
      hasMore = false
    }
  }

  return mapData(allData)
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
      local: localFormatado
    };
  })
}
