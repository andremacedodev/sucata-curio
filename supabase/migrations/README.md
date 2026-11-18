# Migrations — Sucata Curió

Rodar no Supabase (SQL Editor), em ordem. Cada arquivo roda numa transação única:
se algo falhar, nada é aplicado.

| Arquivo | O que faz | Status em produção |
|---|---|---|
| `00_pre_check.sql` | Consulta (não altera nada): RLS por tabela e papéis profiles × company_members | — |
| `20261118_bloco1_seguranca.sql` | Remove policies globais, financeiro/vendas/clientes só para admin da empresa, bloqueia auto-promoção a ADMIN, revoga TRUNCATE | Aplicado em 2026-11-18 |
| `20261118_bloco2_recibo_exclusao.sql` | Numeração de recibo por empresa, colunas protegidas em `companies`, RPC `excluir_compra` | Ver se foi aplicado |
| `20261118_bloco4_compra_atomica.sql` | RPC `criar_compra`: compra + itens + financeiro numa transação, total calculado no banco | Aplicado em 2026-11-18 |
| `20261118_bloco5_dados_empresa.sql` | Grava os dados da Sucata Curió (telefone, endereço, CNPJ, logo) em `companies`, que o recibo passa a ler só do banco | Aplicado em 2026-11-18 |
| `20261118_bloco6_logos_storage.sql` | Bucket `logos` (público para leitura, até 2 MB, PNG/JPG/WEBP); só o admin envia/apaga na pasta `logos/<company_id>/` da própria empresa | Aplicado em 2026-11-18 |
| `20261118_bloco7_historico_paginado.sql` | RPC `buscar_compras`: busca por recibo/cliente/material e datas sobre todas as compras, paginada, com total e soma; índices de data e itens | Aplicado em 2026-11-18 |
| `20261118_bloco8_equipe.sql` | Trava "empresa sempre com 1 admin ativo", vínculo não muda de empresa/usuário, `listar_equipe()` com último acesso e convite pendente | Pendente |

Cada bloco tem um `_rollback.sql` correspondente que desfaz as mudanças.

O front depende do bloco 2 (`rpc("excluir_compra")`) e do bloco 4 (`rpc("criar_compra")`), ambos em `src/lib/db.js`.

`../subapase_schema.sql` é o schema original e está desatualizado.

## Edge Functions (`supabase/functions/`)

| Função | Para quê | Status |
|---|---|---|
| `convidar-membro` | Admin convida alguém para a equipe (envia convite do Supabase ou vincula conta existente) | Pendente |

Publicar pelo painel: **Edge Functions → Deploy a new function → Via Editor**, nome
`convidar-membro`, colar `supabase/functions/convidar-membro/index.ts`.
Ou pela CLI: `supabase functions deploy convidar-membro`.

**Convites por e-mail exigem SMTP próprio** (Authentication → Emails → SMTP Settings):
o e-mail padrão do Supabase só entrega para membros do time do projeto e no máximo 2 por hora.

## Scripts de operação (`supabase/scripts/`)

| Script | Para quê |
|---|---|
| `nova_empresa.sql` | Cadastrar uma nova sucataria: cria a empresa, vincula o dono como admin e cadastra os materiais iniciais. Não envia e-mail (funciona sem SMTP). Antes, crie o usuário em Authentication > Users > Add user com "Auto Confirm User". |
