-- Phase 1B / step 12: activities, final project, attendance.
--
-- Everything numeric is computed in the database. This migration stores the inputs and exposes the
-- three component calculations (atividades, projeto, presenca); migration 13 combines them.
-- Raw values are unrounded numerics; rounding happens once, in migration 13.
--
-- Who edits what (RLS):
--   atividades, dias_letivos, projeto_componentes (weights) : coordenacao / admin (dias_letivos also secretaria)
--   atividade_notas, projeto_notas                          : admin and the student's tutor (tutoria assignment
--                                                             of that semester). Coordenacao reads, cannot edit.
--   justificativas                                          : admin, coordenacao, secretaria, and the student's tutor
-- Students read none of these tables directly; they see their own aggregates after release (migration 13).
-- The check-in tables (public.attendance_records, allowed_users, turmas) and the checkin-presenca Edge
-- Function are NOT changed.

-- ---------------------------------------------------------------- audit helper (registro_id for composite keys)
create or replace function alunos.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_id text;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := alunos.audit_mask(to_jsonb(old)); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := alunos.audit_mask(to_jsonb(new)); end if;

  -- ignore no-op updates (only the touch timestamp changed)
  if tg_op = 'UPDATE' and (v_old - 'atualizado_em') = (v_new - 'atualizado_em') then
    return null;
  end if;

  v_row := coalesce(v_new, v_old);
  v_id := coalesce(
    v_row ->> 'aluno_id',
    v_row ->> 'id',
    v_row ->> 'avaliacao_id',
    nullif(concat_ws(':', v_row ->> 'equipe_id', v_row ->> 'casa_id'), ''),
    nullif(concat_ws(':', v_row ->> 'semestre_id', v_row ->> 'categoria', v_row ->> 'codigo', v_row ->> 'data'), ''));

  insert into alunos.auditoria (usuario, usuario_email, tabela, operacao, registro_id, antes, depois)
  values (auth.uid(), nullif(lower(coalesce(auth.jwt() ->> 'email', '')), ''),
          tg_table_name, tg_op, v_id, v_old, v_new);
  return null;
end $$;
revoke all on function alunos.audit_row() from public, anon, authenticated;

-- ---------------------------------------------------------------- tables
-- Weekly class topics (Tuesday class; Wednesday/Thursday are project + presentation). Titles typed by coordenacao.
create table if not exists alunos.atividades (
  id uuid primary key default gen_random_uuid(),
  semestre_id uuid not null references alunos.semestres (id) on delete cascade,
  ordem int not null check (ordem > 0),
  titulo text not null,
  data_aula date,
  unique (semestre_id, ordem)
);

-- null = not graded yet (never the same as 0). final = ativ + quiz (0..10); a missing component counts as 0
-- once the other one is entered; both null -> final null (not graded).
create table if not exists alunos.atividade_notas (
  atividade_id uuid not null references alunos.atividades (id) on delete cascade,
  aluno_id uuid not null references alunos.alunos (id) on delete cascade,
  ativ numeric(3, 1) check (ativ between 0 and 9),
  quiz numeric(3, 1) check (quiz between 0 and 1),
  final numeric(4, 1) generated always as (
    case when ativ is null and quiz is null then null else coalesce(ativ, 0) + coalesce(quiz, 0) end
  ) stored,
  atualizado_por uuid,
  atualizado_em timestamptz not null default now(),
  primary key (atividade_id, aluno_id)
);
create index if not exists atividade_notas_aluno_ix on alunos.atividade_notas (aluno_id);

-- Final-project components. TODO(owner): the real weights are pending confirmation. The defaults below are
-- EQUAL weights, seeded for every new semester by a trigger, and editable by coordenacao/admin in the UI.
create table if not exists alunos.projeto_componentes (
  semestre_id uuid not null references alunos.semestres (id) on delete cascade,
  codigo text not null,
  nome text not null,
  peso numeric not null default 1 check (peso >= 0),
  primary key (semestre_id, codigo)
);

create table if not exists alunos.projeto_notas (
  semestre_id uuid not null,
  aluno_id uuid not null references alunos.alunos (id) on delete cascade,
  codigo text not null,
  nota numeric(4, 2) check (nota between 0 and 10),
  atualizado_por uuid,
  atualizado_em timestamptz not null default now(),
  primary key (semestre_id, aluno_id, codigo),
  foreign key (semestre_id, codigo) references alunos.projeto_componentes (semestre_id, codigo) on delete cascade
);
create index if not exists projeto_notas_aluno_ix on alunos.projeto_notas (aluno_id);

-- Days of the semester with classes (Monday-Friday, daily 14:00-17:00). Generated from the semester
-- dates by alunos.gerar_dias_letivos(); coordenacao edits holidays by setting aula = false.
create table if not exists alunos.dias_letivos (
  semestre_id uuid not null references alunos.semestres (id) on delete cascade,
  data date not null,
  aula boolean not null default true,
  motivo text,
  primary key (semestre_id, data)
);

-- Justified absences, registered by staff (verbal / WhatsApp today).
create table if not exists alunos.justificativas (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references alunos.alunos (id) on delete cascade,
  data date not null,
  motivo text not null check (btrim(motivo) <> ''),
  registrado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  unique (aluno_id, data)
);

alter table alunos.atividades enable row level security;
alter table alunos.atividade_notas enable row level security;
alter table alunos.projeto_componentes enable row level security;
alter table alunos.projeto_notas enable row level security;
alter table alunos.dias_letivos enable row level security;
alter table alunos.justificativas enable row level security;
revoke all on alunos.atividades, alunos.atividade_notas, alunos.projeto_componentes,
  alunos.projeto_notas, alunos.dias_letivos, alunos.justificativas from anon;

-- ---------------------------------------------------------------- default project components per semester
create or replace function alunos.tg_semestre_componentes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into alunos.projeto_componentes (semestre_id, codigo, nome, peso) values
    (new.id, 'projeto', 'Projeto', 1),
    (new.id, 'apresentacao', 'Apresentação', 1),
    (new.id, 'trabalho_escrito', 'Trabalho escrito', 1)
  on conflict (semestre_id, codigo) do nothing;
  return new;
end $$;
revoke all on function alunos.tg_semestre_componentes() from public, anon, authenticated;

drop trigger if exists trg_semestre_componentes on alunos.semestres;
create trigger trg_semestre_componentes after insert on alunos.semestres
  for each row execute function alunos.tg_semestre_componentes();

-- semesters that already exist
insert into alunos.projeto_componentes (semestre_id, codigo, nome, peso)
select s.id, c.codigo, c.nome, 1
  from alunos.semestres s,
       (values ('projeto', 'Projeto'), ('apresentacao', 'Apresentação'), ('trabalho_escrito', 'Trabalho escrito')) as c (codigo, nome)
on conflict (semestre_id, codigo) do nothing;

-- ---------------------------------------------------------------- stamp the editor
create or replace function alunos.tg_stamp_editor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  if auth.uid() is not null then new.atualizado_por := auth.uid(); end if;
  return new;
end $$;
revoke all on function alunos.tg_stamp_editor() from public, anon, authenticated;

drop trigger if exists trg_atividade_notas_stamp on alunos.atividade_notas;
create trigger trg_atividade_notas_stamp before insert or update on alunos.atividade_notas
  for each row execute function alunos.tg_stamp_editor();
drop trigger if exists trg_projeto_notas_stamp on alunos.projeto_notas;
create trigger trg_projeto_notas_stamp before insert or update on alunos.projeto_notas
  for each row execute function alunos.tg_stamp_editor();

-- ---------------------------------------------------------------- access helpers
-- Is the logged-in user a tutor of this student in this semester (tutoria assignment)?
create or replace function alunos.sou_tutor_de(p_aluno uuid, p_semestre uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('tutor')
     and exists (select 1
                   from alunos.aluno_tutores t
                   join alunos.equipe e on e.id = t.equipe_id
                  where t.aluno_id = p_aluno and t.semestre_id = p_semestre and t.categoria = 'tutoria'
                    and e.ativo and e.email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

create or replace function alunos.pode_ver_notas(p_aluno uuid, p_semestre uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['admin', 'coordenacao']) or alunos.sou_tutor_de(p_aluno, p_semestre);
$$;

create or replace function alunos.pode_lancar_nota(p_aluno uuid, p_semestre uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin') or alunos.sou_tutor_de(p_aluno, p_semestre);
$$;

create or replace function alunos.semestre_da_atividade(p_atividade uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select semestre_id from alunos.atividades where id = p_atividade;
$$;

-- Justifications: admin, coordenacao, secretaria, or the student's tutor in a semester that has a class on that date.
create or replace function alunos.pode_justificar(p_aluno uuid, p_data date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['admin', 'coordenacao', 'secretaria'])
      or (public.has_role('tutor')
          and exists (select 1
                        from alunos.aluno_tutores t
                        join alunos.equipe e on e.id = t.equipe_id
                        join alunos.dias_letivos d on d.semestre_id = t.semestre_id and d.data = p_data
                       where t.aluno_id = p_aluno and t.categoria = 'tutoria'
                         and e.ativo and e.email = lower(coalesce(auth.jwt() ->> 'email', ''))));
$$;

-- ---------------------------------------------------------------- class days
create or replace function alunos.gerar_dias_letivos(p_semestre uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inicio date;
  v_fim date;
  v_n int;
begin
  if auth.uid() is not null and not public.has_any_role(array['admin', 'coordenacao', 'secretaria']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select inicio, fim into v_inicio, v_fim from alunos.semestres where id = p_semestre;
  if not found then
    raise exception 'Semester not found' using errcode = 'P0002';
  end if;
  if v_inicio is null or v_fim is null or v_fim < v_inicio then
    raise exception 'Set the semester start and end dates first' using errcode = '22023';
  end if;

  insert into alunos.dias_letivos (semestre_id, data, aula)
  select p_semestre, d::date, true
    from generate_series(v_inicio::timestamp, v_fim::timestamp, interval '1 day') d
   where extract(isodow from d) between 1 and 5
  on conflict (semestre_id, data) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ---------------------------------------------------------------- attendance: join by e-mail
-- Check-in lives in public.attendance_records -> public.allowed_users(id). The student record is
-- alunos.alunos. They are joined by e-mail (case-insensitive). The check-in tables are untouched.
-- Status values are those stored by the checkin-presenca Edge Function at check-in time:
--   'presente' if the check-in happened by turmas.horario_fim_presente, 'atraso' until turmas.horario_fim_atraso
--   (the window opens 5 minutes before horario_inicio). The function never writes 'falta': absent = no row.
-- Not granted to the API roles; used by the security-definer functions below.
create or replace view alunos.v_presenca_aluno with (security_invoker = true) as
select a.id as aluno_id,
       u.id as allowed_user_id,
       r.turma_id,
       r.data,
       r.status,
       r.horario_checkin
  from alunos.alunos a
  join public.allowed_users u on lower(u.email) = lower(a.email)
  join public.attendance_records r on r.aluno_id = u.id;
revoke all on alunos.v_presenca_aluno from public, anon, authenticated;
grant select on alunos.v_presenca_aluno to service_role;

-- Presença (0..10) = (present x 1 + late x 0.5) / (class days - justified absences) x 10.
--   * class days: dias_letivos with aula = true, up to the cut-off date (default: yesterday, Sao Paulo time,
--     so a class that has not happened yet never counts as an absence; pass p_ate to evaluate a closed semester)
--   * a day with no present/late check-in is an absence; a justification removes it from the denominator
--     only if the student did NOT check in that day
--   * empty / fully justified denominator, or a student who cannot be joined to a login -> null (not an error)
create or replace function alunos._presenca_calc(p_aluno uuid, p_semestre uuid, p_ate date default null)
returns table (dias_letivos int, presentes int, atrasos int, faltas int, justificadas int,
               denominador int, presenca numeric, vinculado boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with par as (
    select coalesce(p_ate, (now() at time zone 'America/Sao_Paulo')::date - 1) as ate
  ),
  vinc as (
    select exists (select 1
                     from alunos.alunos a
                     join public.allowed_users u on lower(u.email) = lower(a.email)
                    where a.id = p_aluno) as ok
  ),
  dias as (
    select d.data
      from alunos.dias_letivos d, par
     where d.semestre_id = p_semestre and d.aula and d.data <= par.ate
  ),
  reg as (
    select r.data,
           case when bool_or(r.status = 'presente') then 'presente'
                when bool_or(r.status = 'atraso') then 'atraso'
                else 'falta' end as st
      from alunos.v_presenca_aluno r
     where r.aluno_id = p_aluno
     group by r.data
  ),
  x as (
    select d.data, coalesce(r.st, 'falta') as st, (j.id is not null) as just
      from dias d
      left join reg r on r.data = d.data
      left join alunos.justificativas j on j.aluno_id = p_aluno and j.data = d.data
  ),
  s as (
    select count(*)::int as total,
           (count(*) filter (where st = 'presente'))::int as pres,
           (count(*) filter (where st = 'atraso'))::int as atr,
           (count(*) filter (where st = 'falta' and not just))::int as falt,
           (count(*) filter (where st = 'falta' and just))::int as just_n
      from x
  )
  select s.total, s.pres, s.atr, s.falt, s.just_n, s.total - s.just_n,
         case when not vinc.ok or s.total - s.just_n <= 0 then null
              else (s.pres + 0.5 * s.atr) * 10 / (s.total - s.just_n)::numeric end,
         vinc.ok
    from s, vinc;
$$;

-- Atividades = mean of the finals of the activities the student has a grade for.
create or replace function alunos._atividades_calc(p_aluno uuid, p_semestre uuid)
returns table (atividades numeric, total int, com_nota int)
language sql
stable
security definer
set search_path = ''
as $$
  select avg(n.final), count(a.id)::int, count(n.final)::int
    from alunos.atividades a
    left join alunos.atividade_notas n on n.atividade_id = a.id and n.aluno_id = p_aluno
   where a.semestre_id = p_semestre;
$$;

-- Projeto = weighted mean of the available components (weights renormalised over the ones with a grade).
create or replace function alunos._projeto_calc(p_aluno uuid, p_semestre uuid)
returns table (projeto numeric, componentes int, com_nota int, faltando text[])
language sql
stable
security definer
set search_path = ''
as $$
  select case when coalesce(sum(c.peso) filter (where n.nota is not null), 0) > 0
              then sum(n.nota * c.peso) filter (where n.nota is not null)
                   / sum(c.peso) filter (where n.nota is not null) end,
         count(*)::int,
         (count(n.nota))::int,
         coalesce(array_agg(c.codigo order by c.codigo) filter (where n.nota is null), '{}'::text[])
    from alunos.projeto_componentes c
    left join alunos.projeto_notas n
           on n.semestre_id = c.semestre_id and n.codigo = c.codigo and n.aluno_id = p_aluno
   where c.semestre_id = p_semestre and c.peso > 0;
$$;

revoke all on function alunos._presenca_calc(uuid, uuid, date) from public, anon, authenticated;
revoke all on function alunos._atividades_calc(uuid, uuid) from public, anon, authenticated;
revoke all on function alunos._projeto_calc(uuid, uuid) from public, anon, authenticated;
grant execute on function alunos._presenca_calc(uuid, uuid, date) to service_role;
grant execute on function alunos._atividades_calc(uuid, uuid) to service_role;
grant execute on function alunos._projeto_calc(uuid, uuid) to service_role;

-- Authorised wrappers for the staff screens.
create or replace function alunos.presenca_aluno(p_aluno uuid, p_semestre uuid, p_ate date default null)
returns table (dias_letivos int, presentes int, atrasos int, faltas int, justificadas int,
               denominador int, presenca numeric, vinculado boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not alunos.pode_ver_notas(p_aluno, p_semestre) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query select * from alunos._presenca_calc(p_aluno, p_semestre, p_ate);
end $$;

create or replace function alunos.atividades_aluno(p_aluno uuid, p_semestre uuid)
returns table (atividades numeric, total int, com_nota int)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not alunos.pode_ver_notas(p_aluno, p_semestre) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query select * from alunos._atividades_calc(p_aluno, p_semestre);
end $$;

create or replace function alunos.projeto_aluno(p_aluno uuid, p_semestre uuid)
returns table (projeto numeric, componentes int, com_nota int, faltando text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not alunos.pode_ver_notas(p_aluno, p_semestre) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query select * from alunos._projeto_calc(p_aluno, p_semestre);
end $$;

-- Students who cannot be joined between the student record and the login/check-in list.
create or replace function alunos.presenca_sem_vinculo()
returns table (origem text, aluno_id uuid, allowed_user_id uuid, nome text, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_any_role(array['admin', 'coordenacao', 'secretaria']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select 'aluno_sem_login'::text, a.id, null::uuid, a.nome, a.email
      from alunos.alunos a
     where a.status = 'Ativo'
       and not exists (select 1 from public.allowed_users u where lower(u.email) = lower(a.email))
    union all
    select 'login_sem_aluno'::text, null::uuid, u.id, u.nome, u.email
      from public.allowed_users u
     where u.papel = 'aluno' and u.ativo
       and not exists (select 1 from alunos.alunos a where lower(a.email) = lower(u.email))
    order by 1, 4;
end $$;

-- ---------------------------------------------------------------- RLS
drop policy if exists "atividades_select" on alunos.atividades;
create policy "atividades_select" on alunos.atividades for select to authenticated
  using (public.is_staff());
drop policy if exists "atividades_write" on alunos.atividades;
create policy "atividades_write" on alunos.atividades for all to authenticated
  using (public.has_any_role(array['admin', 'coordenacao']))
  with check (public.has_any_role(array['admin', 'coordenacao']));

drop policy if exists "atividade_notas_select" on alunos.atividade_notas;
create policy "atividade_notas_select" on alunos.atividade_notas for select to authenticated
  using (alunos.pode_ver_notas(aluno_id, alunos.semestre_da_atividade(atividade_id)));
drop policy if exists "atividade_notas_write" on alunos.atividade_notas;
create policy "atividade_notas_write" on alunos.atividade_notas for all to authenticated
  using (alunos.pode_lancar_nota(aluno_id, alunos.semestre_da_atividade(atividade_id)))
  with check (alunos.pode_lancar_nota(aluno_id, alunos.semestre_da_atividade(atividade_id)));

drop policy if exists "projeto_componentes_select" on alunos.projeto_componentes;
create policy "projeto_componentes_select" on alunos.projeto_componentes for select to authenticated
  using (public.is_staff());
drop policy if exists "projeto_componentes_write" on alunos.projeto_componentes;
create policy "projeto_componentes_write" on alunos.projeto_componentes for all to authenticated
  using (public.has_any_role(array['admin', 'coordenacao']))
  with check (public.has_any_role(array['admin', 'coordenacao']));

drop policy if exists "projeto_notas_select" on alunos.projeto_notas;
create policy "projeto_notas_select" on alunos.projeto_notas for select to authenticated
  using (alunos.pode_ver_notas(aluno_id, semestre_id));
drop policy if exists "projeto_notas_write" on alunos.projeto_notas;
create policy "projeto_notas_write" on alunos.projeto_notas for all to authenticated
  using (alunos.pode_lancar_nota(aluno_id, semestre_id))
  with check (alunos.pode_lancar_nota(aluno_id, semestre_id));

drop policy if exists "dias_letivos_select" on alunos.dias_letivos;
create policy "dias_letivos_select" on alunos.dias_letivos for select to authenticated
  using (public.is_staff());
drop policy if exists "dias_letivos_write" on alunos.dias_letivos;
create policy "dias_letivos_write" on alunos.dias_letivos for all to authenticated
  using (public.has_any_role(array['admin', 'coordenacao', 'secretaria']))
  with check (public.has_any_role(array['admin', 'coordenacao', 'secretaria']));

drop policy if exists "justificativas_select" on alunos.justificativas;
create policy "justificativas_select" on alunos.justificativas for select to authenticated
  using (alunos.pode_justificar(aluno_id, data));
drop policy if exists "justificativas_write" on alunos.justificativas;
create policy "justificativas_write" on alunos.justificativas for all to authenticated
  using (alunos.pode_justificar(aluno_id, data))
  with check (alunos.pode_justificar(aluno_id, data));

-- ---------------------------------------------------------------- grants
grant select, insert, update, delete on
  alunos.atividades, alunos.atividade_notas, alunos.projeto_componentes,
  alunos.projeto_notas, alunos.dias_letivos, alunos.justificativas
  to authenticated;
grant all on
  alunos.atividades, alunos.atividade_notas, alunos.projeto_componentes,
  alunos.projeto_notas, alunos.dias_letivos, alunos.justificativas
  to service_role;

revoke all on function alunos.sou_tutor_de(uuid, uuid) from public, anon;
revoke all on function alunos.pode_ver_notas(uuid, uuid) from public, anon;
revoke all on function alunos.pode_lancar_nota(uuid, uuid) from public, anon;
revoke all on function alunos.semestre_da_atividade(uuid) from public, anon;
revoke all on function alunos.pode_justificar(uuid, date) from public, anon;
revoke all on function alunos.gerar_dias_letivos(uuid) from public, anon;
revoke all on function alunos.presenca_aluno(uuid, uuid, date) from public, anon;
revoke all on function alunos.atividades_aluno(uuid, uuid) from public, anon;
revoke all on function alunos.projeto_aluno(uuid, uuid) from public, anon;
revoke all on function alunos.presenca_sem_vinculo() from public, anon;
grant execute on function alunos.sou_tutor_de(uuid, uuid) to authenticated, service_role;
grant execute on function alunos.pode_ver_notas(uuid, uuid) to authenticated, service_role;
grant execute on function alunos.pode_lancar_nota(uuid, uuid) to authenticated, service_role;
grant execute on function alunos.semestre_da_atividade(uuid) to authenticated, service_role;
grant execute on function alunos.pode_justificar(uuid, date) to authenticated, service_role;
grant execute on function alunos.gerar_dias_letivos(uuid) to authenticated, service_role;
grant execute on function alunos.presenca_aluno(uuid, uuid, date) to authenticated, service_role;
grant execute on function alunos.atividades_aluno(uuid, uuid) to authenticated, service_role;
grant execute on function alunos.projeto_aluno(uuid, uuid) to authenticated, service_role;
grant execute on function alunos.presenca_sem_vinculo() to authenticated, service_role;

-- ---------------------------------------------------------------- audit
do $$
declare t text;
begin
  foreach t in array array['atividades', 'atividade_notas', 'projeto_componentes', 'projeto_notas',
                           'dias_letivos', 'justificativas']
  loop
    execute format('drop trigger if exists trg_audit on alunos.%I', t);
    execute format(
      'create trigger trg_audit after insert or update or delete on alunos.%I
         for each row execute function alunos.audit_row()', t);
  end loop;
end $$;
