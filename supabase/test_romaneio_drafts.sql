-- Testa as funcoes e desfaz os dados de teste antes de finalizar.
begin;
do $$
declare aparelho uuid := gen_random_uuid(); outro uuid := gen_random_uuid(); payload jsonb;
begin
  payload := jsonb_build_object('id', gen_random_uuid(), 'cargaId', 'verificacao', 'origem', 'CM', 'itens', '[]'::jsonb);
  perform public.salvar_rascunho_romaneio(aparelho, 'CM', 2, payload);
  assert (select versao from public.ler_rascunho_romaneio(aparelho, 'CM')) = 2;
  assert not exists (select 1 from public.ler_rascunho_romaneio(outro, 'CM'));
  assert not exists (select 1 from public.ler_rascunho_romaneio(aparelho, 'SC'));
  perform public.salvar_rascunho_romaneio(aparelho, 'CM', 1, null);
  assert (select rascunho from public.ler_rascunho_romaneio(aparelho, 'CM')) = payload;
  perform public.salvar_rascunho_romaneio(aparelho, 'CM', 3, null);
  perform public.salvar_rascunho_romaneio(aparelho, 'CM', 2, payload);
  assert (select rascunho from public.ler_rascunho_romaneio(aparelho, 'CM')) is null;
  assert (select versao from public.ler_rascunho_romaneio(aparelho, 'CM')) = 3;
  assert not has_table_privilege('anon', 'public.romaneio_pedido_rascunhos', 'SELECT');
end;
$$;
rollback;
select relname as tabela, relrowsecurity as protecao_ativa from pg_class
where relnamespace = 'public'::regnamespace
and relname in ('romaneio_estoque_cm', 'pedidos_romaneio', 'romaneio_pedido_rascunhos')
order by relname;
