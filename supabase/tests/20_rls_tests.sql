-- RLS / guard / audit tests for the Phase 1A student record. FAKE DATA ONLY.
-- Everything runs inside one transaction that is rolled back at the end.
-- Prereqs (in order): 00_supabase_stub.sql, 10_baseline_existing_schema.sql, the 202611031* migrations.

begin;

create schema t;
create table t.results (name text, passed boolean);
grant usage on schema t to public;
grant all on t.results to public;

create function t.ok(p_name text, p_cond boolean) returns void language plpgsql as $$
begin insert into t.results values (p_name, coalesce(p_cond, false)); end $$;

-- passes when the statement raises any error
create function t.throws(p_name text, p_sql text) returns void language plpgsql as $$
begin
  begin execute p_sql; insert into t.results values (p_name, false);
  exception when others then insert into t.results values (p_name, true);
  end;
end $$;

-- rows touched by a DML statement (0 = blocked silently by RLS)
create function t.affected(p_sql text) returns bigint language plpgsql as $$
declare n bigint; begin execute p_sql; get diagnostics n = row_count; return n; end $$;

create function t.as_user(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'email', p_email)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
grant execute on all functions in schema t to public;

-- ------------------------------------------------------------------ fixtures (postgres)
insert into auth.users (email) values
  ('ana@test.local'), ('bia@test.local'), ('adm@test.local'), ('coord@test.local'), ('sec@test.local'),
  ('fin@test.local'), ('tutor@test.local'), ('tutor2@test.local'), ('lider@test.local'),
  ('legacy@test.local'), ('nobody@test.local'),
  ('pcoord@test.local'), ('padmin@test.local'), ('mentoremissor@test.local');

insert into public.staff_roles (email, role) values
  ('adm@test.local', 'admin'), ('coord@test.local', 'coordenacao'), ('sec@test.local', 'secretaria'),
  ('fin@test.local', 'financeiro'), ('tutor@test.local', 'tutor'), ('tutor2@test.local', 'tutor'),
  ('lider@test.local', 'lider_casa'), ('legacy@test.local', 'emissor'),
  ('mentoremissor@test.local', 'mentor'), ('mentoremissor@test.local', 'emissor');

-- legacy Propostas profile (existing behaviour must not change)
insert into propostas.perfis (user_id, email, nome, papel)
  select id, 'legacy@test.local', 'Legacy', 'emissor' from auth.users where email = 'legacy@test.local';
-- Propostas-only coordenacao / admin: they have NO staff_roles row
insert into propostas.perfis (user_id, email, nome, papel)
  select id, 'pcoord@test.local', 'PCoord', 'coordenacao' from auth.users where email = 'pcoord@test.local';
insert into propostas.perfis (user_id, email, nome, papel)
  select id, 'padmin@test.local', 'PAdmin', 'admin' from auth.users where email = 'padmin@test.local';
insert into propostas.perfis (user_id, email, nome, papel)
  select id, 'mentoremissor@test.local', 'MentorEmissor', 'emissor' from auth.users where email = 'mentoremissor@test.local';

insert into alunos.semestres (codigo, atual) values ('2026-2', true), ('2026-1', false);

insert into alunos.alunos (id, nome, email, ra, casa_id) values
  ('a0000000-0000-0000-0000-00000000000a', 'Ana Teste', 'ana@test.local', 'RA-A', null),
  ('a0000000-0000-0000-0000-00000000000b', 'Bia Teste', 'bia@test.local', 'RA-B',
     (select id from alunos.casas where nome = 'Casa Amarela'));
insert into alunos.dados_pessoais (aluno_id, cpf, endereco) values
  ('a0000000-0000-0000-0000-00000000000a', '11111111111', 'Rua A'),
  ('a0000000-0000-0000-0000-00000000000b', '22222222222', 'Rua B');
insert into alunos.aluno_saude (aluno_id, alergia) values
  ('a0000000-0000-0000-0000-00000000000a', 'pollen'),
  ('a0000000-0000-0000-0000-00000000000b', 'dust');
insert into alunos.aluno_igreja (aluno_id, igreja_atual) values
  ('a0000000-0000-0000-0000-00000000000a', 'Church A'),
  ('a0000000-0000-0000-0000-00000000000b', 'Church B');

insert into alunos.equipe (id, nome, email) values
  ('e0000000-0000-0000-0000-000000000001', 'Tutor Teste', 'tutor@test.local'),
  ('e0000000-0000-0000-0000-000000000002', 'Tutor2 Teste', 'tutor2@test.local'),
  ('e0000000-0000-0000-0000-000000000003', 'Lider Teste', 'lider@test.local');
insert into alunos.equipe_casas (equipe_id, casa_id)
  select 'e0000000-0000-0000-0000-000000000003', id from alunos.casas where nome = 'Casa Amarela';
insert into alunos.aluno_tutores (aluno_id, semestre_id, equipe_id, categoria) values
  ('a0000000-0000-0000-0000-00000000000a', (select id from alunos.semestres where codigo = '2026-2'),
   'e0000000-0000-0000-0000-000000000001', 'tutoria'),
  ('a0000000-0000-0000-0000-00000000000b', (select id from alunos.semestres where codigo = '2026-1'),
   'e0000000-0000-0000-0000-000000000002', 'tutoria');

insert into storage.objects (bucket_id, name) values
  ('alunos-fotos', 'a0000000-0000-0000-0000-00000000000a/photo.jpg'),
  ('alunos-fotos', 'a0000000-0000-0000-0000-00000000000b/photo.jpg');

-- ------------------------------------------------------------------ student (Ana)
select t.as_user('ana@test.local');
select t.ok('student sees only own basic record', (select count(*) from alunos.alunos) = 1);
select t.ok('student sees own name', (select nome from alunos.alunos) = 'Ana Teste');
select t.ok('student reads own personal data', (select count(*) from alunos.dados_pessoais) = 1);
select t.ok('student reads own health', (select count(*) from alunos.aluno_saude) = 1);
select t.ok('student cannot see other student health', (select count(*) from alunos.aluno_saude where alergia = 'dust') = 0);
select t.ok('student cannot see other student personal data', (select count(*) from alunos.dados_pessoais where cpf = '22222222222') = 0);
select t.throws('student cannot change status', $$update alunos.alunos set status = 'Formado' where email = 'ana@test.local'$$);
select t.throws('student cannot change ra', $$update alunos.alunos set ra = 'HACK' where email = 'ana@test.local'$$);
select t.throws('student cannot change casa_id', $$update alunos.alunos set casa_id = (select id from alunos.casas limit 1) where email = 'ana@test.local'$$);
select t.throws('student cannot change name', $$update alunos.alunos set nome = 'X' where email = 'ana@test.local'$$);
select t.ok('student can change own celular', t.affected($$update alunos.alunos set celular = '+5511999990000' where email = 'ana@test.local'$$) = 1);
select t.ok('student can change own whatsapp', t.affected($$update alunos.alunos set whatsapp = '+5511999990000' where email = 'ana@test.local'$$) = 1);
select t.ok('student cannot update another student (0 rows)', t.affected($$update alunos.alunos set celular = 'x' where email = 'bia@test.local'$$) = 0);
select t.ok('student can update own address', t.affected($$update alunos.dados_pessoais set endereco = 'Rua Nova' where cpf = '11111111111'$$) = 1);
select t.throws('student cannot change own cpf', $$update alunos.dados_pessoais set cpf = '33333333333' where cpf = '11111111111'$$);
select t.ok('student can update own health', t.affected($$update alunos.aluno_saude set alergia = 'none' where alergia = 'pollen'$$) = 1);
select t.ok('student can update own church', t.affected($$update alunos.aluno_igreja set igreja_atual = 'New' where igreja_atual = 'Church A'$$) = 1);
select t.throws('student cannot insert students', $$insert into alunos.alunos (nome, email) values ('Z', 'z@test.local')$$);
select t.throws('student cannot call change_status', $$select alunos.change_status('a0000000-0000-0000-0000-00000000000a', 'Trancado', 'because')$$);
select t.ok('student reads reference tables', (select count(*) from alunos.casas) = 5);
select t.throws('student cannot write reference tables', $$insert into alunos.casas (nome) values ('X')$$);
select t.ok('student sees no status history', (select count(*) from alunos.aluno_status_historico) = 0);
select t.ok('student cannot read audit log', (select count(*) from alunos.auditoria) = 0);
select t.throws('student cannot write audit log', $$insert into alunos.auditoria (tabela, operacao) values ('x', 'x')$$);
select t.ok('student cannot read staff_roles', (select count(*) from public.staff_roles) = 0);
select t.ok('student my_aluno_id resolves by e-mail', alunos.my_aluno_id() = 'a0000000-0000-0000-0000-00000000000a');
select t.ok('student can_view own, not other', public.can_view_aluno('a0000000-0000-0000-0000-00000000000a')
                                            and not public.can_view_aluno('a0000000-0000-0000-0000-00000000000b'));
select t.ok('student reads own photo object', (select count(*) from storage.objects) = 1);
select t.ok('student can upload to own photo folder', t.affected($$insert into storage.objects (bucket_id, name) values ('alunos-fotos', 'a0000000-0000-0000-0000-00000000000a/new.jpg')$$) = 1);
select t.throws('student cannot upload to another student folder', $$insert into storage.objects (bucket_id, name) values ('alunos-fotos', 'a0000000-0000-0000-0000-00000000000b/hack.jpg')$$);
reset role;

-- ------------------------------------------------------------------ outsider / anon
select t.as_user('nobody@test.local');
select t.ok('logged-in outsider sees no students', (select count(*) from alunos.alunos) = 0);
select t.ok('logged-in outsider sees no health', (select count(*) from alunos.aluno_saude) = 0);
reset role;
set local role anon;
select t.throws('anon cannot read students', $$select count(*) from alunos.alunos$$);
select t.throws('anon cannot read staff_roles', $$select count(*) from public.staff_roles$$);
reset role;

-- ------------------------------------------------------------------ tutor (assigned to Ana, current semester)
select t.as_user('tutor@test.local');
select t.ok('tutor sees only the assigned student', (select count(*) from alunos.alunos) = 1);
select t.ok('tutor assigned student is Ana', (select nome from alunos.alunos) = 'Ana Teste');
select t.ok('tutor cannot read health', (select count(*) from alunos.aluno_saude) = 0);
select t.ok('tutor cannot read personal data', (select count(*) from alunos.dados_pessoais) = 0);
select t.ok('tutor cannot read church data', (select count(*) from alunos.aluno_igreja) = 0);
select t.ok('tutor cannot read audit', (select count(*) from alunos.auditoria) = 0);
select t.ok('tutor cannot update the student (0 rows)', t.affected($$update alunos.alunos set nome = 'X' where email = 'ana@test.local'$$) = 0);
select t.ok('tutor sees own assignments only', (select count(*) from alunos.aluno_tutores) = 1);
select t.ok('tutor reads assigned student photo', (select count(*) from storage.objects) = 2);  -- photo.jpg + new.jpg of Ana
reset role;

-- tutor2 is assigned only in a NON-current semester => sees nobody
select t.as_user('tutor2@test.local');
select t.ok('tutor with only past-semester assignment sees no students', (select count(*) from alunos.alunos) = 0);
reset role;

-- ------------------------------------------------------------------ house leader
select t.as_user('lider@test.local');
select t.ok('house leader sees only their house (Bia)', (select count(*) from alunos.alunos) = 1
                                                      and (select nome from alunos.alunos) = 'Bia Teste');
select t.ok('house leader cannot read personal data', (select count(*) from alunos.dados_pessoais) = 0);
select t.ok('house leader cannot read health', (select count(*) from alunos.aluno_saude) = 0);
reset role;

-- ------------------------------------------------------------------ financeiro
select t.as_user('fin@test.local');
select t.ok('financeiro reads all students', (select count(*) from alunos.alunos) = 2);
select t.ok('financeiro reads personal data', (select count(*) from alunos.dados_pessoais) = 2);
select t.ok('financeiro cannot read health', (select count(*) from alunos.aluno_saude) = 0);
select t.ok('financeiro cannot read church', (select count(*) from alunos.aluno_igreja) = 0);
select t.ok('financeiro cannot write students (0 rows)', t.affected($$update alunos.alunos set nome = 'X'$$) = 0);
select t.ok('financeiro cannot write personal data (0 rows)', t.affected($$update alunos.dados_pessoais set endereco = 'X'$$) = 0);
reset role;

-- ------------------------------------------------------------------ secretaria
select t.as_user('sec@test.local');
select t.ok('secretaria reads all students', (select count(*) from alunos.alunos) = 2);
select t.ok('secretaria reads personal data', (select count(*) from alunos.dados_pessoais) = 2);
select t.ok('secretaria cannot read health', (select count(*) from alunos.aluno_saude) = 0);
select t.ok('secretaria reads church data', (select count(*) from alunos.aluno_igreja) = 2);
select t.ok('secretaria writes personal data', t.affected($$update alunos.dados_pessoais set cidade = 'Salinas' where cpf = '22222222222'$$) = 1);
select t.ok('secretaria edits basic data', t.affected($$update alunos.alunos set nome_exibicao = 'Bia' where email = 'bia@test.local'$$) = 1);
select t.throws('status change without reason is rejected', $$update alunos.alunos set status = 'Trancado' where email = 'bia@test.local'$$);
select t.throws('change_status requires a reason', $$select alunos.change_status('a0000000-0000-0000-0000-00000000000b', 'Trancado', '  ')$$);
select alunos.change_status('a0000000-0000-0000-0000-00000000000b', 'Trancado', 'financial leave');
select t.ok('change_status updated the student', (select status from alunos.alunos where email = 'bia@test.local') = 'Trancado');
select t.ok('status history has the reason', (select count(*) from alunos.aluno_status_historico
                                                where status = 'Trancado' and motivo = 'financial leave') = 1);
select t.throws('invalid status is rejected', $$select alunos.change_status('a0000000-0000-0000-0000-00000000000b', 'Banana', 'x')$$);
select t.ok('secretaria cannot read audit', (select count(*) from alunos.auditoria) = 0);
select t.ok('secretaria cannot delete students (0 rows)', t.affected($$delete from alunos.alunos where email = 'bia@test.local'$$) = 0);
reset role;

-- ------------------------------------------------------------------ coordenacao
select t.as_user('coord@test.local');
select t.ok('coordenacao reads all students', (select count(*) from alunos.alunos) = 2);
select t.ok('coordenacao reads health', (select count(*) from alunos.aluno_saude) = 2);
select t.ok('coordenacao cannot write health (0 rows)', t.affected($$update alunos.aluno_saude set alergia = 'x'$$) = 0);
select t.ok('coordenacao cannot write personal data (0 rows)', t.affected($$update alunos.dados_pessoais set endereco = 'x'$$) = 0);
select t.ok('coordenacao writes church data', t.affected($$update alunos.aluno_igreja set igreja_atual = 'Coord'$$) = 2);
select t.ok('coordenacao reads status history', (select count(*) from alunos.aluno_status_historico) >= 1);
select t.ok('coordenacao can write reference data', t.affected($$insert into alunos.casas (nome) values ('Casa Nova')$$) = 1);
reset role;

-- ------------------------------------------------------------------ Propostas profiles must NOT reach student data
-- (legacy policies alunos_leitura / alunos_dp_leitura were dropped by migration 7)
select t.as_user('legacy@test.local');   -- emissor only (propostas.perfis + staff_roles label)
select t.ok('emissor reads 0 rows from alunos.alunos', (select count(*) from alunos.alunos) = 0);
select t.ok('emissor reads 0 rows from alunos.dados_pessoais', (select count(*) from alunos.dados_pessoais) = 0);
select t.ok('emissor reads 0 health rows', (select count(*) from alunos.aluno_saude) = 0);
select t.ok('emissor role grants nothing in the new model', not public.is_staff());
reset role;

select t.as_user('pcoord@test.local');   -- Propostas-only coordenacao, no staff_roles row
select t.ok('Propostas-only coordenacao reads 0 rows from alunos.alunos', (select count(*) from alunos.alunos) = 0);
select t.ok('Propostas-only coordenacao reads 0 rows from alunos.dados_pessoais (no CPF/address)', (select count(*) from alunos.dados_pessoais) = 0);
select t.ok('Propostas-only coordenacao is not staff in the new model', not public.is_staff());
reset role;

select t.as_user('padmin@test.local');   -- Propostas-only admin, no staff_roles row
select t.ok('Propostas-only admin reads 0 rows from alunos.alunos', (select count(*) from alunos.alunos) = 0);
select t.ok('Propostas-only admin reads 0 rows from alunos.dados_pessoais', (select count(*) from alunos.dados_pessoais) = 0);
select t.ok('Propostas-only admin cannot read the audit log', (select count(*) from alunos.auditoria) = 0);
select t.ok('Propostas-only admin cannot read staff_roles', (select count(*) from public.staff_roles) = 0);
reset role;

select t.as_user('mentoremissor@test.local');   -- mentor + emissor, no assignment
select t.ok('mentor+emissor without an assignment sees no students', (select count(*) from alunos.alunos) = 0);
reset role;

-- the legacy policies are really gone
select t.ok('legacy policy alunos_leitura was dropped', not exists (
  select 1 from pg_policies where schemaname = 'alunos' and tablename = 'alunos' and policyname = 'alunos_leitura'));
select t.ok('legacy policy alunos_dp_leitura was dropped', not exists (
  select 1 from pg_policies where schemaname = 'alunos' and tablename = 'dados_pessoais' and policyname = 'alunos_dp_leitura'));
select t.ok('no alunos policy references the Propostas helpers', not exists (
  select 1 from pg_policies where schemaname = 'alunos'
     and coalesce(qual, '') || coalesce(with_check, '') ~ '(eh_equipe|eh_coordenacao_ou_admin|papel_atual|e_admin|e_coordenacao)'));

-- Data API exposure: exact value (migration 9)
select t.ok('pgrst.db_schemas is exactly the approved value', exists (
  select 1 from pg_roles r, unnest(r.rolconfig) c
   where r.rolname = 'authenticator'
     and c = 'pgrst.db_schemas=public, graphql_public, propostas, selecao, alunos'));

-- ------------------------------------------------------------------ admin
select t.as_user('adm@test.local');
select t.ok('admin reads all students', (select count(*) from alunos.alunos) = 2);
select t.ok('admin reads health', (select count(*) from alunos.aluno_saude) = 2);
select t.ok('admin reads audit log', (select count(*) from alunos.auditoria) > 0);
select t.ok('admin audit masks the CPF', (select count(*) from alunos.auditoria
                                           where tabela = 'dados_pessoais'
                                             and (depois ->> 'cpf') like '***.***.***-%') > 0);
select t.ok('admin audit never stores a full CPF', (select count(*) from alunos.auditoria
                                                     where coalesce(antes::text, '') || coalesce(depois::text, '') ~ '(1{11}|2{11}|3{11}|4{11})') = 0);  -- the fixture CPFs
select t.ok('audit recorded the secretaria update with actor e-mail', (select count(*) from alunos.auditoria
                                                                        where usuario_email = 'sec@test.local') > 0);
select t.ok('admin manages staff_roles', t.affected($$insert into public.staff_roles (email, role) values ('new@test.local', 'tutor')$$) = 1);
select t.ok('admin deletes a student', t.affected($$delete from alunos.alunos where email = 'bia@test.local'$$) = 1);
select t.ok('current_roles reflects the logged-in admin', public.current_roles() = array['admin']);
reset role;

-- ------------------------------------------------------------------ non-admin cannot touch staff_roles
select t.as_user('sec@test.local');
select t.ok('secretaria cannot read staff_roles', (select count(*) from public.staff_roles) = 0);
select t.throws('secretaria cannot grant roles', $$insert into public.staff_roles (email, role) values ('sec@test.local', 'admin')$$);
reset role;

-- ------------------------------------------------------------------ selecao.registrar_checkin must keep working
insert into selecao.segredos_automacao (nome, hash)
  values ('make', encode(sha256(convert_to('test-secret', 'UTF8')), 'hex'));
insert into selecao.candidatos (id, email, nome, kommo_lead_id, ra, sexo, semestre, telefone, curso, plano)
  values ('c0000000-0000-0000-0000-000000000001', 'cand@test.local', 'Candidata Teste', 'lead-1', 'RA-C',
          'F', '2027-1', '+5511988887777', 'Teologia', 'Completo');
insert into selecao.candidato_dados_pessoais (candidato_id, cpf, endereco, emergencia)
  values ('c0000000-0000-0000-0000-000000000001', '44444444444', 'Rua C', '{"nome":"Mae","telefone":"+5511977776666"}');

set local role anon;  -- Make calls the RPC with the anon key and the shared secret
select set_config('request.jwt.claims', '', true);
create temp table t_checkin as select selecao.registrar_checkin('test-secret', 'lead-1') as r;
select t.ok('registrar_checkin finds the candidate', (select (r ->> 'encontrado')::boolean from t_checkin));
select t.ok('registrar_checkin is not "ja_registrado" the first time', not (select (r ->> 'ja_registrado')::boolean from t_checkin));
reset role;
select t.ok('check-in created the student', (select count(*) from alunos.alunos where candidato_id = 'c0000000-0000-0000-0000-000000000001') = 1);
select t.ok('check-in created personal data', (select count(*) from alunos.dados_pessoais where cpf = '44444444444') = 1);
select t.ok('check-in defaults: status Ativo, colaborador false', (select status = 'Ativo' and colaborador = false
                                                                    from alunos.alunos where email = 'cand@test.local'));
select t.ok('check-in wrote initial status history', (select count(*) from alunos.aluno_status_historico h
                                                       join alunos.alunos a on a.id = h.aluno_id
                                                      where a.email = 'cand@test.local') = 1);
select t.ok('check-in is audited', (select count(*) from alunos.auditoria where tabela = 'alunos'
                                      and depois ->> 'email' = 'cand@test.local') = 1);
-- second call: idempotent
set local role anon;
select set_config('request.jwt.claims', '', true);
select t.ok('registrar_checkin is idempotent', (select (selecao.registrar_checkin('test-secret', 'lead-1') ->> 'ja_registrado')::boolean));
reset role;
-- force the ON CONFLICT DO UPDATE path (re-run after the step marker is removed)
delete from selecao.candidato_etapas where etapa = 'checkin';
set local role anon;
select set_config('request.jwt.claims', '', true);
select t.ok('registrar_checkin update path works under the new triggers',
            (select (selecao.registrar_checkin('test-secret', 'lead-1') ->> 'encontrado')::boolean));
reset role;
select t.ok('update path did not duplicate the student', (select count(*) from alunos.alunos where email = 'cand@test.local') = 1);
set local role anon;
select t.throws('registrar_checkin still rejects a bad secret', $$select selecao.registrar_checkin('wrong', 'lead-1')$$);
reset role;

-- ------------------------------------------------------------------ report
\echo
select case when passed then 'PASS' else 'FAIL' end as result, name from t.results order by passed, name;
select count(*) filter (where passed) as passed, count(*) filter (where not passed) as failed from t.results;
rollback;
