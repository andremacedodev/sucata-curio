-- ============================================================
-- BLOCO 5 — DADOS DA EMPRESA NO BANCO (recibo sem dados fixos no código)
-- Sucata Curió — 2026-11-18
--
-- Até agora o recibo completava campos vazios de `companies` com os dados
-- da Sucata Curió fixos no pdf.js. O front novo não faz mais isso, então
-- gravamos esses dados no cadastro da própria Curió.
-- Só preenche o que estiver vazio; o que já estiver cadastrado não muda.
-- ============================================================

begin;

update public.companies
set telefone = coalesce(nullif(telefone, ''), '(65) 99264-4949'),
    endereco = coalesce(nullif(endereco, ''), 'Av. Agrícola Paes de Barros, Nº 1632'),
    bairro   = coalesce(nullif(bairro, ''),   'Bairro Porto - Cuiabá/MT'),
    cnpj     = coalesce(nullif(cnpj, ''),     '65.276.996/0001-08'),
    logo_url = coalesce(nullif(logo_url, ''), '/logo_sucata.jpeg'),
    atualizado_em = now()
where nome = 'Sucata Curió';

-- Confere: deve mostrar 1 linha com todos os campos preenchidos.
select nome, telefone, endereco, bairro, cnpj, logo_url
from public.companies
where nome = 'Sucata Curió';

commit;
