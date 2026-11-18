-- Desfaz o bloco 4. Antes de rodar, volte o front para a versão
-- anterior de createCompra (duas chamadas), senão Nova Compra para de funcionar.
begin;
drop function if exists public.criar_compra(text, text, text, jsonb);
commit;
