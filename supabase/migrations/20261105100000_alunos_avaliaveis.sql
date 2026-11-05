-- Phase 1B / step 15: who is evaluated in a semester ("avaliável").
--
-- Rule (single place, easy to change): a student is evaluable in a semester when
--   * status = 'Ativo', and
--   * the plan of that semester's enrolment (falling back to the student's current plan) is not a
--     partner/agreement plan (alunos.planos.convenio = true, today "Convênio");
-- OR the student already has an evaluation in that semester (drafts and submitted ones stay valid and visible,
-- so a student who graduates or locks after being evaluated never loses results).
--
-- The rule is applied where it matters:
--   _avaliadores_esperados  -> expected evaluators (grades' "pendências" and coverage count only evaluable students)
--   cobertura_semestre      -> "Quem já avaliou" lists only evaluable students
--   meus_alunos_avaliar     -> an evaluator's list shows only evaluable students
--   pode_avaliar            -> nobody can start evaluating a non-evaluable student
-- plus a read-only helper for the coordination screens (filters): avaliaveis_semestre.
-- Function bodies are copies of the live ones with only the evaluability condition added.

create or replace function alunos.avaliavel(p_aluno uuid, p_semestre uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from alunos.avaliacoes v where v.aluno_id = p_aluno and v.semestre_id = p_semestre)
      or exists (
        select 1
          from alunos.alunos a
         where a.id = p_aluno
           and a.status = 'Ativo'
           and not coalesce(
             (select pl.convenio
                from alunos.planos pl
               where pl.codigo = coalesce(
                 (select m.plano from alunos.matriculas m where m.aluno_id = a.id and m.semestre_id = p_semestre),
                 a.plano)),
             false));
$$;

-- Read-only list for the screens (filters): effective plan, whether it is an agreement plan, status and the verdict.
create or replace function alunos.avaliaveis_semestre(p_semestre uuid)
returns table (aluno_id uuid, status text, plano text, convenio boolean, avaliavel boolean)
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
  select a.id,
         a.status,
         x.plano,
         coalesce((select pl.convenio from alunos.planos pl where pl.codigo = x.plano), false),
         alunos.avaliavel(a.id, p_semestre)
    from alunos.alunos a
    cross join lateral (
      select coalesce((select m.plano from alunos.matriculas m where m.aluno_id = a.id and m.semestre_id = p_semestre), a.plano) as plano
    ) x;
end $$;

create or replace function alunos._avaliadores_esperados(p_aluno uuid, p_semestre uuid, p_categoria text)
returns table (equipe_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select t.equipe_id
    from alunos.aluno_tutores t
    join alunos.equipe e on e.id = t.equipe_id
   where t.aluno_id = p_aluno and t.semestre_id = p_semestre and t.categoria = p_categoria and e.ativo
     and alunos.avaliavel(p_aluno, p_semestre)
  union
  select ec.equipe_id
    from alunos.alunos a
    join alunos.equipe_casas ec on ec.casa_id = a.casa_id
    join alunos.equipe e on e.id = ec.equipe_id
   where p_categoria = 'mentoria' and a.id = p_aluno and e.ativo
     and alunos.avaliavel(p_aluno, p_semestre)
     and exists (select 1 from public.staff_roles sr where sr.email = e.email and sr.role = 'lider_casa');
$$;

create or replace function alunos.pode_avaliar(p_aluno uuid, p_semestre uuid, p_categoria text, p_equipe uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_staff()
     and p_equipe is not null
     and p_equipe = alunos.minha_equipe_id()
     and alunos.avaliavel(p_aluno, p_semestre)
     and (
       exists (select 1 from alunos.aluno_tutores t
                where t.aluno_id = p_aluno and t.semestre_id = p_semestre
                  and t.equipe_id = p_equipe and t.categoria = p_categoria)
       or (p_categoria = 'mentoria'
           and public.has_role('lider_casa')
           and exists (select 1
                         from alunos.alunos a
                         join alunos.equipe_casas ec on ec.casa_id = a.casa_id
                        where a.id = p_aluno and ec.equipe_id = p_equipe))
     );
$$;

create or replace function alunos.meus_alunos_avaliar(p_semestre uuid)
returns table (
  aluno_id uuid, nome text, casa text, categoria text, avaliacao_id uuid,
  situacao text, respondidas int, total int,
  janela_aberta boolean, abre_em timestamptz, fecha_em timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select alunos.minha_equipe_id() as id
  ),
  alvos as (
    select t.aluno_id, t.categoria
      from alunos.aluno_tutores t, me
     where t.semestre_id = p_semestre and t.equipe_id = me.id and public.is_staff()
    union
    select a.id, 'mentoria'
      from alunos.alunos a
      join alunos.equipe_casas ec on ec.casa_id = a.casa_id, me
     where ec.equipe_id = me.id and public.has_role('lider_casa') and public.is_staff()
  )
  select al.aluno_id,
         coalesce(a.nome_exibicao, a.nome),
         c.nome,
         al.categoria,
         av.id,
         case when av.id is null then 'nao_iniciada' else av.status end,
         coalesce((select count(*)::int from alunos.avaliacao_respostas r where r.avaliacao_id = av.id), 0),
         (select count(*)::int
            from alunos.avaliacao_perguntas p
            join alunos.avaliacao_grupos g on g.id = p.grupo_id
           where g.modelo_id = coalesce(av.modelo_id,
                 (select m.id from alunos.avaliacao_modelos m where m.categoria = al.categoria and m.ativo))),
         alunos.janela_aberta(p_semestre, al.categoria),
         j.abre_em,
         j.fecha_em
    from alvos al
    join alunos.alunos a on a.id = al.aluno_id and alunos.avaliavel(a.id, p_semestre)
    left join alunos.casas c on c.id = a.casa_id
    left join alunos.avaliacoes av
           on av.semestre_id = p_semestre and av.aluno_id = al.aluno_id
          and av.categoria = al.categoria and av.avaliador_equipe_id = (select id from me)
    left join alunos.avaliacao_janelas j on j.semestre_id = p_semestre and j.categoria = al.categoria
   order by coalesce(a.nome_exibicao, a.nome), al.categoria;
$$;

-- cobertura_semestre: the student list is now "evaluable in this semester" (which already includes anyone
-- with an evaluation there). Everything else is unchanged.
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
     where alunos.avaliavel(a.id, p_semestre)
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

revoke all on function alunos.avaliavel(uuid, uuid) from public, anon, authenticated;
grant execute on function alunos.avaliavel(uuid, uuid) to service_role;
revoke all on function alunos.avaliaveis_semestre(uuid) from public, anon;
grant execute on function alunos.avaliaveis_semestre(uuid) to authenticated, service_role;
-- the replaced functions keep their existing grants (create or replace does not change them)
