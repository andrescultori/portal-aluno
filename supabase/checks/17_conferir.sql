-- Conferências SOMENTE DE LEITURA, para rodar DEPOIS da migração 17 (correção de presenças).

-- 1. As duas funções existem (esperado: 2 linhas) e a coluna "motivo" existe na auditoria (esperado: 1 linha).
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and proname in ('corrigir_presenca', 'apagar_presenca') order by 1;
select column_name from information_schema.columns where table_schema = 'alunos' and table_name = 'auditoria' and column_name = 'motivo';

-- 2. Nada de dados mudou: a migração só cria funções e uma coluna (esperado: os mesmos números de antes).
select (select count(*) from public.attendance_records) as registros_de_presenca,
       (select count(*) from alunos.auditoria) as linhas_de_auditoria;

-- 3. A tabela de check-in continua sem política de escrita para pessoas (esperado: só a de leitura, 1 linha).
select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'attendance_records';

-- 4. Nada fora do módulo mudou.
select count(*) as politicas_selecao_propostas from pg_policies where schemaname in ('selecao', 'propostas');   -- esperado 30
select md5(prosrc) as checkin_md5 from pg_proc where oid = 'selecao.registrar_checkin(text,text)'::regprocedure; -- esperado c843e6f9ca5ba86a00e524f51c56d606
