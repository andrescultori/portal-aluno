-- Migration 16 tests: staff management (login + roles + evaluator entry). FAKE DATA ONLY.
begin;
\ir 05_harness.sql

insert into auth.users (email) values ('adm@test.local'), ('coord@test.local'), ('tutora@test.local'), ('sec@test.local');
insert into public.staff_roles (email, role) values
  ('adm@test.local', 'admin'), ('coord@test.local', 'coordenacao'), ('tutora@test.local', 'tutor'),
  ('sec@test.local', 'secretaria'), ('sec@test.local', 'emissor');
insert into public.allowed_users (nome, email, papel) values
  ('Adm', 'adm@test.local', 'equipe'), ('Coord', 'coord@test.local', 'equipe'),
  ('Tutora', 'tutora@test.local', 'equipe'), ('Sec', 'sec@test.local', 'equipe'),
  ('Aluna Login', 'aluna@test.local', 'aluno');

-- ---- admin creates a tutor/mentor: login, roles and the evaluator entry appear together
select t.as_user('adm@test.local');
select t.runs('admin adds a new tutor+mentor', $$select public.salvar_membro_equipe('  Novo@Test.Local ', 'Novo Membro', array['tutor', 'mentor'], true)$$);
reset role;
select t.ok('login created (lowercased e-mail, papel equipe, active)',
  exists (select 1 from public.allowed_users where email = 'novo@test.local' and papel = 'equipe' and ativo and nome = 'Novo Membro'));
select t.ok('roles tutor+mentor created',
  (select array_agg(role order by role) from public.staff_roles where email = 'novo@test.local') = array['mentor', 'tutor']);
select t.ok('evaluator entry created and active',
  exists (select 1 from alunos.equipe where email = 'novo@test.local' and ativo and nome = 'Novo Membro'));

-- ---- editing: change to coordination only -> evaluator entry is deactivated (not deleted), tutor/mentor removed
select t.as_user('adm@test.local');
select t.runs('admin changes the person to coordenacao only', $$select public.salvar_membro_equipe('novo@test.local', 'Novo Membro', array['coordenacao'], true)$$);
reset role;
select t.ok('roles now only coordenacao', (select array_agg(role) from public.staff_roles where email = 'novo@test.local') = array['coordenacao']);
select t.ok('evaluator entry kept but inactive (assignments stay valid)',
  exists (select 1 from alunos.equipe where email = 'novo@test.local' and not ativo));

-- ---- 'emissor' (legacy) is never touched
select t.as_user('adm@test.local');
select t.runs('admin edits secretaria person', $$select public.salvar_membro_equipe('sec@test.local', 'Sec', array['secretaria'], true)$$);
reset role;
select t.ok('legacy emissor role untouched', exists (select 1 from public.staff_roles where email = 'sec@test.local' and role = 'emissor'));

-- ---- coordination: only evaluator roles
select t.as_user('coord@test.local');
select t.runs('coordenacao adds a tutor', $$select public.salvar_membro_equipe('outra@test.local', 'Outra Tutora', array['tutor'], true)$$);
select t.runs('coordenacao deactivates that tutor', $$select public.salvar_membro_equipe('outra@test.local', 'Outra Tutora', array['tutor'], false)$$);
select t.throws_code('coordenacao cannot grant admin', $$select public.salvar_membro_equipe('outra@test.local', 'Outra Tutora', array['admin'], true)$$, '42501');
select t.throws_code('coordenacao cannot grant coordenacao', $$select public.salvar_membro_equipe('outra@test.local', 'Outra Tutora', array['coordenacao'], true)$$, '42501');
select t.throws_code('coordenacao cannot edit an admin', $$select public.salvar_membro_equipe('adm@test.local', 'Adm', array['tutor'], true)$$, '42501');
select t.throws_code('coordenacao cannot edit a secretaria', $$select public.salvar_membro_equipe('sec@test.local', 'Sec', array['tutor'], true)$$, '42501');
create temp table t_eq as select * from public.listar_equipe() limit 0;
grant all on t_eq to public;
insert into t_eq select * from public.listar_equipe();
reset role;
select t.ok('listar_equipe (coordenacao) shows the staff, but not the student login',
  exists (select 1 from t_eq where email = 'tutora@test.local' and 'tutor' = any (papeis) and tem_login)
  and not exists (select 1 from t_eq where email = 'aluna@test.local'));
select t.ok('deactivated tutor: login inactive, evaluator entry inactive',
  exists (select 1 from public.allowed_users where email = 'outra@test.local' and not ativo)
  and exists (select 1 from alunos.equipe where email = 'outra@test.local' and not ativo));

-- ---- everybody else is refused
select t.as_user('tutora@test.local');
select t.throws_code('tutor cannot list staff', $$select * from public.listar_equipe()$$, '42501');
select t.throws_code('tutor cannot save a member', $$select public.salvar_membro_equipe('x@test.local', 'X', array['tutor'], true)$$, '42501');
reset role;
select t.as_user('sec@test.local');
select t.throws_code('secretaria cannot save a member', $$select public.salvar_membro_equipe('x@test.local', 'X', array['tutor'], true)$$, '42501');
reset role;

-- ---- validation and guards
select t.as_user('adm@test.local');
select t.throws_code('invalid e-mail', $$select public.salvar_membro_equipe('sem-arroba', 'X', array['tutor'], true)$$, '22023');
select t.throws_code('missing name', $$select public.salvar_membro_equipe('x@test.local', '  ', array['tutor'], true)$$, '22023');
select t.throws_code('unknown role', $$select public.salvar_membro_equipe('x@test.local', 'X', array['superuser'], true)$$, '22023');
select t.throws_code('legacy role cannot be granted here', $$select public.salvar_membro_equipe('x@test.local', 'X', array['emissor'], true)$$, '22023');
select t.throws_code('a student login cannot become staff by accident', $$select public.salvar_membro_equipe('aluna@test.local', 'Aluna', array['tutor'], true)$$, '22023');
select t.throws_code('admin cannot remove own admin role', $$select public.salvar_membro_equipe('adm@test.local', 'Adm', array['tutor'], true)$$, '22023');
select t.throws_code('admin cannot deactivate self', $$select public.salvar_membro_equipe('adm@test.local', 'Adm', array['admin'], false)$$, '22023');
select t.runs('admin can keep own admin role (rename)', $$select public.salvar_membro_equipe('adm@test.local', 'Adm Renomeado', array['admin'], true)$$);
reset role;
select t.ok('rename applied', exists (select 1 from public.allowed_users where email = 'adm@test.local' and nome = 'Adm Renomeado'));

-- ---- changes are audited (roles table has the audit trigger since migration 10)
select t.ok('role changes left audit rows', exists (select 1 from alunos.auditoria where tabela = 'staff_roles'));

\echo
select case when passed then 'PASS' else 'FAIL' end as result, name from t.results order by passed, name;
select count(*) filter (where passed) as passed, count(*) filter (where not passed) as failed from t.results;
rollback;
