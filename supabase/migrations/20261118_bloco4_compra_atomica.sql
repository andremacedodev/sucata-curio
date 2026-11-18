-- ============================================================
-- BLOCO 4 — SALVAR COMPRA NUMA ÚNICA TRANSAÇÃO
-- Sucata Curió — 2026-11-18
-- Depende do bloco 2 (numeração de recibo por empresa).
-- Para desfazer: 20261118_bloco4_rollback.sql
--
-- Antes: o front gravava a compra e depois os itens em duas chamadas.
-- Se a segunda falhasse, ficava uma compra sem itens que já tinha
-- gerado saída no financeiro. Agora tudo acontece numa função: ou grava
-- compra + itens + financeiro, ou não grava nada.
-- ============================================================

begin;

create or replace function public.criar_compra(
  p_cliente_nome    text,
  p_forma_pagamento text,
  p_observacoes     text,
  p_itens           jsonb
)
returns public.compras
language plpgsql
security invoker            -- RLS continua valendo para quem chama
set search_path to 'public'
as $function$
declare
  v_item   jsonb;
  v_total  numeric(10,2);
  v_compra public.compras;
begin
  -- ---------- Validação ----------
  if p_itens is null
     or jsonb_typeof(p_itens) <> 'array'
     or jsonb_array_length(p_itens) = 0 then
    raise exception 'A compra precisa ter pelo menos um item.';
  end if;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    if coalesce(trim(v_item->>'material_nome'), '') = '' then
      raise exception 'Há um item sem nome de material.';
    end if;
    if coalesce((v_item->>'peso_kg')::numeric, 0) <= 0 then
      raise exception 'Peso inválido no item "%".', v_item->>'material_nome';
    end if;
    if coalesce((v_item->>'preco_por_kg')::numeric, 0) <= 0 then
      raise exception 'Preço inválido no item "%".', v_item->>'material_nome';
    end if;
    -- material_id, se vier, precisa ser um material visível para a empresa
    if nullif(v_item->>'material_id', '') is not null
       and not exists (
         select 1 from public.materiais
         where id = (v_item->>'material_id')::uuid
       ) then
      raise exception 'Material "%" não encontrado.', v_item->>'material_nome';
    end if;
  end loop;

  -- ---------- Total calculado no banco ----------
  -- Peso arredondado a 3 casas e preço a 2, como nas colunas da tabela.
  select sum(round(round((e->>'peso_kg')::numeric, 3)
                 * round((e->>'preco_por_kg')::numeric, 2), 2))
    into v_total
    from jsonb_array_elements(p_itens) e;

  -- ---------- Cabeçalho ----------
  -- company_id, numero_recibo, criado_por: preenchidos por default/triggers.
  -- O trigger AFTER INSERT registra a saída no financeiro.
  insert into public.compras (cliente_nome, forma_pagamento, observacoes, valor_total)
  values (
    nullif(trim(p_cliente_nome), ''),
    coalesce(nullif(trim(p_forma_pagamento), ''), 'Dinheiro'),
    nullif(trim(p_observacoes), ''),
    v_total
  )
  returning * into v_compra;

  -- ---------- Itens ----------
  insert into public.itens_compra
    (compra_id, company_id, material_id, material_nome, peso_kg, preco_por_kg, valor_total)
  select
    v_compra.id,
    v_compra.company_id,
    nullif(e->>'material_id', '')::uuid,
    trim(e->>'material_nome'),
    round((e->>'peso_kg')::numeric, 3),
    round((e->>'preco_por_kg')::numeric, 2),
    round(round((e->>'peso_kg')::numeric, 3)
          * round((e->>'preco_por_kg')::numeric, 2), 2)
  from jsonb_array_elements(p_itens) e;

  return v_compra;
end;
$function$;

revoke execute on function public.criar_compra(text, text, text, jsonb) from public, anon;
grant  execute on function public.criar_compra(text, text, text, jsonb) to authenticated;

commit;
