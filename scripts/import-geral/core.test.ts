// Unit tests with FAKE data only. Run: npm run test:import
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  conferirComBanco, cepDe, cpfDe, cpfValido, dataISO, h12, normalizarNome, planejar, similaridade, telefoneE164, texto,
  type ChavesBanco, type Fontes, type Linha,
} from './core.ts'

// valid fake CPF generator (check digits computed), so tests never use anybody's real number
function cpfFake(base9: string): string {
  const dv = (s: string) => {
    let soma = 0
    for (let i = 0; i < s.length; i++) soma += Number(s[i]) * (s.length + 1 - i)
    const r = (soma * 10) % 11
    return r === 10 ? 0 : r
  }
  const d1 = dv(base9)
  return base9 + d1 + dv(base9 + d1)
}

test('normalizers', () => {
  assert.equal(texto('  a   b '), 'a b')
  assert.equal(texto('-'), null)
  assert.equal(texto('#N/A'), null)
  assert.equal(texto(null), null)
  assert.equal(texto('---'), null)
  assert.equal(texto(' – '), null)
  assert.equal(texto('a-b'), 'a-b')
  assert.ok(similaridade('maria da silva', 'maria da sylva') > 0.9)
  assert.ok(similaridade('maria da silva', 'joao pereira') < 0.5)
  assert.equal(normalizarNome('  José  da Conceição-Silva '), 'jose da conceicao silva')
  assert.equal(cpfDe(1234567890), '01234567890') // Excel dropped the leading zero
  assert.equal(cpfDe('123.456.789-09'), '12345678909')
  assert.equal(cepDe(5508000), '05508000')
  assert.equal(dataISO(new Date('2004-01-19T00:00:00Z')), '2004-01-19')
  assert.equal(dataISO('2004-01-19'), null)
})

test('CPF check digits', () => {
  assert.equal(cpfValido(cpfFake('123456789')), true)
  assert.equal(cpfValido('11111111111'), false)
  assert.equal(cpfValido('12345678900'), false)
  assert.equal(cpfValido('123'), false)
})

test('phones become +55 numbers; foreign numbers keep their digits', () => {
  assert.deepEqual(telefoneE164('(44) 99143-4545'), { valor: '+5544991434545', ok: true })
  assert.deepEqual(telefoneE164('(44) 9143-4545'), { valor: '+554491434545', ok: true })
  assert.deepEqual(telefoneE164(44991434545), { valor: '+5544991434545', ok: true })
  assert.deepEqual(telefoneE164('+32 470 12 34 56'), { valor: '+32470123456', ok: true })
  assert.deepEqual(telefoneE164('5544991434545'), { valor: '+5544991434545', ok: true })
  assert.equal(telefoneE164('12345').ok, false)
  assert.deepEqual(telefoneE164(null), { valor: null, ok: true })
})

function aluno(n: number, extra: Linha = {}): Linha {
  return {
    'NOME COMPLETO': `Aluno${n} Teste Silva`, STATUS: 'Matriculado(a)', RA: `RA${n}`, SEXO: 'F',
    'NASC.': new Date('2003-05-10T00:00:00Z'), CICLO: 'Básico', PLANO: 'Completo', TURMA: '2024-1',
    'INÍCIO': new Date('2024-01-01T00:00:00Z'), 'CONCLUSÃO': null, CURSO: 'Psicologia', 'NÍVEL': 'Graduação',
    MODALIDADE: 'Presencial', TURNO: 'Noturno', CASA: 'Casa Amarela', COLABORADOR: 'N', CPF: cpfFake(String(100000000 + n)),
    'E-MAIL': `aluno${n}@exemplo.test`, CELULAR: '(44) 99999-0000', WHATSAPP: '(44) 99999-0000', 'TEL. RES.': '-',
    LOGRADOURO: 'Rua Teste 10', CEP: 5508000, CIDADE: 'Maringá', ESTADO: 'PR', 'PAÍS': 'Brasil',
    'NOME MÃE': 'Mãe Teste', 'TEL. MÃE': '(44) 98888-0000', EMERGÊNCIA: 'Contato Teste', 'TEL. EMERG.': '(44) 97777-0000',
    'REL. EMERG.': 'Tia', 'CONT. PREF.': 'Mãe', 'IGREJA ANTERIOR': 'Igreja A', 'IGREJA ATUAL': null,
    'RESP. ACAD.': 'Mãe', 'NOME RESP. ACAD.': 'Mãe Teste', 'TEL. RESP. ACAD.': '(44) 98888-0000',
    NOME: `Aluno${n} Silva`, FOTO: 'https://exemplo.test/foto.jpg', ...extra,
  }
}
const fontes = (g: Linha[], sem: Linha[] = [], cic: Linha[] = [], sau: Linha[] = []): Fontes => ({
  geral: g.map((dados, i) => ({ linha: i + 2, dados })), semestres: sem.map((dados, i) => ({ linha: i + 9, dados })),
  ciclos: cic.map((dados, i) => ({ linha: i + 2, dados })), saude: sau.map((dados, i) => ({ linha: i + 2, dados })),
})
const codigos = (r: { problemas: { codigo: string; severidade: string }[] }, sev?: string) =>
  r.problemas.filter((p) => !sev || p.severidade === sev).map((p) => p.codigo)

test('a clean row is planned without errors', () => {
  const r = planejar(fontes([aluno(1)]), new Date('2026-11-04T00:00:00Z'))
  assert.equal(r.planos.length, 1)
  assert.deepEqual(codigos(r, 'erro'), [])
  const p = r.planos[0]
  assert.equal(p.aluno.status, 'Ativo')
  assert.equal(p.aluno.origem, 'planilha')
  assert.equal(p.aluno.telefone, '+5544999990000')
  assert.equal(p.aluno.tel_residencial, null) // "-" means empty
  assert.equal(p.aluno.semestre_ingresso, '2024-1')
  assert.equal(p.dadosPessoais.cep, '05508000')
  assert.deepEqual(p.dadosPessoais.emergencia, { nome: 'Contato Teste', telefone: '+5544977770000', relacao: 'Tia' })
  assert.deepEqual(p.dadosPessoais.responsavel_academico, { relacao: 'Mãe', nome: 'Mãe Teste', telefone: '+5544988880000' })
  assert.deepEqual(p.igreja, { igreja_anterior: 'Igreja A', igreja_atual: null })
  assert.equal(p.dadosPessoais.pastor, null)
})

test('status wording maps to the database values', () => {
  const casos: [string, string][] = [['Matriculado(a)', 'Ativo'], ['Mat. Trancada', 'Trancado'], ['Formado(a)', 'Formado'], ['Desistência', 'Desistente'], ['Desativado(a)', 'Desativado']]
  for (const [de, para] of casos) {
    const r = planejar(fontes([aluno(1, { STATUS: de, 'CONCLUSÃO': new Date('2025-12-01T00:00:00Z') })]))
    assert.equal(r.planos[0].aluno.status, para)
  }
  assert.ok(codigos(planejar(fontes([aluno(1, { STATUS: 'Outro' })])), 'erro').includes('status_desconhecido'))
})

test('blocking problems are reported with row and RA, never names', () => {
  const r = planejar(fontes([
    aluno(1), aluno(2, { 'E-MAIL': 'ALUNO1@exemplo.test ', RA: 'RA1' }), aluno(3, { CPF: '12345678900', CASA: 'Casa X', PLANO: 'VIP', SEXO: 'X', 'E-MAIL': 'sem-arroba' }),
    aluno(4, { TURMA: '2024', CPF: null }),
  ]))
  const erros = codigos(r, 'erro')
  for (const c of ['email_duplicado', 'ra_duplicado', 'casa_desconhecida', 'plano_desconhecido', 'sexo_invalido', 'email_invalido', 'turma_invalida']) assert.ok(erros.includes(c), c)
  assert.ok(codigos(r, 'aviso').includes('cpf_digito_verificador'))
  assert.ok(codigos(r, 'aviso').includes('cpf_vazio'))
  const dup = r.problemas.find((p) => p.codigo === 'email_duplicado')!
  assert.equal(dup.linha, 3)
  assert.equal(dup.ra, 'RA1')
  assert.ok(!JSON.stringify(r.problemas).includes('Teste Silva'))
})

test('a missing mandatory column stops the plan', () => {
  const l = aluno(1); delete (l as Linha)['RA']
  const r = planejar(fontes([l]))
  assert.deepEqual(codigos(r), ['coluna_ausente'])
  assert.equal(r.planos.length, 0)
})

test('semesters, cycles and health are joined and mapped', () => {
  const r = planejar(fontes(
    [aluno(1), aluno(2)],
    [
      { SEMESTRE: '2024-1', ALUNO: 'Aluno1 Silva', CICLO: 'Básico', 'CENÁRIO': 'Universidade', PLANOS: 'Completo', 'ALIMENTAÇÃO': 'S', MORADIA: 'S', ACADEMIA: 'N' },
      { SEMESTRE: '2024-2', ALUNO: 'aluno1 silva', CICLO: 'Básico', 'CENÁRIO': 'Mercado de Trabalho', PLANOS: 'Completo', 'ALIMENTAÇÃO': 'S', MORADIA: 'S', ACADEMIA: 'S' },
      { SEMESTRE: '2025-1', ALUNO: 'Aluno1 Silva', CICLO: 'Avançado', 'CENÁRIO': 'Gestão de Carreira', PLANOS: 'Curso', 'ALIMENTAÇÃO': 'N', MORADIA: 'N', ACADEMIA: 'N' },
      { SEMESTRE: '2025-2', ALUNO: 'Aluno1 Silva', CICLO: 'Carreira', 'CENÁRIO': 'Carreira', PLANOS: 'Equipe', 'ALIMENTAÇÃO': 'N', MORADIA: 'N', ACADEMIA: 'N' },
      { SEMESTRE: '2025-2', ALUNO: 'Aluno1 Silva', CICLO: 'Carreira', 'CENÁRIO': 'Carreira', PLANOS: 'Equipe', 'ALIMENTAÇÃO': 'N', MORADIA: 'N', ACADEMIA: 'N' },
      { SEMESTRE: '2025-2', ALUNO: 'Fantasma', CICLO: 'Básico', 'CENÁRIO': 'Universidade', PLANOS: 'Completo', 'ALIMENTAÇÃO': 'S', MORADIA: 'S', ACADEMIA: 'S' },
    ],
    [{ NOME: 'Aluno1 Silva', STATUS: 'Matriculado(a)', 'BÁSICO': 'Completo', 'AVANÇADO': 'Cursando', CARREIRA: null }],
    [{ 'NOME COMPLETO': 'Aluno2 Teste Silva', 'TIPO SANGUÍNEO': 'O+', 'PLANO DE SAÚDE': 'SUS', ALERGIA: 'Não', ENFERMIDADES: '-' },
     { 'NOME COMPLETO': 'Aluno9 Teste Silva', 'TIPO SANGUÍNEO': 'X+' }],
  ))
  const a1 = r.planos[0], a2 = r.planos[1]
  assert.deepEqual(a1.matriculas.map((m) => [m.semestre, m.modulo_ordem]), [['2024-1', 1], ['2024-2', 2], ['2025-1', 2], ['2025-2', null]])
  assert.equal(a1.matriculas[0].alimentacao, 'S')
  assert.deepEqual(a1.cicloStatus, [{ ciclo: 'Básico', status: 'Completo' }, { ciclo: 'Avançado', status: 'Cursando' }])
  assert.deepEqual(a2.saude, { plano_saude: 'SUS', tipo_sanguineo: 'O+', limitacoes_medicas: null, medicamento_continuo: null, alergia: 'Não', restricao_alimentar: null, enfermidades: null })
  assert.equal(a1.saude, null)
  const erros = codigos(r, 'erro')
  assert.ok(codigos(r, 'aviso').includes('matricula_duplicada_descartada'))
  assert.ok(erros.includes('semestres_sem_ficha'))
  assert.ok(erros.includes('saude_sem_ficha'))
  assert.deepEqual(r.semestres, ['2024-1', '2024-2', '2025-1', '2025-2'])
})

test('cross-check with hashed database keys', () => {
  const fs = fontes([aluno(1), aluno(2), aluno(3), aluno(4), aluno(5)])
  const r = planejar(fs)
  const k = (n: number) => r.planos[n - 1].chaves
  const h = (n: number) => ({ email_h: h12(k(n).email), ra_h: h12(k(n).ra), cpf_h: h12(k(n).cpf!) })
  const chaves: ChavesBanco = {
    candidatos: [
      { id: 'c1', ...h(1) }, // student 1: everything matches
      { id: 'c2', email_h: h(2).email_h, ra_h: h12('OUTRO'), cpf_h: null }, // student 2: only e-mail matches
      { id: 'c3a', email_h: h(3).email_h, ra_h: null, cpf_h: null }, { id: 'c3b', email_h: null, ra_h: h(3).ra_h, cpf_h: null }, // student 3: two different candidates
    ],
    alunos: [{ ...h(4) }],
    allowed_users: [{ email_h: h(1).email_h, papel: 'aluno' }, { email_h: h(5).email_h, papel: 'equipe' }, { email_h: h12('sem-ficha@exemplo.test'), papel: 'aluno' }],
  }
  const c = conferirComBanco(r.planos, chaves)
  assert.equal(c.candidatoUnico, 2)
  assert.equal(c.candidatoUnicoChavesDivergentes, 1) // student 2: same e-mail, but the candidate has ANOTHER RA
  assert.ok(c.problemas.some((p) => p.codigo === 'candidato_com_chave_divergente' && p.detalhe === 'divergem: RA'))
  assert.equal(c.conflitoEntreCandidatos, 1)
  assert.equal(c.semCandidato, 2)
  assert.equal(c.jaExisteEmAlunos, 1)
  assert.equal(c.comLoginAluno, 1)
  assert.equal(c.comLoginEquipe, 1)
  assert.equal(c.loginsAlunoSemFicha, 1)
  assert.ok(c.problemas.some((p) => p.codigo === 'chaves_apontam_para_candidatos_diferentes' && p.ra === 'RA3'))
  assert.ok(!JSON.stringify(c).includes('aluno1@exemplo.test'))
})

test('one candidate linked to two students is an error', () => {
  const r = planejar(fontes([aluno(1), aluno(2, { 'E-MAIL': 'outro@exemplo.test', CPF: cpfFake('200000002'), RA: 'RA9' })]))
  const alvo = r.planos[0].chaves
  const chaves: ChavesBanco = {
    candidatos: [{ id: 'c1', email_h: h12(alvo.email), ra_h: h12(r.planos[1].chaves.ra), cpf_h: null }],
    alunos: [], allowed_users: [],
  }
  // e-mail points to c1 for student 1, RA points to c1 for student 2 -> same candidate twice
  const c = conferirComBanco(r.planos, chaves)
  assert.equal(c.candidatoCompartilhado, 1)
  assert.ok(c.problemas.some((p) => p.codigo === 'candidato_ligado_a_varios_alunos'))
})

test('a missing RA is allowed (the database index is partial), but flagged', () => {
  const r = planejar(fontes([aluno(1, { RA: '-' }), aluno(2, { RA: '---' })]))
  assert.deepEqual(codigos(r, 'erro'), [])
  assert.equal(codigos(r, 'aviso').filter((c) => c === 'ra_ausente').length, 2)
  assert.equal(codigos(r).includes('ra_duplicado'), false)
})

test('a typo between tabs is matched only when the near-match is clear, and is reported', () => {
  const r = planejar(fontes(
    [aluno(1), aluno(2)],
    [{ SEMESTRE: '2024-1', ALUNO: 'Aluno1 Silvva', CICLO: 'Básico', 'CENÁRIO': 'Universidade', PLANOS: 'Completo', 'ALIMENTAÇÃO': 'S', MORADIA: 'S', ACADEMIA: 'S' },
     { SEMESTRE: '2024-1', ALUNO: 'Completamente Outro', CICLO: 'Básico', 'CENÁRIO': 'Universidade', PLANOS: 'Completo', 'ALIMENTAÇÃO': 'S', MORADIA: 'S', ACADEMIA: 'S' }],
  ))
  assert.equal(r.planos[0].matriculas.length, 1)
  assert.ok(r.problemas.some((p) => p.codigo === 'nome_aproximado' && p.ra === 'RA1'))
  assert.ok(codigos(r, 'erro').includes('semestres_sem_ficha'))
})

test('two cycles in the same semester: one enrolment is kept (the later cycle) and the other is reported', () => {
  const r = planejar(fontes([aluno(1)], [
    { SEMESTRE: '2022-1', ALUNO: 'Aluno1 Silva', CICLO: 'Avançado', 'CENÁRIO': 'Gestão de Projetos', PLANOS: 'Completo', 'ALIMENTAÇÃO': 'S', MORADIA: 'S', ACADEMIA: 'S' },
    { SEMESTRE: '2022-1', ALUNO: 'Aluno1 Silva', CICLO: 'Básico', 'CENÁRIO': 'Universidade', PLANOS: 'Completo', 'ALIMENTAÇÃO': 'S', MORADIA: 'S', ACADEMIA: 'S' },
  ]))
  assert.equal(r.planos[0].matriculas.length, 1)
  assert.equal(r.planos[0].matriculas[0].ciclo, 'Avançado')
  assert.deepEqual(codigos(r, 'erro'), [])
  assert.ok(r.problemas.some((p) => p.codigo === 'matricula_duplicada_descartada' && p.detalhe?.includes('descartado Básico')))
  // and the other order gives the same result
  const r2 = planejar(fontes([aluno(1)], [
    { SEMESTRE: '2022-1', ALUNO: 'Aluno1 Silva', CICLO: 'Básico', 'CENÁRIO': 'Universidade', PLANOS: 'Completo', 'ALIMENTAÇÃO': 'S', MORADIA: 'S', ACADEMIA: 'S' },
    { SEMESTRE: '2022-1', ALUNO: 'Aluno1 Silva', CICLO: 'Avançado', 'CENÁRIO': 'Gestão de Projetos', PLANOS: 'Completo', 'ALIMENTAÇÃO': 'S', MORADIA: 'S', ACADEMIA: 'S' },
  ]))
  assert.equal(r2.planos[0].matriculas[0].ciclo, 'Avançado')
})
