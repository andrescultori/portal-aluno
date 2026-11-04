// Pure logic of the "LISTA GERAL" import: spreadsheet rows in, planned database rows + issues out.
// No I/O and no database access here, so it can be unit-tested with fake data.
// The data itself NEVER lives in the repository: the CLI reads the spreadsheet from outside it.
import { createHash } from 'node:crypto'

export type Cell = string | number | boolean | Date | null | undefined
export type Linha = Record<string, Cell>

export type Severidade = 'erro' | 'aviso' | 'info'
export interface Problema {
  severidade: Severidade
  codigo: string
  aba: string
  linha: number // spreadsheet row (1-based)
  ra?: string
  campo?: string
  detalhe?: string
}

// ------------------------------------------------------------------ vocabulary (must match the migrations)
export const CASAS = ['Casa Amarela', 'Casa Meninos', 'Casa de Madeira', 'Apt. Salinas', 'FORA']
export const PLANOS = ['Completo', 'Curso', 'Convênio', 'Alimentação', 'Moradia', 'Equipe']
export const CICLOS = ['Básico', 'Avançado', 'Carreira', 'Convênio']
export const STATUS_CICLO = ['Completo', 'Incompleto', 'Cursando', 'Não cursou']
export const TIPOS_SANGUINEOS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const ORDEM_CICLO = ['Básico', 'Avançado', 'Carreira', 'Convênio']
const MODULOS: Record<string, Record<string, number>> = {
  Básico: { Universidade: 1, 'Mercado de Trabalho': 2, 'Missões Urbanas': 3, 'Missões Transculturais': 4 },
  Avançado: { 'Gestão de Projetos': 1, 'Gestão de Carreira': 2 },
}
// spreadsheet wording -> alunos.alunos.status
export const STATUS_MAP: Record<string, string> = {
  'Matriculado(a)': 'Ativo',
  'Mat. Trancada': 'Trancado',
  'Formado(a)': 'Formado',
  'Desistência': 'Desistente',
  'Desativado(a)': 'Desativado',
}

// ------------------------------------------------------------------ normalizers
export function texto(v: Cell): string | null {
  if (v === null || v === undefined) return null
  const s = (v instanceof Date ? '' : String(v)).replace(/\s+/g, ' ').trim()
  if (s === '' || /^[-–—_.\s]+$/.test(s) || /^#(N\/A|VALUE!|REF!|NAME\?|DIV\/0!)$/i.test(s)) return null
  return s
}
export const ehErroDeFormula = (v: Cell) => typeof v === 'string' && /^#(N\/A|VALUE!|REF!|NAME\?|DIV\/0!)$/i.test(v.trim())

export const soDigitos = (v: Cell) => (v === null || v === undefined ? '' : String(v).replace(/\D/g, ''))

export function normalizarNome(s: string | null): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
export const normalizarEmail = (v: Cell) => (texto(v) ?? '').toLowerCase()
export const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

// Excel turns "01234567890" into 1234567890: restore the leading zeros.
export function cpfDe(v: Cell): string | null {
  const d = soDigitos(v)
  if (!d) return null
  return d.length < 11 ? d.padStart(11, '0') : d
}
export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false
  const dv = (n: number) => {
    let soma = 0
    for (let i = 0; i < n; i++) soma += Number(cpf[i]) * (n + 1 - i)
    const r = (soma * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(cpf[9]) && dv(10) === Number(cpf[10])
}
export function cepDe(v: Cell): string | null {
  const d = soDigitos(v)
  if (!d) return null
  return d.length < 8 ? d.padStart(8, '0') : d
}
// Brazilian numbers become "+55DDNNNNNNNNN" (the format the check-in already stores); "+" numbers keep their digits.
export function telefoneE164(v: Cell): { valor: string | null; ok: boolean } {
  const bruto = texto(v)
  if (!bruto) return { valor: null, ok: true }
  const d = soDigitos(bruto)
  if (bruto.startsWith('+')) return { valor: `+${d}`, ok: d.length >= 8 && d.length <= 15 }
  if (d.length === 10 || d.length === 11) return { valor: `+55${d}`, ok: true }
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return { valor: `+${d}`, ok: true }
  return { valor: bruto, ok: false }
}
// Excel dates arrive as Date at 00:00 UTC.
export function dataISO(v: Cell): string | null {
  return v instanceof Date && !Number.isNaN(v.getTime()) ? v.toISOString().slice(0, 10) : null
}
const semestreDeData = (iso: string) => `${iso.slice(0, 4)}-${Number(iso.slice(5, 7)) <= 6 ? 1 : 2}`
export const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')
// The database side sends only the first 12 hex digits of each hash (48 bits: no realistic collisions here).
export const h12 = (s: string) => sha256(s).slice(0, 12)

export function similaridade(a: string, b: string): number {
  if (a === b) return 1
  if (!a || !b) return 0
  const m = a.length, n = b.length
  let anterior = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const atual = [i]
    for (let j = 1; j <= n; j++) atual[j] = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    anterior = atual
  }
  return 1 - anterior[n] / Math.max(m, n)
}

// ------------------------------------------------------------------ planned rows
export interface PlanoAluno {
  linha: number
  ra: string
  chaves: { email: string; ra: string; cpf: string | null }
  aluno: {
    ra: string; nome: string; nome_exibicao: string | null; email: string; telefone: string | null; sexo: string | null
    data_nascimento: string | null; curso: string | null; nivel: string | null; modalidade: string | null
    turno: string | null; plano: string | null; semestre_ingresso: string | null; status: string
    casa: string | null; colaborador: boolean; inicio: string | null; conclusao: string | null; obs: string | null
    celular: string | null; whatsapp: string | null; tel_residencial: string | null; foto_origem: string | null
    origem: 'planilha'
  }
  dadosPessoais: {
    cpf: string | null; rg: string | null; orgao_rg: string | null; nacionalidade: string | null; estado_civil: string | null
    endereco: string | null; complemento: string | null; bairro: string | null; cep: string | null; cidade: string | null
    estado: string | null; pais: string | null; nome_mae: string | null; tel_mae: string | null; nome_pai: string | null
    tel_pai: string | null; emergencia: { nome: string | null; telefone: string | null; relacao: string | null } | null
    pastor: { nome: string | null; telefone: string | null } | null
    responsavel_academico: { relacao: string | null; nome: string | null; telefone: string | null } | null
    contato_preferido: string | null
  }
  igreja: { igreja_anterior: string | null; igreja_atual: string | null } | null
  saude: {
    plano_saude: string | null; tipo_sanguineo: string | null; limitacoes_medicas: string | null
    medicamento_continuo: string | null; alergia: string | null; restricao_alimentar: string | null; enfermidades: string | null
  } | null
  matriculas: {
    semestre: string; ciclo: string; modulo_ordem: number | null; cenario: string; plano: string
    alimentacao: string; moradia: string; academia: string
  }[]
  cicloStatus: { ciclo: string; status: string }[]
}

export interface Fontes {
  geral: { linha: number; dados: Linha }[]
  semestres: { linha: number; dados: Linha }[]
  ciclos: { linha: number; dados: Linha }[]
  saude: { linha: number; dados: Linha }[]
}

export interface Resultado {
  planos: PlanoAluno[]
  semestres: string[] // semesters the import needs to exist in alunos.semestres
  problemas: Problema[]
}

const obrigatorias = ['NOME COMPLETO', 'STATUS', 'RA', 'E-MAIL', 'CPF', 'NOME']

export function planejar(fontes: Fontes, hoje = new Date()): Resultado {
  const problemas: Problema[] = []
  const add = (p: Problema) => problemas.push(p)
  const planos: PlanoAluno[] = []

  const g = (l: Linha, k: string) => texto(l[k])
  const cabecalhoAusente = obrigatorias.filter((k) => fontes.geral.length > 0 && !(k in fontes.geral[0].dados))
  for (const k of cabecalhoAusente) add({ severidade: 'erro', codigo: 'coluna_ausente', aba: 'GERAL', linha: 1, campo: k })
  if (cabecalhoAusente.length > 0) return { planos, semestres: [], problemas }

  // ---- students
  for (const { linha, dados: d } of fontes.geral) {
    const ra = g(d, 'RA') ?? ''
    const ctx = { aba: 'GERAL', linha, ra } as const
    const nome = g(d, 'NOME COMPLETO')
    if (!nome) { add({ severidade: 'erro', codigo: 'nome_vazio', ...ctx }); continue }
    if (!ra) add({ severidade: 'aviso', codigo: 'ra_ausente', ...ctx })

    const email = normalizarEmail(d['E-MAIL'])
    if (!email) add({ severidade: 'erro', codigo: 'email_vazio', ...ctx })
    else if (!emailValido(email)) add({ severidade: 'erro', codigo: 'email_invalido', ...ctx })

    const cpf = cpfDe(d['CPF'])
    if (!cpf) add({ severidade: 'aviso', codigo: 'cpf_vazio', ...ctx })
    else if (cpf.length !== 11) add({ severidade: 'erro', codigo: 'cpf_tamanho', ...ctx, detalhe: `${cpf.length} dígitos` })
    else if (!cpfValido(cpf)) add({ severidade: 'aviso', codigo: 'cpf_digito_verificador', ...ctx })
    if (typeof d['CPF'] === 'number') add({ severidade: 'info', codigo: 'cpf_numerico_zeros_restaurados', ...ctx })

    const statusBruto = g(d, 'STATUS') ?? ''
    const status = STATUS_MAP[statusBruto]
    if (!status) add({ severidade: 'erro', codigo: 'status_desconhecido', ...ctx, detalhe: statusBruto })

    const sexo = g(d, 'SEXO')
    if (sexo && !['F', 'M'].includes(sexo)) add({ severidade: 'erro', codigo: 'sexo_invalido', ...ctx, detalhe: sexo })

    const nasc = dataISO(d['NASC.'])
    if (!nasc) add({ severidade: 'aviso', codigo: 'nascimento_ausente', ...ctx })
    else {
      const ano = Number(nasc.slice(0, 4))
      if (ano < 1940 || ano > hoje.getUTCFullYear() - 14) add({ severidade: 'aviso', codigo: 'nascimento_improvavel', ...ctx, detalhe: String(ano) })
    }
    const inicio = dataISO(d['INÍCIO'])
    const conclusao = dataISO(d['CONCLUSÃO'])
    for (const [campo, v] of [['NASC.', d['NASC.']], ['INÍCIO', d['INÍCIO']], ['CONCLUSÃO', d['CONCLUSÃO']]] as const) {
      if (v instanceof Date && (v.getUTCHours() !== 0 || v.getUTCMinutes() !== 0)) add({ severidade: 'aviso', codigo: 'data_com_hora', ...ctx, campo })
    }
    const turma = g(d, 'TURMA')
    if (!turma || !/^\d{4}-[12]$/.test(turma)) add({ severidade: 'erro', codigo: 'turma_invalida', ...ctx, detalhe: turma ?? '' })
    else if (inicio && semestreDeData(inicio) !== turma) add({ severidade: 'aviso', codigo: 'turma_diferente_do_inicio', ...ctx, detalhe: `${turma} x ${inicio.slice(0, 7)}` })
    if (conclusao && inicio && conclusao < inicio) add({ severidade: 'erro', codigo: 'conclusao_antes_do_inicio', ...ctx })
    if (status === 'Formado' && !conclusao) add({ severidade: 'aviso', codigo: 'formado_sem_conclusao', ...ctx })
    if (status === 'Ativo' && conclusao) add({ severidade: 'info', codigo: 'matriculado_com_conclusao_prevista', ...ctx })

    const casa = g(d, 'CASA')
    if (casa && !CASAS.includes(casa)) add({ severidade: 'erro', codigo: 'casa_desconhecida', ...ctx, detalhe: casa })
    if (!casa) add({ severidade: 'info', codigo: 'casa_vazia', ...ctx })
    const plano = g(d, 'PLANO')
    if (plano && !PLANOS.includes(plano)) add({ severidade: 'erro', codigo: 'plano_desconhecido', ...ctx, detalhe: plano })
    const ciclo = g(d, 'CICLO')
    if (ciclo && !CICLOS.includes(ciclo)) add({ severidade: 'erro', codigo: 'ciclo_desconhecido', ...ctx, detalhe: ciclo })

    const fone = (campo: string) => {
      const r = telefoneE164(d[campo])
      if (!r.ok) add({ severidade: 'aviso', codigo: 'telefone_formato', ...ctx, campo })
      return r.valor
    }
    const celular = fone('CELULAR')
    const foto = g(d, 'FOTO')
    if (foto && !/^https:\/\//.test(foto)) add({ severidade: 'aviso', codigo: 'foto_nao_url', ...ctx })

    const tipoResp = g(d, 'RESP. ACAD.')
    const emergNome = g(d, 'EMERGÊNCIA')
    const pastorNome = g(d, 'NOME PASTOR')
    const igrejaAnt = g(d, 'IGREJA ANTERIOR')
    const igrejaAtual = g(d, 'IGREJA ATUAL')
    const cep = cepDe(d['CEP'])
    if (cep && cep.length !== 8) add({ severidade: 'aviso', codigo: 'cep_formato', ...ctx })

    planos.push({
      linha,
      ra,
      chaves: { email, ra, cpf },
      aluno: {
        ra, nome, nome_exibicao: g(d, 'NOME'), email, telefone: celular, sexo, data_nascimento: nasc,
        curso: g(d, 'CURSO'), nivel: g(d, 'NÍVEL'), modalidade: g(d, 'MODALIDADE'), turno: g(d, 'TURNO'), plano,
        semestre_ingresso: turma, status: status ?? 'Ativo', casa, colaborador: g(d, 'COLABORADOR') === 'S',
        inicio, conclusao, obs: g(d, 'OBS'), celular, whatsapp: fone('WHATSAPP'), tel_residencial: fone('TEL. RES.'),
        foto_origem: foto, origem: 'planilha',
      },
      dadosPessoais: {
        cpf, rg: texto(d['RG']), orgao_rg: g(d, 'ÓRGÃO EXP.'), nacionalidade: g(d, 'NACIONALIDADE'),
        estado_civil: g(d, 'ESTADO CIVIL'), endereco: g(d, 'LOGRADOURO'), complemento: g(d, 'COMPLEMENTO'),
        bairro: g(d, 'BAIRRO'), cep, cidade: g(d, 'CIDADE'), estado: g(d, 'ESTADO'), pais: g(d, 'PAÍS'),
        nome_mae: g(d, 'NOME MÃE'), tel_mae: fone('TEL. MÃE'), nome_pai: g(d, 'NOME PAI'), tel_pai: fone('TEL. PAI'),
        emergencia: emergNome || g(d, 'TEL. EMERG.') ? { nome: emergNome, telefone: fone('TEL. EMERG.'), relacao: g(d, 'REL. EMERG.') } : null,
        pastor: pastorNome || g(d, 'TEL. PASTOR') ? { nome: pastorNome, telefone: fone('TEL. PASTOR') } : null,
        responsavel_academico: tipoResp || g(d, 'NOME RESP. ACAD.')
          ? { relacao: tipoResp, nome: g(d, 'NOME RESP. ACAD.'), telefone: fone('TEL. RESP. ACAD.') } : null,
        contato_preferido: g(d, 'CONT. PREF.'),
      },
      igreja: igrejaAnt || igrejaAtual ? { igreja_anterior: igrejaAnt, igreja_atual: igrejaAtual } : null,
      saude: null,
      matriculas: [],
      cicloStatus: [],
    })
  }

  // ---- duplicate keys inside the spreadsheet (the database has unique indexes on these)
  for (const [campo, pegar] of [
    ['email', (p: PlanoAluno) => p.chaves.email], ['ra', (p: PlanoAluno) => p.chaves.ra], ['cpf', (p: PlanoAluno) => p.chaves.cpf ?? ''],
  ] as const) {
    const vistos = new Map<string, PlanoAluno>()
    for (const p of planos) {
      const k = pegar(p)
      if (!k) continue
      const outro = vistos.get(k)
      if (outro) add({ severidade: 'erro', codigo: `${campo}_duplicado`, aba: 'GERAL', linha: p.linha, ra: p.ra, detalhe: `igual à linha ${outro.linha}` })
      else vistos.set(k, p)
    }
  }

  const porNomeCompleto = new Map<string, PlanoAluno[]>()
  const porNomeExibicao = new Map<string, PlanoAluno[]>()
  for (const p of planos) {
    const a = normalizarNome(p.aluno.nome)
    porNomeCompleto.set(a, [...(porNomeCompleto.get(a) ?? []), p])
    const b = normalizarNome(p.aluno.nome_exibicao)
    if (b) porNomeExibicao.set(b, [...(porNomeExibicao.get(b) ?? []), p])
  }
  const achar = (mapa: Map<string, PlanoAluno[]>, nome: string | null, ctx: { aba: string; linha: number }, codigo: string): PlanoAluno | null => {
    const chave = normalizarNome(nome)
    const lista = mapa.get(chave) ?? []
    if (lista.length === 1) return lista[0]
    if (lista.length === 0 && chave) {
      // typo between tabs: accept ONLY a clear, unique near-match, and say so (the owner must eyeball it)
      const ranking = [...mapa.entries()].map(([k, v]) => ({ k, v, s: similaridade(chave, k) })).sort((x, y) => y.s - x.s)
      const [melhor, segundo] = ranking
      if (melhor && melhor.s >= 0.9 && melhor.v.length === 1 && (!segundo || melhor.s - segundo.s >= 0.05)) {
        add({ severidade: 'aviso', codigo: 'nome_aproximado', ...ctx, ra: melhor.v[0].ra, detalhe: `casado com GERAL!${melhor.v[0].linha} (similaridade ${melhor.s.toFixed(2)})` })
        return melhor.v[0]
      }
    }
    add({ severidade: 'erro', codigo: lista.length === 0 ? `${codigo}_sem_ficha` : `${codigo}_nome_ambiguo`, ...ctx })
    return null
  }

  // ---- SEMESTRES -> matriculas
  const semestresNecessarios = new Set<string>(planos.map((p) => p.aluno.semestre_ingresso).filter((s): s is string => !!s))
  for (const { linha, dados: d } of fontes.semestres) {
    const sem = texto(d['SEMESTRE'])
    const p = achar(porNomeExibicao, texto(d['ALUNO']), { aba: 'SEMESTRES', linha }, 'semestres')
    if (!p) continue
    const ctx = { aba: 'SEMESTRES', linha, ra: p.ra } as const
    if (!sem || !/^\d{4}-[12]$/.test(sem)) { add({ severidade: 'erro', codigo: 'semestre_invalido', ...ctx, detalhe: sem ?? '' }); continue }
    const ciclo = texto(d['CICLO']) ?? ''
    const cenario = texto(d['CENÁRIO']) ?? ''
    const plano = texto(d['PLANOS']) ?? ''
    if (!CICLOS.includes(ciclo)) add({ severidade: 'erro', codigo: 'ciclo_desconhecido', ...ctx, detalhe: ciclo })
    if (!PLANOS.includes(plano)) add({ severidade: 'erro', codigo: 'plano_desconhecido', ...ctx, detalhe: plano })
    let modulo: number | null = null
    if (MODULOS[ciclo]) {
      modulo = MODULOS[ciclo][cenario] ?? null
      if (modulo === null) add({ severidade: 'aviso', codigo: 'cenario_fora_do_ciclo', ...ctx, detalhe: `${ciclo} / ${cenario}` })
    }
    semestresNecessarios.add(sem)
    const nova = {
      semestre: sem, ciclo, modulo_ordem: modulo, cenario, plano,
      alimentacao: texto(d['ALIMENTAÇÃO']) ?? '', moradia: texto(d['MORADIA']) ?? '', academia: texto(d['ACADEMIA']) ?? '',
    }
    const existente = p.matriculas.findIndex((m) => m.semestre === sem)
    if (existente >= 0) {
      // alunos.matriculas allows ONE row per student and semester. Keep the later cycle, report the other one.
      const velha = p.matriculas[existente]
      const ficaNova = ORDEM_CICLO.indexOf(nova.ciclo) > ORDEM_CICLO.indexOf(velha.ciclo)
      add({ severidade: 'aviso', codigo: 'matricula_duplicada_descartada', ...ctx, detalhe: `${sem}: mantido ${ficaNova ? nova.ciclo : velha.ciclo}/${ficaNova ? nova.cenario : velha.cenario}; descartado ${ficaNova ? velha.ciclo : nova.ciclo}/${ficaNova ? velha.cenario : nova.cenario}` })
      if (ficaNova) p.matriculas[existente] = nova
      continue
    }
    p.matriculas.push(nova)
  }
  for (const p of planos) {
    // Rule from the owner: a student's FIRST semester is always the TURMA semester. When SEMESTRES has no row for it, derive one
    // from GERAL. In the real data every first semester is Básico (Convênio students: Convênio); the scenario/module of that
    // semester is not in GERAL, so it stays empty. The plan is the CURRENT one (it can differ from what was paid then): flagged.
    const turma = p.aluno.semestre_ingresso
    if (turma && !p.matriculas.some((m) => m.semestre === turma)) {
      const ciclo = p.aluno.plano === 'Convênio' ? 'Convênio' : 'Básico'
      semestresNecessarios.add(turma)
      p.matriculas.push({
        semestre: turma, ciclo, modulo_ordem: null, cenario: '', plano: p.aluno.plano ?? '', alimentacao: '', moradia: '', academia: '',
      })
      add({ severidade: 'info', codigo: 'matricula_derivada_da_turma', aba: 'GERAL', linha: p.linha, ra: p.ra, detalhe: `${turma}: ${ciclo}, plano ${p.aluno.plano ?? '-'}` })
    }
    p.matriculas.sort((a, b) => a.semestre.localeCompare(b.semestre))
  }

  // ---- CICLOS -> ciclo_status
  const vistosCiclos = new Set<string>()
  for (const { linha, dados: d } of fontes.ciclos) {
    const p = achar(porNomeExibicao, texto(d['NOME']), { aba: 'CICLOS', linha }, 'ciclos')
    if (!p) continue
    const ctx = { aba: 'CICLOS', linha, ra: p.ra } as const
    if (vistosCiclos.has(p.ra)) { add({ severidade: 'erro', codigo: 'ciclos_linha_duplicada', ...ctx }); continue }
    vistosCiclos.add(p.ra)
    const st = texto(d['STATUS']) ? STATUS_MAP[texto(d['STATUS']) as string] : undefined
    if (st && st !== p.aluno.status) add({ severidade: 'aviso', codigo: 'ciclos_status_diferente_da_ficha', ...ctx })
    for (const ciclo of ['BÁSICO', 'AVANÇADO', 'CARREIRA']) {
      const v = texto(d[ciclo])
      if (!v) continue
      if (!STATUS_CICLO.includes(v)) { add({ severidade: 'erro', codigo: 'ciclo_status_desconhecido', ...ctx, campo: ciclo, detalhe: v }); continue }
      p.cicloStatus.push({ ciclo: ciclo[0] + ciclo.slice(1).toLowerCase(), status: v })
    }
  }
  for (const p of planos) if (!vistosCiclos.has(p.ra)) add({ severidade: 'info', codigo: 'aluno_sem_linha_em_ciclos', aba: 'GERAL', linha: p.linha, ra: p.ra })

  // ---- SAÚDE -> aluno_saude (matched by FULL NAME: the tab has no RA)
  const vistosSaude = new Set<string>()
  for (const { linha, dados: d } of fontes.saude) {
    const nome = texto(d['NOME COMPLETO'])
    if (!nome) continue
    const p = achar(porNomeCompleto, nome, { aba: 'SAÚDE', linha }, 'saude')
    if (!p) continue
    const ctx = { aba: 'SAÚDE', linha, ra: p.ra } as const
    if (vistosSaude.has(p.ra)) { add({ severidade: 'erro', codigo: 'saude_linha_duplicada', ...ctx }); continue }
    vistosSaude.add(p.ra)
    if (ehErroDeFormula(d['STATUS']) || ehErroDeFormula(d['SEXO'])) add({ severidade: 'info', codigo: 'saude_formula_com_erro_ignorada', ...ctx })
    let sangue = texto(d['TIPO SANGUÍNEO'])
    if (sangue && !TIPOS_SANGUINEOS.includes(sangue)) { add({ severidade: 'aviso', codigo: 'tipo_sanguineo_invalido', ...ctx, detalhe: sangue }); sangue = null }
    p.saude = {
      plano_saude: texto(d['PLANO DE SAÚDE']), tipo_sanguineo: sangue, limitacoes_medicas: texto(d['LIMITAÇÕES MÉDICAS']),
      medicamento_continuo: texto(d['MEDICAMENTO CONTÍNUO']), alergia: texto(d['ALERGIA']),
      restricao_alimentar: texto(d['RESTRIÇÃO ALIMENTAR']), enfermidades: texto(d['ENFERMIDADES']),
    }
  }
  for (const p of planos) if (!p.saude) add({ severidade: 'info', codigo: 'aluno_sem_ficha_de_saude', aba: 'GERAL', linha: p.linha, ra: p.ra })

  return { planos, semestres: [...semestresNecessarios].sort(), problemas }
}

// ------------------------------------------------------------------ cross-check against the database (hashed keys only)
// The database side returns only 12-hex-digit SHA-256 prefixes of e-mail / RA / CPF, so no personal data is exchanged.
export interface ChavesBanco {
  candidatos: { id: string; email_h: string | null; ra_h: string | null; cpf_h: string | null }[]
  alunos: { email_h: string | null; ra_h: string | null; cpf_h: string | null }[]
  allowed_users: { email_h: string; papel: string }[]
}
export interface ConferenciaBanco {
  semCandidato: number
  candidatoUnico: number
  candidatoUnicoChavesDivergentes: number
  conflitoEntreCandidatos: number
  candidatoCompartilhado: number
  jaExisteEmAlunos: number
  comLoginAluno: number
  comLoginEquipe: number
  loginsAlunoSemFicha: number
  problemas: Problema[]
}

export function conferirComBanco(planos: PlanoAluno[], chaves: ChavesBanco): ConferenciaBanco {
  const problemas: Problema[] = []
  const porEmail = new Map<string, number[]>(), porRa = new Map<string, number[]>(), porCpf = new Map<string, number[]>()
  chaves.candidatos.forEach((c, i) => {
    for (const [mapa, h] of [[porEmail, c.email_h], [porRa, c.ra_h], [porCpf, c.cpf_h]] as const) if (h) mapa.set(h, [...(mapa.get(h) ?? []), i])
  })
  const usosDoCandidato = new Map<number, number>()
  const r: ConferenciaBanco = {
    semCandidato: 0, candidatoUnico: 0, candidatoUnicoChavesDivergentes: 0, conflitoEntreCandidatos: 0, candidatoCompartilhado: 0,
    jaExisteEmAlunos: 0, comLoginAluno: 0, comLoginEquipe: 0, loginsAlunoSemFicha: 0, problemas,
  }
  const emailsDaPlanilha = new Set<string>()
  for (const p of planos) {
    const hEmail = h12(p.chaves.email), hRa = p.chaves.ra ? h12(p.chaves.ra) : null, hCpf = p.chaves.cpf ? h12(p.chaves.cpf) : null
    emailsDaPlanilha.add(hEmail)
    const a = new Set(porEmail.get(hEmail) ?? []), b = new Set(hRa ? porRa.get(hRa) ?? [] : []), c = new Set(hCpf ? porCpf.get(hCpf) ?? [] : [])
    const uniao = new Set([...a, ...b, ...c])
    const ctx = { aba: 'GERAL', linha: p.linha, ra: p.ra } as const
    if (uniao.size === 0) r.semCandidato++
    else if (uniao.size === 1) {
      r.candidatoUnico++
      const i = [...uniao][0]
      usosDoCandidato.set(i, (usosDoCandidato.get(i) ?? 0) + 1)
      // Only a real DISAGREEMENT matters: both sides have the key and the values differ.
      const cand = chaves.candidatos[i]
      const divergentes = [
        ['e-mail', cand.email_h, hEmail], ['RA', cand.ra_h, hRa], ['CPF', cand.cpf_h, hCpf],
      ].filter(([, doCandidato, daPlanilha]) => doCandidato && daPlanilha && doCandidato !== daPlanilha).map(([k]) => k)
      if (divergentes.length > 0) {
        r.candidatoUnicoChavesDivergentes++
        problemas.push({ severidade: 'aviso', codigo: 'candidato_com_chave_divergente', ...ctx, detalhe: `divergem: ${divergentes.join(', ')}` })
      }
    } else {
      r.conflitoEntreCandidatos++
      problemas.push({ severidade: 'erro', codigo: 'chaves_apontam_para_candidatos_diferentes', ...ctx, detalhe: `${uniao.size} candidatos` })
    }
    if (chaves.alunos.some((x) => x.email_h === hEmail || (hRa && x.ra_h === hRa) || (hCpf && x.cpf_h === hCpf))) {
      r.jaExisteEmAlunos++
      problemas.push({ severidade: 'aviso', codigo: 'ja_existe_em_alunos', ...ctx })
    }
    const login = chaves.allowed_users.find((u) => u.email_h === hEmail)
    if (login?.papel === 'aluno') r.comLoginAluno++
    else if (login) r.comLoginEquipe++
  }
  r.candidatoCompartilhado = [...usosDoCandidato.values()].filter((n) => n > 1).length
  for (const [i, n] of usosDoCandidato) if (n > 1) problemas.push({ severidade: 'erro', codigo: 'candidato_ligado_a_varios_alunos', aba: 'GERAL', linha: 0, detalhe: `candidato #${i} em ${n} linhas` })
  r.loginsAlunoSemFicha = chaves.allowed_users.filter((u) => u.papel === 'aluno' && !emailsDaPlanilha.has(u.email_h)).length
  return r
}
