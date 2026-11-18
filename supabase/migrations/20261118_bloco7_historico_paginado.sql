-- ============================================================
-- BLOCO 7 — HISTÓRICO PAGINADO COM BUSCA NO BANCO
-- Peso Certo — 2026-11-18
-- Para desfazer: 20261118_bloco7_rollback.sql
--
-- Antes: a tela baixava só as 100 compras mais recentes e buscava dentro
-- delas; compras mais antigas ficavam inacessíveis. Agora a busca roda no
-- banco sobre TODAS as compras da empresa e devolve uma página por vez,
-- junto com o total de compras e o valor somado de todas as encontradas.
-- ============================================================

begin;

-- Índices para busca e ordenação continuarem rápidas com o volume crescendo
create index if not exists compras_company_data_idx
  on public.compras (company_id, data_hora desc);
create index if not exists itens_compra_compra_id_idx
  on public.itens_compra (compra_id);

create or replace function public.buscar_compras(
  p_busca  text        default null,  -- nº do recibo, cliente ou material
  p_inicio timestamptz default null,
  p_fim    timestamptz default null,
  p_limite integer     default 30,
  p_offset integer     default 0
)
returns jsonb
language plpgsql
stable
security invoker            -- RLS: cada usuário só enxerga a própria empresa
set search_path to 'public'
as $function$
declare
  v_busca  text := nullif(trim(p_busca), '');
  v_padrao text;
  v_numero integer;
  v_limite integer := least(greatest(coalesce(p_limite, 30), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if v_busca is not null then
    -- Escapa % e _ para que sejam buscados literalmente
    v_padrao := '%' || replace(replace(replace(v_busca, '\', '\\'), '%', '\%'), '_', '\_') || '%';
    -- "42", "#42" ou "0042" encontram o recibo 42
    if ltrim(v_busca, '#') ~ '^\d{1,9}$' then
      v_numero := ltrim(v_busca, '#')::integer;
    end if;
  end if;

  with filtradas as (
    select c.*
    from public.compras c
    where (p_inicio is null or c.data_hora >= p_inicio)
      and (p_fim    is null or c.data_hora <= p_fim)
      and (
        v_busca is null
        or c.numero_recibo = v_numero
        or c.cliente_nome ilike v_padrao
        or exists (
          select 1 from public.itens_compra i
          where i.compra_id = c.id and i.material_nome ilike v_padrao
        )
      )
  ),
  pagina as (
    select * from filtradas
    order by data_hora desc, numero_recibo desc
    limit v_limite offset v_offset
  )
  select jsonb_build_object(
    'total',       (select count(*) from filtradas),
    'valor_total', (select coalesce(sum(valor_total), 0) from filtradas),
    'compras', coalesce((
      select jsonb_agg(
               to_jsonb(p) || jsonb_build_object(
                 'itens_compra', coalesce((
                   select jsonb_agg(to_jsonb(i) order by i.criado_em, i.id)
                   from public.itens_compra i
                   where i.compra_id = p.id
                 ), '[]'::jsonb)
               )
               order by p.data_hora desc, p.numero_recibo desc
             )
      from pagina p
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

revoke execute on function public.buscar_compras(text, timestamptz, timestamptz, integer, integer) from public, anon;
grant  execute on function public.buscar_compras(text, timestamptz, timestamptz, integer, integer) to authenticated;

commit;
