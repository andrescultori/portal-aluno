-- Conferências SOMENTE DE LEITURA, para rodar DEPOIS da migração 18 (texto "desenvolvimento" obrigatório).

-- 1. A função tem a nova regra (esperado: true) e continua com as mesmas permissões (esperado: authenticated e service_role).
select pg_get_functiondef('alunos.enviar_avaliacao(uuid)'::regprocedure) like '%The development text is required%' as tem_a_regra;
select grantee from information_schema.routine_privileges
 where routine_schema = 'alunos' and routine_name = 'enviar_avaliacao' and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC') order by 1;

-- 2. Nada de dados mudou (esperado: 0 avaliações até agora).
select count(*) as avaliacoes from alunos.avaliacoes;

-- 3. Nada fora do módulo mudou.
select count(*) as politicas_selecao_propostas from pg_policies where schemaname in ('selecao', 'propostas');   -- esperado 30
select md5(prosrc) as checkin_md5 from pg_proc where oid = 'selecao.registrar_checkin(text,text)'::regprocedure; -- esperado c843e6f9ca5ba86a00e524f51c56d606
