-- Phase 1B / step 19: list a student's absent days (to justify them). READ-ONLY function, no tables.
--
-- Same rule as alunos._presenca_calc (so the list and the Presença grade always agree): class days = dias_letivos with
-- aula = true up to the cut-off date (default: yesterday, America/Sao_Paulo); a day is an absence when the student has
-- no 'presente' or 'atraso' check-in that day (a manual 'falta' row also counts). A student with no login linked to the
-- check-in gets no rows (the grade is unavailable, never a fake 0). Each row says whether the day is already justified.
-- Access: admin, coordenacao, the student's tutor (alunos.pode_ver_notas) and secretaria — the people who can justify.

create or replace function alunos.faltas_aluno(p_aluno uuid, p_semestre uuid, p_ate date default null)
returns table (data date, justificada boolean, motivo text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (alunos.pode_ver_notas(p_aluno, p_semestre) or public.has_role('secretaria')) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  return query
  with par as (
    select coalesce(p_ate, (now() at time zone 'America/Sao_Paulo')::date - 1) as ate
  ),
  vinc as (
    select exists (select 1
                     from alunos.alunos a
                     join public.allowed_users u on lower(u.email) = lower(a.email)
                    where a.id = p_aluno) as ok
  ),
  presentes as (
    select distinct r.data
      from alunos.v_presenca_aluno r
     where r.aluno_id = p_aluno and r.status in ('presente', 'atraso')
  )
  select d.data, (j.id is not null), j.motivo
    from alunos.dias_letivos d
    cross join par
    cross join vinc
    left join alunos.justificativas j on j.aluno_id = p_aluno and j.data = d.data
   where vinc.ok
     and d.semestre_id = p_semestre and d.aula and d.data <= par.ate
     and not exists (select 1 from presentes p where p.data = d.data)
   order by d.data;
end $$;

revoke all on function alunos.faltas_aluno(uuid, uuid, date) from public, anon;
grant execute on function alunos.faltas_aluno(uuid, uuid, date) to authenticated, service_role;
