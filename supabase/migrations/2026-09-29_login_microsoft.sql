-- Login com Microsoft (Azure) além de Google
-- Executar uma vez no SQL Editor do Supabase (projeto já existente).
--
-- As comparações de e-mail no banco eram sensíveis a maiúsculas/minúsculas
-- (email = auth.jwt() ->> 'email'). Contas Google normalmente voltam em
-- minúsculas, mas contas Microsoft podem preservar a caixa original —
-- então um e-mail cadastrado como "aluno@outlook.com" na whitelist podia
-- não bater com "Aluno@outlook.com" vindo do provider, quebrando RLS pra
-- esse usuário. Normaliza os dois lados com lower() em todo lugar que
-- compara e-mail do JWT.

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

create or replace function public.current_aluno_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from allowed_users
  where lower(email) = lower(auth.jwt() ->> 'email') and ativo = true
  limit 1;
$$;

drop policy if exists "allowed_users_select_self_or_equipe" on allowed_users;
create policy "allowed_users_select_self_or_equipe"
  on allowed_users for select
  to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email') or public.current_papel() = 'equipe');
