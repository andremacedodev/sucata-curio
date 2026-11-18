-- Rode ANTES do bloco 1. Não altera nada.

-- A) RLS ligado em cada tabela?
select c.relname as tabela, c.relrowsecurity as rls_ativo
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;

-- B) Papel em profiles x papel na empresa.
--    Toda linha com role_profile = 'ADMIN' precisa ter role_empresa = 'admin'
--    e vinculo_ativo = true; senão esse usuário perde o Financeiro após o bloco 1.
select p.email,
       p.role   as role_profile,
       cm.role  as role_empresa,
       cm.ativo as vinculo_ativo,
       c.nome   as empresa
from public.profiles p
left join public.company_members cm on cm.user_id = p.id
left join public.companies c on c.id = cm.company_id
order by c.nome, p.email;
