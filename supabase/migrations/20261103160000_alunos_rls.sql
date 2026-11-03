-- Phase 1A / step 7: access control for the student record (RLS is the real enforcement;
-- the UI only hides what the role cannot read).
--
-- Matrix (admin can do everything everywhere):
--   alunos.alunos        student: own row, edits only celular/whatsapp/foto_path
--                        tutor/mentor: assigned students (read) | lider_casa: own house (read)
--                        coordenacao, secretaria: read/write | financeiro: read
--   dados_pessoais       student: own (read; edits address/emergency) | coordenacao, financeiro: read
--                        secretaria: read/write | tutor/mentor/lider_casa: none
--   aluno_igreja         student: own read/write | coordenacao, secretaria: read/write
--   aluno_saude          student: own read/write | coordenacao: read | everyone else: none
--   matriculas, ciclo_status  read: same people who can read the student | write: coordenacao, secretaria
--   aluno_status_historico    read: coordenacao, secretaria | nobody writes directly
--
-- The legacy policies alunos_leitura / alunos_dp_leitura are DROPPED below. They depend on
-- selecao.eh_equipe() / selecao.eh_coordenacao_ou_admin(), which are true for anyone with a
-- propostas.perfis row (including emissores). Once the `alunos` schema is exposed in the Data API
-- that would let emissores read every student and Propostas coordenacao/admin read CPF and
-- addresses. From here on only the new helpers (has_any_role, can_view_aluno, my_aluno_id) grant
-- access. Safe: nothing could reach those policies through the API before (schema not exposed),
-- and selecao.registrar_checkin is security definer, so it is not affected by RLS.

-- ---------------------------------------------------------------- helpers

-- Student identity bridge: the logged-in user's record in alunos.alunos, matched by
-- user_id (when linked) or by the verified e-mail in the JWT.
create or replace function alunos.my_aluno_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.id
    from alunos.alunos a
   where a.user_id = auth.uid()
      or lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
   order by (a.user_id = auth.uid()) desc nulls last
   limit 1;
$$;

-- Can the current user read this student's basic record?
create or replace function public.can_view_aluno(p_aluno_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_roles text[] := public.current_roles();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if p_aluno_id is null then return false; end if;

  if v_roles && array['admin', 'coordenacao', 'secretaria', 'financeiro'] then
    return true;
  end if;

  if p_aluno_id = alunos.my_aluno_id() then
    return true;
  end if;

  -- tutor / mentor: students assigned in the current semester
  -- (if no semester is flagged "atual", any assignment counts)
  if v_roles && array['tutor', 'mentor'] and exists (
    select 1
      from alunos.aluno_tutores t
      join alunos.equipe e on e.id = t.equipe_id
      join alunos.semestres s on s.id = t.semestre_id
     where t.aluno_id = p_aluno_id
       and e.ativo
       and e.email = v_email
       and (s.atual or not exists (select 1 from alunos.semestres where atual))
  ) then
    return true;
  end if;

  -- líder de casa: students living in one of their houses
  if v_roles && array['lider_casa'] and exists (
    select 1
      from alunos.alunos a
      join alunos.equipe_casas ec on ec.casa_id = a.casa_id
      join alunos.equipe e on e.id = ec.equipe_id
     where a.id = p_aluno_id
       and e.ativo
       and e.email = v_email
  ) then
    return true;
  end if;

  return false;
end $$;

-- Staff action with a mandatory reason; writes the history through the status trigger.
create or replace function alunos.change_status(p_aluno_id uuid, p_status text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_any_role(array['admin', 'coordenacao', 'secretaria']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  perform set_config('app.status_reason', btrim(p_reason), true);
  update alunos.alunos set status = p_status where id = p_aluno_id;
  if not found then
    raise exception 'student not found' using errcode = 'P0002';
  end if;
end $$;

-- ---------------------------------------------------------------- column guards
-- Students may edit only a few columns of their own rows; everything else needs staff.
-- Calls without an end-user JWT (service role, security-definer RPCs such as
-- selecao.registrar_checkin) are not restricted.

create or replace function alunos.tg_guard_student_self_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_blocked text[];
begin
  if auth.uid() is null then return new; end if;
  if public.has_any_role(array['admin', 'coordenacao', 'secretaria']) then return new; end if;

  select array_agg(n.key order by n.key) into v_blocked
    from jsonb_each(to_jsonb(new)) n
    join jsonb_each(to_jsonb(old)) o using (key)
   where n.value is distinct from o.value
     and n.key not in ('atualizado_em', 'celular', 'whatsapp', 'foto_path');

  if v_blocked is not null then
    raise exception 'Not allowed to change: %', array_to_string(v_blocked, ', ')
      using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function alunos.tg_guard_dados_pessoais()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_blocked text[];
  v_allowed text[] := array['atualizado_em', 'aluno_id', 'endereco', 'numero', 'complemento',
                            'bairro', 'cep', 'cidade', 'estado', 'pais', 'emergencia'];
begin
  if auth.uid() is null then return new; end if;
  if public.has_any_role(array['admin', 'secretaria']) then return new; end if;

  if tg_op = 'INSERT' then
    select array_agg(n.key order by n.key) into v_blocked
      from jsonb_each(to_jsonb(new)) n
     where n.value <> 'null'::jsonb and n.key <> all (v_allowed);
  else
    select array_agg(n.key order by n.key) into v_blocked
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o using (key)
     where n.value is distinct from o.value and n.key <> all (v_allowed);
  end if;

  if v_blocked is not null then
    raise exception 'Not allowed to change: %', array_to_string(v_blocked, ', ')
      using errcode = '42501';
  end if;
  return new;
end $$;

revoke all on function alunos.tg_guard_student_self_update() from public, anon, authenticated;
revoke all on function alunos.tg_guard_dados_pessoais() from public, anon, authenticated;

drop trigger if exists trg_alunos_guard on alunos.alunos;
create trigger trg_alunos_guard before update on alunos.alunos
  for each row execute function alunos.tg_guard_student_self_update();

drop trigger if exists trg_dados_pessoais_guard on alunos.dados_pessoais;
create trigger trg_dados_pessoais_guard before insert or update on alunos.dados_pessoais
  for each row execute function alunos.tg_guard_dados_pessoais();

-- ---------------------------------------------------------------- policies

-- legacy policies (see header)
drop policy if exists "alunos_leitura" on alunos.alunos;
drop policy if exists "alunos_dp_leitura" on alunos.dados_pessoais;

-- alunos.alunos
drop policy if exists "alunos_select" on alunos.alunos;
create policy "alunos_select" on alunos.alunos for select to authenticated
  using (public.can_view_aluno(id));

drop policy if exists "alunos_insert_staff" on alunos.alunos;
create policy "alunos_insert_staff" on alunos.alunos for insert to authenticated
  with check (public.has_any_role(array['admin', 'coordenacao', 'secretaria']));

drop policy if exists "alunos_update" on alunos.alunos;
create policy "alunos_update" on alunos.alunos for update to authenticated
  using (public.has_any_role(array['admin', 'coordenacao', 'secretaria']) or id = alunos.my_aluno_id())
  with check (public.has_any_role(array['admin', 'coordenacao', 'secretaria']) or id = alunos.my_aluno_id());

drop policy if exists "alunos_delete_admin" on alunos.alunos;
create policy "alunos_delete_admin" on alunos.alunos for delete to authenticated
  using (public.has_role('admin'));

-- alunos.dados_pessoais
drop policy if exists "dp_select" on alunos.dados_pessoais;
create policy "dp_select" on alunos.dados_pessoais for select to authenticated
  using (public.has_any_role(array['admin', 'coordenacao', 'secretaria', 'financeiro'])
         or aluno_id = alunos.my_aluno_id());

drop policy if exists "dp_insert" on alunos.dados_pessoais;
create policy "dp_insert" on alunos.dados_pessoais for insert to authenticated
  with check (public.has_any_role(array['admin', 'secretaria']) or aluno_id = alunos.my_aluno_id());

drop policy if exists "dp_update" on alunos.dados_pessoais;
create policy "dp_update" on alunos.dados_pessoais for update to authenticated
  using (public.has_any_role(array['admin', 'secretaria']) or aluno_id = alunos.my_aluno_id())
  with check (public.has_any_role(array['admin', 'secretaria']) or aluno_id = alunos.my_aluno_id());

drop policy if exists "dp_delete_admin" on alunos.dados_pessoais;
create policy "dp_delete_admin" on alunos.dados_pessoais for delete to authenticated
  using (public.has_role('admin'));

-- alunos.aluno_igreja
drop policy if exists "igreja_select" on alunos.aluno_igreja;
create policy "igreja_select" on alunos.aluno_igreja for select to authenticated
  using (public.has_any_role(array['admin', 'coordenacao', 'secretaria']) or aluno_id = alunos.my_aluno_id());

drop policy if exists "igreja_write" on alunos.aluno_igreja;
create policy "igreja_write" on alunos.aluno_igreja for all to authenticated
  using (public.has_any_role(array['admin', 'coordenacao', 'secretaria']) or aluno_id = alunos.my_aluno_id())
  with check (public.has_any_role(array['admin', 'coordenacao', 'secretaria']) or aluno_id = alunos.my_aluno_id());

-- alunos.aluno_saude (restricted)
drop policy if exists "saude_select" on alunos.aluno_saude;
create policy "saude_select" on alunos.aluno_saude for select to authenticated
  using (public.has_any_role(array['admin', 'coordenacao']) or aluno_id = alunos.my_aluno_id());

drop policy if exists "saude_write" on alunos.aluno_saude;
create policy "saude_write" on alunos.aluno_saude for all to authenticated
  using (public.has_role('admin') or aluno_id = alunos.my_aluno_id())
  with check (public.has_role('admin') or aluno_id = alunos.my_aluno_id());

-- alunos.matriculas / ciclo_status
drop policy if exists "matriculas_select" on alunos.matriculas;
create policy "matriculas_select" on alunos.matriculas for select to authenticated
  using (public.can_view_aluno(aluno_id));
drop policy if exists "matriculas_write" on alunos.matriculas;
create policy "matriculas_write" on alunos.matriculas for all to authenticated
  using (public.has_any_role(array['admin', 'coordenacao', 'secretaria']))
  with check (public.has_any_role(array['admin', 'coordenacao', 'secretaria']));

drop policy if exists "ciclo_status_select" on alunos.ciclo_status;
create policy "ciclo_status_select" on alunos.ciclo_status for select to authenticated
  using (public.can_view_aluno(aluno_id));
drop policy if exists "ciclo_status_write" on alunos.ciclo_status;
create policy "ciclo_status_write" on alunos.ciclo_status for all to authenticated
  using (public.has_any_role(array['admin', 'coordenacao', 'secretaria']))
  with check (public.has_any_role(array['admin', 'coordenacao', 'secretaria']));

-- alunos.aluno_status_historico (read only; written by the status trigger)
drop policy if exists "status_hist_select" on alunos.aluno_status_historico;
create policy "status_hist_select" on alunos.aluno_status_historico for select to authenticated
  using (public.has_any_role(array['admin', 'coordenacao', 'secretaria']));

-- alunos.equipe / equipe_casas / aluno_tutores
drop policy if exists "equipe_select" on alunos.equipe;
create policy "equipe_select" on alunos.equipe for select to authenticated
  using (public.is_staff());
drop policy if exists "equipe_write" on alunos.equipe;
create policy "equipe_write" on alunos.equipe for all to authenticated
  using (public.has_any_role(array['admin', 'coordenacao']))
  with check (public.has_any_role(array['admin', 'coordenacao']));

drop policy if exists "equipe_casas_select" on alunos.equipe_casas;
create policy "equipe_casas_select" on alunos.equipe_casas for select to authenticated
  using (public.is_staff());
drop policy if exists "equipe_casas_write" on alunos.equipe_casas;
create policy "equipe_casas_write" on alunos.equipe_casas for all to authenticated
  using (public.has_any_role(array['admin', 'coordenacao']))
  with check (public.has_any_role(array['admin', 'coordenacao']));

drop policy if exists "aluno_tutores_select" on alunos.aluno_tutores;
create policy "aluno_tutores_select" on alunos.aluno_tutores for select to authenticated
  using (
    public.has_any_role(array['admin', 'coordenacao', 'secretaria'])
    or exists (select 1 from alunos.equipe e
                where e.id = equipe_id
                  and e.email = lower(coalesce(auth.jwt() ->> 'email', '')))
  );
drop policy if exists "aluno_tutores_write" on alunos.aluno_tutores;
create policy "aluno_tutores_write" on alunos.aluno_tutores for all to authenticated
  using (public.has_any_role(array['admin', 'coordenacao', 'secretaria']))
  with check (public.has_any_role(array['admin', 'coordenacao', 'secretaria']));

-- reference tables: readable by any logged-in user, editable by admin/coordenacao
do $$
declare t text;
begin
  foreach t in array array['semestres', 'ciclos', 'modulos', 'casas', 'planos', 'pacotes']
  loop
    execute format('drop policy if exists "%1$s_select" on alunos.%1$I', t);
    execute format('create policy "%1$s_select" on alunos.%1$I for select to authenticated using (true)', t);
    execute format('drop policy if exists "%1$s_write" on alunos.%1$I', t);
    execute format(
      'create policy "%1$s_write" on alunos.%1$I for all to authenticated
         using (public.has_any_role(array[''admin'', ''coordenacao'']))
         with check (public.has_any_role(array[''admin'', ''coordenacao'']))', t);
  end loop;
end $$;

-- audit log: admin read only, no client writes
drop policy if exists "auditoria_select_admin" on alunos.auditoria;
create policy "auditoria_select_admin" on alunos.auditoria for select to authenticated
  using (public.has_role('admin'));

-- ---------------------------------------------------------------- grants
revoke all on all tables in schema alunos from anon;

grant usage on schema alunos to authenticated, service_role;

grant select, insert, update, delete on
  alunos.alunos, alunos.dados_pessoais, alunos.aluno_igreja, alunos.aluno_saude,
  alunos.matriculas, alunos.ciclo_status, alunos.equipe, alunos.equipe_casas, alunos.aluno_tutores,
  alunos.semestres, alunos.ciclos, alunos.modulos, alunos.casas, alunos.planos, alunos.pacotes
  to authenticated;
grant select on alunos.aluno_status_historico, alunos.auditoria to authenticated;
grant all on all tables in schema alunos to service_role;
grant usage, select on all sequences in schema alunos to service_role;

revoke all on function alunos.my_aluno_id() from public, anon;
revoke all on function public.can_view_aluno(uuid) from public, anon;
revoke all on function alunos.change_status(uuid, text, text) from public, anon;
grant execute on function alunos.my_aluno_id() to authenticated, service_role;
grant execute on function public.can_view_aluno(uuid) to authenticated, service_role;
grant execute on function alunos.change_status(uuid, text, text) to authenticated, service_role;
