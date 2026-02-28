import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testQuery() {
  const { data, error, count } = await supabase
    .from('inventario_itens')
    .select('codigo, descricao, local', { count: 'exact' })
    .limit(10000);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Total rows in response: ${data.length}`);
  console.log(`Total rows in table (count): ${count}`);
  console.log('First 5 items:', data.slice(0, 5));
  
  // count how many have valid 'codigo'
  const validCodigo = data.filter((row: any) => row.codigo && row.codigo.trim() !== '');
  console.log(`Items with valid codigo: ${validCodigo.length}`);
}

testQuery();
