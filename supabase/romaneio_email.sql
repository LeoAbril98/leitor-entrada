begin;

create table if not exists public.romaneio_email_config (
  origem text primary key check (origem in ('SC', 'CM')),
  ativo boolean not null default false,
  destinatarios text[] not null default '{}',
  atualizado_em timestamptz not null default now(),
  check (cardinality(destinatarios) <= 20),
  check (not ativo or cardinality(destinatarios) > 0)
);
insert into public.romaneio_email_config (origem) values ('SC'), ('CM') on conflict do nothing;
alter table public.romaneio_email_config enable row level security;
revoke all on public.romaneio_email_config from public, anon, authenticated;
grant all on public.romaneio_email_config to service_role;

create table if not exists public.romaneio_email_envios (
  pedido_id uuid primary key references public.pedidos_romaneio(id) on delete cascade,
  estado text not null check (estado in ('enviando', 'enviado', 'falhou', 'incerto')),
  destinatarios text[] not null,
  tentativas integer not null default 1,
  iniciado_em timestamptz not null default now(),
  enviado_em timestamptz,
  mensagem text,
  message_id text
);
alter table public.romaneio_email_envios enable row level security;
revoke all on public.romaneio_email_envios from public, anon, authenticated;
grant all on public.romaneio_email_envios to service_role;
grant select (pedido_id, estado, iniciado_em, enviado_em, mensagem) on public.romaneio_email_envios to anon, authenticated;
create policy romaneio_email_status_select on public.romaneio_email_envios
  for select to anon, authenticated using (true);

-- Serialize reservations across requests and server instances before contacting Gmail.
create or replace function public.reservar_email_romaneio(p_pedido uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare pedido public.pedidos_romaneio; cfg public.romaneio_email_config;
  envio public.romaneio_email_envios; usados integer;
begin
  perform pg_advisory_xact_lock(731802);
  select * into pedido from public.pedidos_romaneio where id = p_pedido;
  if not found then raise exception 'Pedido nao encontrado'; end if;
  select * into envio from public.romaneio_email_envios where pedido_id = p_pedido;
  if found and envio.estado <> 'falhou' then
    if envio.estado = 'enviando' and envio.iniciado_em < now() - interval '2 minutes' then
      update public.romaneio_email_envios set estado = 'incerto',
        mensagem = 'Confira o Gmail antes de tentar outro envio.' where pedido_id = p_pedido;
      envio.estado := 'incerto';
    end if;
    return jsonb_build_object('estado', envio.estado, 'reservado', false);
  end if;
  select * into cfg from public.romaneio_email_config where origem = pedido.origem;
  if not found or not cfg.ativo or cardinality(cfg.destinatarios) = 0 then
    return jsonb_build_object('estado', 'desativado', 'reservado', false);
  end if;
  select coalesce(sum(tentativas), 0) into usados from public.romaneio_email_envios
    where iniciado_em >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  if usados >= 10 then
    return jsonb_build_object('estado', 'limite', 'reservado', false);
  end if;
  insert into public.romaneio_email_envios as e (pedido_id, estado, destinatarios)
    values (p_pedido, 'enviando', cfg.destinatarios)
    on conflict (pedido_id) do update set estado = 'enviando',
      tentativas = e.tentativas + 1, iniciado_em = now(), mensagem = null;
  select * into envio from public.romaneio_email_envios where pedido_id = p_pedido;
  return jsonb_build_object('estado', 'enviando', 'reservado', true, 'destinatarios', envio.destinatarios);
end;
$$;
revoke all on function public.reservar_email_romaneio(uuid) from public, anon, authenticated;
grant execute on function public.reservar_email_romaneio(uuid) to service_role;
notify pgrst, 'reload schema';
commit;
