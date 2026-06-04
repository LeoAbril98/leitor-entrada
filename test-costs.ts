import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testQuery() {
  const { data, error } = await supabase
    .from('item_costs')
    .select('codigo, custo')
    .limit(5);

  if (error) {
    console.log('Error querying item_costs:', error.message || error);
  } else {
    console.log('Successfully queried item_costs, data:', data);
  }
}

testQuery();
