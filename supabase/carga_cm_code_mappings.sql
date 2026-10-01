-- Tabela para persistência de vínculos de códigos (Mapeamento de códigos de planilhas para códigos oficiais MK)
create table if not exists public.carga_cm_code_mappings (
  doc_text text primary key,
  stock_code text not null,
  stock_desc text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Habilitar Row Level Security (RLS)
alter table public.carga_cm_code_mappings enable row level security;

-- Políticas permissivas para leitura e escrita por todos os dispositivos
drop policy if exists "carga_cm_code_mappings_select" on public.carga_cm_code_mappings;
create policy "carga_cm_code_mappings_select" on public.carga_cm_code_mappings
  for select using (true);

drop policy if exists "carga_cm_code_mappings_insert" on public.carga_cm_code_mappings;
create policy "carga_cm_code_mappings_insert" on public.carga_cm_code_mappings
  for insert with check (true);

drop policy if exists "carga_cm_code_mappings_update" on public.carga_cm_code_mappings;
create policy "carga_cm_code_mappings_update" on public.carga_cm_code_mappings
  for update using (true) with check (true);

drop policy if exists "carga_cm_code_mappings_delete" on public.carga_cm_code_mappings;
create policy "carga_cm_code_mappings_delete" on public.carga_cm_code_mappings
  for delete using (true);
