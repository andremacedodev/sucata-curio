-- ============================================================
-- NOVA EMPRESA (cliente) — Peso Certo
-- Rodar no SQL Editor do Supabase. Não envia e-mail (funciona sem SMTP).
--
-- ANTES: crie o usuário do dono da sucataria em
--   Authentication > Users > Add user > Create new user
--   (e-mail + senha, marque "Auto Confirm User").
--
-- Depois preencha as 3 linhas abaixo e rode. Se algo estiver errado,
-- nada é criado e aparece a mensagem explicando o motivo.
-- ============================================================

do $$
declare
  v_nome  text := 'Ferro Velho Exemplo';   -- nome da empresa (aparece no app e no recibo)
  v_slug  text := 'ferro-velho-exemplo';   -- identificador único: minúsculas, sem espaço/acento
  v_email text := 'dono@exemplo.com';      -- e-mail do usuário criado no passo "ANTES"

  v_user    uuid;
  v_company uuid;
begin
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Slug inválido: "%". Use só letras minúsculas, números e hífen (ex.: ferro-velho-sao-jose).', v_slug;
  end if;

  select id into v_user
  from public.profiles
  where lower(email) = lower(trim(v_email));

  if v_user is null then
    raise exception 'Usuário % não encontrado. Crie primeiro em Authentication > Users > Add user.', v_email;
  end if;

  if exists (select 1 from public.company_members where user_id = v_user and ativo) then
    raise exception 'O e-mail % já está ativo em outra empresa. Use outro e-mail.', v_email;
  end if;

  if exists (select 1 from public.companies where slug = v_slug) then
    raise exception 'Já existe uma empresa com o slug "%". Escolha outro.', v_slug;
  end if;

  insert into public.companies (nome, slug)
  values (trim(v_nome), v_slug)
  returning id into v_company;

  insert into public.company_members (company_id, user_id, role, ativo)
  values (v_company, v_user, 'admin', true);

  update public.profiles set nome = coalesce(nome, split_part(v_email, '@', 1))
  where id = v_user;

  -- Materiais iniciais (o admin edita depois na tela Materiais)
  insert into public.materiais (nome, company_id)
  select m, v_company
  from unnest(array[
    'Latinha', 'Panela', 'Perfil', 'Offset', 'Cabo Al', 'Chaparia', 'Bloco',
    'Pistão', 'Roda', 'Cobre Limpo', 'Cobre Misto', 'Cobre com Casca',
    'Cavaco Alumínio', 'Cavaco Metal', 'Metal', 'Radiador Alumínio',
    'Condensador', 'Bateria', 'Chumbo', 'Inox', 'Zamac', 'Motor Gel', 'Ferro'
  ]) as m;

  raise notice 'Empresa "%" criada (id %). Admin: %. Ele já pode entrar no app.', v_nome, v_company, v_email;
end
$$;
