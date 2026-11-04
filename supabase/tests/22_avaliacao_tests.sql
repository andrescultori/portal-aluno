-- Migration 11 tests: question bank, evaluations, windows, comments, visibility. FAKE DATA ONLY.
begin;
\ir 05_harness.sql

create function t.fill(p_av uuid, p_valor smallint default 5) returns int language plpgsql as $$
declare n int;
begin
  insert into alunos.avaliacao_respostas (avaliacao_id, pergunta_id, valor)
  select p_av, p.id, p_valor
    from alunos.avaliacoes a
    join alunos.avaliacao_grupos g on g.modelo_id = a.modelo_id
    join alunos.avaliacao_perguntas p on p.grupo_id = g.id
   where a.id = p_av
  on conflict (avaliacao_id, pergunta_id) do update set valor = excluded.valor;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function t.fill(uuid, smallint) to public;

-- ------------------------------------------------------------------ fixtures (postgres)
insert into auth.users (email) values
  ('ana@test.local'), ('bia@test.local'), ('tutora@test.local'), ('tutorb@test.local'), ('lider@test.local'),
  ('mentorm@test.local'), ('sec@test.local'), ('fin@test.local'), ('coord@test.local'), ('adm@test.local'),
  ('emissor@test.local'), ('outsider@test.local');
insert into public.staff_roles (email, role) values
  ('tutora@test.local', 'tutor'), ('tutorb@test.local', 'tutor'), ('lider@test.local', 'lider_casa'),
  ('mentorm@test.local', 'mentor'), ('sec@test.local', 'secretaria'), ('fin@test.local', 'financeiro'),
  ('coord@test.local', 'coordenacao'), ('adm@test.local', 'admin'), ('emissor@test.local', 'emissor');

insert into alunos.semestres (codigo, atual) values ('2026-2', true);
insert into alunos.alunos (id, nome, email, casa_id) values
  ('a0000000-0000-0000-0000-00000000000a', 'Ana Teste', 'ana@test.local', null),
  ('a0000000-0000-0000-0000-00000000000b', 'Bia Teste', 'bia@test.local',
     (select id from alunos.casas where nome = 'Casa Amarela'));
insert into alunos.equipe (id, nome, email) values
  ('e0000000-0000-0000-0000-0000000000a1', 'Tutora', 'tutora@test.local'),
  ('e0000000-0000-0000-0000-0000000000a2', 'Tutor B', 'tutorb@test.local'),
  ('e0000000-0000-0000-0000-0000000000a3', 'Lider', 'lider@test.local'),
  ('e0000000-0000-0000-0000-0000000000a4', 'Mentor M', 'mentorm@test.local'),
  ('e0000000-0000-0000-0000-0000000000a5', 'Coord', 'coord@test.local');
insert into alunos.equipe_casas (equipe_id, casa_id)
  select 'e0000000-0000-0000-0000-0000000000a3', id from alunos.casas where nome = 'Casa Amarela';
insert into alunos.aluno_tutores (aluno_id, semestre_id, equipe_id, categoria)
  select v.aluno, s.id, v.equipe, v.cat
    from alunos.semestres s,
         (values ('a0000000-0000-0000-0000-00000000000a'::uuid, 'e0000000-0000-0000-0000-0000000000a1'::uuid, 'tutoria'),
                 ('a0000000-0000-0000-0000-00000000000b'::uuid, 'e0000000-0000-0000-0000-0000000000a2'::uuid, 'tutoria'),
                 ('a0000000-0000-0000-0000-00000000000a'::uuid, 'e0000000-0000-0000-0000-0000000000a4'::uuid, 'mentoria')
         ) as v (aluno, equipe, cat)
   where s.codigo = '2026-2';
insert into alunos.avaliacao_janelas (semestre_id, categoria, abre_em, fecha_em)
  select s.id, c.cat, now() - interval '1 day', now() + interval '1 day'
    from alunos.semestres s, (values ('tutoria'), ('mentoria')) as c (cat)
   where s.codigo = '2026-2';

-- ------------------------------------------------------------------ seeds
select t.ok('Tutoria v1 is active with 2 groups and 8 questions',
  (select count(*) from alunos.avaliacao_modelos where categoria = 'tutoria' and versao = 1 and ativo) = 1
  and (select count(*) from alunos.avaliacao_grupos g join alunos.avaliacao_modelos m on m.id = g.modelo_id
        where m.categoria = 'tutoria' and m.versao = 1) = 2
  and (select count(*) from alunos.avaliacao_perguntas p join alunos.avaliacao_grupos g on g.id = p.grupo_id
         join alunos.avaliacao_modelos m on m.id = g.modelo_id where m.categoria = 'tutoria' and m.versao = 1) = 8);
select t.ok('Mentoria v1 is active with 4 groups and 11 questions',
  (select count(*) from alunos.avaliacao_modelos where categoria = 'mentoria' and versao = 1 and ativo) = 1
  and (select count(*) from alunos.avaliacao_grupos g join alunos.avaliacao_modelos m on m.id = g.modelo_id
        where m.categoria = 'mentoria' and m.versao = 1) = 4
  and (select count(*) from alunos.avaliacao_perguntas p join alunos.avaliacao_grupos g on g.id = p.grupo_id
         join alunos.avaliacao_modelos m on m.id = g.modelo_id where m.categoria = 'mentoria' and m.versao = 1) = 11);
select t.ok('Tutoria groups are Teoria x4 and Prática x4',
  (select string_agg(g.codigo || ':' || (select count(*) from alunos.avaliacao_perguntas p where p.grupo_id = g.id), ',' order by g.ordem)
     from alunos.avaliacao_grupos g join alunos.avaliacao_modelos m on m.id = g.modelo_id
    where m.categoria = 'tutoria' and m.versao = 1) = 'teoria:4,pratica:4');
select t.ok('Mentoria groups are 2/3/2/4',
  (select string_agg(g.codigo || ':' || (select count(*) from alunos.avaliacao_perguntas p where p.grupo_id = g.id), ',' order by g.ordem)
     from alunos.avaliacao_grupos g join alunos.avaliacao_modelos m on m.id = g.modelo_id
    where m.categoria = 'mentoria' and m.versao = 1) = 'encontro:2,autocuidado:3,praticas_espirituais:2,vida_comunidade:4');
select t.ok('free-text prompts are part of the versioned model',
  (select rotulo_observacoes = 'Sobre as alternativas acima, alguma observação?'
      and ajuda_observacoes like 'Caso você não tenha marcado Excelente ou Bom%'
      and rotulo_desenvolvimento like 'Como você acredita que foi o desenvolvimento%'
     from alunos.avaliacao_modelos where categoria = 'tutoria' and versao = 1));
select t.ok('scale has the 5 labels',
  (select string_agg(rotulo, '|' order by valor) from alunos.avaliacao_escala)
    = 'Não posso/não sei responder|Insatisfatório|Regular|Bom|Excelente');
select t.ok('points: 1 excluded, 2->4, 3->6, 4->8, 5->10',
  alunos.pontos(1::smallint) is null and alunos.pontos(2::smallint) = 4 and alunos.pontos(3::smallint) = 6
  and alunos.pontos(4::smallint) = 8 and alunos.pontos(5::smallint) = 10);
select t.ok('two active models of one category are impossible', (
  select count(*) from pg_indexes where indexname = 'avaliacao_modelos_ativo_uq') = 1);

-- composite FK, checked as the table owner (no RLS in the way)
select t.throws_code('a Mentoria model cannot be attached to a Tutoria evaluation (composite FK)', $$
  insert into alunos.avaliacoes (semestre_id, aluno_id, avaliador_equipe_id, modelo_id, categoria)
  select s.id, 'a0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-0000000000a4', m.id, 'tutoria'
    from alunos.semestres s, alunos.avaliacao_modelos m
   where s.codigo = '2026-2' and m.categoria = 'mentoria' and m.versao = 1$$, '23503');

-- ------------------------------------------------------------------ evaluator: tutora (assigned to Ana, tutoria)
select t.as_user('tutora@test.local');
select t.ok('tutora list: Ana tutoria, not started, 0 of 8',
  (select count(*) from alunos.meus_alunos_avaliar((select id from alunos.semestres where codigo = '2026-2'))) = 1
  and (select situacao = 'nao_iniciada' and respondidas = 0 and total = 8 and categoria = 'tutoria' and janela_aberta
         from alunos.meus_alunos_avaliar((select id from alunos.semestres where codigo = '2026-2'))));
select t.ok('tutora creates the evaluation for Ana', t.affected($$
  insert into alunos.avaliacoes (id, semestre_id, aluno_id, avaliador_equipe_id, modelo_id, categoria)
  select 'f0000000-0000-0000-0000-000000000001', s.id, 'a0000000-0000-0000-0000-00000000000a',
         'e0000000-0000-0000-0000-0000000000a1', m.id, 'tutoria'
    from alunos.semestres s, alunos.avaliacao_modelos m
   where s.codigo = '2026-2' and m.categoria = 'tutoria' and m.versao = 1$$) = 1);
select t.throws_code('tutora cannot evaluate a student she is not assigned to', $$
  insert into alunos.avaliacoes (semestre_id, aluno_id, avaliador_equipe_id, modelo_id, categoria)
  select s.id, 'a0000000-0000-0000-0000-00000000000b', 'e0000000-0000-0000-0000-0000000000a1', m.id, 'tutoria'
    from alunos.semestres s, alunos.avaliacao_modelos m
   where s.codigo = '2026-2' and m.categoria = 'tutoria' and m.versao = 1$$, '42501');
select t.throws_code('tutora cannot create an evaluation as another evaluator', $$
  insert into alunos.avaliacoes (semestre_id, aluno_id, avaliador_equipe_id, modelo_id, categoria)
  select s.id, 'a0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-0000000000a2', m.id, 'tutoria'
    from alunos.semestres s, alunos.avaliacao_modelos m
   where s.codigo = '2026-2' and m.categoria = 'tutoria' and m.versao = 1$$, '42501');
select t.throws_code('tutora cannot evaluate Mentoria without a mentoria assignment', $$
  insert into alunos.avaliacoes (semestre_id, aluno_id, avaliador_equipe_id, modelo_id, categoria)
  select s.id, 'a0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-0000000000a1', m.id, 'mentoria'
    from alunos.semestres s, alunos.avaliacao_modelos m
   where s.codigo = '2026-2' and m.categoria = 'mentoria' and m.versao = 1$$, '42501');
select t.throws_code('second evaluation of the same student/category by the same evaluator is rejected', $$
  insert into alunos.avaliacoes (semestre_id, aluno_id, avaliador_equipe_id, modelo_id, categoria)
  select s.id, 'a0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-0000000000a1', m.id, 'tutoria'
    from alunos.semestres s, alunos.avaliacao_modelos m
   where s.codigo = '2026-2' and m.categoria = 'tutoria' and m.versao = 1$$, '23505');
select t.throws_code('evaluator cannot create an already-submitted evaluation', $$
  insert into alunos.avaliacoes (semestre_id, aluno_id, avaliador_equipe_id, modelo_id, categoria, status)
  select s.id, 'a0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-0000000000a1', m.id, 'tutoria', 'enviada'
    from alunos.semestres s, alunos.avaliacao_modelos m
   where s.codigo = '2026-2' and m.categoria = 'tutoria' and m.versao = 1$$, '42501');
select t.throws_code('evaluator cannot flip status to enviada directly',
  $$update alunos.avaliacoes set status = 'enviada' where id = 'f0000000-0000-0000-0000-000000000001'$$, '42501');
select t.throws_code('evaluator cannot move an evaluation to another student',
  $$update alunos.avaliacoes set aluno_id = 'a0000000-0000-0000-0000-00000000000b' where id = 'f0000000-0000-0000-0000-000000000001'$$, '42501');

-- answers, validation
select t.ok('tutora saves 8 draft answers', t.fill('f0000000-0000-0000-0000-000000000001') = 8);
select t.ok('draft progress is reported (8 of 8)',
  (select respondidas = 8 and total = 8 and situacao = 'rascunho'
     from alunos.meus_alunos_avaliar((select id from alunos.semestres where codigo = '2026-2'))));
select t.ok('tutora removes one answer (draft)',
  t.affected($$delete from alunos.avaliacao_respostas where avaliacao_id = 'f0000000-0000-0000-0000-000000000001'
                and pergunta_id = (select min(id) from alunos.avaliacao_perguntas)$$) = 1);
select t.throws_code('submit with a missing answer is rejected',
  $$select alunos.enviar_avaliacao('f0000000-0000-0000-0000-000000000001')$$, '22023');
select t.ok('tutora answers again; one answer is Regular (3)', t.fill('f0000000-0000-0000-0000-000000000001') = 8
  and t.affected($$update alunos.avaliacao_respostas set valor = 3
                    where avaliacao_id = 'f0000000-0000-0000-0000-000000000001'
                      and pergunta_id = (select min(id) from alunos.avaliacao_perguntas)$$) = 1);
select t.throws_code('submit with an answer below Bom and no observation is rejected',
  $$select alunos.enviar_avaliacao('f0000000-0000-0000-0000-000000000001')$$, '22023');
select t.ok('tutora writes a blank observation', t.affected($$
  insert into alunos.avaliacao_comentarios (avaliacao_id, observacoes, desenvolvimento)
  values ('f0000000-0000-0000-0000-000000000001', '   ', 'dev-tutora-ana')$$) = 1);
select t.throws_code('a blank observation does not count',
  $$select alunos.enviar_avaliacao('f0000000-0000-0000-0000-000000000001')$$, '22023');
select t.ok('tutora writes the observation', t.affected($$
  update alunos.avaliacao_comentarios set observacoes = 'needs to improve punctuality'
   where avaliacao_id = 'f0000000-0000-0000-0000-000000000001'$$) = 1);
select t.runs('submission succeeds', $$select alunos.enviar_avaliacao('f0000000-0000-0000-0000-000000000001')$$);
select t.ok('status is enviada with a timestamp',
  (select status = 'enviada' and enviada_em is not null from alunos.avaliacoes where id = 'f0000000-0000-0000-0000-000000000001'));
select t.ok('list shows the evaluation as enviada',
  (select situacao = 'enviada' from alunos.meus_alunos_avaliar((select id from alunos.semestres where codigo = '2026-2'))));
select t.ok('editing an answer after submit changes nothing (0 rows)',
  t.affected($$update alunos.avaliacao_respostas set valor = 5 where avaliacao_id = 'f0000000-0000-0000-0000-000000000001'$$) = 0);
select t.ok('editing the comment after submit changes nothing (0 rows)',
  t.affected($$update alunos.avaliacao_comentarios set observacoes = 'changed' where avaliacao_id = 'f0000000-0000-0000-0000-000000000001'$$) = 0);
select t.ok('deleting an answer after submit changes nothing (0 rows)',
  t.affected($$delete from alunos.avaliacao_respostas where avaliacao_id = 'f0000000-0000-0000-0000-000000000001'$$) = 0);
select t.throws_code('adding an answer to a submitted evaluation is rejected', $$
  insert into alunos.avaliacao_respostas (avaliacao_id, pergunta_id, valor)
  values ('f0000000-0000-0000-0000-000000000001', (select max(id) from alunos.avaliacao_perguntas), 5)$$, '42501');
select t.ok('the submitted answers and comment are intact',
  (select count(*) from alunos.avaliacao_respostas where avaliacao_id = 'f0000000-0000-0000-0000-000000000001' and valor = 5) = 7
  and (select observacoes from alunos.avaliacao_comentarios where avaliacao_id = 'f0000000-0000-0000-0000-000000000001') = 'needs to improve punctuality');
select t.ok('evaluator cannot reopen her submitted evaluation (0 rows)',
  t.affected($$update alunos.avaliacoes set status = 'rascunho' where id = 'f0000000-0000-0000-0000-000000000001'$$) = 0);
select t.throws_code('submitting twice is rejected',
  $$select alunos.enviar_avaliacao('f0000000-0000-0000-0000-000000000001')$$, '55000');
select t.ok('tutora cannot delete evaluations (0 rows)',
  t.affected($$delete from alunos.avaliacoes where id = 'f0000000-0000-0000-0000-000000000001'$$) = 0);
reset role;

-- ------------------------------------------------------------------ tutorb (assigned to Bia)
select t.as_user('tutorb@test.local');
select t.ok('tutorb creates the evaluation for Bia', t.affected($$
  insert into alunos.avaliacoes (id, semestre_id, aluno_id, avaliador_equipe_id, modelo_id, categoria)
  select 'f0000000-0000-0000-0000-000000000002', s.id, 'a0000000-0000-0000-0000-00000000000b',
         'e0000000-0000-0000-0000-0000000000a2', m.id, 'tutoria'
    from alunos.semestres s, alunos.avaliacao_modelos m
   where s.codigo = '2026-2' and m.categoria = 'tutoria' and m.versao = 1$$) = 1);
select t.ok('tutorb answers (all Bom)', t.fill('f0000000-0000-0000-0000-000000000002', 4::smallint) = 8);
select t.ok('tutorb writes a private development text', t.affected($$
  insert into alunos.avaliacao_comentarios (avaliacao_id, desenvolvimento)
  values ('f0000000-0000-0000-0000-000000000002', 'dev-tutorb-bia')$$) = 1);
select t.runs('all-Bom evaluation needs no observation', $$select alunos.enviar_avaliacao('f0000000-0000-0000-0000-000000000002')$$);
select t.ok('tutorb sees only his own evaluation', (select count(*) from alunos.avaliacoes) = 1);
select t.ok('tutorb cannot read the other tutor''s answers',
  (select count(*) from alunos.avaliacao_respostas where avaliacao_id = 'f0000000-0000-0000-0000-000000000001') = 0);
select t.ok('tutorb cannot read the other tutor''s comments',
  (select count(*) from alunos.avaliacao_comentarios where avaliacao_id = 'f0000000-0000-0000-0000-000000000001') = 0);
select t.ok('tutorb sees only his own answers and comments',
  (select count(*) from alunos.avaliacao_respostas) = 8 and (select count(*) from alunos.avaliacao_comentarios) = 1);
select t.throws('tutorb cannot submit the other tutor''s evaluation',
  $$select alunos.enviar_avaliacao('f0000000-0000-0000-0000-000000000001')$$);
select t.ok('tutorb cannot edit the other tutor''s comment (0 rows)',
  t.affected($$update alunos.avaliacao_comentarios set observacoes = 'x' where avaliacao_id = 'f0000000-0000-0000-0000-000000000001'$$) = 0);
reset role;

select t.as_user('tutora@test.local');
select t.ok('tutora sees only her own evaluation, answers and comment',
  (select count(*) from alunos.avaliacoes) = 1 and (select count(*) from alunos.avaliacao_respostas) = 8
  and (select count(*) from alunos.avaliacao_comentarios) = 1);
select t.ok('tutora cannot read tutorb''s comment text',
  (select count(*) from alunos.avaliacao_comentarios where desenvolvimento = 'dev-tutorb-bia') = 0);
reset role;

-- ------------------------------------------------------------------ house leader (Casa Amarela = Bia)
select t.as_user('lider@test.local');
select t.ok('leader list: only Bia, Mentoria',
  (select count(*) from alunos.meus_alunos_avaliar((select id from alunos.semestres where codigo = '2026-2'))) = 1
  and (select categoria = 'mentoria' and total = 11 and nome = 'Bia Teste'
         from alunos.meus_alunos_avaliar((select id from alunos.semestres where codigo = '2026-2'))));
select t.ok('leader creates Bia Mentoria (derived from the house)', t.affected($$
  insert into alunos.avaliacoes (id, semestre_id, aluno_id, avaliador_equipe_id, modelo_id, categoria)
  select 'f0000000-0000-0000-0000-000000000003', s.id, 'a0000000-0000-0000-0000-00000000000b',
         'e0000000-0000-0000-0000-0000000000a3', m.id, 'mentoria'
    from alunos.semestres s, alunos.avaliacao_modelos m
   where s.codigo = '2026-2' and m.categoria = 'mentoria' and m.versao = 1$$) = 1);
select t.throws_code('leader cannot evaluate a student from another house', $$
  insert into alunos.avaliacoes (semestre_id, aluno_id, avaliador_equipe_id, modelo_id, categoria)
  select s.id, 'a0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-0000000000a3', m.id, 'mentoria'
    from alunos.semestres s, alunos.avaliacao_modelos m
   where s.codigo = '2026-2' and m.categoria = 'mentoria' and m.versao = 1$$, '42501');
select t.throws_code('leader has no Tutoria rights over his house student', $$
  insert into alunos.avaliacoes (semestre_id, aluno_id, avaliador_equipe_id, modelo_id, categoria)
  select s.id, 'a0000000-0000-0000-0000-00000000000b', 'e0000000-0000-0000-0000-0000000000a3', m.id, 'tutoria'
    from alunos.semestres s, alunos.avaliacao_modelos m
   where s.codigo = '2026-2' and m.categoria = 'tutoria' and m.versao = 1$$, '42501');
select t.ok('leader answers "cannot answer" (1) everywhere', t.fill('f0000000-0000-0000-0000-000000000003', 1::smallint) = 11);
select t.throws_code('"cannot answer" counts as below Bom and needs the observation',
  $$select alunos.enviar_avaliacao('f0000000-0000-0000-0000-000000000003')$$, '22023');
select t.ok('leader switches to Excelente', t.fill('f0000000-0000-0000-0000-000000000003', 5::smallint) = 11);
select t.runs('leader submits', $$select alunos.enviar_avaliacao('f0000000-0000-0000-0000-000000000003')$$);
select t.throws_code('an answer from the Tutoria model is rejected inside a Mentoria evaluation', $$
  insert into alunos.avaliacao_respostas (avaliacao_id, pergunta_id, valor)
  values ('f0000000-0000-0000-0000-000000000003',
          (select p.id from alunos.avaliacao_perguntas p join alunos.avaliacao_grupos g on g.id = p.grupo_id
             join alunos.avaliacao_modelos m on m.id = g.modelo_id where m.categoria = 'tutoria' and m.versao = 1 limit 1), 5)$$, '42501');
reset role;

-- ------------------------------------------------------------------ explicit mentor (Ana Mentoria), window closes
select t.as_user('mentorm@test.local');
select t.ok('mentor list: Ana Mentoria not started',
  (select count(*) = 1 and bool_and(situacao = 'nao_iniciada') from alunos.meus_alunos_avaliar((select id from alunos.semestres where codigo = '2026-2'))));
select t.ok('mentor creates Ana Mentoria', t.affected($$
  insert into alunos.avaliacoes (id, semestre_id, aluno_id, avaliador_equipe_id, modelo_id, categoria)
  select 'f0000000-0000-0000-0000-000000000004', s.id, 'a0000000-0000-0000-0000-00000000000a',
         'e0000000-0000-0000-0000-0000000000a4', m.id, 'mentoria'
    from alunos.semestres s, alunos.avaliacao_modelos m
   where s.codigo = '2026-2' and m.categoria = 'mentoria' and m.versao = 1$$) = 1);
select t.ok('mentor answers all 11', t.fill('f0000000-0000-0000-0000-000000000004') = 11);
reset role;

-- the Mentoria window closes
update alunos.avaliacao_janelas set abre_em = now() - interval '3 days', fecha_em = now() - interval '1 hour'
 where categoria = 'mentoria';

select t.as_user('mentorm@test.local');
select t.ok('list reports the window as closed', (select not janela_aberta from alunos.meus_alunos_avaliar((select id from alunos.semestres where codigo = '2026-2'))));
select t.ok('editing answers after the window closes changes nothing (0 rows)',
  t.affected($$update alunos.avaliacao_respostas set valor = 1 where avaliacao_id = 'f0000000-0000-0000-0000-000000000004'$$) = 0);
select t.throws_code('submitting after the window closes is rejected',
  $$select alunos.enviar_avaliacao('f0000000-0000-0000-0000-000000000004')$$, '55000');
select t.ok('no draft edits on the evaluation row (0 rows)',
  t.affected($$update alunos.avaliacoes set atualizado_em = now() where id = 'f0000000-0000-0000-0000-000000000004'$$) = 0);
reset role;

-- ------------------------------------------------------------------ outsiders see nothing
select t.as_user('ana@test.local');
select t.ok('student reads no evaluation', (select count(*) from alunos.avaliacoes) = 0);
select t.ok('student reads no answer', (select count(*) from alunos.avaliacao_respostas) = 0);
select t.ok('student reads no comment', (select count(*) from alunos.avaliacao_comentarios) = 0);
select t.ok('student reads no windows', (select count(*) from alunos.avaliacao_janelas) = 0);
select t.ok('student can read the question wording', (select count(*) from alunos.avaliacao_perguntas) = 19);
select t.ok('student has no students to evaluate',
  (select count(*) from alunos.meus_alunos_avaliar((select id from alunos.semestres where codigo = '2026-2'))) = 0);
select t.throws('student cannot create an evaluation', $$
  insert into alunos.avaliacoes (semestre_id, aluno_id, avaliador_equipe_id, modelo_id, categoria)
  select s.id, 'a0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-0000000000a1', m.id, 'tutoria'
    from alunos.semestres s, alunos.avaliacao_modelos m
   where s.codigo = '2026-2' and m.categoria = 'tutoria' and m.versao = 1$$);
select t.ok('student cannot change the question bank (0 rows)',
  t.affected($$update alunos.avaliacao_perguntas set texto = 'x'$$) = 0);
reset role;

select t.as_user('sec@test.local');
select t.ok('secretaria reads no evaluation, answer or comment',
  (select count(*) from alunos.avaliacoes) = 0 and (select count(*) from alunos.avaliacao_respostas) = 0
  and (select count(*) from alunos.avaliacao_comentarios) = 0);
select t.throws('secretaria cannot write comments', $$
  insert into alunos.avaliacao_comentarios (avaliacao_id, observacoes) values ('f0000000-0000-0000-0000-000000000001', 'x')$$);
select t.ok('secretaria can see the windows but not change them',
  (select count(*) from alunos.avaliacao_janelas) = 2 and t.affected($$update alunos.avaliacao_janelas set liberada_em = now()$$) = 0);
reset role;

select t.as_user('fin@test.local');
select t.ok('financeiro reads no evaluation, answer or comment',
  (select count(*) from alunos.avaliacoes) = 0 and (select count(*) from alunos.avaliacao_respostas) = 0
  and (select count(*) from alunos.avaliacao_comentarios) = 0);
reset role;

select t.as_user('emissor@test.local');
select t.ok('emissor-only reads nothing (evaluations, answers, comments, windows)',
  (select count(*) from alunos.avaliacoes) = 0 and (select count(*) from alunos.avaliacao_respostas) = 0
  and (select count(*) from alunos.avaliacao_comentarios) = 0 and (select count(*) from alunos.avaliacao_janelas) = 0);
select t.ok('emissor-only has nobody to evaluate',
  (select count(*) from alunos.meus_alunos_avaliar((select id from alunos.semestres where codigo = '2026-2'))) = 0);
reset role;

select t.as_user('outsider@test.local');
select t.ok('logged-in outsider reads nothing',
  (select count(*) from alunos.avaliacoes) = 0 and (select count(*) from alunos.avaliacao_comentarios) = 0);
reset role;

select set_config('request.jwt.claims', '', true);
set local role anon;
select t.throws('anon cannot read evaluations', $$select count(*) from alunos.avaliacoes$$);
select t.throws('anon cannot read comments', $$select count(*) from alunos.avaliacao_comentarios$$);
select t.throws('anon cannot read answers', $$select count(*) from alunos.avaliacao_respostas$$);
select t.throws('anon cannot read the question bank', $$select count(*) from alunos.avaliacao_perguntas$$);
select t.throws('anon cannot call enviar_avaliacao', $$select alunos.enviar_avaliacao('f0000000-0000-0000-0000-000000000001')$$);
reset role;

-- ------------------------------------------------------------------ coordenacao
select t.as_user('coord@test.local');
select t.ok('coordenacao reads all 4 evaluations', (select count(*) from alunos.avaliacoes) = 4);
select t.ok('coordenacao reads every comment',
  (select count(*) from alunos.avaliacao_comentarios where desenvolvimento in ('dev-tutora-ana', 'dev-tutorb-bia')) = 2);
select t.ok('coordenacao reads every answer', (select count(*) from alunos.avaliacao_respostas) = 8 + 8 + 11 + 11);
select t.ok('coordenacao edits an answer AFTER submit', t.affected($$
  update alunos.avaliacao_respostas set valor = 4
   where avaliacao_id = 'f0000000-0000-0000-0000-000000000001'
     and pergunta_id = (select min(id) from alunos.avaliacao_perguntas)$$) = 1);
select t.ok('coordenacao edits a comment AFTER submit', t.affected($$
  update alunos.avaliacao_comentarios set observacoes = 'revised by coordination'
   where avaliacao_id = 'f0000000-0000-0000-0000-000000000001'$$) = 1);
select t.runs('coordenacao submits on behalf of the mentor after the window closed (override)',
  $$select alunos.enviar_avaliacao('f0000000-0000-0000-0000-000000000004')$$);
select t.ok('...and the evaluation is enviada',
  (select status from alunos.avaliacoes where id = 'f0000000-0000-0000-0000-000000000004') = 'enviada');
select t.throws_code('coordenacao still cannot submit an incomplete evaluation', $$
  select alunos.enviar_avaliacao((select id from alunos.avaliacoes where false))$$, 'P0002');
select t.ok('coordenacao reopens a submitted evaluation', t.affected($$
  update alunos.avaliacoes set status = 'rascunho' where id = 'f0000000-0000-0000-0000-000000000001'$$) = 1);
select t.ok('reopening clears the submission time',
  (select enviada_em is null from alunos.avaliacoes where id = 'f0000000-0000-0000-0000-000000000001'));
select t.throws_code('coordenacao cannot flip to enviada without validation', $$
  update alunos.avaliacoes set status = 'enviada' where id = 'f0000000-0000-0000-0000-000000000001'$$, '42501');
select t.ok('coordenacao writes windows', t.affected($$update alunos.avaliacao_janelas set liberada_em = now() - interval '1 minute' where categoria = 'tutoria'$$) = 1);
reset role;

select t.as_user('tutora@test.local');
select t.ok('tutora can edit again after the coordination reopened it (window still open)',
  t.affected($$update alunos.avaliacao_respostas set valor = 5 where avaliacao_id = 'f0000000-0000-0000-0000-000000000001'$$) = 8);
select t.runs('tutora re-submits', $$select alunos.enviar_avaliacao('f0000000-0000-0000-0000-000000000001')$$);
reset role;

-- release: only when EVERY window of the semester is released
select t.ok('semester not released while only one window is', not alunos.semestre_liberado((select id from alunos.semestres where codigo = '2026-2')));
update alunos.avaliacao_janelas set liberada_em = now() - interval '1 minute' where categoria = 'mentoria';
select t.ok('semester released when all windows are', alunos.semestre_liberado((select id from alunos.semestres where codigo = '2026-2')));
update alunos.avaliacao_janelas set liberada_em = now() + interval '1 day' where categoria = 'mentoria';
select t.ok('a future release date is not released', not alunos.semestre_liberado((select id from alunos.semestres where codigo = '2026-2')));
update alunos.avaliacao_janelas set liberada_em = null;
select t.ok('no release date is not released', not alunos.semestre_liberado((select id from alunos.semestres where codigo = '2026-2')));

-- released results do NOT open the raw rows to the student
update alunos.avaliacao_janelas set liberada_em = now() - interval '1 minute';
select t.as_user('ana@test.local');
select t.ok('after release the student still reads no raw evaluation row', (select count(*) from alunos.avaliacoes) = 0);
select t.ok('after release the student still reads no comment', (select count(*) from alunos.avaliacao_comentarios) = 0);
select t.ok('after release the student still reads no answer', (select count(*) from alunos.avaliacao_respostas) = 0);
reset role;

-- ------------------------------------------------------------------ admin: cascade delete, bank versioning
select t.as_user('coord@test.local');
select t.ok('coordenacao evaluates on behalf (Coord team member, Ana Tutoria)', t.affected($$
  insert into alunos.avaliacoes (id, semestre_id, aluno_id, avaliador_equipe_id, modelo_id, categoria)
  select 'f0000000-0000-0000-0000-000000000005', s.id, 'a0000000-0000-0000-0000-00000000000a',
         'e0000000-0000-0000-0000-0000000000a5', m.id, 'tutoria'
    from alunos.semestres s, alunos.avaliacao_modelos m
   where s.codigo = '2026-2' and m.categoria = 'tutoria' and m.versao = 1$$) = 1);
select t.ok('...with answers and a comment', t.fill('f0000000-0000-0000-0000-000000000005') = 8
  and t.affected($$insert into alunos.avaliacao_comentarios (avaliacao_id, observacoes) values ('f0000000-0000-0000-0000-000000000005', 'x')$$) = 1);
reset role;

select t.as_user('adm@test.local');
select t.ok('admin deletes an evaluation', t.affected($$
  delete from alunos.avaliacoes where id = 'f0000000-0000-0000-0000-000000000005'$$) = 1);
select t.ok('...its answers and comment cascade',
  (select count(*) from alunos.avaliacao_respostas where avaliacao_id = 'f0000000-0000-0000-0000-000000000005') = 0
  and (select count(*) from alunos.avaliacao_comentarios where avaliacao_id = 'f0000000-0000-0000-0000-000000000005') = 0);
reset role;

-- question bank: a used model is frozen, new versions are the way
select t.as_user('coord@test.local');
select t.throws_code('wording of a model with evaluations cannot be edited',
  $$update alunos.avaliacao_perguntas set texto = 'changed' where id = (select min(id) from alunos.avaliacao_perguntas)$$, '55006');
select t.throws_code('questions cannot be added to a model with evaluations', $$
  insert into alunos.avaliacao_perguntas (grupo_id, ordem, texto)
  select g.id, 99, 'extra' from alunos.avaliacao_grupos g join alunos.avaliacao_modelos m on m.id = g.modelo_id
   where m.categoria = 'tutoria' and m.versao = 1 limit 1$$, '55006');
select t.throws_code('questions cannot be deleted from a model with evaluations',
  $$delete from alunos.avaliacao_perguntas where id = (select min(id) from alunos.avaliacao_perguntas)$$, '55006');
select t.throws_code('groups cannot be renamed on a model with evaluations',
  $$update alunos.avaliacao_grupos set nome = 'x' where codigo = 'teoria'$$, '55006');
select t.throws_code('a model with evaluations cannot be deleted',
  $$delete from alunos.avaliacao_modelos where categoria = 'tutoria' and versao = 1$$, '55006');
select t.throws_code('the observation prompt of a used model cannot be rewritten',
  $$update alunos.avaliacao_modelos set rotulo_observacoes = 'x' where categoria = 'tutoria' and versao = 1$$, '55006');
create temp table t_novo as select alunos.nova_versao_modelo('tutoria') as id;
select t.ok('new version clones groups and questions, inactive',
  (select versao = 2 and not ativo from alunos.avaliacao_modelos where id = (select id from t_novo))
  and (select count(*) from alunos.avaliacao_grupos where modelo_id = (select id from t_novo)) = 2
  and (select count(*) from alunos.avaliacao_perguntas p join alunos.avaliacao_grupos g on g.id = p.grupo_id
        where g.modelo_id = (select id from t_novo)) = 8);
select t.ok('the new version can be edited (no evaluations yet)', t.affected($$
  update alunos.avaliacao_perguntas set texto = 'v2 wording'
   where id = (select min(p.id) from alunos.avaliacao_perguntas p join alunos.avaliacao_grupos g on g.id = p.grupo_id
                where g.modelo_id = (select id from t_novo))$$) = 1);
select t.throws('two active models of the same category are rejected',
  $$update alunos.avaliacao_modelos set ativo = true where id = (select id from t_novo)$$);
select alunos.ativar_modelo((select id from t_novo));
select t.ok('activating v2 deactivates v1',
  (select ativo from alunos.avaliacao_modelos where id = (select id from t_novo))
  and not (select ativo from alunos.avaliacao_modelos where categoria = 'tutoria' and versao = 1));
select t.ok('old evaluations keep pointing to v1',
  (select m.versao = 1 from alunos.avaliacoes a join alunos.avaliacao_modelos m on m.id = a.modelo_id
    where a.id = 'f0000000-0000-0000-0000-000000000001'));
select t.throws_code('an answer from another model version is rejected', $$
  insert into alunos.avaliacao_respostas (avaliacao_id, pergunta_id, valor)
  select 'f0000000-0000-0000-0000-000000000001', p.id, 5
    from alunos.avaliacao_perguntas p join alunos.avaliacao_grupos g on g.id = p.grupo_id
   where g.modelo_id = (select id from t_novo) limit 1$$, '23514');
reset role;

select t.as_user('tutora@test.local');
select t.throws_code('an evaluator cannot create a model version', $$select alunos.nova_versao_modelo('tutoria')$$, '42501');
select t.throws_code('an evaluator cannot activate a model', $$select alunos.ativar_modelo(1)$$, '42501');
select t.ok('an evaluator cannot edit the bank (0 rows)', t.affected($$update alunos.avaliacao_modelos set ativo = ativo$$) = 0);
reset role;

-- ------------------------------------------------------------------ audit
select t.ok('submission by the evaluator is audited with her e-mail',
  (select count(*) from alunos.auditoria where tabela = 'avaliacoes' and operacao = 'UPDATE'
      and usuario_email = 'tutora@test.local' and depois ->> 'status' = 'enviada'
      and registro_id = 'a0000000-0000-0000-0000-00000000000a') >= 1);
select t.ok('coordination edit after submit is audited with old and new value',
  (select count(*) from alunos.auditoria where tabela = 'avaliacao_respostas' and operacao = 'UPDATE'
      and usuario_email = 'coord@test.local' and antes ->> 'valor' = '3' and depois ->> 'valor' = '4'
      and registro_id = 'f0000000-0000-0000-0000-000000000001') = 1);
select t.ok('comment changes are audited (admin-only log)',
  (select count(*) from alunos.auditoria where tabela = 'avaliacao_comentarios' and usuario_email = 'coord@test.local') >= 1);
select t.ok('window changes are audited',
  (select count(*) from alunos.auditoria where tabela = 'avaliacao_janelas' and operacao = 'UPDATE') >= 1);
select t.ok('model version creation is audited',
  (select count(*) from alunos.auditoria where tabela = 'avaliacao_modelos' and operacao = 'INSERT' and depois ->> 'versao' = '2') = 1);

\echo
select case when passed then 'PASS' else 'FAIL' end as result, name from t.results order by passed, name;
select count(*) filter (where passed) as passed, count(*) filter (where not passed) as failed from t.results;
rollback;
