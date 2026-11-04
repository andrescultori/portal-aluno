// Generates the ONE-TIME import SQL from the planned rows. The output holds personal data, so the CLI only writes it
// OUTSIDE the repository. Design:
//   * a single DO block = a single transaction: any problem rolls everything back;
//   * INSERT ... ON CONFLICT DO NOTHING everywhere: it NEVER overwrites a row that already exists, so re-running adds nothing;
//   * explicit guards (objects exist, no candidate shared by two students) and final counts that must match the plan;
//   * the status history gets the reason "Importação da LISTA GERAL" instead of the generic one.
import type { PlanoAluno } from './core.ts'

export interface OpcoesSql {
  vincularCandidatos: boolean
  geradoEm?: string
}

export function gerarSql(planos: PlanoAluno[], semestres: string[], opcoes: OpcoesSql): string {
  const dados = {
    versao: 1,
    semestres,
    totais: {
      alunos: planos.length,
      dados_pessoais: planos.length,
      igreja: planos.filter((p) => p.igreja).length,
      saude: planos.filter((p) => p.saude).length,
      matriculas: planos.reduce((n, p) => n + p.matriculas.length, 0),
      ciclo_status: planos.reduce((n, p) => n + p.cicloStatus.length, 0),
    },
    alunos: planos.map((p) => ({
      aluno: p.aluno, dp: p.dadosPessoais, igreja: p.igreja, saude: p.saude, matriculas: p.matriculas, ciclos: p.cicloStatus,
    })),
  }
  const json = JSON.stringify(dados)
  if (json.includes('$json$') || json.includes('$import$')) throw new Error('Os dados contêm um delimitador reservado ($json$ / $import$).')

  return `-- ============================================================================================
-- IMPORTAÇÃO ÚNICA DA LISTA GERAL — gerado ${opcoes.geradoEm ?? new Date().toISOString()}
-- CONTÉM DADOS PESSOAIS DE ALUNOS: não envie por e-mail/chat, não coloque em repositório, apague depois de usar.
--
-- Como usar: cole TUDO no SQL Editor do Supabase (projeto de produção) e execute UMA vez.
--   * É uma transação só: se algo falhar, NADA é gravado e a mensagem diz o motivo.
--   * Nunca altera linhas que já existem (ON CONFLICT DO NOTHING): rodar de novo não duplica nem sobrescreve nada.
--   * O resultado final é uma tabela de contagens; compare com a coluna "esperado".
--   * Não toca em selecao.*, propostas.*, registrar_checkin nem em cenários do Make.
-- ============================================================================================
do $import$
declare
  -- true  = liga cada aluno ao seu candidato (selecao.candidatos) pelo e-mail/RA/CPF: o check-in do Make não quebra,
  --         mas, se rodar para esse candidato, sobrescreve dados do aluno (risco R1, veja docs/import-geral.md).
  -- false = não liga: o check-in desse candidato falharia por e-mail duplicado.
  v_vincular boolean := ${opcoes.vincularCandidatos ? 'true' : 'false'};
  v_dados jsonb := $json$${json}$json$::jsonb;
  v_total int := jsonb_array_length(v_dados->'alunos');
  v_n int;
  v_exp int;
begin
  -- 0. guardas -----------------------------------------------------------------------------------
  if to_regclass('alunos.matriculas') is null or to_regclass('alunos.ciclo_status') is null
     or to_regclass('alunos.aluno_saude') is null or to_regclass('alunos.aluno_igreja') is null
     or to_regclass('alunos.semestres') is null or to_regclass('selecao.candidatos') is null then
    raise exception 'Faltam tabelas esperadas: as migrações do módulo de alunos não foram aplicadas.';
  end if;
  if exists (select 1 from alunos.casas where nome = 'Casa Amarela') is not true then
    raise exception 'A tabela alunos.casas não tem as casas esperadas.';
  end if;
  perform set_config('app.status_reason', 'Importação da LISTA GERAL', true);

  -- 1. semestres ---------------------------------------------------------------------------------
  insert into alunos.semestres (codigo)
  select jsonb_array_elements_text(v_dados->'semestres')
  on conflict (codigo) do nothing;

  -- 2. dados em tabelas temporárias --------------------------------------------------------------
  create temp table _a on commit drop as
  select e.ord::int as idx, e.val as j from jsonb_array_elements(v_dados->'alunos') with ordinality as e(val, ord);

  -- candidatos: por e-mail, RA ou CPF; precisa ser no máximo 1 por aluno e 1 aluno por candidato
  create temp table _cand on commit drop as
  select a.idx,
         (select array_agg(distinct c.id)
            from selecao.candidatos c
           where lower(btrim(c.email)) = a.j->'aluno'->>'email'
              or (nullif(a.j->'aluno'->>'ra', '') is not null and btrim(c.ra) = a.j->'aluno'->>'ra')
              or (nullif(a.j->'dp'->>'cpf', '') is not null and exists (
                    select 1 from selecao.candidato_dados_pessoais d
                     where d.candidato_id = c.id
                       and regexp_replace(coalesce(d.cpf, ''), '\\D', '', 'g') = a.j->'dp'->>'cpf'))) as ids
    from _a a;
  if exists (select 1 from _cand where coalesce(array_length(ids, 1), 0) > 1) then
    raise exception 'Conflito: as chaves (e-mail/RA/CPF) de um aluno apontam para candidatos diferentes. Nada foi gravado.';
  end if;
  if exists (select 1 from _cand where ids is not null group by ids[1] having count(*) > 1) then
    raise exception 'Conflito: o mesmo candidato corresponde a mais de um aluno da planilha. Nada foi gravado.';
  end if;
  if v_vincular and exists (
       select 1 from _cand c join alunos.alunos x on x.candidato_id = c.ids[1]
        where lower(x.email) <> (select a.j->'aluno'->>'email' from _a a where a.idx = c.idx)) then
    raise exception 'Conflito: um candidato já está ligado a outro aluno em alunos.alunos. Nada foi gravado.';
  end if;

  -- 3. alunos ------------------------------------------------------------------------------------
  insert into alunos.alunos (candidato_id, ra, nome, nome_exibicao, email, telefone, sexo, data_nascimento, curso, nivel,
                             modalidade, turno, plano, semestre_ingresso, status, casa_id, colaborador, inicio, conclusao,
                             obs, celular, whatsapp, tel_residencial, foto_origem, origem)
  select case when v_vincular then c.ids[1] end,
         nullif(a.j->'aluno'->>'ra', ''), a.j->'aluno'->>'nome', a.j->'aluno'->>'nome_exibicao', a.j->'aluno'->>'email',
         a.j->'aluno'->>'telefone', a.j->'aluno'->>'sexo', (a.j->'aluno'->>'data_nascimento')::date,
         a.j->'aluno'->>'curso', a.j->'aluno'->>'nivel', a.j->'aluno'->>'modalidade', a.j->'aluno'->>'turno',
         a.j->'aluno'->>'plano', a.j->'aluno'->>'semestre_ingresso', a.j->'aluno'->>'status',
         (select ca.id from alunos.casas ca where ca.nome = a.j->'aluno'->>'casa'),
         coalesce((a.j->'aluno'->>'colaborador')::boolean, false),
         (a.j->'aluno'->>'inicio')::date, (a.j->'aluno'->>'conclusao')::date, a.j->'aluno'->>'obs',
         a.j->'aluno'->>'celular', a.j->'aluno'->>'whatsapp', a.j->'aluno'->>'tel_residencial',
         a.j->'aluno'->>'foto_origem', 'planilha'
    from _a a join _cand c using (idx)
  on conflict ((lower(email))) do nothing;
  get diagnostics v_n = row_count;
  raise notice 'alunos novos: % de %', v_n, v_total;

  create temp table _ids on commit drop as
  select a.idx, x.id as aluno_id
    from _a a join alunos.alunos x on lower(x.email) = a.j->'aluno'->>'email';
  select count(*) into v_n from _ids;
  if v_n <> v_total then raise exception 'Esperava % alunos e encontrei %. Nada foi gravado.', v_total, v_n; end if;
  if exists (select 1 from _a a where a.j->'aluno'->>'casa' is not null
               and not exists (select 1 from alunos.casas ca where ca.nome = a.j->'aluno'->>'casa')) then
    raise exception 'Há uma casa desconhecida na planilha. Nada foi gravado.';
  end if;

  -- 4. dados pessoais, igreja, saúde ------------------------------------------------------------
  insert into alunos.dados_pessoais (aluno_id, cpf, rg, orgao_rg, nacionalidade, estado_civil, endereco, complemento, bairro,
                                     cep, cidade, estado, pais, nome_mae, tel_mae, nome_pai, tel_pai, emergencia, pastor,
                                     responsavel_academico, contato_preferido)
  select i.aluno_id, nullif(a.j->'dp'->>'cpf', ''), a.j->'dp'->>'rg', a.j->'dp'->>'orgao_rg', a.j->'dp'->>'nacionalidade',
         a.j->'dp'->>'estado_civil', a.j->'dp'->>'endereco', a.j->'dp'->>'complemento', a.j->'dp'->>'bairro',
         a.j->'dp'->>'cep', a.j->'dp'->>'cidade', a.j->'dp'->>'estado', a.j->'dp'->>'pais', a.j->'dp'->>'nome_mae',
         a.j->'dp'->>'tel_mae', a.j->'dp'->>'nome_pai', a.j->'dp'->>'tel_pai',
         nullif(a.j->'dp'->'emergencia', 'null'::jsonb), nullif(a.j->'dp'->'pastor', 'null'::jsonb),
         nullif(a.j->'dp'->'responsavel_academico', 'null'::jsonb), a.j->'dp'->>'contato_preferido'
    from _a a join _ids i using (idx)
  on conflict (aluno_id) do nothing;

  insert into alunos.aluno_igreja (aluno_id, igreja_anterior, igreja_atual)
  select i.aluno_id, a.j->'igreja'->>'igreja_anterior', a.j->'igreja'->>'igreja_atual'
    from _a a join _ids i using (idx)
   where jsonb_typeof(a.j->'igreja') = 'object'
  on conflict (aluno_id) do nothing;

  insert into alunos.aluno_saude (aluno_id, plano_saude, tipo_sanguineo, limitacoes_medicas, medicamento_continuo, alergia,
                                  restricao_alimentar, enfermidades)
  select i.aluno_id, a.j->'saude'->>'plano_saude', a.j->'saude'->>'tipo_sanguineo', a.j->'saude'->>'limitacoes_medicas',
         a.j->'saude'->>'medicamento_continuo', a.j->'saude'->>'alergia', a.j->'saude'->>'restricao_alimentar',
         a.j->'saude'->>'enfermidades'
    from _a a join _ids i using (idx)
   where jsonb_typeof(a.j->'saude') = 'object'
  on conflict (aluno_id) do nothing;

  -- 5. matrículas e status dos ciclos -----------------------------------------------------------
  insert into alunos.matriculas (aluno_id, semestre_id, ciclo_id, modulo_id, cenario, plano, alimentacao, moradia, academia)
  select i.aluno_id, s.id, c.id, md.id, nullif(m->>'cenario', ''), nullif(btrim(m->>'plano'), ''),
         nullif(m->>'alimentacao', ''), nullif(m->>'moradia', ''), nullif(m->>'academia', '')
    from _a a
    join _ids i using (idx)
    cross join lateral jsonb_array_elements(a.j->'matriculas') m
    join alunos.semestres s on s.codigo = m->>'semestre'
    join alunos.ciclos c on c.nome = m->>'ciclo'
    left join alunos.modulos md on md.ciclo_id = c.id and md.ordem = (m->>'modulo_ordem')::int
  on conflict (aluno_id, semestre_id) do nothing;

  insert into alunos.ciclo_status (aluno_id, ciclo_id, status)
  select i.aluno_id, c.id, k->>'status'
    from _a a
    join _ids i using (idx)
    cross join lateral jsonb_array_elements(a.j->'ciclos') k
    join alunos.ciclos c on c.nome = k->>'ciclo'
  on conflict (aluno_id, ciclo_id) do nothing;

  -- 6. conferência final: as contagens têm que bater com o plano --------------------------------
  for v_n, v_exp in
    select (select count(*) from alunos.dados_pessoais d join _ids i on i.aluno_id = d.aluno_id), (v_dados->'totais'->>'dados_pessoais')::int
    union all select (select count(*) from alunos.aluno_igreja d join _ids i on i.aluno_id = d.aluno_id), (v_dados->'totais'->>'igreja')::int
    union all select (select count(*) from alunos.aluno_saude d join _ids i on i.aluno_id = d.aluno_id), (v_dados->'totais'->>'saude')::int
    union all select (select count(*) from alunos.matriculas d join _ids i on i.aluno_id = d.aluno_id
                       where d.semestre_id in (select s.id from alunos.semestres s where s.codigo in (select jsonb_array_elements_text(v_dados->'semestres')))),
                     (v_dados->'totais'->>'matriculas')::int
    union all select (select count(*) from alunos.ciclo_status d join _ids i on i.aluno_id = d.aluno_id), (v_dados->'totais'->>'ciclo_status')::int
  loop
    if v_n < v_exp then raise exception 'Contagem abaixo do esperado (% de %). Nada foi gravado.', v_n, v_exp; end if;
  end loop;
end
$import$;

-- Resultado: contagens das linhas vindas da planilha.
select 'alunos (origem planilha)' as tabela, count(*)::int as encontrado, ${planos.length} as esperado
  from alunos.alunos where origem = 'planilha'
union all select 'alunos ligados a um candidato', count(candidato_id)::int, null from alunos.alunos where origem = 'planilha'
union all select 'dados_pessoais', count(*)::int, ${planos.length} from alunos.dados_pessoais d join alunos.alunos a on a.id = d.aluno_id where a.origem = 'planilha'
union all select 'aluno_igreja', count(*)::int, ${planos.filter((p) => p.igreja).length} from alunos.aluno_igreja d join alunos.alunos a on a.id = d.aluno_id where a.origem = 'planilha'
union all select 'aluno_saude', count(*)::int, ${planos.filter((p) => p.saude).length} from alunos.aluno_saude d join alunos.alunos a on a.id = d.aluno_id where a.origem = 'planilha'
union all select 'matriculas', count(*)::int, ${planos.reduce((n, p) => n + p.matriculas.length, 0)} from alunos.matriculas d join alunos.alunos a on a.id = d.aluno_id where a.origem = 'planilha'
union all select 'ciclo_status', count(*)::int, ${planos.reduce((n, p) => n + p.cicloStatus.length, 0)} from alunos.ciclo_status d join alunos.alunos a on a.id = d.aluno_id where a.origem = 'planilha'
union all select 'alunos com histórico de status "Importação da LISTA GERAL"', count(distinct h.aluno_id)::int, ${planos.length} from alunos.aluno_status_historico h join alunos.alunos a on a.id = h.aluno_id where a.origem = 'planilha' and h.motivo = 'Importação da LISTA GERAL';
`
}
