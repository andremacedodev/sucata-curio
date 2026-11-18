-- ============================================================
-- BLOCO 8 — EQUIPE GERENCIADA PELO ADMIN DA EMPRESA
-- Peso Certo — 2026-11-18
-- Para desfazer: 20261118_bloco8_rollback.sql
--
-- * Trava: a empresa nunca fica sem pelo menos um admin ativo
--   (nem desativando, nem rebaixando, nem apagando o último admin).
-- * Trava: um vínculo não pode ser "movido" para outra empresa/usuário.
-- * listar_equipe(): membros da empresa com nome, e-mail, papel, status,
--   último acesso e se o convite ainda está pendente. Só para admin.
-- O convite em si é feito pela Edge Function "convidar-membro".
-- ============================================================

begin;

create or replace function public.proteger_ultimo_admin()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_era_admin_ativo  boolean := old.role = 'admin' and old.ativo;
  v_segue_admin_ativo boolean := tg_op = 'UPDATE' and new.role = 'admin' and new.ativo;
begin
  if tg_op = 'UPDATE'
     and (new.company_id <> old.company_id or new.user_id <> old.user_id) then
    raise exception 'Não é permitido mover um vínculo para outra empresa ou outro usuário.'
      using errcode = '42501';
  end if;

  if v_era_admin_ativo and not v_segue_admin_ativo then
    if not exists (
      select 1 from public.company_members cm
      where cm.company_id = old.company_id
        and cm.id <> old.id
        and cm.role = 'admin'
        and cm.ativo = true
    ) then
      raise exception 'A empresa precisa ter pelo menos um administrador ativo.'
        using errcode = '23514';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

drop trigger if exists company_members_proteger_admin on public.company_members;
create trigger company_members_proteger_admin
before update or delete on public.company_members
for each row execute function public.proteger_ultimo_admin();

-- Lista a equipe da empresa. SECURITY DEFINER para ler último acesso em
-- auth.users; por isso confere explicitamente que quem chama é admin.
create or replace function public.listar_equipe(p_company_id uuid)
returns table (
  user_id          uuid,
  nome             text,
  email            text,
  role             text,
  ativo            boolean,
  criado_em        timestamptz,
  ultimo_acesso    timestamptz,
  convite_pendente boolean
)
language plpgsql
stable
security definer
set search_path to 'public', 'auth'
as $function$
begin
  if not public.is_company_admin(p_company_id) then
    raise exception 'Apenas o administrador da empresa pode ver a equipe.'
      using errcode = '42501';
  end if;

  return query
  select cm.user_id,
         p.nome,
         coalesce(p.email, u.email)::text,
         cm.role::text,
         cm.ativo,
         cm.criado_em,
         u.last_sign_in_at,
         (u.last_sign_in_at is null)
  from public.company_members cm
  left join public.profiles p on p.id = cm.user_id
  left join auth.users u      on u.id = cm.user_id
  where cm.company_id = p_company_id
  order by cm.ativo desc, (cm.role = 'admin') desc, coalesce(p.nome, p.email);
end;
$function$;

revoke execute on function public.listar_equipe(uuid) from public, anon;
grant  execute on function public.listar_equipe(uuid) to authenticated;

commit;
