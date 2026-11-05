-- Conferências SOMENTE DE LEITURA, para rodar DEPOIS da migração 20 (componentes definitivos do projeto).

-- 1. Todos os semestres têm exatamente os 3 componentes novos (esperado: uma linha, "3", e nenhum código antigo).
select string_agg(distinct n::text, ',') as componentes_por_semestre from (select count(*) n from alunos.projeto_componentes group by semestre_id) x;
select codigo, nome, count(*) as semestres, min(peso) as peso_min, max(peso) as peso_max from alunos.projeto_componentes group by codigo, nome order by codigo;
select count(*) as codigos_antigos from alunos.projeto_componentes where codigo in ('trabalho_escrito', 'apresentacao');   -- esperado 0

-- 2. A chave estrangeira agora acompanha a troca de código (esperado: ... ON UPDATE CASCADE ON DELETE CASCADE).
select pg_get_constraintdef(oid) from pg_constraint
 where conrelid = 'alunos.projeto_notas'::regclass and contype = 'f' and confrelid = 'alunos.projeto_componentes'::regclass;

-- 3. Nenhuma nota se perdeu (esperado: 0 até agora, ou o mesmo número de antes).
select count(*) as notas_de_projeto from alunos.projeto_notas;

-- 4. Nada fora do módulo mudou.
select count(*) as politicas_selecao_propostas from pg_policies where schemaname in ('selecao', 'propostas');   -- esperado 30
select md5(prosrc) as checkin_md5 from pg_proc where oid = 'selecao.registrar_checkin(text,text)'::regprocedure; -- esperado c843e6f9ca5ba86a00e524f51c56d606
