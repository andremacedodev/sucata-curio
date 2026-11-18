-- Desfaz o bloco 7. Antes de rodar, volte o front do Histórico para a versão
-- anterior (getCompras com limite de 100), senão a tela para de carregar.
begin;
drop function if exists public.buscar_compras(text, timestamptz, timestamptz, integer, integer);
drop index if exists public.compras_company_data_idx;
drop index if exists public.itens_compra_compra_id_idx;
commit;
