-- Conferências SOMENTE DE LEITURA, para rodar DEPOIS da migração 21 (correção de segurança do excluir_checkin).

-- 1. A função tem a correção (esperado: true).
select pg_get_functiondef('public.excluir_checkin(uuid,text)'::regprocedure) like '%coalesce(public.current_papel()%' as tem_a_correcao;

-- 2. Só "authenticated" e "service_role" podem chamá-la (esperado: authenticated, service_role; sem anon nem PUBLIC).
select grantee from information_schema.routine_privileges
 where routine_schema = 'public' and routine_name = 'excluir_checkin' and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC') order by 1;

-- 3. Nada de dados mudou (a migração só recria a função).
select (select count(*) from public.attendance_records) as presencas, (select count(*) from alunos.auditoria) as linhas_de_auditoria;

-- 4. Nada fora do módulo mudou.
select count(*) as politicas_selecao_propostas from pg_policies where schemaname in ('selecao', 'propostas');   -- esperado 30
select md5(prosrc) as checkin_md5 from pg_proc where oid = 'selecao.registrar_checkin(text,text)'::regprocedure; -- esperado c843e6f9ca5ba86a00e524f51c56d606
