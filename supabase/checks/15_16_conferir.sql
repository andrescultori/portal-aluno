-- Conferências SOMENTE DE LEITURA. Rode o bloco A depois da migração 15 e o bloco B depois da 16.
-- (No SQL Editor não há "usuário logado", então aqui usamos a função interna alunos.avaliavel.)

-- ===== BLOCO A — depois da migração 15 =====
-- A1. As funções existem (esperado: 4 linhas).
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'alunos' and proname in ('avaliavel', 'avaliaveis_semestre', 'pode_avaliar', 'meus_alunos_avaliar', 'cobertura_semestre', '_avaliadores_esperados')
 order by 1;
-- A2. Quantos alunos serão avaliados no semestre 2026-2 (esperado hoje: ~30 avaliáveis; o resto fora).
select count(*) filter (where alunos.avaliavel(a.id, s.id)) as avaliaveis,
       count(*) filter (where not alunos.avaliavel(a.id, s.id)) as fora_da_avaliacao,
       count(*) filter (where a.status = 'Ativo' and not alunos.avaliavel(a.id, s.id)) as ativos_fora_por_convenio
  from alunos.alunos a cross join alunos.semestres s where s.codigo = '2026-2';

-- ===== BLOCO B — depois da migração 16 =====
-- B1. As funções existem (esperado: 2 linhas).
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and proname in ('listar_equipe', 'salvar_membro_equipe') order by 1;
-- B2. Nada de dados mudou: avaliadores 6, funções 18 (as migrações só criam funções).
select (select count(*) from alunos.equipe) as avaliadores, (select count(*) from public.staff_roles) as funcoes,
       (select count(*) from public.allowed_users where papel = 'equipe') as logins_equipe;

-- ===== Depois das duas — nada fora do módulo de alunos mudou =====
select count(*) as politicas_selecao_propostas from pg_policies where schemaname in ('selecao', 'propostas');   -- esperado 30
select md5(prosrc) as checkin_md5 from pg_proc where oid = 'selecao.registrar_checkin(text,text)'::regprocedure; -- esperado c843e6f9ca5ba86a00e524f51c56d606
