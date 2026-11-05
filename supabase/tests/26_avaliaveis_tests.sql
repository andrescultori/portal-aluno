-- Migration 15 tests: who is evaluable in a semester. FAKE DATA ONLY.
begin;
\ir 05_harness.sql

insert into auth.users (email) values
  ('tutora@test.local'), ('lider@test.local'), ('coord@test.local'), ('adm@test.local'), ('sec@test.local');
insert into public.staff_roles (email, role) values
  ('tutora@test.local', 'tutor'), ('lider@test.local', 'lider_casa'), ('coord@test.local', 'coordenacao'),
  ('adm@test.local', 'admin'), ('sec@test.local', 'secretaria');

insert into alunos.semestres (id, codigo, atual) values ('50000000-0000-0000-0000-000000000002', '2026-2', true);
-- Ana: Ativo/Completo -> evaluable. Bia: Ativo, enrolment plan Convênio -> NOT. Caio: Trancado -> NOT.
-- Duda: Ativo, current plan Convênio but the semester's enrolment plan is Completo -> evaluable (enrolment wins).
-- Edu: Formado but already has a draft in the semester -> evaluable (history stays). Fabi: Ativo, no plan at all -> evaluable.
insert into alunos.alunos (id, nome, email, casa_id, status, plano) values
  ('a0000000-0000-0000-0000-00000000000a', 'Ana Teste', 'ana@test.local', (select id from alunos.casas where nome = 'Casa Amarela'), 'Ativo', 'Completo'),
  ('a0000000-0000-0000-0000-00000000000b', 'Bia Convenio', 'bia@test.local', (select id from alunos.casas where nome = 'Casa Amarela'), 'Ativo', 'Convênio'),
  ('a0000000-0000-0000-0000-00000000000c', 'Caio Trancado', 'caio@test.local', (select id from alunos.casas where nome = 'Casa Amarela'), 'Trancado', 'Completo'),
  ('a0000000-0000-0000-0000-00000000000d', 'Duda Mudou', 'duda@test.local', null, 'Ativo', 'Convênio'),
  ('a0000000-0000-0000-0000-00000000000e', 'Edu Formado', 'edu@test.local', null, 'Formado', 'Completo'),
  ('a0000000-0000-0000-0000-00000000000f', 'Fabi SemPlano', 'fabi@test.local', null, 'Ativo', null);
insert into alunos.matriculas (aluno_id, semestre_id, plano) values
  ('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002', 'Completo'),
  ('a0000000-0000-0000-0000-00000000000b', '50000000-0000-0000-0000-000000000002', 'Convênio'),
  ('a0000000-0000-0000-0000-00000000000d', '50000000-0000-0000-0000-000000000002', 'Completo');
insert into alunos.equipe (id, nome, email) values
  ('e0000000-0000-0000-0000-0000000000a1', 'Tutora', 'tutora@test.local'),
  ('e0000000-0000-0000-0000-0000000000a3', 'Lider', 'lider@test.local');
insert into alunos.equipe_casas (equipe_id, casa_id)
  select 'e0000000-0000-0000-0000-0000000000a3', id from alunos.casas where nome = 'Casa Amarela';
insert into alunos.aluno_tutores (aluno_id, semestre_id, equipe_id, categoria)
  select a, '50000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000a1', 'tutoria'
    from unnest(array['a0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000b',
                      'a0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000d',
                      'a0000000-0000-0000-0000-00000000000e']::uuid[]) a;
insert into alunos.avaliacoes (id, semestre_id, aluno_id, avaliador_equipe_id, modelo_id, categoria, status)
  select 'f0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002',
         'a0000000-0000-0000-0000-00000000000e', 'e0000000-0000-0000-0000-0000000000a1', m.id, 'tutoria', 'rascunho'
    from alunos.avaliacao_modelos m where m.categoria = 'tutoria' and m.ativo;

select t.ok('avaliavel: Ativo + Completo',
  alunos.avaliavel('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002'));
select t.ok('NOT avaliavel: Ativo but enrolment plan is Convênio',
  not alunos.avaliavel('a0000000-0000-0000-0000-00000000000b', '50000000-0000-0000-0000-000000000002'));
select t.ok('NOT avaliavel: Trancado',
  not alunos.avaliavel('a0000000-0000-0000-0000-00000000000c', '50000000-0000-0000-0000-000000000002'));
select t.ok('avaliavel: current plan Convênio but the semester enrolment plan is Completo (enrolment wins)',
  alunos.avaliavel('a0000000-0000-0000-0000-00000000000d', '50000000-0000-0000-0000-000000000002'));
select t.ok('avaliavel: Formado with an evaluation in that semester (history stays)',
  alunos.avaliavel('a0000000-0000-0000-0000-00000000000e', '50000000-0000-0000-0000-000000000002'));
select t.ok('avaliavel: Ativo without any plan',
  alunos.avaliavel('a0000000-0000-0000-0000-00000000000f', '50000000-0000-0000-0000-000000000002'));
select t.ok('NOT avaliavel in a semester where the student has nothing and is not Ativo (Edu, other semester)',
  not alunos.avaliavel('a0000000-0000-0000-0000-00000000000e', '50000000-0000-0000-0000-0000000000ff'));

-- expected evaluators: Bia and Caio are no longer expected
select t.ok('expected tutoria evaluators: Ana yes',
  exists (select 1 from alunos._avaliadores_esperados('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002', 'tutoria')));
select t.ok('expected tutoria evaluators: Bia (Convênio) none',
  not exists (select 1 from alunos._avaliadores_esperados('a0000000-0000-0000-0000-00000000000b', '50000000-0000-0000-0000-000000000002', 'tutoria')));
select t.ok('expected tutoria evaluators: Caio (Trancado) none',
  not exists (select 1 from alunos._avaliadores_esperados('a0000000-0000-0000-0000-00000000000c', '50000000-0000-0000-0000-000000000002', 'tutoria')));
select t.ok('expected mentoria evaluators: house leader of Bia (Convênio) is not expected, of Ana is',
  not exists (select 1 from alunos._avaliadores_esperados('a0000000-0000-0000-0000-00000000000b', '50000000-0000-0000-0000-000000000002', 'mentoria'))
  and exists (select 1 from alunos._avaliadores_esperados('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002', 'mentoria')));

-- coordination screens
create temp table t_cob as select * from alunos.cobertura_semestre('50000000-0000-0000-0000-000000000002') limit 0;
create temp table t_av as select * from alunos.avaliaveis_semestre('50000000-0000-0000-0000-000000000002') limit 0;
grant all on t_cob, t_av to public;
select t.as_user('coord@test.local');
insert into t_cob select * from alunos.cobertura_semestre('50000000-0000-0000-0000-000000000002');
insert into t_av select * from alunos.avaliaveis_semestre('50000000-0000-0000-0000-000000000002');
reset role;
select t.ok('coverage lists Ana, Duda, Edu, Fabi', (select count(distinct aluno) from t_cob where aluno in ('Ana Teste', 'Duda Mudou', 'Edu Formado', 'Fabi SemPlano')) = 4);
select t.ok('coverage does NOT list Bia (Convênio) nor Caio (Trancado)',
  not exists (select 1 from t_cob where aluno in ('Bia Convenio', 'Caio Trancado')));
select t.ok('avaliaveis_semestre: 4 evaluable, 2 not',
  (select count(*) filter (where avaliavel) from t_av where aluno_id in (select id from alunos.alunos)) = 4
  and (select count(*) filter (where not avaliavel) from t_av) = 2);
select t.ok('avaliaveis_semestre reports the effective plan (enrolment plan wins)',
  exists (select 1 from t_av where aluno_id = 'a0000000-0000-0000-0000-00000000000d' and plano = 'Completo')
  and exists (select 1 from t_av where aluno_id = 'a0000000-0000-0000-0000-00000000000b' and plano = 'Convênio'));

select t.ok('avaliaveis_semestre flags the agreement plan (convenio) from the effective plan',
  exists (select 1 from t_av where aluno_id = 'a0000000-0000-0000-0000-00000000000b' and convenio)
  and exists (select 1 from t_av where aluno_id = 'a0000000-0000-0000-0000-00000000000d' and not convenio)
  and exists (select 1 from t_av where aluno_id = 'a0000000-0000-0000-0000-00000000000f' and not convenio and plano is null));

select t.as_user('tutora@test.local');
select t.throws_code('tutor cannot call avaliaveis_semestre',
  $$select * from alunos.avaliaveis_semestre('50000000-0000-0000-0000-000000000002')$$, '42501');
select t.ok('tutor list: only Ana, Duda, Edu (Bia, Caio hidden)',
  (select array_agg(nome order by nome) from alunos.meus_alunos_avaliar('50000000-0000-0000-0000-000000000002'))
    = array['Ana Teste', 'Duda Mudou', 'Edu Formado']);
select t.ok('tutor can evaluate Ana', alunos.pode_avaliar('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002', 'tutoria', 'e0000000-0000-0000-0000-0000000000a1'));
select t.ok('tutor can NOT evaluate Bia (Convênio)', not alunos.pode_avaliar('a0000000-0000-0000-0000-00000000000b', '50000000-0000-0000-0000-000000000002', 'tutoria', 'e0000000-0000-0000-0000-0000000000a1'));
select t.ok('tutor can NOT evaluate Caio (Trancado)', not alunos.pode_avaliar('a0000000-0000-0000-0000-00000000000c', '50000000-0000-0000-0000-000000000002', 'tutoria', 'e0000000-0000-0000-0000-0000000000a1'));
select t.ok('tutor can still evaluate Edu (Formado, draft exists)', alunos.pode_avaliar('a0000000-0000-0000-0000-00000000000e', '50000000-0000-0000-0000-000000000002', 'tutoria', 'e0000000-0000-0000-0000-0000000000a1'));
select t.throws('tutor cannot call avaliavel directly (internal)',
  $$select alunos.avaliavel('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002')$$);
reset role;

select t.as_user('lider@test.local');
select t.ok('house leader list (Mentoria): Ana only (Bia Convênio and Caio Trancado hidden)',
  (select array_agg(nome order by nome) from alunos.meus_alunos_avaliar('50000000-0000-0000-0000-000000000002')) = array['Ana Teste']);
reset role;

\echo
select case when passed then 'PASS' else 'FAIL' end as result, name from t.results order by passed, name;
select count(*) filter (where passed) as passed, count(*) filter (where not passed) as failed from t.results;
rollback;
