-- Avisos e comunicados exibidos na Home do aluno.
-- NÃO é executada automaticamente: rodar uma vez no SQL Editor do projeto.
-- Idempotente (pode ser repetida). Até rodar, a Home mostra "Nenhum aviso".
--
-- Leitura: qualquer usuário logado vê só os avisos ativos; a equipe vê todos
-- (inclusive inativos, pra editar). Escrita: só equipe.

create table if not exists public.avisos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  resumo text,
  publicado_em date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  ativo boolean not null default true
);

alter table public.avisos enable row level security;

drop policy if exists "avisos_select_authenticated" on public.avisos;
create policy "avisos_select_authenticated"
  on public.avisos for select
  to authenticated
  using (ativo or public.current_papel() = 'equipe');

drop policy if exists "avisos_write_equipe" on public.avisos;
create policy "avisos_write_equipe"
  on public.avisos for all
  to authenticated
  using (public.current_papel() = 'equipe')
  with check (public.current_papel() = 'equipe');

-- Sem acesso para visitantes sem login; authenticated passa pela RLS acima.
revoke all on public.avisos from anon;
grant select, insert, update, delete on public.avisos to authenticated;
grant all on public.avisos to service_role;
