-- Conferências SOMENTE DE LEITURA, para rodar DEPOIS da migração 19 (lista de faltas do aluno).

-- 1. A função existe (esperado: 1 linha) e só "authenticated" e "service_role" podem chamá-la.
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'alunos' and proname = 'faltas_aluno';
select grantee from information_schema.routine_privileges
 where routine_schema = 'alunos' and routine_name = 'faltas_aluno' and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC') order by 1;

-- 2. Nada de dados mudou (a migração só cria uma função).
select (select count(*) from alunos.dias_letivos) as dias_letivos, (select count(*) from alunos.justificativas) as justificativas,
       (select count(*) from public.attendance_records) as presencas;

-- 3. Nada fora do módulo mudou.
select count(*) as politicas_selecao_propostas from pg_policies where schemaname in ('selecao', 'propostas');   -- esperado 30
select md5(prosrc) as checkin_md5 from pg_proc where oid = 'selecao.registrar_checkin(text,text)'::regprocedure; -- esperado c843e6f9ca5ba86a00e524f51c56d606
