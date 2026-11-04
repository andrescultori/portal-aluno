-- Phase 1A / step 1: unified staff roles for the student record.
--
-- Roles live in ONE table so every new module reads the same source:
--   admin, coordenacao, secretaria, financeiro, tutor, mentor, lider_casa
-- plus the legacy label `emissor` (App de Propostas). `emissor` never grants access
-- to student data; the Propostas app keeps its own tables/helpers (propostas.perfis,
-- propostas.papel_atual, selecao.eh_*), which this migration does not touch.
--
-- People are NOT seeded here (no personal data in migrations). The initial rows are
-- inserted once, out of band, after review.
--
-- Not applied automatically: review, then run in the Supabase SQL Editor.

create table if not exists public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(btrim(email))),
  role text not null check (role in
    ('admin', 'coordenacao', 'secretaria', 'financeiro', 'tutor', 'mentor', 'lider_casa', 'emissor')),
  created_at timestamptz not null default now(),
  unique (email, role)
);

alter table public.staff_roles enable row level security;
revoke all on public.staff_roles from anon;
grant select, insert, update, delete on public.staff_roles to authenticated;
grant all on public.staff_roles to service_role;

-- Roles of the logged-in user (matched by the verified e-mail in the JWT).
create or replace function public.current_roles()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(role order by role), '{}'::text[])
    from public.staff_roles
   where email = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_role = any (public.current_roles());
$$;

create or replace function public.has_any_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_roles() && p_roles;
$$;

-- Any staff role that can touch student data (excludes the legacy `emissor`).
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_roles() &&
    array['admin', 'coordenacao', 'secretaria', 'financeiro', 'tutor', 'mentor', 'lider_casa'];
$$;

revoke all on function public.current_roles() from public, anon;
revoke all on function public.has_role(text) from public, anon;
revoke all on function public.has_any_role(text[]) from public, anon;
revoke all on function public.is_staff() from public, anon;
grant execute on function public.current_roles() to authenticated, service_role;
grant execute on function public.has_role(text) to authenticated, service_role;
grant execute on function public.has_any_role(text[]) to authenticated, service_role;
grant execute on function public.is_staff() to authenticated, service_role;

drop policy if exists "staff_roles_select_admin" on public.staff_roles;
create policy "staff_roles_select_admin"
  on public.staff_roles for select to authenticated
  using (public.has_role('admin'));

drop policy if exists "staff_roles_write_admin" on public.staff_roles;
create policy "staff_roles_write_admin"
  on public.staff_roles for all to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));
