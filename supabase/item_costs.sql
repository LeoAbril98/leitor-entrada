create table if not exists public.item_costs (
  codigo text primary key,
  custo numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.item_costs enable row level security;

drop policy if exists "item_costs_select" on public.item_costs;
create policy "item_costs_select"
on public.item_costs
for select
using (true);

drop policy if exists "item_costs_insert" on public.item_costs;
create policy "item_costs_insert"
on public.item_costs
for insert
with check (true);

drop policy if exists "item_costs_update" on public.item_costs;
create policy "item_costs_update"
on public.item_costs
for update
using (true)
with check (true);

drop policy if exists "item_costs_delete" on public.item_costs;
create policy "item_costs_delete"
on public.item_costs
for delete
using (true);
