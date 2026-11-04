-- Migration 10 tests: role and staff changes are audited. FAKE DATA ONLY; rolled back at the end.
begin;
\ir 05_harness.sql

insert into auth.users (email) values ('adm@test.local'), ('sec@test.local');
insert into public.staff_roles (email, role) values ('adm@test.local', 'admin'), ('sec@test.local', 'secretaria');

-- clean slate so we only look at what this file does
delete from alunos.auditoria;

-- ---- admin grants and revokes a role through the API (JWT present)
select t.as_user('adm@test.local');
insert into public.staff_roles (email, role) values ('new@test.local', 'tutor');
select t.ok('role grant is audited with the actor e-mail',
  (select count(*) from alunos.auditoria
    where tabela = 'staff_roles' and operacao = 'INSERT' and usuario_email = 'adm@test.local'
      and depois ->> 'email' = 'new@test.local' and depois ->> 'role' = 'tutor') = 1);
select t.ok('role grant audit uses the row id as registro_id',
  (select registro_id from alunos.auditoria where tabela = 'staff_roles' and operacao = 'INSERT'
      and depois ->> 'email' = 'new@test.local') is not null);
update public.staff_roles set role = 'mentor' where email = 'new@test.local';
select t.ok('role change is audited with old and new value',
  (select count(*) from alunos.auditoria
    where tabela = 'staff_roles' and operacao = 'UPDATE'
      and antes ->> 'role' = 'tutor' and depois ->> 'role' = 'mentor') = 1);
update public.staff_roles set role = 'mentor' where email = 'new@test.local';   -- no-op
select t.ok('no-op update is not audited',
  (select count(*) from alunos.auditoria where tabela = 'staff_roles' and operacao = 'UPDATE') = 1);
delete from public.staff_roles where email = 'new@test.local';
select t.ok('role revocation is audited',
  (select count(*) from alunos.auditoria
    where tabela = 'staff_roles' and operacao = 'DELETE' and antes ->> 'email' = 'new@test.local') = 1);

-- ---- team directory
insert into alunos.equipe (id, nome, email)
  values ('e0000000-0000-0000-0000-0000000000f1', 'Equipe Teste', 'eq@test.local');
select t.ok('equipe insert is audited with the row id',
  (select count(*) from alunos.auditoria where tabela = 'equipe' and operacao = 'INSERT'
      and registro_id = 'e0000000-0000-0000-0000-0000000000f1') = 1);
insert into alunos.equipe_casas (equipe_id, casa_id)
  select 'e0000000-0000-0000-0000-0000000000f1', id from alunos.casas where nome = 'Casa Amarela';
select t.ok('equipe_casas insert is audited with a composite registro_id',
  (select count(*) from alunos.auditoria where tabela = 'equipe_casas' and operacao = 'INSERT'
      and registro_id like 'e0000000-0000-0000-0000-0000000000f1:%') = 1);
delete from alunos.equipe_casas where equipe_id = 'e0000000-0000-0000-0000-0000000000f1';
select t.ok('equipe_casas delete is audited',
  (select count(*) from alunos.auditoria where tabela = 'equipe_casas' and operacao = 'DELETE'
      and registro_id like 'e0000000-0000-0000-0000-0000000000f1:%') = 1);
update alunos.equipe set ativo = false where id = 'e0000000-0000-0000-0000-0000000000f1';
select t.ok('equipe deactivation is audited',
  (select count(*) from alunos.auditoria where tabela = 'equipe' and operacao = 'UPDATE'
      and antes ->> 'ativo' = 'true' and depois ->> 'ativo' = 'false') = 1);
select t.ok('admin can read these audit rows', (select count(*) from alunos.auditoria) >= 7);
reset role;

-- ---- existing behaviour is unchanged
insert into alunos.alunos (id, nome, email) values ('a0000000-0000-0000-0000-0000000000c1', 'Teste', 'c1@test.local');
insert into alunos.aluno_saude (aluno_id, alergia) values ('a0000000-0000-0000-0000-0000000000c1', 'x');
select t.ok('student tables still use aluno_id as registro_id',
  (select count(*) from alunos.auditoria where tabela = 'aluno_saude'
      and registro_id = 'a0000000-0000-0000-0000-0000000000c1') = 1);
select t.ok('alunos table still uses id as registro_id',
  (select count(*) from alunos.auditoria where tabela = 'alunos'
      and registro_id = 'a0000000-0000-0000-0000-0000000000c1') = 1);

-- ---- SQL Editor / service role: no JWT, row still recorded
select set_config('request.jwt.claims', '', true);
insert into public.staff_roles (email, role) values ('sql@test.local', 'secretaria');
select t.ok('change without a JWT is recorded with null actor',
  (select count(*) from alunos.auditoria where tabela = 'staff_roles' and operacao = 'INSERT'
      and depois ->> 'email' = 'sql@test.local' and usuario is null and usuario_email is null) = 1);

-- ---- who can read the log
select t.as_user('sec@test.local');
select t.ok('secretaria cannot read the audit log', (select count(*) from alunos.auditoria) = 0);
select t.throws('secretaria cannot forge audit rows',
  $$insert into alunos.auditoria (tabela, operacao) values ('staff_roles', 'INSERT')$$);
select t.throws('secretaria cannot grant roles',
  $$insert into public.staff_roles (email, role) values ('sec@test.local', 'admin')$$);
reset role;
set local role anon;
select t.throws('anon cannot read the audit log', $$select count(*) from alunos.auditoria$$);
reset role;

-- ---- every table has the trigger
select t.ok('trg_audit exists on staff_roles, equipe and equipe_casas',
  (select count(*) from pg_trigger tg join pg_class c on c.oid = tg.tgrelid
    where tg.tgname = 'trg_audit' and not tg.tgisinternal
      and c.relname in ('staff_roles', 'equipe', 'equipe_casas')) = 3);

\echo
select case when passed then 'PASS' else 'FAIL' end as result, name from t.results order by passed, name;
select count(*) filter (where passed) as passed, count(*) filter (where not passed) as failed from t.results;
rollback;
