-- Structure-only replica of the existing check-in tables (public.turmas, allowed_users, attendance_records),
-- matching the live columns (read-only inspection 2026-11-04). RLS is enabled but the live policies are not
-- replicated (they use helpers that the alunos migrations never touch). FAKE DATA ONLY in tests.
create table if not exists public.turmas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  horario_inicio time not null,
  horario_fim_presente time not null,
  horario_fim_atraso time not null,
  ativo boolean not null default true,
  qr_token text not null unique default encode(gen_random_bytes(16), 'hex')
);
create table if not exists public.allowed_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users (id),
  nome text not null,
  email text unique not null,
  papel text not null check (papel in ('aluno', 'equipe')),
  turma_id uuid references public.turmas (id),
  ativo boolean not null default true,
  created_at timestamptz default now()
);
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.allowed_users (id),
  turma_id uuid not null references public.turmas (id),
  data date not null,
  horario_checkin timestamptz not null,
  status text not null check (status in ('presente', 'atraso', 'falta')),
  created_at timestamptz default now(),
  unique (aluno_id, turma_id, data)
);
alter table public.turmas enable row level security;
alter table public.allowed_users enable row level security;
alter table public.attendance_records enable row level security;
grant select, insert, update, delete on public.turmas, public.allowed_users, public.attendance_records
  to authenticated, service_role;

-- Live helper (migration 2026-09-29_login_microsoft.sql, verbatim): the papel of the logged-in login ('aluno' | 'equipe').
create or replace function public.current_papel()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select papel
  from allowed_users
  where lower(email) = lower(auth.jwt() ->> 'email') and ativo = true
  limit 1;
$$;
grant execute on function public.current_papel() to authenticated, service_role;
