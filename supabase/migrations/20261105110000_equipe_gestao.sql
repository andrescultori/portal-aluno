-- Phase 1B / step 16: one place to manage staff (login + roles + evaluator list).
--
-- Today a staff member lives in three tables that have to agree by e-mail:
--   public.allowed_users  (login whitelist, papel = 'equipe')
--   public.staff_roles    (what the person can do: admin, coordenacao, tutor, mentor, lider_casa, ...)
--   alunos.equipe         (who appears in the "Atribuições" dropdowns and can be assigned students)
-- Two functions keep them in sync so the screen "Equipe e acessos" needs only one action:
--   public.listar_equipe()            -> read-only list (union of the three tables)
--   public.salvar_membro_equipe(...)  -> create/update one member: login, roles, evaluator entry
--
-- Who can do what:
--   admin        -> everything (any role), including promoting/demoting other people;
--   coordenacao  -> can add/edit/deactivate people whose roles are only tutor / mentor / lider_casa
--                   (cannot grant or remove admin, coordenacao, secretaria, financeiro, and cannot edit
--                   anyone who holds one of those);
--   everybody else -> not allowed.
-- Nobody is ever deleted: "removing" a person deactivates the login and the evaluator entry (assignments and
-- evaluations keep pointing to them). The legacy 'emissor' role is never touched here.
-- Guards: you cannot remove your own admin role or deactivate yourself (lock-out protection).

create or replace function public.listar_equipe()
returns table (email text, nome text, ativo boolean, papeis text[], equipe_id uuid, tem_login boolean)
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
  with todos as (
    select lower(u.email) as e from public.allowed_users u where u.papel = 'equipe'
    union select s.email from public.staff_roles s
    union select q.email from alunos.equipe q
  )
  select t.e,
         coalesce(u.nome, q.nome, t.e),
         coalesce(u.ativo, q.ativo, true),
         coalesce((select array_agg(s.role order by s.role) from public.staff_roles s where s.email = t.e), '{}'::text[]),
         q.id,
         u.id is not null
    from todos t
    left join public.allowed_users u on lower(u.email) = t.e and u.papel = 'equipe'
    left join alunos.equipe q on q.email = t.e
   order by coalesce(u.nome, q.nome, t.e);
end $$;

create or replace function public.salvar_membro_equipe(
  p_email text, p_nome text, p_papeis text[], p_ativo boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_nome text := nullif(btrim(coalesce(p_nome, '')), '');
  v_papeis text[] := coalesce(p_papeis, '{}'::text[]);
  v_gerenciaveis constant text[] := array['admin', 'coordenacao', 'secretaria', 'financeiro', 'tutor', 'mentor', 'lider_casa'];
  v_avaliadores constant text[] := array['tutor', 'mentor', 'lider_casa'];
  v_eu text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_atuais text[];
begin
  if not public.has_any_role(array['admin', 'coordenacao']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+$' then
    raise exception 'Invalid e-mail' using errcode = '22023';
  end if;
  if v_nome is null then
    raise exception 'Name is required' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_papeis) r where r <> all (v_gerenciaveis)) then
    raise exception 'Unknown role' using errcode = '22023';
  end if;

  select coalesce(array_agg(role), '{}'::text[]) into v_atuais from public.staff_roles where email = v_email;

  -- coordination only manages evaluator roles, and only for people who do not hold a higher role
  if not public.has_role('admin') then
    if exists (select 1 from unnest(v_papeis) r where r <> all (v_avaliadores))
       or exists (select 1 from unnest(v_atuais) r where r = any (v_gerenciaveis) and r <> all (v_avaliadores)) then
      raise exception 'Only an admin can grant or change admin, coordenacao, secretaria or financeiro' using errcode = '42501';
    end if;
  end if;

  -- lock-out protection
  if v_email = v_eu and (not p_ativo or (public.has_role('admin') and not ('admin' = any (v_papeis)))) then
    raise exception 'You cannot deactivate yourself or remove your own admin role' using errcode = '22023';
  end if;

  -- 1. login (a student login cannot be turned into staff by accident)
  if exists (select 1 from public.allowed_users where lower(email) = v_email and papel <> 'equipe') then
    raise exception 'This e-mail is a student login' using errcode = '22023';
  end if;
  insert into public.allowed_users (nome, email, papel, ativo)
  values (v_nome, v_email, 'equipe', p_ativo)
  on conflict (email) do update set nome = excluded.nome, ativo = excluded.ativo;

  -- 2. roles: remove the managed ones that were unchecked, add the new ones ('emissor' is never touched)
  delete from public.staff_roles
   where email = v_email and role = any (v_gerenciaveis) and role <> all (v_papeis);
  insert into public.staff_roles (email, role)
  select v_email, r from unnest(v_papeis) r
  on conflict (email, role) do nothing;

  -- 3. evaluator entry (Atribuições dropdowns): present and active while the person can evaluate
  if v_papeis && v_avaliadores then
    insert into alunos.equipe (nome, email, ativo)
    values (v_nome, v_email, p_ativo)
    on conflict (email) do update set nome = excluded.nome, ativo = excluded.ativo;
  else
    update alunos.equipe set nome = v_nome, ativo = false where email = v_email;
  end if;
end $$;

revoke all on function public.listar_equipe() from public, anon;
revoke all on function public.salvar_membro_equipe(text, text, text[], boolean) from public, anon;
grant execute on function public.listar_equipe() to authenticated, service_role;
grant execute on function public.salvar_membro_equipe(text, text, text[], boolean) to authenticated, service_role;
