-- Migration 14 tests: coverage function for the coordination screen. FAKE DATA ONLY.
begin;
\ir 05_harness.sql

insert into auth.users (email) values
  ('tutora@test.local'), ('tutorb@test.local'), ('lider@test.local'), ('mentorm@test.local'),
  ('coord@test.local'), ('adm@test.local'), ('sec@test.local'), ('ana@test.local');
insert into public.staff_roles (email, role) values
  ('tutora@test.local', 'tutor'), ('tutorb@test.local', 'tutor'), ('lider@test.local', 'lider_casa'),
  ('mentorm@test.local', 'mentor'), ('coord@test.local', 'coordenacao'), ('adm@test.local', 'admin'),
  ('sec@test.local', 'secretaria');

insert into alunos.semestres (id, codigo, atual) values ('50000000-0000-0000-0000-000000000002', '2026-2', true);
insert into alunos.alunos (id, nome, email, casa_id, status) values
  ('a0000000-0000-0000-0000-00000000000a', 'Ana Teste', 'ana@test.local', (select id from alunos.casas where nome = 'Casa Amarela'), 'Ativo'),
  ('a0000000-0000-0000-0000-00000000000b', 'Bia Teste', 'bia@test.local', null, 'Ativo'),
  ('a0000000-0000-0000-0000-00000000000c', 'Caio Desistente', 'caio@test.local', null, 'Desistente'),
  ('a0000000-0000-0000-0000-00000000000d', 'Duda Sem Ninguem', 'duda@test.local', null, 'Ativo');
insert into alunos.equipe (id, nome, email) values
  ('e0000000-0000-0000-0000-0000000000a1', 'Tutora', 'tutora@test.local'),
  ('e0000000-0000-0000-0000-0000000000a2', 'Tutor B', 'tutorb@test.local'),
  ('e0000000-0000-0000-0000-0000000000a3', 'Lider', 'lider@test.local'),
  ('e0000000-0000-0000-0000-0000000000a4', 'Mentor M', 'mentorm@test.local');
insert into alunos.equipe_casas (equipe_id, casa_id)
  select 'e0000000-0000-0000-0000-0000000000a3', id from alunos.casas where nome = 'Casa Amarela';
insert into alunos.aluno_tutores (aluno_id, semestre_id, equipe_id, categoria) values
  ('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000a1', 'tutoria'),
  ('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000a2', 'tutoria'),
  ('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000a4', 'mentoria'),
  ('a0000000-0000-0000-0000-00000000000b', '50000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000a1', 'tutoria');
-- Ana / tutora: submitted (all 8 answered). Ana / tutorb: draft with 3 answers. Bia / tutora: not started.
-- Extra: Bia / tutorb evaluated without being assigned (esperado = false).
insert into alunos.avaliacoes (id, semestre_id, aluno_id, avaliador_equipe_id, modelo_id, categoria, status)
  select v.id::uuid, '50000000-0000-0000-0000-000000000002', v.aluno::uuid, v.equipe::uuid, m.id, 'tutoria', v.st
    from alunos.avaliacao_modelos m,
         (values ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-0000000000a1', 'enviada'),
                 ('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-0000000000a2', 'rascunho'),
                 ('f0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000b', 'e0000000-0000-0000-0000-0000000000a2', 'rascunho'))
           as v (id, aluno, equipe, st)
   where m.categoria = 'tutoria' and m.ativo;
insert into alunos.avaliacao_respostas (avaliacao_id, pergunta_id, valor)
  select 'f0000000-0000-0000-0000-000000000001', p.id, 5 from alunos.avaliacao_perguntas p
    join alunos.avaliacao_grupos g on g.id = p.grupo_id join alunos.avaliacao_modelos m on m.id = g.modelo_id where m.categoria = 'tutoria' and m.ativo;
insert into alunos.avaliacao_respostas (avaliacao_id, pergunta_id, valor)
  select 'f0000000-0000-0000-0000-000000000002', p.id, 4 from alunos.avaliacao_perguntas p
    join alunos.avaliacao_grupos g on g.id = p.grupo_id join alunos.avaliacao_modelos m on m.id = g.modelo_id
   where m.categoria = 'tutoria' and m.ativo order by p.id limit 3;

create temp table t_cob as
  select * from alunos.cobertura_semestre('50000000-0000-0000-0000-000000000002') limit 0;
grant all on t_cob to public;
select t.as_user('coord@test.local');
insert into t_cob select * from alunos.cobertura_semestre('50000000-0000-0000-0000-000000000002');
reset role;

select t.ok('Ana / Tutoria / Tutora: submitted, 8 of 8, expected',
  exists (select 1 from t_cob where aluno = 'Ana Teste' and categoria = 'tutoria' and avaliador = 'Tutora'
                                and situacao = 'enviada' and respondidas = 8 and total = 8 and esperado));
select t.ok('Ana / Tutoria / Tutor B: draft, 3 of 8',
  exists (select 1 from t_cob where aluno = 'Ana Teste' and categoria = 'tutoria' and avaliador = 'Tutor B'
                                and situacao = 'rascunho' and respondidas = 3 and total = 8 and esperado));
select t.ok('Bia / Tutoria / Tutora: expected, not started',
  exists (select 1 from t_cob where aluno = 'Bia Teste' and categoria = 'tutoria' and avaliador = 'Tutora'
                                and situacao = 'nao_iniciada' and respondidas = 0 and esperado));
select t.ok('Bia / Tutoria / Tutor B: has a draft although NOT expected -> esperado = false',
  exists (select 1 from t_cob where aluno = 'Bia Teste' and avaliador = 'Tutor B' and situacao = 'rascunho' and not esperado));
select t.ok('Ana / Mentoria: the explicit mentor AND the house leader are both expected, not started',
  (select count(*) from t_cob where aluno = 'Ana Teste' and categoria = 'mentoria' and esperado and situacao = 'nao_iniciada') = 2
  and exists (select 1 from t_cob where aluno = 'Ana Teste' and categoria = 'mentoria' and avaliador = 'Lider')
  and exists (select 1 from t_cob where aluno = 'Ana Teste' and categoria = 'mentoria' and avaliador = 'Mentor M'));
select t.ok('Mentoria total is the active model size (11)',
  (select bool_and(total = 11) from t_cob where categoria = 'mentoria' and situacao <> 'sem_avaliador'));
select t.ok('a student with nobody assigned gets one "sem_avaliador" row per category',
  (select count(*) from t_cob where aluno = 'Duda Sem Ninguem') = 2
  and (select bool_and(situacao = 'sem_avaliador' and equipe_id is null and avaliador is null and esperado is null)
         from t_cob where aluno = 'Duda Sem Ninguem'));
select t.ok('Bia has no Mentoria evaluator -> sem_avaliador',
  exists (select 1 from t_cob where aluno = 'Bia Teste' and categoria = 'mentoria' and situacao = 'sem_avaliador'));
select t.ok('inactive students are left out',
  (select count(*) from t_cob where aluno = 'Caio Desistente') = 0);
select t.ok('no answers or comments leak: the function returns counts only',
  (select count(*) from information_schema.parameters where specific_schema = 'alunos' and specific_name like 'cobertura_semestre%'
      and parameter_mode = 'OUT' and parameter_name in ('valor', 'observacoes', 'desenvolvimento', 'texto', 'comentario')) = 0);

-- who may call it
select t.as_user('adm@test.local');
select t.ok('admin can call it', (select count(*) from alunos.cobertura_semestre('50000000-0000-0000-0000-000000000002')) > 0);
reset role;
select t.as_user('tutora@test.local');
select t.throws_code('a tutor cannot call it', $$select * from alunos.cobertura_semestre('50000000-0000-0000-0000-000000000002')$$, '42501');
reset role;
select t.as_user('sec@test.local');
select t.throws_code('secretaria cannot call it', $$select * from alunos.cobertura_semestre('50000000-0000-0000-0000-000000000002')$$, '42501');
reset role;
select t.as_user('ana@test.local');
select t.throws_code('a student cannot call it', $$select * from alunos.cobertura_semestre('50000000-0000-0000-0000-000000000002')$$, '42501');
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select t.throws('anon cannot call it', $$select * from alunos.cobertura_semestre('50000000-0000-0000-0000-000000000002')$$);
reset role;

\echo
select case when passed then 'PASS' else 'FAIL' end as result, name from t.results order by passed, name;
select count(*) filter (where passed) as passed, count(*) filter (where not passed) as failed from t.results;
rollback;
