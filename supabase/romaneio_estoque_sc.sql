begin;

create table if not exists public.romaneio_estoque_sc (
  codigo text primary key,
  descricao text not null default '',
  quantidade integer not null default 0 check (quantidade >= 0),
  arquivo_origem text,
  atualizado_em timestamptz not null default now(),
  constraint romaneio_estoque_sc_codigo_normalizado
    check (codigo <> '' and codigo = upper(btrim(codigo)))
);

alter table public.romaneio_estoque_sc enable row level security;

drop policy if exists "romaneio_estoque_sc_select" on public.romaneio_estoque_sc;
create policy "romaneio_estoque_sc_select" on public.romaneio_estoque_sc
  for select to anon, authenticated using (true);

grant select on public.romaneio_estoque_sc to anon, authenticated;
revoke insert, update, delete on public.romaneio_estoque_sc from anon, authenticated;

create or replace function public.set_romaneio_estoque_sc_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists romaneio_estoque_sc_updated_at on public.romaneio_estoque_sc;
create trigger romaneio_estoque_sc_updated_at
before update on public.romaneio_estoque_sc
for each row execute function public.set_romaneio_estoque_sc_updated_at();

notify pgrst, 'reload schema';
commit;
