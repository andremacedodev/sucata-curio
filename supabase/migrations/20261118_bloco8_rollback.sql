-- Desfaz o bloco 8 (SQL). Os usuários convidados continuam existindo.
-- Para remover a Edge Function: painel do Supabase > Edge Functions >
-- convidar-membro > Delete (ou `supabase functions delete convidar-membro`).
begin;
drop trigger if exists company_members_proteger_admin on public.company_members;
drop function if exists public.proteger_ultimo_admin();
drop function if exists public.listar_equipe(uuid);
commit;
