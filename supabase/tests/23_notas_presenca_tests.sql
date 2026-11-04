-- Migration 12 tests: activities, final project, class days, justifications, attendance. FAKE DATA ONLY.
begin;
\ir 05_harness.sql

-- ------------------------------------------------------------------ fixtures (postgres)
insert into auth.users (email) values
  ('ana@test.local'), ('bia@test.local'), ('tutora@test.local'), ('tutorb@test.local'),
  ('sec@test.local'), ('fin@test.local'), ('coord@test.local'), ('adm@test.local');
insert into public.staff_roles (email, role) values
  ('tutora@test.local', 'tutor'), ('tutorb@test.local', 'tutor'), ('sec@test.local', 'secretaria'),
  ('fin@test.local', 'financeiro'), ('coord@test.local', 'coordenacao'), ('adm@test.local', 'admin');

-- 2026-08-03 (Mon) .. 2026-08-14 (Fri) = 10 weekdays
insert into alunos.semestres (id, codigo, inicio, fim, atual)
  values ('50000000-0000-0000-0000-000000000001', '2026-2', '2026-08-03', '2026-08-14', true);
insert into alunos.alunos (id, nome, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'Ana Teste', 'Ana@Test.Local'),     -- mixed case on purpose
  ('a0000000-0000-0000-0000-00000000000b', 'Bia Teste', 'bia@test.local');
insert into alunos.equipe (id, nome, email) values
  ('e0000000-0000-0000-0000-0000000000a1', 'Tutora', 'tutora@test.local'),
  ('e0000000-0000-0000-0000-0000000000a2', 'Tutor B', 'tutorb@test.local');
insert into alunos.aluno_tutores (aluno_id, semestre_id, equipe_id, categoria) values
  ('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000a1', 'tutoria'),
  ('a0000000-0000-0000-0000-00000000000b', '50000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000a2', 'tutoria');

insert into public.turmas (id, nome, horario_inicio, horario_fim_presente, horario_fim_atraso)
  values ('70000000-0000-0000-0000-000000000001', 'Turma Teste', '14:00', '14:15', '14:45');
insert into public.allowed_users (id, nome, email, papel, turma_id) values
  ('c0000000-0000-0000-0000-00000000000a', 'Ana Teste', 'ana@test.local', 'aluno', '70000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-0000000000f1', 'Fulana Sem Ficha', 'fulana@test.local', 'aluno', '70000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-0000000000e1', 'Equipe Teste', 'equipe@test.local', 'equipe', null);

-- ------------------------------------------------------------------ seeds / triggers
select t.ok('a new semester gets 3 default components with equal weights',
  (select count(*) = 3 and min(peso) = 1 and max(peso) = 1 from alunos.projeto_componentes
    where semestre_id = '50000000-0000-0000-0000-000000000001'));
select t.ok('component codes are projeto / apresentacao / trabalho_escrito',
  (select string_agg(codigo, ',' order by codigo) from alunos.projeto_componentes
    where semestre_id = '50000000-0000-0000-0000-000000000001') = 'apresentacao,projeto,trabalho_escrito');

-- ------------------------------------------------------------------ class days
select t.as_user('tutora@test.local');
select t.throws_code('a tutor cannot generate class days',
  $$select alunos.gerar_dias_letivos('50000000-0000-0000-0000-000000000001')$$, '42501');
reset role;
select t.as_user('sec@test.local');
select t.ok('secretaria generates the class days: 10 weekdays, no weekends',
  alunos.gerar_dias_letivos('50000000-0000-0000-0000-000000000001') = 10
  and (select count(*) from alunos.dias_letivos where extract(isodow from data) > 5) = 0);
select t.ok('generating again adds nothing (idempotent)',
  alunos.gerar_dias_letivos('50000000-0000-0000-0000-000000000001') = 0);
select t.ok('secretaria marks a holiday', t.affected($$
  update alunos.dias_letivos set aula = false, motivo = 'holiday' where data = '2026-08-07'$$) = 1);
reset role;
insert into alunos.semestres (id, codigo) values ('50000000-0000-0000-0000-000000000002', '2027-1');
select t.throws_code('class days need the semester dates',
  $$select alunos.gerar_dias_letivos('50000000-0000-0000-0000-000000000002')$$, '22023');

-- ------------------------------------------------------------------ activities and their grades
select t.as_user('coord@test.local');
select t.ok('coordenacao creates 3 activities', t.affected($$
  insert into alunos.atividades (id, semestre_id, ordem, titulo) values
    ('d0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 1, 'Cosmovisão Cristã'),
    ('d0000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 2, 'Tema B'),
    ('d0000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', 3, 'Tema C')$$) = 3);
select t.throws_code('coordenacao cannot grade activities (read-only)', $$
  insert into alunos.atividade_notas (atividade_id, aluno_id, ativ) values
    ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 5)$$, '42501');
reset role;

select t.as_user('tutora@test.local');
select t.ok('tutora grades Ana: activity 1 = 8 + 1', t.affected($$
  insert into alunos.atividade_notas (atividade_id, aluno_id, ativ, quiz)
  values ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 8, 1)$$) = 1);
select t.ok('tutora grades Ana: activity 2 = 7, quiz not entered yet', t.affected($$
  insert into alunos.atividade_notas (atividade_id, aluno_id, ativ)
  values ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', 7)$$) = 1);
select t.ok('final = ativ + quiz (9.0) and a missing quiz counts as 0 (7.0)',
  (select final from alunos.atividade_notas where atividade_id = 'd0000000-0000-0000-0000-000000000001') = 9.0
  and (select final from alunos.atividade_notas where atividade_id = 'd0000000-0000-0000-0000-000000000002') = 7.0);
select t.ok('a row with both fields empty can be saved', t.affected($$
  insert into alunos.atividade_notas (atividade_id, aluno_id, ativ, quiz)
  values ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a', null, null)$$) = 1);
select t.ok('...and has no final (null, not 0)',
  (select final is null from alunos.atividade_notas where atividade_id = 'd0000000-0000-0000-0000-000000000003'));
select t.throws_code('activity grade above 9 is rejected', $$
  update alunos.atividade_notas set ativ = 9.1 where atividade_id = 'd0000000-0000-0000-0000-000000000001'$$, '23514');
select t.throws_code('quiz above 1 is rejected', $$
  update alunos.atividade_notas set quiz = 1.1 where atividade_id = 'd0000000-0000-0000-0000-000000000001'$$, '23514');
select t.throws_code('negative grade is rejected', $$
  update alunos.atividade_notas set ativ = -1 where atividade_id = 'd0000000-0000-0000-0000-000000000001'$$, '23514');
select t.throws_code('tutora cannot grade a student who is not hers', $$
  insert into alunos.atividade_notas (atividade_id, aluno_id, ativ)
  values ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000b', 5)$$, '42501');
select t.ok('Atividades = mean of the graded finals only: (9 + 7) / 2 = 8 over 2 of 3',
  (select atividades = 8 and total = 3 and com_nota = 2
     from alunos.atividades_aluno('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001')));
select t.ok('the editor is stamped', (select atualizado_por is not null from alunos.atividade_notas limit 1));
select t.ok('tutora cannot read grades of another tutor''s student',
  (select count(*) from alunos.atividade_notas where aluno_id = 'a0000000-0000-0000-0000-00000000000b') = 0);
select t.throws_code('tutora cannot read Atividades of a student who is not hers',
  $$select * from alunos.atividades_aluno('a0000000-0000-0000-0000-00000000000b', '50000000-0000-0000-0000-000000000001')$$, '42501');
select t.ok('tutora cannot edit activity titles (0 rows)', t.affected($$update alunos.atividades set titulo = 'x'$$) = 0);
reset role;

select t.as_user('tutorb@test.local');
select t.ok('another tutor sees none of Ana''s grades and cannot change them',
  (select count(*) from alunos.atividade_notas) = 0
  and t.affected($$update alunos.atividade_notas set ativ = 0$$) = 0);
reset role;

select t.as_user('coord@test.local');
select t.ok('coordenacao reads all activity grades', (select count(*) from alunos.atividade_notas) = 3);
reset role;
select t.as_user('adm@test.local');
select t.ok('admin edits a grade', t.affected($$
  update alunos.atividade_notas set quiz = 1 where atividade_id = 'd0000000-0000-0000-0000-000000000002'$$) = 1);
reset role;

-- ------------------------------------------------------------------ final project
select t.as_user('tutora@test.local');
select t.ok('tutora grades two components of Ana (8 and 9)', t.affected($$
  insert into alunos.projeto_notas (semestre_id, aluno_id, codigo, nota) values
    ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'projeto', 8),
    ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'apresentacao', 9)$$) = 2);
select t.ok('Projeto renormalises over available components: (8+9)/2 = 8.5, missing = trabalho_escrito',
  (select projeto = 8.5 and componentes = 3 and com_nota = 2 and faltando = array['trabalho_escrito']
     from alunos.projeto_aluno('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001')));
select t.throws_code('component grade above 10 is rejected', $$
  update alunos.projeto_notas set nota = 10.5 where codigo = 'projeto'$$, '23514');
select t.throws_code('a grade for an unknown component is rejected', $$
  insert into alunos.projeto_notas (semestre_id, aluno_id, codigo, nota)
  values ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'nope', 5)$$, '23503');
select t.ok('tutora cannot change the weights (0 rows)', t.affected($$update alunos.projeto_componentes set peso = 5$$) = 0);
select t.throws_code('tutora cannot grade the project of another tutor''s student', $$
  insert into alunos.projeto_notas (semestre_id, aluno_id, codigo, nota)
  values ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000b', 'projeto', 5)$$, '42501');
reset role;

select t.as_user('coord@test.local');
select t.ok('coordenacao changes a weight (Projeto x2)', t.affected($$
  update alunos.projeto_componentes set peso = 2
   where codigo = 'projeto' and semestre_id = '50000000-0000-0000-0000-000000000001'$$) = 1);
select t.ok('weighted mean: (8*2 + 9*1) / 3 = 8.3333…',
  (select abs(projeto - 25.0 / 3) < 0.0000001 from alunos.projeto_aluno('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001')));
select t.ok('coordenacao zeroes a weight', t.affected($$
  update alunos.projeto_componentes set peso = 0
   where codigo = 'trabalho_escrito' and semestre_id = '50000000-0000-0000-0000-000000000001'$$) = 1);
select t.ok('...a zero-weight component is ignored and not reported as missing',
  (select componentes = 2 and faltando = '{}'::text[]
     from alunos.projeto_aluno('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001')));
select t.ok('coordenacao cannot grade the project (0 rows)',
  t.affected($$update alunos.projeto_notas set nota = 1$$) = 0);
reset role;
select t.as_user('adm@test.local');
select t.ok('admin: student with no project grades -> Projeto null, components missing',
  (select projeto is null and com_nota = 0 and faltando = array['apresentacao', 'projeto']
     from alunos.projeto_aluno('a0000000-0000-0000-0000-00000000000b', '50000000-0000-0000-0000-000000000001')));
reset role;

-- ------------------------------------------------------------------ attendance
-- Ana: 5 present, 2 late, 3 absent among the 10 weekdays; the 7th (holiday) is not a class day.
-- days: 03 04 05 06 | 07 holiday | 10 11 12 13 14
insert into public.attendance_records (aluno_id, turma_id, data, horario_checkin, status)
select 'c0000000-0000-0000-0000-00000000000a', '70000000-0000-0000-0000-000000000001', d.data, d.data + time '14:05', d.st
  from (values (date '2026-08-03', 'presente'), (date '2026-08-04', 'presente'), (date '2026-08-05', 'presente'),
               (date '2026-08-06', 'atraso'),   (date '2026-08-07', 'presente'),            -- 07 is a holiday: ignored
               (date '2026-08-10', 'presente'), (date '2026-08-11', 'presente'),
               (date '2026-08-12', 'atraso'),   (date '2026-08-13', 'falta')) as d (data, st);   -- 13: explicit 'falta' row; 14: no row

select t.ok('the view joins student and check-in by e-mail, case-insensitively',
  (select count(*) from alunos.v_presenca_aluno where aluno_id = 'a0000000-0000-0000-0000-00000000000a') = 9);

-- cut-off 2026-08-14: class days = 9 (the holiday is out); present 6 (03,04,05,10,11 + ...) -> count below
select t.ok('counts: 9 class days, 5 present, 2 late, 2 absent, nothing justified',
  (select dias_letivos = 9 and presentes = 5 and atrasos = 2 and faltas = 2 and justificadas = 0 and denominador = 9 and vinculado
     from alunos._presenca_calc('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001', date '2026-08-14')));
select t.ok('Presença = (5 + 2*0.5) / 9 * 10 = 6.666…',
  (select abs(presenca - 60.0 / 9) < 0.0000001
     from alunos._presenca_calc('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001', date '2026-08-14')));
select t.ok('the cut-off date limits the class days (until 08-05: 3 days, all present = 10)',
  (select dias_letivos = 3 and presenca = 10
     from alunos._presenca_calc('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001', date '2026-08-05')));
select t.ok('by default today''s class does not count yet (semester in the past -> all days)',
  (select dias_letivos = 9
     from alunos._presenca_calc('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001')));

-- justifications
select t.as_user('tutora@test.local');
select t.ok('tutora justifies Ana''s absence on 08-14', t.affected($$
  insert into alunos.justificativas (aluno_id, data, motivo)
  values ('a0000000-0000-0000-0000-00000000000a', '2026-08-14', 'sick (WhatsApp)')$$) = 1);
select t.ok('...registered_by is stamped', (select registrado_por is not null from alunos.justificativas limit 1));
select t.ok('a justification on a day she attended does NOT shrink the denominator', t.affected($$
  insert into alunos.justificativas (aluno_id, data, motivo)
  values ('a0000000-0000-0000-0000-00000000000a', '2026-08-03', 'unneeded')$$) = 1);
select t.throws_code('one justification per student per day', $$
  insert into alunos.justificativas (aluno_id, data, motivo)
  values ('a0000000-0000-0000-0000-00000000000a', '2026-08-14', 'again')$$, '23505');
select t.throws_code('a blank reason is rejected', $$
  insert into alunos.justificativas (aluno_id, data, motivo)
  values ('a0000000-0000-0000-0000-00000000000a', '2026-08-13', '  ')$$, '23514');
select t.throws_code('tutora cannot justify a student who is not hers', $$
  insert into alunos.justificativas (aluno_id, data, motivo)
  values ('a0000000-0000-0000-0000-00000000000b', '2026-08-14', 'x')$$, '42501');
select t.ok('Presença with 1 justified absence: (5 + 1) / 8 * 10 = 7.5',
  (select justificadas = 1 and faltas = 1 and denominador = 8 and presenca = 7.5
     from alunos.presenca_aluno('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001', date '2026-08-14')));
reset role;

-- secretaria can justify, financeiro / unrelated tutor cannot
select t.as_user('sec@test.local');
select t.ok('secretaria justifies the second absence', t.affected($$
  insert into alunos.justificativas (aluno_id, data, motivo)
  values ('a0000000-0000-0000-0000-00000000000a', '2026-08-13', 'family')$$) = 1);
reset role;
select t.as_user('tutorb@test.local');
select t.ok('another tutor sees no justification of Ana', (select count(*) from alunos.justificativas where aluno_id = 'a0000000-0000-0000-0000-00000000000a') = 0);
select t.throws_code('another tutor cannot read Ana''s attendance summary',
  $$select * from alunos.presenca_aluno('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001')$$, '42501');
reset role;
select t.as_user('fin@test.local');
select t.ok('financeiro sees no justification and no grade',
  (select count(*) from alunos.justificativas) = 0 and (select count(*) from alunos.atividade_notas) = 0
  and (select count(*) from alunos.projeto_notas) = 0);
select t.ok('financeiro can read the class-day calendar (staff-visible configuration) but not change it',
  (select count(*) from alunos.dias_letivos) > 0 and t.affected($$update alunos.dias_letivos set aula = false$$) = 0);
select t.throws_code('financeiro cannot call the attendance summary',
  $$select * from alunos.presenca_aluno('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001')$$, '42501');
reset role;

select t.ok('both absences justified: denominator 7, presenca = 6 / 7 * 10',
  (select denominador = 7 and abs(presenca - 60.0 / 7) < 0.0000001
     from alunos._presenca_calc('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001', date '2026-08-14')));

-- empty / fully justified denominators -> null, not an error
select t.ok('no class days in range -> Presença null',
  (select dias_letivos = 0 and presenca is null
     from alunos._presenca_calc('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001', date '2026-07-01')));
select t.ok('semester without configured class days -> Presença null',
  (select dias_letivos = 0 and presenca is null
     from alunos._presenca_calc('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002', date '2027-12-31')));
insert into alunos.dias_letivos (semestre_id, data) values ('50000000-0000-0000-0000-000000000002', '2027-02-01');
insert into public.allowed_users (id, nome, email, papel) values
  ('c0000000-0000-0000-0000-00000000000b', 'Bia Teste', 'bia@test.local', 'aluno');
insert into alunos.justificativas (aluno_id, data, motivo)
  values ('a0000000-0000-0000-0000-00000000000b', '2027-02-01', 'x');
select t.ok('fully justified -> denominator 0 -> Presença null (no division error)',
  (select denominador = 0 and presenca is null and vinculado
     from alunos._presenca_calc('a0000000-0000-0000-0000-00000000000b', '50000000-0000-0000-0000-000000000002', date '2027-12-31')));

-- a student who cannot be joined
delete from public.attendance_records where aluno_id = 'c0000000-0000-0000-0000-00000000000a';
delete from public.allowed_users where id = 'c0000000-0000-0000-0000-00000000000a';
select t.ok('after removing Ana''s login: not linked, Presença null',
  (select not vinculado and presenca is null
     from alunos._presenca_calc('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001', date '2026-08-14')));

select t.as_user('coord@test.local');
select t.ok('unlinked report lists the student without login and the login without student',
  (select count(*) from alunos.presenca_sem_vinculo() where origem = 'aluno_sem_login' and nome = 'Ana Teste') = 1
  and (select count(*) from alunos.presenca_sem_vinculo() where origem = 'login_sem_aluno' and nome = 'Fulana Sem Ficha') = 1);
select t.ok('team logins (papel equipe) are not reported',
  (select count(*) from alunos.presenca_sem_vinculo() where nome = 'Equipe Teste') = 0);
reset role;
select t.as_user('tutora@test.local');
select t.throws_code('a tutor cannot list unlinked students', $$select * from alunos.presenca_sem_vinculo()$$, '42501');
reset role;

-- the check-in view is not exposed to the API roles
select t.as_user('adm@test.local');
select t.throws('authenticated (even admin) cannot read the check-in view', $$select count(*) from alunos.v_presenca_aluno$$);
reset role;
select t.as_user('adm@test.local');
select t.throws_code('internal calc functions are not callable by API roles (even admin)',
  $$select * from alunos._presenca_calc('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001')$$, '42501');
select t.throws_code('...nor the project / activity calcs',
  $$select * from alunos._projeto_calc('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001')$$, '42501');
reset role;

-- ------------------------------------------------------------------ outsiders and audit
select t.as_user('ana@test.local');
select t.ok('student reads no grades, activities, justifications or class days',
  (select count(*) from alunos.atividade_notas) = 0 and (select count(*) from alunos.atividades) = 0
  and (select count(*) from alunos.projeto_notas) = 0 and (select count(*) from alunos.justificativas) = 0
  and (select count(*) from alunos.dias_letivos) = 0 and (select count(*) from alunos.projeto_componentes) = 0);
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select t.throws('anon cannot read grades', $$select count(*) from alunos.atividade_notas$$);
select t.throws('anon cannot read justifications', $$select count(*) from alunos.justificativas$$);
select t.throws('anon cannot call the attendance summary',
  $$select * from alunos.presenca_aluno('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001')$$);
reset role;

select t.ok('grade changes are audited with old and new value and the editor''s e-mail',
  (select count(*) from alunos.auditoria where tabela = 'atividade_notas' and operacao = 'UPDATE'
      and usuario_email = 'adm@test.local' and antes ->> 'quiz' is null and depois ->> 'quiz' = '1.0') = 1);
select t.ok('project grades are audited with the student as registro_id',
  (select count(*) from alunos.auditoria where tabela = 'projeto_notas' and operacao = 'INSERT'
      and usuario_email = 'tutora@test.local' and registro_id = 'a0000000-0000-0000-0000-00000000000a') = 2);
select t.ok('weight changes are audited (semester:code registro_id)',
  (select count(*) from alunos.auditoria where tabela = 'projeto_componentes' and operacao = 'UPDATE'
      and usuario_email = 'coord@test.local'
      and registro_id = '50000000-0000-0000-0000-000000000001:projeto') = 1);
select t.ok('justifications are audited',
  (select count(*) from alunos.auditoria where tabela = 'justificativas' and operacao = 'INSERT'
      and usuario_email in ('tutora@test.local', 'sec@test.local')) = 3);
select t.ok('holiday edits are audited (semester:date registro_id)',
  (select count(*) from alunos.auditoria where tabela = 'dias_letivos' and operacao = 'UPDATE'
      and registro_id = '50000000-0000-0000-0000-000000000001:2026-08-07') = 1);

\echo
select case when passed then 'PASS' else 'FAIL' end as result, name from t.results order by passed, name;
select count(*) filter (where passed) as passed, count(*) filter (where not passed) as failed from t.results;
rollback;
