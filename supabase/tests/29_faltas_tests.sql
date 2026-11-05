-- Migration 19 tests: the absent-days list agrees with the Presença grade. FAKE DATA ONLY.
begin;
\ir 05_harness.sql

insert into auth.users (email) values
  ('adm@test.local'), ('coord@test.local'), ('sec@test.local'), ('tutora@test.local'), ('tutorb@test.local'),
  ('mentorm@test.local'), ('fin@test.local');
insert into public.staff_roles (email, role) values
  ('adm@test.local', 'admin'), ('coord@test.local', 'coordenacao'), ('sec@test.local', 'secretaria'),
  ('tutora@test.local', 'tutor'), ('tutorb@test.local', 'tutor'), ('mentorm@test.local', 'mentor'), ('fin@test.local', 'financeiro');

insert into alunos.semestres (id, codigo, inicio, fim, atual)
  values ('50000000-0000-0000-0000-000000000002', '2026-2', '2026-11-02', '2026-11-13', true);
-- class days: Mon 2 .. Fri 6 and Mon 9 .. Fri 13; Wed 4 is a holiday (aula = false)
insert into alunos.dias_letivos (semestre_id, data, aula, motivo)
  select '50000000-0000-0000-0000-000000000002', d::date, d::date <> '2026-11-04', case when d::date = '2026-11-04' then 'Feriado' end
    from generate_series('2026-11-02'::date, '2026-11-13'::date, '1 day') d where extract(isodow from d) < 6;

insert into alunos.alunos (id, nome, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'Ana Teste', 'ana@test.local'),
  ('a0000000-0000-0000-0000-00000000000b', 'Bia SemLogin', 'bia@test.local');
insert into alunos.equipe (id, nome, email) values
  ('e0000000-0000-0000-0000-0000000000a1', 'Tutora', 'tutora@test.local'),
  ('e0000000-0000-0000-0000-0000000000a2', 'Tutor B', 'tutorb@test.local');
insert into alunos.aluno_tutores (aluno_id, semestre_id, equipe_id, categoria) values
  ('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000a1', 'tutoria');

-- Ana has a login. Check-ins: Mon 2 presente, Tue 3 atraso, Thu 5 manual 'falta' row, Fri 6 none, Mon 9 presente.
insert into public.turmas (id, nome, horario_inicio, horario_fim_presente, horario_fim_atraso)
  values ('70000000-0000-0000-0000-000000000001', 'Turma', '14:00', '14:05', '14:15');
insert into public.allowed_users (id, nome, email, papel, turma_id)
  values ('80000000-0000-0000-0000-000000000001', 'Ana Teste', 'ana@test.local', 'aluno', '70000000-0000-0000-0000-000000000001');
insert into public.attendance_records (aluno_id, turma_id, data, horario_checkin, status) values
  ('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '2026-11-02', '2026-11-02 17:01+00', 'presente'),
  ('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '2026-11-03', '2026-11-03 17:10+00', 'atraso'),
  ('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '2026-11-05', '2026-11-05 17:20+00', 'falta'),
  ('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '2026-11-09', '2026-11-09 17:01+00', 'presente');
-- Fri 6 is justified
insert into alunos.justificativas (aluno_id, data, motivo) values ('a0000000-0000-0000-0000-00000000000a', '2026-11-06', 'Consulta médica');

create temp table t_f (data date, justificada boolean, motivo text);
grant all on t_f to public;

select t.as_user('tutora@test.local');
insert into t_f select * from alunos.faltas_aluno('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002', '2026-11-09');
reset role;
select t.ok('absent days up to the cut-off: Thu 5 (manual falta) and Fri 6 (justified); holiday Wed 4 is not a class day',
  (select array_agg(data order by data) from t_f) = array['2026-11-05', '2026-11-06']::date[]);
select t.ok('Fri 6 shows as justified with its reason; Thu 5 does not',
  exists (select 1 from t_f where data = '2026-11-06' and justificada and motivo = 'Consulta médica')
  and exists (select 1 from t_f where data = '2026-11-05' and not justificada and motivo is null));

-- agrees with the Presença grade (same rule): faltas (unjustified) + justificadas = rows of the list
select t.as_user('tutora@test.local');
select t.ok('list agrees with presenca_aluno: 1 falta + 1 justificada',
  (select faltas = 1 and justificadas = 1 from alunos.presenca_aluno('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002', '2026-11-09')));
truncate t_f;
insert into t_f select * from alunos.faltas_aluno('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002', '2026-11-13');
reset role;
select t.ok('a later cut-off adds the days after Mon 9 (Tue 10 .. Fri 13)',
  (select count(*) from t_f where data > '2026-11-09') = 4);

-- a student without a login linked to the check-in gets no rows (never a fake list of absences)
select t.as_user('adm@test.local');
select t.ok('no login linked: empty list', (select count(*) from alunos.faltas_aluno('a0000000-0000-0000-0000-00000000000b', '50000000-0000-0000-0000-000000000002', '2026-11-13')) = 0);
reset role;

-- default cut-off is yesterday (America/Sao_Paulo): with the semester in the past nothing breaks and today is never an absence
select t.as_user('coord@test.local');
select t.ok('coordenacao can read', (select count(*) from alunos.faltas_aluno('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002', '2026-11-13')) >= 2);
reset role;
select t.as_user('sec@test.local');
select t.ok('secretaria can read', (select count(*) from alunos.faltas_aluno('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002', '2026-11-13')) >= 2);
reset role;

-- who cannot
select t.as_user('tutorb@test.local');
select t.throws_code('another tutor cannot', $$select * from alunos.faltas_aluno('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002')$$, '42501');
reset role;
select t.as_user('mentorm@test.local');
select t.throws_code('mentor cannot', $$select * from alunos.faltas_aluno('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002')$$, '42501');
reset role;
select t.as_user('fin@test.local');
select t.throws_code('financeiro cannot', $$select * from alunos.faltas_aluno('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002')$$, '42501');
reset role;
set role anon;
select t.throws('anon cannot', $$select * from alunos.faltas_aluno('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002')$$);
reset role;

\echo
select case when passed then 'PASS' else 'FAIL' end as result, name from t.results order by passed, name;
select count(*) filter (where passed) as passed, count(*) filter (where not passed) as failed from t.results;
rollback;
