begin;

create table if not exists public.romaneio_estoque_cm (
  codigo text primary key check (codigo <> '' and codigo = upper(btrim(codigo))),
  descricao text not null default '',
  quantidade integer not null default 0 check (quantidade >= 0),
  arquivo_origem text,
  atualizado_em timestamptz not null default now()
);
alter table public.romaneio_estoque_cm enable row level security;
create policy romaneio_estoque_cm_select on public.romaneio_estoque_cm for select to anon, authenticated using (true);
grant select on public.romaneio_estoque_cm to anon, authenticated;
revoke insert, update, delete on public.romaneio_estoque_cm from anon, authenticated;
create trigger romaneio_estoque_cm_updated_at before update on public.romaneio_estoque_cm
  for each row execute function public.set_romaneio_estoque_sc_updated_at();

create table if not exists public.pedidos_romaneio (
  id uuid primary key,
  origem text not null check (origem in ('SC', 'CM')),
  carga_id text not null,
  carga_numero text not null,
  itens jsonb not null check (jsonb_typeof(itens) = 'array'),
  pdf_path text not null,
  excel_path text not null,
  data_criacao timestamptz not null,
  data_atualizacao timestamptz not null default now()
);
alter table public.pedidos_romaneio enable row level security;
create policy pedidos_romaneio_select on public.pedidos_romaneio for select to anon, authenticated using (true);
create policy pedidos_romaneio_insert on public.pedidos_romaneio for insert to anon, authenticated with check (true);
create policy pedidos_romaneio_update on public.pedidos_romaneio for update to anon, authenticated using (true) with check (true);
create policy pedidos_romaneio_delete on public.pedidos_romaneio for delete to anon, authenticated using (true);
grant select, insert, update, delete on public.pedidos_romaneio to anon, authenticated;

-- A chave aleatoria do aparelho e uma capacidade privada: nao e listavel no app.
create table if not exists public.romaneio_pedido_rascunhos (
  dispositivo_id uuid not null,
  origem text not null check (origem in ('SC', 'CM')),
  versao bigint not null check (versao > 0),
  rascunho jsonb check (rascunho is null or jsonb_typeof(rascunho) = 'object'),
  atualizado_em timestamptz not null default now(),
  primary key (dispositivo_id, origem)
);
alter table public.romaneio_pedido_rascunhos enable row level security;
revoke all on public.romaneio_pedido_rascunhos from anon, authenticated;

create or replace function public.ler_rascunho_romaneio(p_dispositivo uuid, p_origem text)
returns table (rascunho jsonb, versao bigint, atualizado_em timestamptz)
language sql security definer set search_path = pg_catalog, public as $$
  select r.rascunho, r.versao, r.atualizado_em from public.romaneio_pedido_rascunhos r
  where r.dispositivo_id = p_dispositivo and r.origem = p_origem;
$$;

create or replace function public.salvar_rascunho_romaneio(
  p_dispositivo uuid, p_origem text, p_versao bigint, p_rascunho jsonb
) returns bigint language plpgsql security definer set search_path = pg_catalog, public as $$
declare atual bigint;
begin
  if p_dispositivo is null or p_origem not in ('SC','CM') or p_versao is null or p_versao <= 0 then
    raise exception 'Rascunho invalido';
  end if;
  if p_rascunho is not null and (
    jsonb_typeof(p_rascunho) <> 'object' or jsonb_typeof(p_rascunho->'itens') is distinct from 'array'
    or p_rascunho->>'cargaId' is null or p_rascunho->>'id' is null
    or coalesce(p_rascunho->>'origem', p_origem) <> p_origem
  ) then raise exception 'Pedido invalido'; end if;
  insert into public.romaneio_pedido_rascunhos as r (dispositivo_id, origem, versao, rascunho)
  values (p_dispositivo, p_origem, p_versao, p_rascunho)
  on conflict (dispositivo_id, origem) do update set
    versao = excluded.versao, rascunho = excluded.rascunho, atualizado_em = now()
  where excluded.versao > r.versao;
  select versao into atual from public.romaneio_pedido_rascunhos
    where dispositivo_id = p_dispositivo and origem = p_origem;
  return atual;
end;
$$;
revoke all on function public.ler_rascunho_romaneio(uuid,text) from public;
revoke all on function public.salvar_rascunho_romaneio(uuid,text,bigint,jsonb) from public;
grant execute on function public.ler_rascunho_romaneio(uuid,text) to anon, authenticated;
grant execute on function public.salvar_rascunho_romaneio(uuid,text,bigint,jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
