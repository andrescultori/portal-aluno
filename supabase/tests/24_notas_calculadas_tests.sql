-- Migration 13 tests: computed grades. Parity with the "Avaliação Completa" workbook formulas, edge cases,
-- an end-to-end scenario through real evaluations, and who can see what. FAKE DATA ONLY.
begin;
\ir 05_harness.sql

-- =================================================================== A. pure formulas (workbook parity)
-- Case from the workbook, semester 2024-1: Teoria 9, Prática 8.5, Atividades 9.12, Projeto 8.5, Presença 8.7
-- -> Tutoria 8.8 ; Mentoria 7.3 -> Final 8.1   (unrounded math would give 8.0; rounded-then-averaged gives 8.1)
select t.ok('PARITY: Tutoria = 8.8', alunos.calc_tutoria(9, 8.5, 9.12, 8.5, 8.7) = 8.8);
select t.ok('PARITY: Final = 8.1 from the rounded Tutoria 8.8 and Mentoria 7.3', alunos.calc_final(8.8, 7.3) = 8.1);
select t.ok('PARITY: the chain Tutoria -> Final reproduces 8.1',
  alunos.calc_final(alunos.calc_tutoria(9, 8.5, 9.12, 8.5, 8.7), 7.3) = 8.1);
select t.ok('PARITY: averaging the UNROUNDED values would give 8.0 (that is not the rule)',
  round(((9 + 8.5 + 9.12 + 8.5 + 8.7) / 5 + 7.3) / 2, 1) = 8.0);
select t.ok('PARITY: unrounded Mentoria (80/11) still rounds to 7.3 before the Final',
  alunos.calc_final(alunos.calc_tutoria(9, 8.5, 9.12, 8.5, 8.7), round(80.0 / 11, 1)) = 8.1);

-- Case 2: a missing component (value 0 is excluded from the average, null too)
select t.ok('CASE 2: a 0 component is excluded: avg(9, 8, 8.5, 8.5) = 8.5', alunos.calc_tutoria(9, 8, 0, 8.5, 8.5) = 8.5);
select t.ok('CASE 2: a null component is excluded as well', alunos.calc_tutoria(9, 8, null, 8.5, 8.5) = 8.5);
select t.ok('CASE 2: with the 0 counted the answer would differ (7.0) - proving the exclusion matters',
  round((9 + 8 + 0 + 8.5 + 8.5) / 5.0, 1) = 6.8);
select t.ok('CASE 2: everything missing -> null (not 0, not an error)', alunos.calc_tutoria(null, null, 0, null, 0) is null);

-- Case 3: a missing Mentoria (the Final is the Tutoria alone)
select t.ok('CASE 3: no Mentoria (null) -> Final = Tutoria 8.8', alunos.calc_final(8.8, null) = 8.8);
select t.ok('CASE 3: Mentoria 0 -> excluded as well', alunos.calc_final(8.8, 0) = 8.8);
select t.ok('CASE 3: no Tutoria -> Final = Mentoria', alunos.calc_final(null, 7.3) = 7.3);
select t.ok('CASE 3: nothing at all -> null', alunos.calc_final(null, null) is null);

-- Case 4: rounding and the 6.0 / 5.9 boundary
select t.ok('CASE 4: 5.9 fails and 6.0 passes',
  alunos.aprovado_de(5.9) = false and alunos.aprovado_de(6.0) = true);
select t.ok('CASE 4: Tutoria 5.9 + Mentoria 6.0 -> average 5.95 rounds HALF UP to 6.0 -> approved',
  alunos.calc_final(5.9, 6.0) = 6.0 and alunos.aprovado_de(alunos.calc_final(5.9, 6.0)));
select t.ok('CASE 4: 5.94 stays 5.9 -> not approved', alunos.calc_final(5.9, 5.98) = 5.9 and not alunos.aprovado_de(alunos.calc_final(5.9, 5.98)));
select t.ok('CASE 4: half-up on x.x5 where half-even would differ: avg 8.65 -> 8.7', alunos.calc_final(8.6, 8.7) = 8.7);
select t.ok('CASE 4: half-up: avg 6.45 -> 6.5 (floating point would give 6.4)', alunos.calc_final(6.4, 6.5) = 6.5);
select t.ok('approval needs a final', alunos.aprovado_de(null) is null);
select t.ok('concept thresholds: <5 Insatisfatório | 5..<7 Regular | 7..<9 Bom | >=9 Excelente',
  alunos.conceito_de(0) = 'Insatisfatório' and alunos.conceito_de(4.9) = 'Insatisfatório'
  and alunos.conceito_de(5.0) = 'Regular' and alunos.conceito_de(6.9) = 'Regular'
  and alunos.conceito_de(7.0) = 'Bom' and alunos.conceito_de(8.9) = 'Bom'
  and alunos.conceito_de(9.0) = 'Excelente' and alunos.conceito_de(10) = 'Excelente'
  and alunos.conceito_de(null) is null);
select t.ok('pass mark default is 6.0', (select aprovacao from alunos.notas_config) = 6.0);

-- =================================================================== B. end-to-end through real rows
insert into auth.users (email) values
  ('ana@test.local'), ('bia@test.local'), ('tutora@test.local'), ('tutorb@test.local'), ('mentorm@test.local'),
  ('lider@test.local'), ('sec@test.local'), ('fin@test.local'), ('coord@test.local'), ('adm@test.local');
insert into public.staff_roles (email, role) values
  ('tutora@test.local', 'tutor'), ('tutorb@test.local', 'tutor'), ('mentorm@test.local', 'mentor'),
  ('lider@test.local', 'lider_casa'), ('sec@test.local', 'secretaria'), ('fin@test.local', 'financeiro'),
  ('coord@test.local', 'coordenacao'), ('adm@test.local', 'admin');

-- semester 2025-2: Mon 2025-08-04 .. Fri 2025-08-15 = 10 class days (in the past, so every day counts)
insert into alunos.semestres (id, codigo, inicio, fim)
  values ('50000000-0000-0000-0000-000000000002', '2025-2', '2025-08-04', '2025-08-15');
insert into alunos.alunos (id, nome, email, casa_id) values
  ('a0000000-0000-0000-0000-00000000000a', 'Ana Teste', 'ana@test.local',
     (select id from alunos.casas where nome = 'Casa Amarela')),
  ('a0000000-0000-0000-0000-00000000000b', 'Bia Teste', 'bia@test.local', null);
insert into alunos.equipe (id, nome, email) values
  ('e0000000-0000-0000-0000-0000000000a1', 'Tutora', 'tutora@test.local'),
  ('e0000000-0000-0000-0000-0000000000a2', 'Tutor B', 'tutorb@test.local'),
  ('e0000000-0000-0000-0000-0000000000a4', 'Mentor M', 'mentorm@test.local'),
  ('e0000000-0000-0000-0000-0000000000a3', 'Lider', 'lider@test.local');
insert into alunos.equipe_casas (equipe_id, casa_id)
  select 'e0000000-0000-0000-0000-0000000000a3', id from alunos.casas where nome = 'Casa Amarela';
insert into alunos.aluno_tutores (aluno_id, semestre_id, equipe_id, categoria) values
  ('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000a1', 'tutoria'),
  ('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000a2', 'tutoria'),
  ('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000a4', 'mentoria'),
  ('a0000000-0000-0000-0000-00000000000b', '50000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000a1', 'tutoria'),
  ('a0000000-0000-0000-0000-00000000000b', '50000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000a2', 'tutoria');
-- Mentoria for Ana is expected from mentorm (explicit) and lider (house leader of Casa Amarela) = 2 evaluators
insert into alunos.matriculas (aluno_id, semestre_id, ciclo_id)
  select 'a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002', id from alunos.ciclos where nome = 'Básico';

-- helper: a submitted evaluation with answers given as a list of valores in question order
create function t.evaluate(p_id uuid, p_aluno uuid, p_semestre uuid, p_equipe uuid, p_cat text, p_valores int[])
returns void language plpgsql as $$
begin
  insert into alunos.avaliacoes (id, semestre_id, aluno_id, avaliador_equipe_id, modelo_id, categoria, status)
  select p_id, p_semestre, p_aluno, p_equipe, m.id, p_cat, 'enviada'
    from alunos.avaliacao_modelos m where m.categoria = p_cat and m.ativo;
  insert into alunos.avaliacao_respostas (avaliacao_id, pergunta_id, valor)
  select p_id, q.id, p_valores[q.rn]
    from (select p.id, row_number() over (order by g.ordem, p.ordem) as rn
            from alunos.avaliacao_perguntas p
            join alunos.avaliacao_grupos g on g.id = p.grupo_id
            join alunos.avaliacao_modelos m on m.id = g.modelo_id
           where m.categoria = p_cat and m.ativo) q;
end $$;
grant execute on function t.evaluate(uuid, uuid, uuid, uuid, text, int[]) to public;

-- Tutoria, two evaluators. Questions: teoria q1..q4, pratica q1..q4.
--   A: all 5 (10 pts)            B: teoria 4,4,4,4 (8) ; pratica 4,4,3,3 (8,8,6,6)
--   -> question means: teoria 9,9,9,9 = 9 ; pratica 9,9,8,8 = 8.5
select t.evaluate('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a',
  '50000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000a1', 'tutoria', array[5,5,5,5,5,5,5,5]);
select t.evaluate('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a',
  '50000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000a2', 'tutoria', array[4,4,4,4,4,4,3,3]);
-- Mentoria: mentorm answers 5,5,5,4,4,4,3,3,3,2,2 (10,10,10,8,8,8,6,6,6,4,4 = 80 points over 11 questions = 7.2727 -> 7.3)
select t.evaluate('f0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a',
  '50000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000a4', 'mentoria', array[5,5,5,4,4,4,3,3,3,2,2]);
-- the house leader answers "cannot answer" (1) to everything: the evaluation is submitted but adds no points
select t.evaluate('f0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-00000000000a',
  '50000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000a3', 'mentoria', array[1,1,1,1,1,1,1,1,1,1,1]);
-- a DRAFT evaluation never counts
insert into alunos.avaliacoes (id, semestre_id, aluno_id, avaliador_equipe_id, modelo_id, categoria)
  select 'f0000000-0000-0000-0000-000000000009', '50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000b',
         'e0000000-0000-0000-0000-0000000000a1', m.id, 'tutoria' from alunos.avaliacao_modelos m where m.categoria = 'tutoria' and m.ativo;
insert into alunos.avaliacao_respostas (avaliacao_id, pergunta_id, valor)
  select 'f0000000-0000-0000-0000-000000000009', p.id, 2 from alunos.avaliacao_perguntas p
    join alunos.avaliacao_grupos g on g.id = p.grupo_id join alunos.avaliacao_modelos m on m.id = g.modelo_id
   where m.categoria = 'tutoria' and m.ativo;

-- activities: finals 9.0, 9.5, 9.0, 9.5 -> mean 9.25
insert into alunos.atividades (id, semestre_id, ordem, titulo) values
  ('d0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', 1, 'A1'),
  ('d0000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 2, 'A2'),
  ('d0000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000002', 3, 'A3'),
  ('d0000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000002', 4, 'A4');
insert into alunos.atividade_notas (atividade_id, aluno_id, ativ, quiz) values
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 8, 1),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', 9, 0.5),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a', 9, 0),
  ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-00000000000a', 8.5, 1);
-- project: 8, 9, 8.5 with equal weights -> 8.5
insert into alunos.projeto_notas (semestre_id, aluno_id, codigo, nota) values
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', 'projeto', 8),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', 'avaliacao_pares', 9),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', 'escrita', 8.5);
-- attendance: 10 class days; Ana: 8 present, 1 late, 1 absent -> (8 + 0.5) / 10 * 10 = 8.5
select alunos.gerar_dias_letivos('50000000-0000-0000-0000-000000000002');
insert into public.turmas (id, nome, horario_inicio, horario_fim_presente, horario_fim_atraso)
  values ('70000000-0000-0000-0000-000000000001', 'Turma Teste', '14:00', '14:15', '14:45');
insert into public.allowed_users (id, nome, email, papel, turma_id)
  values ('c0000000-0000-0000-0000-00000000000a', 'Ana Teste', 'ana@test.local', 'aluno', '70000000-0000-0000-0000-000000000001');
insert into public.attendance_records (aluno_id, turma_id, data, horario_checkin, status)
select 'c0000000-0000-0000-0000-00000000000a', '70000000-0000-0000-0000-000000000001', d.data, d.data + time '14:05',
       case when d.data = date '2025-08-08' then 'atraso' else 'presente' end
  from alunos.dias_letivos d
 where d.semestre_id = '50000000-0000-0000-0000-000000000002' and d.data <> date '2025-08-15';   -- 15th: absent

-- ---- expected: teoria 9, pratica 8.5, atividades 9.25, projeto 8.5, presenca 8.5
--      tutoria = round(avg(9, 8.5, 9.25, 8.5, 8.5) = 8.75, 1) = 8.8 ; mentoria 7.3 ; final = round(avg(8.8, 7.3) = 8.05, 1) = 8.1

select t.as_user('coord@test.local');
create temp table t_ana as select * from alunos.notas_aluno('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002');
reset role;
select t.ok('E2E: Teoria = 9 and Prática = 8.5 (mean of question means across two evaluators)',
  (select teoria = 9 and pratica = 8.5 from t_ana));
select t.ok('E2E: Atividades = 9.25 and Projeto = 8.5 and Presença = 8.5',
  (select atividades = 9.25 and projeto = 8.5 and presenca = 8.5 from t_ana));
select t.ok('E2E: Tutoria = 8.8 (8.75 rounded half up)', (select tutoria = 8.8 from t_ana));
select t.ok('E2E: Mentoria = 7.3 (80/11 = 7.27); the "cannot answer" evaluation added nothing', (select mentoria = 7.3 from t_ana));
select t.ok('E2E: Final = 8.1 from the rounded values; concept Bom; approved', (select final = 8.1 and conceito = 'Bom' and aprovado from t_ana));
select t.ok('E2E: the result is complete (all evaluators, activities, project and attendance are in)',
  (select completo and pendencias = '[]'::jsonb and tutoria_enviadas = 2 and tutoria_esperados = 2
          and mentoria_enviadas = 2 and mentoria_esperados = 2 from t_ana));

-- ---- partial result: Bia has only a draft, no activities, no project, no login
select t.as_user('coord@test.local');
create temp table t_bia as select * from alunos.notas_aluno('a0000000-0000-0000-0000-00000000000b', '50000000-0000-0000-0000-000000000002');
reset role;
select t.ok('PARTIAL: a draft evaluation does not count (Teoria/Prática/Tutoria/Final are null)',
  (select teoria is null and pratica is null and tutoria is null and mentoria is null and final is null
          and conceito is null and aprovado is null from t_bia));
select t.ok('PARTIAL: flagged incomplete and never definitive', (select not completo from t_bia));
select t.ok('PARTIAL: the missing pieces are listed',
  (select pendencias @> '[{"codigo":"tutoria_sem_avaliacoes"}]'
      and pendencias @> '[{"codigo":"mentoria_sem_avaliacoes"}]'
      and pendencias @> '[{"codigo":"atividades_sem_notas"}]'
      and pendencias @> '[{"codigo":"projeto_componentes_faltando"}]'
      and pendencias @> '[{"codigo":"presenca_sem_vinculo"}]' from t_bia));
select t.ok('PARTIAL: Presença is null and the student is reported as not linked (never a fake 0)',
  (select presenca is null from t_bia));

-- a partial Tutoria: one of the two tutors has submitted (fixtures are written without an end-user JWT)
select set_config('request.jwt.claims', '', true);
insert into alunos.avaliacoes (id, semestre_id, aluno_id, avaliador_equipe_id, modelo_id, categoria, status)
  select 'f0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000b',
         'e0000000-0000-0000-0000-0000000000a2', m.id, 'tutoria', 'enviada' from alunos.avaliacao_modelos m where m.categoria = 'tutoria' and m.ativo;
insert into alunos.avaliacao_respostas (avaliacao_id, pergunta_id, valor)
  select 'f0000000-0000-0000-0000-00000000000a', p.id, 4 from alunos.avaliacao_perguntas p
    join alunos.avaliacao_grupos g on g.id = p.grupo_id join alunos.avaliacao_modelos m on m.id = g.modelo_id
   where m.categoria = 'tutoria' and m.ativo;
select t.as_user('coord@test.local');
select t.ok('PARTIAL: with 1 of 2 tutors, Teoria/Prática = 8, Tutoria = 8.0 but flagged "avaliadores faltando 1 of 2"',
  (select teoria = 8 and pratica = 8 and tutoria = 8.0 and not completo
          and pendencias @> '[{"codigo":"tutoria_avaliadores_faltando","enviadas":1,"esperados":2,"faltando":1}]'
     from alunos.notas_aluno('a0000000-0000-0000-0000-00000000000b', '50000000-0000-0000-0000-000000000002')));
select t.ok('PARTIAL: a partial Final exists (8.0 from Tutoria alone) but is flagged, not definitive',
  (select final = 8.0 and not completo
     from alunos.notas_aluno('a0000000-0000-0000-0000-00000000000b', '50000000-0000-0000-0000-000000000002')));
reset role;

-- ---- question means (staff view): group means, evaluator counts, no identity
select t.as_user('coord@test.local');
select t.ok('question means: 8 Tutoria + 11 Mentoria rows',
  (select count(*) filter (where categoria = 'tutoria') = 8 and count(*) filter (where categoria = 'mentoria') = 11
     from alunos.perguntas_aluno('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002')));
select t.ok('question means: Tutoria Teoria q1 = 9 over 2 evaluators; Mentoria q1 = 10 over 1 evaluator (the "cannot answer" one is ignored)',
  (select max(media) filter (where categoria = 'tutoria' and grupo_codigo = 'teoria' and pergunta_ordem = 1) = 9
      and max(avaliadores) filter (where categoria = 'tutoria' and grupo_codigo = 'teoria' and pergunta_ordem = 1) = 2
      and max(media) filter (where categoria = 'mentoria' and grupo_codigo = 'encontro' and pergunta_ordem = 1) = 10
      and max(avaliadores) filter (where categoria = 'mentoria' and grupo_codigo = 'encontro' and pergunta_ordem = 1) = 1
     from alunos.perguntas_aluno('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002')));
select t.ok('question means expose no evaluator and no comment column',
  (select count(*) from information_schema.parameters
    where specific_schema = 'alunos' and specific_name like 'perguntas_aluno%' and parameter_mode = 'OUT'
      and (parameter_name like '%avaliador_equipe%' or parameter_name like '%email%' or parameter_name like '%coment%'
           or parameter_name like '%observ%' or parameter_name like '%desenvolv%')) = 0);
reset role;

-- ---- who may call what
select t.as_user('tutora@test.local');
select t.throws_code('a tutor cannot read the consolidated grades',
  $$select * from alunos.notas_aluno('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002')$$, '42501');
select t.throws_code('a tutor cannot read question means',
  $$select * from alunos.perguntas_aluno('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002')$$, '42501');
select t.throws_code('a tutor cannot list the semester',
  $$select * from alunos.notas_semestre('50000000-0000-0000-0000-000000000002')$$, '42501');
select t.throws_code('internal functions are not callable by API roles',
  $$select * from alunos._nota_semestre('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002')$$, '42501');
reset role;
select t.as_user('sec@test.local');
select t.throws_code('secretaria cannot read the consolidated grades',
  $$select * from alunos.notas_aluno('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002')$$, '42501');
reset role;
select t.as_user('fin@test.local');
select t.throws_code('financeiro cannot read the consolidated grades',
  $$select * from alunos.notas_aluno('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002')$$, '42501');
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select t.throws('anon cannot call the grade functions',
  $$select * from alunos.notas_aluno('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002')$$);
select t.throws('anon cannot call the student functions', $$select * from alunos.meu_desenvolvimento()$$);
select t.throws('anon cannot read the concept table', $$select * from alunos.conceitos$$);
reset role;

select t.as_user('adm@test.local');
select t.ok('admin lists the semester: Ana (complete) and Bia (partial)',
  (select count(*) = 2 and count(*) filter (where completo) = 1 and count(*) filter (where nome = 'Ana Teste' and final = 8.1) = 1
     from alunos.notas_semestre('50000000-0000-0000-0000-000000000002')));
reset role;

-- =================================================================== C. student view: own results, only after release
insert into alunos.avaliacao_janelas (semestre_id, categoria, abre_em, fecha_em)
  select '50000000-0000-0000-0000-000000000002', c.cat, now() - interval '30 days', now() - interval '20 days'
    from (values ('tutoria'), ('mentoria')) c (cat);

select t.as_user('ana@test.local');
select t.ok('BEFORE release: the student sees no result', (select count(*) from alunos.meu_desenvolvimento()) = 0);
select t.ok('BEFORE release: the student sees no question means',
  (select count(*) from alunos.meu_desenvolvimento_perguntas('50000000-0000-0000-0000-000000000002')) = 0);
select t.ok('BEFORE release: no cycle averages', (select semestres from alunos.minhas_medias_ciclo()) = 0);
reset role;

update alunos.avaliacao_janelas set liberada_em = now() + interval '1 day' where categoria = 'tutoria';
update alunos.avaliacao_janelas set liberada_em = now() - interval '1 minute' where categoria = 'mentoria';
select t.as_user('ana@test.local');
select t.ok('PARTIAL release (one window still in the future): still nothing', (select count(*) from alunos.meu_desenvolvimento()) = 0);
reset role;

update alunos.avaliacao_janelas set liberada_em = now() - interval '1 minute';
select t.as_user('ana@test.local');
select t.ok('AFTER release: the student sees her semester: Tutoria 8.8, Mentoria 7.3, Final 8.1, Bom, approved, complete',
  (select count(*) = 1 and bool_and(tutoria = 8.8 and mentoria = 7.3 and final = 8.1 and conceito = 'Bom' and aprovado and completo)
     from alunos.meu_desenvolvimento()));
select t.ok('AFTER release: the component grades are visible to her',
  (select teoria = 9 and pratica = 8.5 and atividades = 9.25 and projeto = 8.5 and presenca = 8.5 from alunos.meu_desenvolvimento()));
select t.ok('AFTER release: question means by group are visible (19 rows)',
  (select count(*) from alunos.meu_desenvolvimento_perguntas('50000000-0000-0000-0000-000000000002')) = 19);
select t.ok('the student result has no evaluator, comment or pending-list columns',
  (select count(*) from information_schema.parameters
    where specific_schema = 'alunos' and specific_name like 'meu_desenvolvimento%' and parameter_mode = 'OUT'
      and (parameter_name in ('avaliador_equipe_id', 'avaliador', 'equipe_id', 'usuario', 'usuario_email', 'pendencias',
                              'observacoes', 'desenvolvimento')
           or parameter_name like '%email%' or parameter_name like '%coment%' or parameter_name like '%observ%')) = 0);
select t.ok('she still reads no raw evaluation row, answer or comment',
  (select count(*) from alunos.avaliacoes) = 0 and (select count(*) from alunos.avaliacao_respostas) = 0
  and (select count(*) from alunos.avaliacao_comentarios) = 0);
reset role;

select t.as_user('bia@test.local');
select t.ok('another student sees only her own (Bia has no released complete data: her row exists but never Ana''s)',
  (select count(*) from alunos.meu_desenvolvimento() where final = 8.1) = 0);
reset role;
select t.as_user('bia@test.local');
select t.ok('Bia sees her own partial result flagged incomplete, not definitive',
  (select count(*) = 1 and bool_and(not completo) from alunos.meu_desenvolvimento()));
reset role;

select t.as_user('outsider@test.local');
select t.ok('a non-student sees nothing', (select count(*) from alunos.meu_desenvolvimento()) = 0);
reset role;

-- =================================================================== D. history and cycle averages
select set_config('request.jwt.claims', '', true);
-- Ana: 2025-2 Básico final 8.1 (above). Add 2025-1 Básico with final 8.0 and 2026-1 Avançado with final 9.0,
-- each from a single Mentoria evaluation (the only available piece), to test the cycle averages.
insert into alunos.semestres (id, codigo, inicio, fim) values
  ('50000000-0000-0000-0000-000000000001', '2025-1', null, null),
  ('50000000-0000-0000-0000-000000000003', '2026-1', null, null);
insert into alunos.matriculas (aluno_id, semestre_id, ciclo_id) values
  ('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001', (select id from alunos.ciclos where nome = 'Básico')),
  ('a0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000003', (select id from alunos.ciclos where nome = 'Avançado'));
select t.evaluate('f0000000-0000-0000-0000-0000000000b1', 'a0000000-0000-0000-0000-00000000000a',
  '50000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000a4', 'mentoria', array[4,4,4,4,4,4,4,4,4,4,4]);   -- 8.0
select t.evaluate('f0000000-0000-0000-0000-0000000000b2', 'a0000000-0000-0000-0000-00000000000a',
  '50000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-0000000000a4', 'mentoria', array[5,5,5,5,5,5,5,5,5,5,5]);   -- 10 -> 10.0
-- make 2026-1's final exactly 9.0: one Mentoria of 10 and an activity-free semester gives 10; use mixed answers: 5 and 4 -> 9.0
delete from alunos.avaliacao_respostas where avaliacao_id = 'f0000000-0000-0000-0000-0000000000b2';
insert into alunos.avaliacao_respostas (avaliacao_id, pergunta_id, valor)
  select 'f0000000-0000-0000-0000-0000000000b2', q.id, case when q.rn <= 5 then 5 else 4 end
    from (select p.id, row_number() over (order by g.ordem, p.ordem) as rn
            from alunos.avaliacao_perguntas p join alunos.avaliacao_grupos g on g.id = p.grupo_id
            join alunos.avaliacao_modelos m on m.id = g.modelo_id where m.categoria = 'mentoria' and m.ativo) q;
-- 5 questions at 10 and 6 at 8 = 98 / 11 = 8.909 -> 8.9

select t.as_user('coord@test.local');
select t.ok('history lists the three semesters in order, each with its cycle',
  (select string_agg(semestre || ':' || coalesce(ciclo, '-'), ',' order by semestre)
     from alunos.historico_aluno('a0000000-0000-0000-0000-00000000000a')) = '2025-1:Básico,2025-2:Básico,2026-1:Avançado');
select t.ok('semester finals: 2025-1 = 8.0, 2025-2 = 8.1, 2026-1 = 8.9',
  (select string_agg(final::text, ',' order by semestre) from alunos.historico_aluno('a0000000-0000-0000-0000-00000000000a')) = '8.0,8.1,8.9');
select t.ok('Média Básico = round(avg(8.0, 8.1), 1) = 8.1 (8.05 half up); Média Avançado = 8.9; Média final = round(avg(8.0, 8.1, 8.9), 1) = 8.3',
  (select media_basico = 8.1 and media_avancado = 8.9 and media_final = 8.3 and semestres = 3
     from alunos.medias_ciclo_aluno('a0000000-0000-0000-0000-00000000000a')));
select t.ok('semesters that are not complete are counted so the screen can warn',
  (select semestres_incompletos = 2 from alunos.medias_ciclo_aluno('a0000000-0000-0000-0000-00000000000a')));
reset role;

-- history for the student: only released semesters (2025-2 only: the other two have no window)
select t.as_user('ana@test.local');
select t.ok('the student history shows only released semesters', (select count(*) from alunos.meu_desenvolvimento()) = 1);
select t.ok('...and the cycle averages are computed only from them: Básico 8.1, Avançado null, final 8.1',
  (select media_basico = 8.1 and media_avancado is null and media_final = 8.1 and semestres = 1 from alunos.minhas_medias_ciclo()));
reset role;

-- =================================================================== E. configuration is editable and audited
select t.as_user('coord@test.local');
select t.ok('coordenacao can change the pass mark', t.affected($$update alunos.notas_config set aprovacao = 7.0$$) = 1);
select t.ok('...and the approval follows it (8.1 still passes, 6.5 no longer does)',
  alunos.aprovado_de(8.1) and not alunos.aprovado_de(6.5));
select t.ok('coordenacao can move a concept threshold', t.affected($$update alunos.conceitos set minimo = 5.5 where nome = 'Regular'$$) = 1);
select t.ok('...and the concept follows it (5.2 is now Insatisfatório)', alunos.conceito_de(5.2) = 'Insatisfatório');
reset role;
select t.as_user('tutora@test.local');
select t.ok('a tutor cannot change the configuration (0 rows)',
  t.affected($$update alunos.notas_config set aprovacao = 1$$) = 0 and t.affected($$update alunos.conceitos set minimo = 0.1 where nome = 'Bom'$$) = 0);
reset role;
select t.ok('configuration changes are audited',
  (select count(*) from alunos.auditoria where tabela in ('notas_config', 'conceitos') and operacao = 'UPDATE'
      and usuario_email = 'coord@test.local') = 2);

\echo
select case when passed then 'PASS' else 'FAIL' end as result, name from t.results order by passed, name;
select count(*) filter (where passed) as passed, count(*) filter (where not passed) as failed from t.results;
rollback;
