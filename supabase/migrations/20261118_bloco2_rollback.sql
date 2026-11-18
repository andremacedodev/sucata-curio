-- Desfaz o bloco 2. Os recibos já emitidos mantêm seus números;
-- a sequência global volta a partir do maior número existente.
begin;

drop function if exists public.excluir_compra(uuid);

grant update on public.companies to authenticated;

alter table public.compras drop constraint if exists compras_company_recibo_unique;
drop trigger if exists compras_set_numero_recibo on public.compras;
drop function if exists public.set_numero_recibo();

select setval('public.numero_recibo_seq',
  greatest((select coalesce(max(numero_recibo), 0) from public.compras), 1));
alter table public.compras alter column numero_recibo set default nextval('public.numero_recibo_seq');
alter table public.compras alter column numero_recibo drop not null;

alter table public.companies drop column if exists ultimo_numero_recibo;

commit;
