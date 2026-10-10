begin;

create policy romaneio_files_select on storage.objects for select to anon, authenticated
using (bucket_id = 'fotos' and (
  name like 'pedidos-rodas-sc/%' or name like 'pedidos-rodas-cm/%'
  or name in ('sync/romaneios_data.json', 'sync/romaneios_deleted_ids.json')
));
create policy romaneio_files_insert on storage.objects for insert to anon, authenticated
with check (bucket_id = 'fotos' and (
  name like 'pedidos-rodas-sc/%' or name like 'pedidos-rodas-cm/%'
  or name in ('sync/romaneios_data.json', 'sync/romaneios_deleted_ids.json')
));
create policy romaneio_files_update on storage.objects for update to anon, authenticated
using (bucket_id = 'fotos' and (
  name like 'pedidos-rodas-sc/%' or name like 'pedidos-rodas-cm/%'
  or name in ('sync/romaneios_data.json', 'sync/romaneios_deleted_ids.json')
))
with check (bucket_id = 'fotos' and (
  name like 'pedidos-rodas-sc/%' or name like 'pedidos-rodas-cm/%'
  or name in ('sync/romaneios_data.json', 'sync/romaneios_deleted_ids.json')
));
create policy romaneio_files_delete on storage.objects for delete to anon, authenticated
using (bucket_id = 'fotos' and (
  name like 'pedidos-rodas-sc/%' or name like 'pedidos-rodas-cm/%'
  or name in ('sync/romaneios_data.json', 'sync/romaneios_deleted_ids.json')
));
notify pgrst, 'reload schema';
commit;
