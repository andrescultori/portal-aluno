-- Aplicado manualmente em 2026-10-07 após migração para o projeto elurrbjflkdpjddwqomc.

-- 1) turmas: ninguém lê qr_token direto; só as demais colunas, e só usuário logado
revoke select on public.turmas from anon, authenticated;
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'turmas' and column_name <> 'qr_token';
  execute format('grant select (%s) on public.turmas to authenticated', cols);
end $$;

-- 2) RPCs do QR: checagem de papel à prova de NULL + permissões
create or replace function public.get_turma_qr_token(p_turma_id uuid)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_token text;
begin
  if coalesce(public.current_papel(), '') <> 'equipe' then raise exception 'not authorized'; end if;
  select qr_token into v_token from turmas where id = p_turma_id;
  return v_token;
end; $$;

create or replace function public.regenerate_turma_qr_token(p_turma_id uuid)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_token text;
begin
  if coalesce(public.current_papel(), '') <> 'equipe' then raise exception 'not authorized'; end if;
  update turmas set qr_token = encode(extensions.gen_random_bytes(16), 'hex')
   where id = p_turma_id returning qr_token into v_token;
  return v_token;
end; $$;

revoke execute on function public.get_turma_qr_token(uuid)        from public, anon;
revoke execute on function public.regenerate_turma_qr_token(uuid) from public, anon;
grant  execute on function public.get_turma_qr_token(uuid)        to authenticated, service_role;
grant  execute on function public.regenerate_turma_qr_token(uuid) to authenticated, service_role;

-- 3) funções auxiliares: fora do alcance de visitantes sem login
revoke execute on function public.current_aluno_id() from public, anon;
revoke execute on function public.current_papel()    from public, anon;
-- handle_new_auth_user é função de gatilho; não precisa ser chamável pela API
-- (ATENÇÃO: esta linha só vale depois que eu validar o primeiro login de um usuário novo;
--  deixe-a comentada por enquanto)
-- revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
