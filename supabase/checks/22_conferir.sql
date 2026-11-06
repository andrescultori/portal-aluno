-- Conferências SOMENTE DE LEITURA, para rodar DEPOIS da migração 22 (excluir_checkin restrito; apagar_presenca aposentada).

-- 1. A função só aceita admin, coordenacao e tutor (esperado: true, true, e false = sem a regra antiga "papel equipe").
select pg_get_functiondef('public.excluir_checkin(uuid,text)'::regprocedure) like '%array[''admin'', ''coordenacao'', ''tutor'']%' as so_admin_coord_tutor,
       pg_get_functiondef('public.excluir_checkin(uuid,text)'::regprocedure) like '%has_any_role%' as usa_has_any_role,
       pg_get_functiondef('public.excluir_checkin(uuid,text)'::regprocedure) like '%current_papel%' as ainda_usa_papel_equipe;

-- 2. Só "authenticated" e "service_role" podem chamá-la (esperado: authenticated, service_role).
select grantee from information_schema.routine_privileges
 where routine_schema = 'public' and routine_name = 'excluir_checkin' and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC') order by 1;

-- 3. A função antiga foi aposentada (esperado: 0).
select count(*) as apagar_presenca_existe from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'apagar_presenca';

-- 4. Nada de dados mudou (a migração só recria uma função e remove outra).
select (select count(*) from public.attendance_records) as presencas, (select count(*) from alunos.auditoria) as linhas_de_auditoria;

-- 5. Nada fora do módulo mudou.
select count(*) as politicas_selecao_propostas from pg_policies where schemaname in ('selecao', 'propostas');   -- esperado 30
select md5(prosrc) as checkin_md5 from pg_proc where oid = 'selecao.registrar_checkin(text,text)'::regprocedure; -- esperado c843e6f9ca5ba86a00e524f51c56d606
