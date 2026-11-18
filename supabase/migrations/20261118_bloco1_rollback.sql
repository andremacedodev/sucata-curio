-- Desfaz o bloco 1, voltando ao estado exportado em 2026-11-18.
begin;

-- Policies por empresa como estavam
drop policy if exists financeiro_select on public.financeiro;
drop policy if exists financeiro_insert on public.financeiro;
drop policy if exists financeiro_update on public.financeiro;
create policy financeiro_select on public.financeiro for select using (is_company_member(company_id));
create policy financeiro_insert on public.financeiro for insert with check (is_company_member(company_id));
create policy financeiro_update on public.financeiro for update using (is_company_member(company_id)) with check (is_company_member(company_id));

drop policy if exists vendas_select on public.vendas;
drop policy if exists vendas_insert on public.vendas;
drop policy if exists vendas_update on public.vendas;
create policy vendas_select on public.vendas for select using (is_company_member(company_id));
create policy vendas_insert on public.vendas for insert with check (is_company_member(company_id));
create policy vendas_update on public.vendas for update using (is_company_member(company_id)) with check (is_company_member(company_id));

drop policy if exists clientes_select on public.clientes;
drop policy if exists clientes_insert on public.clientes;
drop policy if exists clientes_update on public.clientes;
create policy clientes_select on public.clientes for select using (is_company_member(company_id));
create policy clientes_insert on public.clientes for insert with check (is_company_member(company_id));
create policy clientes_update on public.clientes for update using (is_company_member(company_id)) with check (is_company_member(company_id));

drop policy if exists compras_update on public.compras;
create policy compras_update on public.compras for update using (is_company_member(company_id)) with check (is_company_member(company_id));

drop policy if exists itens_compra_update on public.itens_compra;
create policy itens_compra_update on public.itens_compra for update using (is_company_member(company_id)) with check (is_company_member(company_id));

drop policy if exists itens_compra_insert on public.itens_compra;
create policy itens_compra_insert on public.itens_compra for insert with check (is_company_member(company_id));

drop policy if exists profiles_select_company_admin on public.profiles;

-- Policies globais antigas
create policy profiles_select_own_or_admin on public.profiles for select to authenticated using ((id = auth.uid()) or is_admin());
create policy profiles_update_own_or_admin on public.profiles for update to authenticated using ((id = auth.uid()) or is_admin()) with check ((id = auth.uid()) or is_admin());
create policy profiles_insert_admin on public.profiles for insert to authenticated with check (is_admin());
create policy profiles_delete_admin on public.profiles for delete to authenticated using (is_admin());
create policy materiais_select_admin_operator on public.materiais for select to authenticated using (is_admin() or is_operator());
create policy materiais_insert_admin on public.materiais for insert to authenticated with check (is_admin());
create policy materiais_update_admin on public.materiais for update to authenticated using (is_admin()) with check (is_admin());
create policy clientes_admin_all on public.clientes for all to authenticated using (is_admin()) with check (is_admin());
create policy compras_select_admin_operator on public.compras for select to authenticated using (is_admin() or is_operator());
create policy compras_insert_admin_operator on public.compras for insert to authenticated with check (is_admin() or is_operator());
create policy compras_update_admin on public.compras for update to authenticated using (is_admin()) with check (is_admin());
create policy itens_compra_select_admin_operator on public.itens_compra for select to authenticated using (is_admin() or is_operator());
create policy itens_compra_insert_admin_operator on public.itens_compra for insert to authenticated with check (is_admin() or is_operator());
create policy itens_compra_update_admin on public.itens_compra for update to authenticated using (is_admin()) with check (is_admin());
create policy financeiro_admin_all on public.financeiro for all to authenticated using (is_admin()) with check (is_admin());
create policy vendas_admin_all on public.vendas for all to authenticated using (is_admin()) with check (is_admin());

-- Privilégios
grant insert, update, delete, truncate on public.profiles to authenticated;
grant truncate on
  public.companies, public.company_members, public.clientes, public.materiais,
  public.compras, public.itens_compra, public.financeiro, public.vendas
to authenticated;

-- handle_new_user original (role vindo do metadata)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public', 'auth'
as $function$
begin
  insert into public.profiles (id, email, nome, role)
  values (new.id, new.email,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'OPERADOR'))
  on conflict (id) do nothing;
  return new;
end;
$function$;

commit;
