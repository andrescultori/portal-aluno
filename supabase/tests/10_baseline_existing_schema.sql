-- Structure-only replica of the parts of the LIVE database that the Phase 1A migrations and
-- tests depend on (captured read-only from project elurrbjflkdpjddwqomc on 2026-11-03).
-- No data. TEST ONLY.

create schema if not exists selecao;
create schema if not exists propostas;
create schema if not exists alunos;
grant usage on schema selecao, propostas, alunos to anon, authenticated, service_role;

create type propostas.papel_usuario as enum ('emissor', 'coordenacao', 'admin');
create table propostas.perfis (
  id uuid primary key default gen_random_uuid(), user_id uuid, email text, nome text,
  papel propostas.papel_usuario, ativo boolean default true,
  criado_em timestamptz default now(), ultimo_acesso timestamptz);

create function propostas.papel_atual() returns propostas.papel_usuario
  language sql stable security definer set search_path to '' as $$
  select papel from propostas.perfis where user_id = auth.uid() and ativo $$;
create function selecao.eh_equipe() returns boolean
  language sql stable security definer set search_path to '' as $$
  select propostas.papel_atual() is not null $$;
create function selecao.eh_coordenacao_ou_admin() returns boolean
  language sql stable security definer set search_path to '' as $$
  select coalesce(propostas.papel_atual()::text in ('coordenacao','admin'), false) $$;

create table selecao.segredos_automacao (nome text primary key, hash text not null, atualizado_em timestamptz not null default now());
create table selecao.candidatos (
  id uuid primary key default gen_random_uuid(), email text not null, nome text not null,
  status text not null default 'Em Processo', confirmado boolean, sexo text, semestre text,
  data_nascimento date, telefone text, cidade text, estado text, curso text, nivel text,
  modalidade text, turno text, plano text, pacote text, valor_total numeric, valor_oferecido numeric,
  desconto_especial text, desconto numeric, proposta_situacao text, responsavel text, obs text,
  entrevista_situacao text, entrevista_formato text, com_quem text, ra text, igreja text,
  clickup_task_id text, kommo_lead_id text, kommo_contact_id text, origem text not null default 'app',
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now());
create table selecao.candidato_dados_pessoais (
  candidato_id uuid primary key references selecao.candidatos (id) on delete cascade,
  cpf text check (cpf ~ '^\d{11}$'), rg text, orgao_rg text, nacionalidade text, estado_civil text,
  profissao text, endereco text, cep text, cidade text, estado text, pais text, nome_mae text,
  tel_mae text, nome_pai text, tel_pai text, emergencia jsonb, fiador jsonb, pastor jsonb,
  atualizado_em timestamptz not null default now());
create table selecao.candidato_etapas (
  candidato_id uuid not null references selecao.candidatos (id) on delete cascade,
  etapa text not null, concluida_em timestamptz, detalhe text, origem text not null default 'app',
  registrado_em timestamptz not null default now(), primary key (candidato_id, etapa));

create function selecao.touch_atualizado_em() returns trigger language plpgsql set search_path to '' as $function$
begin new.atualizado_em := now(); return new; end $function$;
create function selecao.fmt_cep(t text) returns text language sql immutable set search_path to '' as $function$
  select case when length(x) = 8 then substr(x,1,5) || '-' || substr(x,6,3)
              else nullif(btrim(coalesce(t,'')), '') end
  from (select regexp_replace(coalesce(t,''), '\D', '', 'g') as x) s
$function$;
create function selecao.fmt_cpf(t text) returns text language sql immutable set search_path to '' as $function$
  select case when length(x) = 11
              then substr(x,1,3) || '.' || substr(x,4,3) || '.' || substr(x,7,3) || '-' || substr(x,10,2)
              else nullif(btrim(coalesce(t,'')), '') end
  from (select regexp_replace(coalesce(t,''), '\D', '', 'g') as x) s
$function$;
create function selecao.fmt_data(t text) returns text language sql immutable set search_path to '' as $function$
  select case when t ~ '^\d{4}-\d{2}-\d{2}' then to_char(substr(t,1,10)::date, 'DD/MM/YYYY')
              else nullif(btrim(coalesce(t,'')), '') end
$function$;
create function selecao.fmt_telefone(p text) returns text language sql immutable set search_path to '' as $function$
  select case
    when p ~ '^\+55\d{11}$' then '(' || substr(p,4,2) || ') ' || substr(p,6,5) || '-' || substr(p,11)
    when p ~ '^\+55\d{10}$' then '(' || substr(p,4,2) || ') ' || substr(p,6,4) || '-' || substr(p,10)
    else p end
$function$;
create function selecao.valida_segredo(p_segredo text, p_nome text default 'make') returns boolean
  language sql stable security definer set search_path to '' as $function$
  select exists (select 1 from selecao.segredos_automacao s
                  where s.nome = p_nome
                    and s.hash = encode(sha256(convert_to(coalesce(p_segredo,''), 'UTF8')), 'hex'))
$function$;

-- alunos (existing)
create table alunos.alunos (
  id uuid primary key default gen_random_uuid(),
  candidato_id uuid unique references selecao.candidatos (id) on delete set null,
  user_id uuid, ra text, nome text not null, email text not null, telefone text,
  sexo text check (sexo in ('F','M')), data_nascimento date, curso text, nivel text, modalidade text,
  turno text, plano text, semestre_ingresso text check (semestre_ingresso ~ '^\d{4}-[12]$'),
  status text not null default 'Ativo' constraint alunos_status_check
    check (status in ('Ativo','Trancado','Formado','Desistente')),
  checkin_em timestamptz, origem text not null default 'checkin',
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now());
create unique index alunos_email_uq on alunos.alunos (lower(email));
create unique index alunos_ra_uq on alunos.alunos (ra) where ra is not null;
create index alunos_user_ix on alunos.alunos (user_id) where user_id is not null;
create table alunos.dados_pessoais (
  aluno_id uuid primary key references alunos.alunos (id) on delete cascade,
  cpf text check (cpf ~ '^\d{11}$'), rg text, orgao_rg text, nacionalidade text, estado_civil text,
  profissao text, endereco text, cep text, cidade text, estado text, pais text, nome_mae text,
  tel_mae text, nome_pai text, tel_pai text, emergencia jsonb, fiador jsonb, pastor jsonb,
  atualizado_em timestamptz not null default now());
create unique index alunos_dp_cpf_uq on alunos.dados_pessoais (cpf) where cpf is not null;
create trigger trg_alunos_touch before update on alunos.alunos
  for each row execute function selecao.touch_atualizado_em();
create trigger trg_alunos_dp_touch before update on alunos.dados_pessoais
  for each row execute function selecao.touch_atualizado_em();
alter table alunos.alunos enable row level security;
alter table alunos.dados_pessoais enable row level security;
create policy alunos_leitura on alunos.alunos for select to public
  using (selecao.eh_equipe() or user_id = auth.uid());
create policy alunos_dp_leitura on alunos.dados_pessoais for select to public
  using (selecao.eh_coordenacao_ou_admin() or exists (
    select 1 from alunos.alunos a where a.id = dados_pessoais.aluno_id and a.user_id = auth.uid()));
grant select on alunos.alunos, alunos.dados_pessoais to authenticated;
grant all on alunos.alunos, alunos.dados_pessoais to service_role;

-- selecao.registrar_checkin: VERBATIM copy of the live function (must keep working).
CREATE OR REPLACE FUNCTION selecao.registrar_checkin(p_segredo text, p_kommo_lead_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  c   selecao.candidatos;
  dp  selecao.candidato_dados_pessoais;
  v_aluno uuid;
  v_ja boolean;
begin
  if not selecao.valida_segredo(p_segredo) then
    raise exception 'não autorizado' using errcode = '28000';
  end if;

  select * into c from selecao.candidatos
   where kommo_lead_id = btrim(coalesce(p_kommo_lead_id, ''))
   order by criado_em desc limit 1;
  if not found then
    return jsonb_build_object('encontrado', false);
  end if;

  select * into dp from selecao.candidato_dados_pessoais where candidato_id = c.id;
  v_ja := exists (select 1 from selecao.candidato_etapas e where e.candidato_id = c.id and e.etapa = 'checkin');

  if v_ja then
    select id into v_aluno from alunos.alunos where candidato_id = c.id;
    return jsonb_build_object('encontrado', true, 'ja_registrado', true,
      'candidato_id', c.id, 'aluno_id', v_aluno, 'nome', c.nome, 'clickup_task_id', coalesce(c.clickup_task_id, ''));
  end if;

  update selecao.candidatos set status = 'Matriculado' where id = c.id and status <> 'Desistente';

  insert into selecao.candidato_etapas (candidato_id, etapa, concluida_em, detalhe, origem)
  values (c.id, 'checkin', now(), 'Check-in (Kommo)', 'make')
  on conflict (candidato_id, etapa) do update set concluida_em = excluded.concluida_em, detalhe = excluded.detalhe;

  insert into alunos.alunos (candidato_id, ra, nome, email, telefone, sexo, data_nascimento, curso, nivel,
                             modalidade, turno, plano, semestre_ingresso, checkin_em, origem)
  values (c.id, c.ra, c.nome, c.email, c.telefone, c.sexo, c.data_nascimento, c.curso, c.nivel,
          c.modalidade, c.turno, c.plano, c.semestre, now(), 'checkin')
  on conflict (candidato_id) do update
     set ra = coalesce(excluded.ra, alunos.alunos.ra), nome = excluded.nome, email = excluded.email,
         telefone = excluded.telefone, sexo = excluded.sexo, data_nascimento = excluded.data_nascimento,
         curso = excluded.curso, nivel = excluded.nivel, modalidade = excluded.modalidade,
         turno = excluded.turno, plano = excluded.plano, semestre_ingresso = excluded.semestre_ingresso,
         checkin_em = coalesce(alunos.alunos.checkin_em, excluded.checkin_em)
  returning id into v_aluno;

  if dp.candidato_id is not null then
    insert into alunos.dados_pessoais (aluno_id, cpf, rg, orgao_rg, nacionalidade, estado_civil, profissao, endereco,
                                       cep, cidade, estado, pais, nome_mae, tel_mae, nome_pai, tel_pai,
                                       emergencia, fiador, pastor)
    values (v_aluno, dp.cpf, dp.rg, dp.orgao_rg, dp.nacionalidade, dp.estado_civil, dp.profissao, dp.endereco,
            dp.cep, dp.cidade, dp.estado, dp.pais, dp.nome_mae, dp.tel_mae, dp.nome_pai, dp.tel_pai,
            dp.emergencia, dp.fiador, dp.pastor)
    on conflict (aluno_id) do update
       set cpf = excluded.cpf, rg = excluded.rg, orgao_rg = excluded.orgao_rg, nacionalidade = excluded.nacionalidade,
           estado_civil = excluded.estado_civil, profissao = excluded.profissao, endereco = excluded.endereco,
           cep = excluded.cep, cidade = excluded.cidade, estado = excluded.estado, pais = excluded.pais,
           nome_mae = excluded.nome_mae, tel_mae = excluded.tel_mae, nome_pai = excluded.nome_pai,
           tel_pai = excluded.tel_pai, emergencia = excluded.emergencia, fiador = excluded.fiador,
           pastor = excluded.pastor;
  end if;

  return jsonb_build_object(
    'encontrado', true, 'ja_registrado', false,
    'candidato_id', c.id, 'aluno_id', v_aluno,
    'clickup_task_id', coalesce(c.clickup_task_id, ''),
    -- campos da planilha GERAL (já formatados como no Excel)
    'nome', c.nome, 'email', c.email, 'ra', coalesce(c.ra, ''),
    'sexo', coalesce(c.sexo, ''), 'data_nascimento', coalesce(selecao.fmt_data(c.data_nascimento::text), ''),
    'plano', coalesce(c.plano, ''), 'semestre', coalesce(c.semestre, ''), 'curso', coalesce(c.curso, ''),
    'nivel', coalesce(c.nivel, ''), 'modalidade', coalesce(c.modalidade, ''),
    'telefone', coalesce(selecao.fmt_telefone(c.telefone), ''),
    'cpf', coalesce(selecao.fmt_cpf(dp.cpf), ''), 'rg', coalesce(dp.rg, ''), 'orgao_rg', coalesce(dp.orgao_rg, ''),
    'nacionalidade', coalesce(dp.nacionalidade, ''), 'estado_civil', coalesce(dp.estado_civil, ''),
    'endereco', coalesce(dp.endereco, ''), 'cidade', coalesce(dp.cidade, ''), 'estado', coalesce(dp.estado, ''),
    'pais', coalesce(dp.pais, ''), 'cep', coalesce(selecao.fmt_cep(dp.cep), ''),
    'nome_mae', coalesce(dp.nome_mae, ''), 'tel_mae', coalesce(selecao.fmt_telefone(dp.tel_mae), ''),
    'nome_pai', coalesce(dp.nome_pai, ''), 'tel_pai', coalesce(selecao.fmt_telefone(dp.tel_pai), ''),
    'emergencia_nome', coalesce(dp.emergencia->>'nome', ''), 'emergencia_tel', coalesce(selecao.fmt_telefone(dp.emergencia->>'telefone'), ''),
    'emergencia_relacao', coalesce(dp.emergencia->>'relacao', ''),
    'pastor_nome', coalesce(dp.pastor->>'nome', ''), 'pastor_tel', coalesce(selecao.fmt_telefone(dp.pastor->>'telefone'), '')
  );
end $function$;

grant execute on function selecao.registrar_checkin(text, text) to anon, authenticated, service_role;
