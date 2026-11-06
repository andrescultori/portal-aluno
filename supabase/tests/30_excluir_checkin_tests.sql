-- Steps 21-22 tests: public.excluir_checkin — who may (admin, coordenacao, tutor), the NULL hole, audit. FAKE DATA ONLY.
begin;
\ir 05_harness.sql

insert into auth.users (email) values ('staff@test.local'), ('tutora@test.local'), ('adm@test.local'), ('coord@test.local'), ('mentorm@test.local'), ('sec@test.local'), ('fin@test.local'), ('aluna@test.local'), ('semlogin@test.local');
insert into public.staff_roles (email, role) values ('tutora@test.local', 'tutor'), ('adm@test.local', 'admin'), ('coord@test.local', 'coordenacao'), ('mentorm@test.local', 'mentor'), ('sec@test.local', 'secretaria'), ('fin@test.local', 'financeiro');
insert into public.turmas (id, nome, horario_inicio, horario_fim_presente, horario_fim_atraso)
  values ('70000000-0000-0000-0000-000000000001', 'Turma Teste', '14:00', '14:05', '14:15');
insert into public.allowed_users (id, nome, email, papel, turma_id) values
  ('80000000-0000-0000-0000-000000000001', 'Ana Teste', 'ana@test.local', 'aluno', '70000000-0000-0000-0000-000000000001'),
  ('80000000-0000-0000-0000-000000000002', 'Staff', 'staff@test.local', 'equipe', null),
  ('80000000-0000-0000-0000-000000000003', 'Tutora', 'tutora@test.local', 'equipe', null),
  ('80000000-0000-0000-0000-000000000004', 'Adm', 'adm@test.local', 'equipe', null),
  ('80000000-0000-0000-0000-000000000005', 'Aluna', 'aluna@test.local', 'aluno', null),
  ('80000000-0000-0000-0000-000000000006', 'Coord', 'coord@test.local', 'equipe', null),
  ('80000000-0000-0000-0000-000000000007', 'Mentor', 'mentorm@test.local', 'equipe', null),
  ('80000000-0000-0000-0000-000000000008', 'Sec', 'sec@test.local', 'equipe', null),
  ('80000000-0000-0000-0000-000000000009', 'Fin', 'fin@test.local', 'equipe', null);
insert into public.attendance_records (id, aluno_id, turma_id, data, horario_checkin, status)
  select ('90000000-0000-0000-0000-00000000000' || n)::uuid, '80000000-0000-0000-0000-000000000001',
         '70000000-0000-0000-0000-000000000001', ('2026-11-0' || n)::date, ('2026-11-0' || n || ' 17:03+00')::timestamptz, 'presente'
    from generate_series(1, 6) n;
delete from alunos.auditoria;

-- roles that may: admin, coordenacao, tutor
select t.as_user('tutora@test.local');
select t.runs('a tutor deletes with a reason', $$select public.excluir_checkin('90000000-0000-0000-0000-000000000001', '  Registro duplicado  ')$$);
select t.throws_code('reason is required (blank)', $$select public.excluir_checkin('90000000-0000-0000-0000-000000000002', '   ')$$, '22023');
select t.throws_code('reason is required (null)', $$select public.excluir_checkin('90000000-0000-0000-0000-000000000002', null)$$, '22023');
select t.throws_code('unknown check-in', $$select public.excluir_checkin('90000000-0000-0000-0000-0000000000ff', 'x')$$, 'P0002');
reset role;
select t.ok('the record is gone and the others stay',
  not exists (select 1 from public.attendance_records where id = '90000000-0000-0000-0000-000000000001')
  and (select count(*) from public.attendance_records) = 5);
select t.ok('audit: DELETE with the whole row in "antes", the trimmed reason in "depois" AND in the motivo column',
  exists (select 1 from alunos.auditoria where tabela = 'attendance_records' and operacao = 'DELETE'
            and registro_id = '90000000-0000-0000-0000-000000000001'
            and antes ->> 'data' = '2026-11-01' and antes ->> 'status' = 'presente'
            and antes ->> 'aluno_id' = '80000000-0000-0000-0000-000000000001'
            and depois ->> 'motivo' = 'Registro duplicado' and motivo = 'Registro duplicado' and usuario_email = 'tutora@test.local'));
select t.ok('the student can check in again the same day (unique key is free)',
  t.affected($$insert into public.attendance_records (aluno_id, turma_id, data, horario_checkin, status)
               values ('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '2026-11-01', now(), 'presente')$$) = 1);

select t.as_user('coord@test.local');
select t.runs('coordenacao deletes', $$select public.excluir_checkin('90000000-0000-0000-0000-000000000002', 'Teste')$$);
reset role;
select t.as_user('adm@test.local');
select t.runs('admin deletes', $$select public.excluir_checkin('90000000-0000-0000-0000-000000000003', 'Teste')$$);
reset role;

-- roles that may NOT (even though they are staff logins with papel 'equipe')
select t.as_user('mentorm@test.local');
select t.throws_code('mentor cannot', $$select public.excluir_checkin('90000000-0000-0000-0000-000000000004', 'x')$$, '42501');
reset role;
select t.as_user('sec@test.local');
select t.throws_code('secretaria cannot', $$select public.excluir_checkin('90000000-0000-0000-0000-000000000004', 'x')$$, '42501');
reset role;
select t.as_user('fin@test.local');
select t.throws_code('financeiro cannot', $$select public.excluir_checkin('90000000-0000-0000-0000-000000000004', 'x')$$, '42501');
reset role;
select t.as_user('staff@test.local');
select t.throws_code('a staff login (papel equipe) with no role cannot', $$select public.excluir_checkin('90000000-0000-0000-0000-000000000004', 'x')$$, '42501');
reset role;

-- not staff at all
select t.as_user('aluna@test.local');
select t.throws_code('a student login cannot', $$select public.excluir_checkin('90000000-0000-0000-0000-000000000004', 'Quero apagar')$$, '42501');
select t.ok('...and the direct DELETE of the table still touches 0 rows',
  t.affected($$delete from public.attendance_records where id = '90000000-0000-0000-0000-000000000004'$$) = 0);
reset role;
select t.as_user('semlogin@test.local');
select t.throws_code('a signed-in user with no login row cannot (the NULL hole stays closed)', $$select public.excluir_checkin('90000000-0000-0000-0000-000000000004', 'x')$$, '42501');
reset role;
set role anon;
select t.throws('anon cannot', $$select public.excluir_checkin('90000000-0000-0000-0000-000000000004', 'x')$$);
reset role;
select t.ok('the refused calls deleted nothing: 4 left after the 3 deletions + 1 re-check-in', (select count(*) from public.attendance_records) = 4);
select t.ok('audit has exactly the 3 deletions', (select count(*) from alunos.auditoria where tabela = 'attendance_records') = 3);
select t.ok('apagar_presenca is retired', to_regprocedure('public.apagar_presenca(uuid,text)') is null);

\echo
select case when passed then 'PASS' else 'FAIL' end as result, name from t.results order by passed, name;
select count(*) filter (where passed) as passed, count(*) filter (where not passed) as failed from t.results;
rollback;
