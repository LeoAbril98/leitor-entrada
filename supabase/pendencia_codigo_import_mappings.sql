create table if not exists public.pendencia_codigo_import_mappings (
  codigo_importado text primary key,
  codigo_base text not null,
  descricao_importada text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pendencia_codigo_import_mappings enable row level security;

drop policy if exists "pendencia_codigo_import_mappings_select" on public.pendencia_codigo_import_mappings;
create policy "pendencia_codigo_import_mappings_select"
on public.pendencia_codigo_import_mappings
for select
using (true);

drop policy if exists "pendencia_codigo_import_mappings_insert" on public.pendencia_codigo_import_mappings;
create policy "pendencia_codigo_import_mappings_insert"
on public.pendencia_codigo_import_mappings
for insert
with check (true);

drop policy if exists "pendencia_codigo_import_mappings_update" on public.pendencia_codigo_import_mappings;
create policy "pendencia_codigo_import_mappings_update"
on public.pendencia_codigo_import_mappings
for update
using (true)
with check (true);

drop policy if exists "pendencia_codigo_import_mappings_delete" on public.pendencia_codigo_import_mappings;
create policy "pendencia_codigo_import_mappings_delete"
on public.pendencia_codigo_import_mappings
for delete
using (true);
