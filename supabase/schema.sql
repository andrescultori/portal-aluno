-- Portal do Aluno UniMissional — schema + RLS
-- Executar no SQL editor do Supabase (projeto vazio) na ordem em que aparece.

create extension if not exists pgcrypto;

-- ============================================================
-- 1. Tabelas
-- ============================================================

create table turmas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  horario_inicio time not null,
  horario_fim_presente time not null,
  horario_fim_atraso time not null,
  ativo boolean not null default true
);

create table allowed_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id),
  nome text not null,
  email text unique not null,
  papel text not null check (papel in ('aluno', 'equipe')),
  turma_id uuid references turmas(id),
  ativo boolean not null default true,
  created_at timestamptz default now()
);

create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid references allowed_users(id) not null,
  turma_id uuid references turmas(id) not null,
  data date not null,
  horario_checkin timestamptz not null,
  status text not null check (status in ('presente', 'atraso', 'falta')),
  created_at timestamptz default now(),
  unique (aluno_id, turma_id, data)
);

create table hero_config (
  id int primary key default 1,
  modo text not null check (modo in ('video', 'carrossel')),
  video_url text,
  imagens jsonb,
  intervalo_segundos int default 5
);

create table manual_do_aluno (
  id int primary key default 1,
  pdf_url text,
  resumo text
);

create table classroom_links (
  id uuid primary key default gen_random_uuid(),
  nome_turma text not null,
  url text not null,
  ordem int default 0
);

create table link_sections (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  ordem int default 0
);

create table link_section_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references link_sections(id) on delete cascade,
  nome text not null,
  url text not null,
  descricao text,
  ordem int default 0
);

create table info_pages (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  slug text unique not null,
  conteudo text,
  ordem int default 0
);

create table settings (
  chave text primary key,
  valor text
);

-- ============================================================
-- 2. Vincular auth.users -> allowed_users pelo e-mail no primeiro login
-- ============================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update allowed_users
  set auth_user_id = new.id
  where email = new.email and auth_user_id is null;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ============================================================
-- 3. Helper: papel do usuário autenticado (via e-mail do JWT)
-- ============================================================

create or replace function public.current_papel()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select papel
  from allowed_users
  where email = auth.jwt() ->> 'email' and ativo = true
  limit 1;
$$;

create or replace function public.current_aluno_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from allowed_users
  where email = auth.jwt() ->> 'email' and ativo = true
  limit 1;
$$;

-- ============================================================
-- 4. Row Level Security
-- ============================================================

alter table allowed_users enable row level security;
alter table turmas enable row level security;
alter table attendance_records enable row level security;
alter table hero_config enable row level security;
alter table manual_do_aluno enable row level security;
alter table classroom_links enable row level security;
alter table link_sections enable row level security;
alter table link_section_items enable row level security;
alter table info_pages enable row level security;
alter table settings enable row level security;

-- allowed_users: aluno vê o próprio registro; equipe vê e edita todos.
create policy "allowed_users_select_self_or_equipe"
  on allowed_users for select
  to authenticated
  using (email = auth.jwt() ->> 'email' or public.current_papel() = 'equipe');

create policy "allowed_users_write_equipe"
  on allowed_users for all
  to authenticated
  using (public.current_papel() = 'equipe')
  with check (public.current_papel() = 'equipe');

-- turmas: leitura pública para autenticados; escrita só equipe.
create policy "turmas_select_authenticated"
  on turmas for select
  to authenticated
  using (true);

create policy "turmas_write_equipe"
  on turmas for all
  to authenticated
  using (public.current_papel() = 'equipe')
  with check (public.current_papel() = 'equipe');

-- attendance_records: aluno lê só os próprios; equipe lê tudo.
-- Nenhuma policy de INSERT/UPDATE/DELETE para authenticated:
-- a gravação é feita exclusivamente pela Edge Function (service role),
-- que calcula o status no servidor e ignora a RLS.
create policy "attendance_select_self_or_equipe"
  on attendance_records for select
  to authenticated
  using (aluno_id = public.current_aluno_id() or public.current_papel() = 'equipe');

-- Tabelas de conteúdo: leitura pública para autenticados; escrita só equipe.
create policy "hero_config_select" on hero_config for select to authenticated using (true);
create policy "hero_config_write" on hero_config for all to authenticated
  using (public.current_papel() = 'equipe') with check (public.current_papel() = 'equipe');

create policy "manual_select" on manual_do_aluno for select to authenticated using (true);
create policy "manual_write" on manual_do_aluno for all to authenticated
  using (public.current_papel() = 'equipe') with check (public.current_papel() = 'equipe');

create policy "classroom_links_select" on classroom_links for select to authenticated using (true);
create policy "classroom_links_write" on classroom_links for all to authenticated
  using (public.current_papel() = 'equipe') with check (public.current_papel() = 'equipe');

create policy "link_sections_select" on link_sections for select to authenticated using (true);
create policy "link_sections_write" on link_sections for all to authenticated
  using (public.current_papel() = 'equipe') with check (public.current_papel() = 'equipe');

create policy "link_section_items_select" on link_section_items for select to authenticated using (true);
create policy "link_section_items_write" on link_section_items for all to authenticated
  using (public.current_papel() = 'equipe') with check (public.current_papel() = 'equipe');

create policy "info_pages_select" on info_pages for select to authenticated using (true);
create policy "info_pages_write" on info_pages for all to authenticated
  using (public.current_papel() = 'equipe') with check (public.current_papel() = 'equipe');

create policy "settings_select" on settings for select to authenticated using (true);
create policy "settings_write" on settings for all to authenticated
  using (public.current_papel() = 'equipe') with check (public.current_papel() = 'equipe');

-- ============================================================
-- 5. Dados iniciais
-- ============================================================

insert into hero_config (id, modo, video_url, imagens, intervalo_segundos)
values (1, 'carrossel', null, '[]'::jsonb, 5)
on conflict (id) do nothing;

insert into manual_do_aluno (id, pdf_url, resumo)
values (1, null, null)
on conflict (id) do nothing;

insert into classroom_links (nome_turma, url, ordem) values
  ('Turma A', 'https://classroom.google.com', 1),
  ('Turma B', 'https://classroom.google.com', 2)
on conflict do nothing;

insert into link_sections (titulo, ordem) values
  ('Biblioteca e Pesquisa', 1),
  ('Financeiro e Secretaria', 2),
  ('Comunidade', 3)
on conflict do nothing;

-- Primeiro usuário da equipe (ajuste o e-mail antes de rodar).
-- insert into allowed_users (nome, email, papel, ativo)
-- values ('Nome do Admin', 'admin@unimissional.edu.br', 'equipe', true);
