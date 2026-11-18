-- ============================================================
-- BLOCO 6 — LOGO DA EMPRESA (Supabase Storage)
-- Peso Certo — 2026-11-18
-- Para desfazer: 20261118_bloco6_rollback.sql
--
-- Bucket "logos":
--   * leitura pública (o logo aparece no app e no recibo em PDF)
--   * cada empresa tem a própria pasta: logos/<company_id>/arquivo.png
--   * só o ADMIN da empresa envia, troca ou apaga arquivos da pasta dela
--   * até 2 MB, apenas PNG, JPEG ou WEBP (SVG fica de fora: pode conter script)
-- ============================================================

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A pasta (1º nível do caminho) precisa ser o id de uma empresa
-- onde o usuário é admin ativo. Compara como texto para que um nome de
-- pasta inválido apenas negue o acesso, sem erro de conversão.
create or replace function public.is_admin_da_pasta(p_pasta text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.company_members cm
    join public.companies c on c.id = cm.company_id
    where cm.company_id::text = p_pasta
      and cm.user_id = auth.uid()
      and cm.role = 'admin'
      and cm.ativo = true
      and c.ativo = true
  );
$function$;

revoke execute on function public.is_admin_da_pasta(text) from public, anon;
grant  execute on function public.is_admin_da_pasta(text) to authenticated;

drop policy if exists logos_insert_admin on storage.objects;
drop policy if exists logos_update_admin on storage.objects;
drop policy if exists logos_delete_admin on storage.objects;

create policy logos_insert_admin on storage.objects for insert to authenticated
  with check (
    bucket_id = 'logos'
    and public.is_admin_da_pasta((storage.foldername(name))[1])
  );

create policy logos_update_admin on storage.objects for update to authenticated
  using (
    bucket_id = 'logos'
    and public.is_admin_da_pasta((storage.foldername(name))[1])
  )
  with check (
    bucket_id = 'logos'
    and public.is_admin_da_pasta((storage.foldername(name))[1])
  );

create policy logos_delete_admin on storage.objects for delete to authenticated
  using (
    bucket_id = 'logos'
    and public.is_admin_da_pasta((storage.foldername(name))[1])
  );

-- Leitura pela API (listar/apagar exige SELECT): só a pasta da própria empresa.
-- A exibição do logo usa a URL pública do bucket e não depende desta policy.
drop policy if exists logos_select_admin on storage.objects;
create policy logos_select_admin on storage.objects for select to authenticated
  using (
    bucket_id = 'logos'
    and public.is_admin_da_pasta((storage.foldername(name))[1])
  );

commit;
