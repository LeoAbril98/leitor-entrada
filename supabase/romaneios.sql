-- Tabela para persistência e sincronização de Romaneios entre múltiplos dispositivos (PC, Celular, Tablet)
create table if not exists public.romaneios (
  id text primary key,
  numero text not null,
  titulo text not null,
  cliente_ou_destino text default '',
  status text not null default 'pendente',
  total_itens integer not null default 0,
  total_pecas integer not null default 0,
  total_conferido integer not null default 0,
  itens jsonb not null default '[]'::jsonb,
  arquivos jsonb not null default '[]'::jsonb,
  data_criacao timestamptz not null default now(),
  data_atualizacao timestamptz not null default now()
);

-- Habilitar Row Level Security (RLS)
alter table public.romaneios enable row level security;

-- Políticas permissivas para leitura e escrita por todos os operadores
drop policy if exists "romaneios_select" on public.romaneios;
create policy "romaneios_select" on public.romaneios
  for select using (true);

drop policy if exists "romaneios_insert" on public.romaneios;
create policy "romaneios_insert" on public.romaneios
  for insert with check (true);

drop policy if exists "romaneios_update" on public.romaneios;
create policy "romaneios_update" on public.romaneios
  for update using (true) with check (true);

drop policy if exists "romaneios_delete" on public.romaneios;
create policy "romaneios_delete" on public.romaneios
  for delete using (true);
