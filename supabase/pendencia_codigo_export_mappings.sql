create table if not exists public.pendencia_codigo_export_mappings (
  codigo_base text primary key,
  codigo_original text not null,
  descricao_original text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pendencia_codigo_export_mappings enable row level security;

drop policy if exists "pendencia_codigo_export_mappings_select" on public.pendencia_codigo_export_mappings;
create policy "pendencia_codigo_export_mappings_select"
on public.pendencia_codigo_export_mappings
for select
using (true);

drop policy if exists "pendencia_codigo_export_mappings_insert" on public.pendencia_codigo_export_mappings;
create policy "pendencia_codigo_export_mappings_insert"
on public.pendencia_codigo_export_mappings
for insert
with check (true);

drop policy if exists "pendencia_codigo_export_mappings_update" on public.pendencia_codigo_export_mappings;
create policy "pendencia_codigo_export_mappings_update"
on public.pendencia_codigo_export_mappings
for update
using (true)
with check (true);

drop policy if exists "pendencia_codigo_export_mappings_delete" on public.pendencia_codigo_export_mappings;
create policy "pendencia_codigo_export_mappings_delete"
on public.pendencia_codigo_export_mappings
for delete
using (true);
