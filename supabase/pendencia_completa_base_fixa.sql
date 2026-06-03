create table if not exists public.pendencia_completa_base_fixa (
  codigo text primary key,
  descricao text not null,
  custo numeric not null default 0,
  ordem integer not null default 0,
  ordem_origem text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pendencia_completa_base_fixa enable row level security;

drop policy if exists "pendencia_completa_base_fixa_select" on public.pendencia_completa_base_fixa;
create policy "pendencia_completa_base_fixa_select"
on public.pendencia_completa_base_fixa
for select
using (true);

drop policy if exists "pendencia_completa_base_fixa_insert" on public.pendencia_completa_base_fixa;
create policy "pendencia_completa_base_fixa_insert"
on public.pendencia_completa_base_fixa
for insert
with check (true);

drop policy if exists "pendencia_completa_base_fixa_update" on public.pendencia_completa_base_fixa;
create policy "pendencia_completa_base_fixa_update"
on public.pendencia_completa_base_fixa
for update
using (true)
with check (true);

drop policy if exists "pendencia_completa_base_fixa_delete" on public.pendencia_completa_base_fixa;
create policy "pendencia_completa_base_fixa_delete"
on public.pendencia_completa_base_fixa
for delete
using (true);
