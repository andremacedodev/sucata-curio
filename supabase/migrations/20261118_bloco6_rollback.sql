-- Desfaz o bloco 6. Os arquivos já enviados continuam no bucket;
-- apague-os pelo painel (Storage > logos) se quiser remover tudo.
begin;
drop policy if exists logos_select_admin on storage.objects;
drop policy if exists logos_insert_admin on storage.objects;
drop policy if exists logos_update_admin on storage.objects;
drop policy if exists logos_delete_admin on storage.objects;
drop function if exists public.is_admin_da_pasta(text);
commit;
