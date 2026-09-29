-- Presença via QR Code por turma
-- Executar uma vez no SQL Editor do Supabase (projeto já existente).
--
-- Cada turma passa a ter um token secreto (qr_token). O check-in só é aceito
-- se o token enviado bater com o da turma do aluno — o token só existe
-- impresso no QR Code afixado na sala, então confirmar presença exige ter
-- escaneado o QR fisicamente.
--
-- A coluna qr_token é propositalmente escondida de qualquer select('*')
-- feito com a sessão do usuário (aluno ou equipe): só as duas funções abaixo,
-- que checam papel = 'equipe', conseguem lê-la ou trocá-la.

alter table turmas add column qr_token text;
update turmas set qr_token = encode(gen_random_bytes(16), 'hex') where qr_token is null;
alter table turmas alter column qr_token set not null;
alter table turmas alter column qr_token set default encode(gen_random_bytes(16), 'hex');
alter table turmas add constraint turmas_qr_token_key unique (qr_token);

-- Restringe select('*') a não trazer qr_token pra ninguém autenticado.
revoke select on turmas from authenticated;
grant select (id, nome, horario_inicio, horario_fim_presente, horario_fim_atraso, ativo)
  on turmas to authenticated;

create or replace function public.get_turma_qr_token(p_turma_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if public.current_papel() <> 'equipe' then
    raise exception 'not authorized';
  end if;

  select qr_token into v_token from turmas where id = p_turma_id;
  return v_token;
end;
$$;

create or replace function public.regenerate_turma_qr_token(p_turma_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if public.current_papel() <> 'equipe' then
    raise exception 'not authorized';
  end if;

  update turmas set qr_token = encode(gen_random_bytes(16), 'hex')
  where id = p_turma_id
  returning qr_token into v_token;

  return v_token;
end;
$$;

grant execute on function public.get_turma_qr_token(uuid) to authenticated;
grant execute on function public.regenerate_turma_qr_token(uuid) to authenticated;
