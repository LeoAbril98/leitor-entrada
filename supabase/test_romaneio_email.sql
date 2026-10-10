begin;
do $$
declare pedido uuid := gen_random_uuid(); resultado jsonb;
begin
  insert into public.pedidos_romaneio (id, origem, carga_id, carga_numero, itens, pdf_path, excel_path, data_criacao)
    values (pedido, 'CM', 'teste-descartavel', 'CM-TESTE', '[]', 'teste.pdf', 'teste.xlsx', now());
  update public.romaneio_email_config set ativo = true, destinatarios = array['teste@example.com'] where origem = 'CM';
  resultado := public.reservar_email_romaneio(pedido);
  if resultado->>'reservado' <> 'true' or resultado->'destinatarios' <> '["teste@example.com"]'::jsonb then
    raise exception 'Reserva inicial incorreta';
  end if;
  resultado := public.reservar_email_romaneio(pedido);
  if resultado->>'reservado' <> 'false' then raise exception 'Reserva duplicada'; end if;
  update public.romaneio_email_envios set estado = 'falhou' where pedido_id = pedido;
  resultado := public.reservar_email_romaneio(pedido);
  if resultado->>'reservado' <> 'true' then raise exception 'Repeticao de falha bloqueada'; end if;
  update public.romaneio_email_envios set estado = 'enviado' where pedido_id = pedido;
  resultado := public.reservar_email_romaneio(pedido);
  if resultado->>'reservado' <> 'false' or resultado->>'estado' <> 'enviado' then raise exception 'Pedido enviado reservado novamente'; end if;
  update public.romaneio_email_envios set estado = 'enviando', iniciado_em = now() - interval '3 minutes' where pedido_id = pedido;
  resultado := public.reservar_email_romaneio(pedido);
  if resultado->>'estado' <> 'incerto' then raise exception 'Reserva abandonada precisa de conferencia'; end if;
end;
$$;
select 'Reservas e repeticoes verificadas. Nenhum e-mail enviado; teste revertido.' as resultado;
rollback;
