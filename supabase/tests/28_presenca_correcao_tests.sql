-- Migration 17 tests: correct / delete a check-in record, audited. FAKE DATA ONLY.
begin;
\ir 05_harness.sql

insert into auth.users (email) values
  ('adm@test.local'), ('coord@test.local'), ('sec@test.local'), ('tutora@test.local'), ('fin@test.local');
insert into public.staff_roles (email, role) values
  ('adm@test.local', 'admin'), ('coord@test.local', 'coordenacao'), ('sec@test.local', 'secretaria'),
  ('tutora@test.local', 'tutor'), ('fin@test.local', 'financeiro');

insert into public.turmas (id, nome, horario_inicio, horario_fim_presente, horario_fim_atraso)
  values ('70000000-0000-0000-0000-000000000001', 'Turma Teste', '14:00', '14:05', '14:15');
insert into public.allowed_users (id, nome, email, papel, turma_id) values
  ('80000000-0000-0000-0000-000000000001', 'Ana Teste', 'ana@test.local', 'aluno', '70000000-0000-0000-0000-000000000001');
insert into public.attendance_records (id, aluno_id, turma_id, data, horario_checkin, status) values
  ('90000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '2026-11-02', '2026-11-02 17:03:00+00', 'presente'),
  ('90000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '2026-11-03', '2026-11-03 17:12:00+00', 'atraso'),
  ('90000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '2026-11-04', '2026-11-04 17:20:00+00', 'falta'),
  ('90000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '2026-11-05', '2026-11-05 17:01:00+00', 'presente');
delete from alunos.auditoria;

-- ---- correcting a status
select t.as_user('sec@test.local');
select t.runs('secretaria corrects atraso -> presente', $$select public.corrigir_presenca('90000000-0000-0000-0000-000000000002', 'presente', '  Chegou no horário, o QR falhou  ')$$);
reset role;
select t.ok('status changed, check-in time untouched',
  exists (select 1 from public.attendance_records where id = '90000000-0000-0000-0000-000000000002' and status = 'presente' and horario_checkin = '2026-11-03 17:12:00+00'));
select t.ok('audit row: UPDATE with before/after, reason (trimmed) and who',
  exists (select 1 from alunos.auditoria where tabela = 'attendance_records' and operacao = 'UPDATE'
            and registro_id = '90000000-0000-0000-0000-000000000002'
            and antes ->> 'status' = 'atraso' and depois ->> 'status' = 'presente'
            and motivo = 'Chegou no horário, o QR falhou' and usuario_email = 'sec@test.local'));

select t.as_user('coord@test.local');
select t.runs('coordenacao corrects falta -> presente', $$select public.corrigir_presenca('90000000-0000-0000-0000-000000000003', 'presente', 'Estava em aula')$$);
select t.throws_code('reason is required (empty)', $$select public.corrigir_presenca('90000000-0000-0000-0000-000000000001', 'atraso', '   ')$$, '22023');
select t.throws_code('reason is required (null)', $$select public.corrigir_presenca('90000000-0000-0000-0000-000000000001', 'atraso', null)$$, '22023');
select t.throws_code('invalid status', $$select public.corrigir_presenca('90000000-0000-0000-0000-000000000001', 'ausente', 'x')$$, '22023');
select t.throws_code('same status is refused', $$select public.corrigir_presenca('90000000-0000-0000-0000-000000000001', 'presente', 'x')$$, '22023');
select t.throws_code('unknown record', $$select public.corrigir_presenca('90000000-0000-0000-0000-0000000000ff', 'falta', 'x')$$, 'P0002');
reset role;

-- ---- who cannot correct
select t.as_user('tutora@test.local');
select t.throws_code('tutor cannot correct', $$select public.corrigir_presenca('90000000-0000-0000-0000-000000000001', 'falta', 'x')$$, '42501');
select t.throws_code('tutor cannot delete', $$select public.apagar_presenca('90000000-0000-0000-0000-000000000001', 'x')$$, '42501');
select t.ok('tutor direct UPDATE of the table still touches 0 rows (no policy)',
  t.affected($$update public.attendance_records set status = 'falta' where id = '90000000-0000-0000-0000-000000000001'$$) = 0);
select t.ok('tutor direct DELETE of the table still touches 0 rows (no policy)',
  t.affected($$delete from public.attendance_records where id = '90000000-0000-0000-0000-000000000001'$$) = 0);
reset role;
select t.as_user('fin@test.local');
select t.throws_code('financeiro cannot correct', $$select public.corrigir_presenca('90000000-0000-0000-0000-000000000001', 'falta', 'x')$$, '42501');
reset role;
select t.ok('nothing changed by the refused calls',
  (select status from public.attendance_records where id = '90000000-0000-0000-0000-000000000001') = 'presente');

-- ---- deleting
select t.as_user('sec@test.local');
select t.throws_code('secretaria cannot delete', $$select public.apagar_presenca('90000000-0000-0000-0000-000000000004', 'Registro duplicado')$$, '42501');
reset role;
select t.as_user('coord@test.local');
select t.throws_code('delete needs a reason', $$select public.apagar_presenca('90000000-0000-0000-0000-000000000004', ' ')$$, '22023');
select t.runs('coordenacao deletes with a reason', $$select public.apagar_presenca('90000000-0000-0000-0000-000000000004', 'Registro duplicado')$$);
select t.throws_code('deleting twice: record not found', $$select public.apagar_presenca('90000000-0000-0000-0000-000000000004', 'Registro duplicado')$$, 'P0002');
reset role;
select t.ok('record is gone', not exists (select 1 from public.attendance_records where id = '90000000-0000-0000-0000-000000000004'));
select t.ok('audit row: DELETE keeps the whole record in "antes" with the reason',
  exists (select 1 from alunos.auditoria where tabela = 'attendance_records' and operacao = 'DELETE'
            and registro_id = '90000000-0000-0000-0000-000000000004'
            and antes ->> 'status' = 'presente' and antes ->> 'data' = '2026-11-05'
            and antes ->> 'aluno_id' = '80000000-0000-0000-0000-000000000001'
            and depois is null and motivo = 'Registro duplicado' and usuario_email = 'coord@test.local'));
select t.ok('the student can check in again the same day (unique key is free)',
  t.affected($$insert into public.attendance_records (aluno_id, turma_id, data, horario_checkin, status)
               values ('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '2026-11-05', now(), 'presente')$$) = 1);

-- ---- admin can do both; anon cannot
select t.as_user('adm@test.local');
select t.runs('admin corrects', $$select public.corrigir_presenca('90000000-0000-0000-0000-000000000001', 'atraso', 'Teste admin')$$);
select t.runs('admin deletes', $$select public.apagar_presenca('90000000-0000-0000-0000-000000000001', 'Teste admin')$$);
reset role;
select t.ok('audit holds all 5 changes (3 corrections + 2 deletions)',
  (select count(*) from alunos.auditoria where tabela = 'attendance_records') = 5);
set role anon;
select t.throws('anon cannot call corrigir_presenca', $$select public.corrigir_presenca('90000000-0000-0000-0000-000000000002', 'falta', 'x')$$);
select t.throws('anon cannot call apagar_presenca', $$select public.apagar_presenca('90000000-0000-0000-0000-000000000002', 'x')$$);
reset role;

\echo
select case when passed then 'PASS' else 'FAIL' end as result, name from t.results order by passed, name;
select count(*) filter (where passed) as passed, count(*) filter (where not passed) as failed from t.results;
rollback;
