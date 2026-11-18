-- ============================================================
-- BLOCO 1 — SEGURANÇA / ISOLAMENTO ENTRE EMPRESAS
-- Sucata Curió — 2026-11-18
--
-- ANTES DE RODAR: execute 00_pre_check.sql e confirme que todo
-- usuário ADMIN em profiles também é 'admin' em company_members.
-- Se algo falhar no meio, nada é aplicado (transação única).
-- Para desfazer: 20261118_bloco1_rollback.sql
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Garantir RLS ligado em todas as tabelas (idempotente)
-- ------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.companies       enable row level security;
alter table public.company_members enable row level security;
alter table public.clientes        enable row level security;
alter table public.materiais       enable row level security;
alter table public.compras         enable row level security;
alter table public.itens_compra    enable row level security;
alter table public.financeiro      enable row level security;
alter table public.vendas          enable row level security;

-- ------------------------------------------------------------
-- 2. Remover as policies antigas GLOBAIS (is_admin / is_operator)
--    Elas somam (OR) com as policies por empresa e liberam
--    acesso a dados de TODAS as empresas.
-- ------------------------------------------------------------
drop policy if exists profiles_select_own_or_admin        on public.profiles;
drop policy if exists profiles_update_own_or_admin        on public.profiles;
drop policy if exists profiles_insert_admin               on public.profiles;
drop policy if exists profiles_delete_admin               on public.profiles;
drop policy if exists materiais_select_admin_operator     on public.materiais;
drop policy if exists materiais_insert_admin              on public.materiais;
drop policy if exists materiais_update_admin              on public.materiais;
drop policy if exists clientes_admin_all                  on public.clientes;
drop policy if exists compras_select_admin_operator       on public.compras;
drop policy if exists compras_insert_admin_operator       on public.compras;
drop policy if exists compras_update_admin                on public.compras;
drop policy if exists itens_compra_select_admin_operator  on public.itens_compra;
drop policy if exists itens_compra_insert_admin_operator  on public.itens_compra;
drop policy if exists itens_compra_update_admin           on public.itens_compra;
drop policy if exists financeiro_admin_all                on public.financeiro;
drop policy if exists vendas_admin_all                    on public.vendas;

-- ------------------------------------------------------------
-- 3. Financeiro, vendas e clientes: só ADMIN da empresa
--    (a saída automática da compra continua funcionando: o trigger
--     registrar_saida_financeiro é SECURITY DEFINER)
-- ------------------------------------------------------------
drop policy if exists financeiro_select on public.financeiro;
drop policy if exists financeiro_insert on public.financeiro;
drop policy if exists financeiro_update on public.financeiro;
create policy financeiro_select on public.financeiro for select
  using (public.is_company_admin(company_id));
create policy financeiro_insert on public.financeiro for insert
  with check (public.is_company_admin(company_id));
create policy financeiro_update on public.financeiro for update
  using (public.is_company_admin(company_id))
  with check (public.is_company_admin(company_id));

drop policy if exists vendas_select on public.vendas;
drop policy if exists vendas_insert on public.vendas;
drop policy if exists vendas_update on public.vendas;
create policy vendas_select on public.vendas for select
  using (public.is_company_admin(company_id));
create policy vendas_insert on public.vendas for insert
  with check (public.is_company_admin(company_id));
create policy vendas_update on public.vendas for update
  using (public.is_company_admin(company_id))
  with check (public.is_company_admin(company_id));

drop policy if exists clientes_select on public.clientes;
drop policy if exists clientes_insert on public.clientes;
drop policy if exists clientes_update on public.clientes;
create policy clientes_select on public.clientes for select
  using (public.is_company_admin(company_id));
create policy clientes_insert on public.clientes for insert
  with check (public.is_company_admin(company_id));
create policy clientes_update on public.clientes for update
  using (public.is_company_admin(company_id))
  with check (public.is_company_admin(company_id));

-- ------------------------------------------------------------
-- 4. Compras e itens: operador lê e cria; só ADMIN altera
-- ------------------------------------------------------------
drop policy if exists compras_update on public.compras;
create policy compras_update on public.compras for update
  using (public.is_company_admin(company_id))
  with check (public.is_company_admin(company_id));

drop policy if exists itens_compra_update on public.itens_compra;
create policy itens_compra_update on public.itens_compra for update
  using (public.is_company_admin(company_id))
  with check (public.is_company_admin(company_id));

-- Item só pode ser ligado a uma compra da mesma empresa
drop policy if exists itens_compra_insert on public.itens_compra;
create policy itens_compra_insert on public.itens_compra for insert
  with check (
    public.is_company_member(company_id)
    and exists (
      select 1 from public.compras c
      where c.id = compra_id and c.company_id = itens_compra.company_id
    )
  );

-- ------------------------------------------------------------
-- 5. Profiles: usuário NÃO pode mais alterar o próprio role/ativo
--    (antes, um OPERADOR conseguia se promover a ADMIN pela API)
-- ------------------------------------------------------------
revoke insert, update, delete on public.profiles from authenticated;
grant update (nome) on public.profiles to authenticated;
-- profiles_select_own e profiles_update_own (id = auth.uid()) continuam.

-- Admin da empresa enxerga o perfil dos membros da própria empresa
drop policy if exists profiles_select_company_admin on public.profiles;
create policy profiles_select_company_admin on public.profiles for select
  using (
    exists (
      select 1 from public.company_members cm
      where cm.user_id = profiles.id
        and public.is_company_admin(cm.company_id)
    )
  );

-- ------------------------------------------------------------
-- 6. Novo usuário sempre nasce OPERADOR
--    (antes o role vinha de raw_user_meta_data, que quem se
--     cadastra controla — dava para se cadastrar já como ADMIN)
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
begin
  insert into public.profiles (id, email, nome, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    'OPERADOR'
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

-- ------------------------------------------------------------
-- 7. TRUNCATE ignora RLS — ninguém pela API precisa disso
-- ------------------------------------------------------------
revoke truncate on
  public.profiles, public.companies, public.company_members,
  public.clientes, public.materiais, public.compras,
  public.itens_compra, public.financeiro, public.vendas
from authenticated, anon;

commit;
