-- ============================================================
-- BLOCO 2 — RECIBO POR EMPRESA + EXCLUSÃO ATÔMICA
-- Sucata Curió — 2026-11-18
-- Transação única. Para desfazer: 20261118_bloco2_rollback.sql
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Contador de recibo por empresa
-- ------------------------------------------------------------
alter table public.companies
  add column if not exists ultimo_numero_recibo integer not null default 0;

-- Continua a numeração atual de cada empresa (Sucata Curió segue de onde parou)
update public.companies c
set ultimo_numero_recibo = coalesce(
  (select max(numero_recibo) from public.compras where company_id = c.id), 0);

create or replace function public.set_numero_recibo()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Sempre gera no banco; ignora qualquer número enviado pelo cliente.
  -- O UPDATE trava a linha da empresa, então duas compras simultâneas
  -- nunca recebem o mesmo número.
  update public.companies
     set ultimo_numero_recibo = ultimo_numero_recibo + 1
   where id = new.company_id
  returning ultimo_numero_recibo into new.numero_recibo;

  if new.numero_recibo is null then
    raise exception 'Empresa % não encontrada ao gerar número do recibo', new.company_id;
  end if;

  return new;
end;
$function$;

drop trigger if exists compras_set_numero_recibo on public.compras;
create trigger compras_set_numero_recibo
before insert on public.compras
for each row execute function public.set_numero_recibo();

alter table public.compras alter column numero_recibo drop default;
alter table public.compras alter column numero_recibo set not null;

-- Garante que nunca haverá recibo repetido dentro da mesma empresa.
-- Se já existir duplicado, a migration inteira falha e nada é aplicado.
alter table public.compras
  drop constraint if exists compras_company_recibo_unique;
alter table public.compras
  add constraint compras_company_recibo_unique unique (company_id, numero_recibo);

-- ------------------------------------------------------------
-- 2. Admin da empresa não altera contador, slug nem status da empresa
-- ------------------------------------------------------------
revoke update on public.companies from authenticated;
grant update (nome, telefone, endereco, bairro, cnpj, logo_url)
  on public.companies to authenticated;

-- ------------------------------------------------------------
-- 3. Exclusão de compra numa única transação, com erro explícito
--    SECURITY INVOKER: as policies de DELETE (só admin) continuam valendo.
-- ------------------------------------------------------------
create or replace function public.excluir_compra(p_compra_id uuid)
returns void
language plpgsql
security invoker
set search_path to 'public'
as $function$
declare
  v_apagadas integer;
begin
  delete from public.financeiro where compra_id = p_compra_id;
  delete from public.compras where id = p_compra_id;
  get diagnostics v_apagadas = row_count;

  if v_apagadas = 0 then
    raise exception 'Compra não excluída: apenas administradores podem excluir, ou a compra não existe.'
      using errcode = '42501';
  end if;
end;
$function$;

revoke execute on function public.excluir_compra(uuid) from public, anon;
grant execute on function public.excluir_compra(uuid) to authenticated;

commit;
