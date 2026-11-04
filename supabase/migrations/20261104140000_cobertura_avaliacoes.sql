-- Phase 1B / step 14: evaluation coverage for the coordination screen. READ-ONLY function, no tables.
--
-- One row per (student, category, evaluator) for the semester:
--   * every evaluator that is EXPECTED (explicit assignment, or house leader for Mentoria) — the same rule the
--     grade calculation uses (alunos._avaliadores_esperados);
--   * every evaluator that has an evaluation although not expected (esperado = false);
--   * a student/category without any evaluator gets one row with situacao = 'sem_avaliador'.
-- situacao: nao_iniciada | rascunho | enviada | sem_avaliador. Answers/comments are never returned.
-- Students considered: status 'Ativo', plus anyone who already has an evaluation in the semester.
-- Access: admin and coordenacao only (the evaluators' own screens use alunos.meus_alunos_avaliar).

create or replace function alunos.cobertura_semestre(p_semestre uuid)
returns table (
  aluno_id uuid, aluno text, casa text, categoria text,
  equipe_id uuid, avaliador text, esperado boolean,
  situacao text, respondidas int, total int)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_any_role(array['admin', 'coordenacao']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  return query
  with alvo as (
    select a.id, coalesce(a.nome_exibicao, a.nome) as nome, c.nome as casa
      from alunos.alunos a
      left join alunos.casas c on c.id = a.casa_id
     where a.status = 'Ativo'
        or exists (select 1 from alunos.avaliacoes v where v.aluno_id = a.id and v.semestre_id = p_semestre)
  ),
  cats as (
    select unnest(array['tutoria', 'mentoria']) as categoria
  ),
  esperados as (
    select a.id as aluno_id, c.categoria, e.equipe_id, true as esperado
      from alvo a
      cross join cats c
      cross join lateral alunos._avaliadores_esperados(a.id, p_semestre, c.categoria) e
  ),
  reais as (
    select v.aluno_id, v.categoria, v.avaliador_equipe_id as equipe_id, v.id as avaliacao_id,
           v.modelo_id, v.status
      from alunos.avaliacoes v
     where v.semestre_id = p_semestre
  ),
  pares as (
    select e.aluno_id, e.categoria, e.equipe_id from esperados e
    union
    select r.aluno_id, r.categoria, r.equipe_id from reais r
  )
  select a.id,
         a.nome,
         a.casa,
         c.categoria,
         p.equipe_id,
         m.nome,
         case when p.equipe_id is null then null
              else exists (select 1 from esperados e
                            where e.aluno_id = a.id and e.categoria = c.categoria and e.equipe_id = p.equipe_id) end,
         case when p.equipe_id is null then 'sem_avaliador'
              when r.avaliacao_id is null then 'nao_iniciada'
              else r.status end,
         case when r.avaliacao_id is null then 0
              else (select count(*)::int from alunos.avaliacao_respostas x where x.avaliacao_id = r.avaliacao_id) end,
         (select count(*)::int
            from alunos.avaliacao_perguntas q
            join alunos.avaliacao_grupos g on g.id = q.grupo_id
           where g.modelo_id = coalesce(r.modelo_id,
                 (select md.id from alunos.avaliacao_modelos md where md.categoria = c.categoria and md.ativo)))
    from alvo a
    cross join cats c
    left join pares p on p.aluno_id = a.id and p.categoria = c.categoria
    left join alunos.equipe m on m.id = p.equipe_id
    left join reais r on r.aluno_id = a.id and r.categoria = c.categoria and r.equipe_id = p.equipe_id
   order by a.nome, c.categoria, m.nome;
end $$;

revoke all on function alunos.cobertura_semestre(uuid) from public, anon;
grant execute on function alunos.cobertura_semestre(uuid) to authenticated, service_role;
