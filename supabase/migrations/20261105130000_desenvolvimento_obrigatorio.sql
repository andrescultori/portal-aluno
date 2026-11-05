-- Phase 1B / step 18: the "desenvolvimento" text of an evaluation is required to submit it.
-- (Owner's decision, matching the original Microsoft Forms: "Como você acredita que foi o desenvolvimento do(a)
-- aluno(a)?" cannot be left empty.) Body = the live alunos.enviar_avaliacao plus one check; nothing else changes.
-- Drafts can still be saved without it; only the submission is blocked. No evaluation has been submitted yet.

create or replace function alunos.enviar_avaliacao(p_avaliacao uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a alunos.avaliacoes%rowtype;
  v_total int;
  v_respondidas int;
  -- coordenacao/admin override the window/assignment checks; so does a call without an end-user JWT
  -- (service role, SQL Editor)
  v_override boolean := public.has_any_role(array['admin', 'coordenacao']) or auth.uid() is null;
begin
  select * into a from alunos.avaliacoes where id = p_avaliacao for update;
  if not found then
    raise exception 'Evaluation not found' using errcode = 'P0002';
  end if;

  if not v_override then
    if not alunos.pode_avaliar(a.aluno_id, a.semestre_id, a.categoria, a.avaliador_equipe_id) then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    if a.status = 'enviada' then
      raise exception 'This evaluation was already submitted' using errcode = '55000';
    end if;
    if not alunos.janela_aberta(a.semestre_id, a.categoria) then
      raise exception 'The evaluation window is closed' using errcode = '55000';
    end if;
  end if;

  select count(*) into v_total
    from alunos.avaliacao_perguntas p
    join alunos.avaliacao_grupos g on g.id = p.grupo_id
   where g.modelo_id = a.modelo_id;
  select count(*) into v_respondidas from alunos.avaliacao_respostas where avaliacao_id = a.id;
  if v_respondidas < v_total then
    raise exception 'Answer all questions before submitting (% of %)', v_respondidas, v_total
      using errcode = '22023';
  end if;

  if exists (select 1 from alunos.avaliacao_respostas where avaliacao_id = a.id and valor < 4)
     and nullif(btrim(coalesce((select observacoes from alunos.avaliacao_comentarios
                                 where avaliacao_id = a.id), '')), '') is null then
    raise exception 'The observation is required when any answer is below Bom' using errcode = '22023';
  end if;

  -- new: the development text is always required
  if nullif(btrim(coalesce((select desenvolvimento from alunos.avaliacao_comentarios
                             where avaliacao_id = a.id), '')), '') is null then
    raise exception 'The development text is required' using errcode = '22023';
  end if;

  if a.status <> 'enviada' then
    perform set_config('app.avaliacao_enviar', 'on', true);
    update alunos.avaliacoes set status = 'enviada', enviada_em = now() where id = a.id;
    perform set_config('app.avaliacao_enviar', '', true);
  end if;
end $$;

-- create or replace keeps the existing grants (authenticated, service_role; revoked from public/anon)
