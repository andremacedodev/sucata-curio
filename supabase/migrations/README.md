# Migrations — Sucata Curió

Rodar no Supabase (SQL Editor), em ordem. Cada arquivo roda numa transação única:
se algo falhar, nada é aplicado.

| Arquivo | O que faz | Status em produção |
|---|---|---|
| `00_pre_check.sql` | Consulta (não altera nada): RLS por tabela e papéis profiles × company_members | — |
| `20261118_bloco1_seguranca.sql` | Remove policies globais, financeiro/vendas/clientes só para admin da empresa, bloqueia auto-promoção a ADMIN, revoga TRUNCATE | Aplicado em 2026-11-18 |
| `20261118_bloco2_recibo_exclusao.sql` | Numeração de recibo por empresa, colunas protegidas em `companies`, RPC `excluir_compra` | Ver se foi aplicado |
| `20261118_bloco4_compra_atomica.sql` | RPC `criar_compra`: compra + itens + financeiro numa transação, total calculado no banco | Pendente |

Cada bloco tem um `_rollback.sql` correspondente que desfaz as mudanças.

O front depende do bloco 2 (`rpc("excluir_compra")`) e do bloco 4 (`rpc("criar_compra")`), ambos em `src/lib/db.js`.

`../subapase_schema.sql` é o schema original e está desatualizado.
