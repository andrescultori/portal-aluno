// DRY-RUN of the "LISTA GERAL" import. It reads the spreadsheet, validates it, plans what would be written
// and cross-checks it against hashed keys from the database. It NEVER writes to the database and has no --apply.
//
//   npx tsx scripts/import-geral/cli.ts --file "<path to LISTA_GERAL_ALUNOS.xlsx>" --out "<report folder>" [--db-keys keys.json]
//
// Both the spreadsheet and the report folder MUST be outside the repository (they hold personal data).
// The console only prints counts; reports identify rows by spreadsheet row number and RA, never by name.
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import readXlsxFile from 'read-excel-file/node'
import {
  conferirComBanco, planejar,
  type Cell, type ChavesBanco, type Fontes, type Linha, type Problema,
} from './core.ts'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const dentroDoRepo = (p: string) => {
  const rel = path.relative(raiz, path.resolve(p))
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

function argumento(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const arquivo = argumento('file') ?? process.env.IMPORT_FILE
const saida = argumento('out') ?? process.env.IMPORT_OUT
const chavesArq = argumento('db-keys')
if (process.argv.includes('--apply')) {
  console.error('Este script é só um ensaio (dry-run): não existe --apply. A importação real precisa de aprovação.')
  process.exit(2)
}
if (!arquivo || !saida) {
  console.error('Uso: tsx scripts/import-geral/cli.ts --file <planilha.xlsx> --out <pasta fora do repo> [--db-keys chaves.json]')
  process.exit(2)
}
for (const [rotulo, p] of [['planilha', arquivo], ['pasta de saída', saida]] as const) {
  if (dentroDoRepo(p)) {
    console.error(`Recusado: a ${rotulo} está dentro do repositório. Dados de alunos ficam fora dele.`)
    process.exit(2)
  }
}

// Reads one sheet as objects keyed by the header label found on the first row that has >= 5 labels.
function lerAba(abas: { sheet: string; data: Cell[][] }[], nome: string): { linha: number; dados: Linha }[] {
  const aba = abas.find((a) => a.sheet === nome)
  if (!aba) throw new Error(`Aba "${nome}" não encontrada`)
  const hi = aba.data.findIndex((r) => r.filter((c) => c !== null && c !== undefined && c !== '').length >= 5)
  if (hi < 0) throw new Error(`Aba "${nome}" sem cabeçalho`)
  const cab = aba.data[hi].map((c) => (c === null || c === undefined ? '' : String(c).trim()))
  const saida: { linha: number; dados: Linha }[] = []
  aba.data.slice(hi + 1).forEach((r, i) => {
    if (r.every((c) => c === null || c === undefined || c === '')) return
    const dados: Linha = {}
    cab.forEach((k, j) => { if (k) dados[k] = r[j] })
    saida.push({ linha: hi + 2 + i, dados })
  })
  return saida
}

const abas = (await readXlsxFile(arquivo)) as unknown as { sheet: string; data: Cell[][] }[]
const fontes: Fontes = {
  geral: lerAba(abas, 'GERAL'),
  semestres: lerAba(abas, 'SEMESTRES'),
  ciclos: lerAba(abas, 'CICLOS'),
  saude: lerAba(abas, 'SAÚDE'),
}
const resultado = planejar(fontes)
// Keys file: arrays of 12-hex hash prefixes straight from the database, plus md5 checksums to prove the file is intact.
function lerChaves(arquivoChaves: string): ChavesBanco {
  const bruto = JSON.parse(readFileSync(arquivoChaves, 'utf8')) as {
    candidatos: (string | null)[][]; alunos: (string | null)[][]; allowed_users: string[][]
    integrity?: { candidatos: string; alunos: string; allowed_users: string }
  }
  const md5 = (t: string) => createHash('md5').update(t).digest('hex')
  const trio = (l: (string | null)[][]) => l.map(([e, r, c]) => `${e ?? '-'}${r ?? '-'}${c ?? '-'}`).join(',')
  if (bruto.integrity) {
    const ok =
      md5(trio(bruto.candidatos)) === bruto.integrity.candidatos &&
      (bruto.alunos.length === 0 ? bruto.integrity.alunos === '' : md5(trio(bruto.alunos)) === bruto.integrity.alunos) &&
      md5(bruto.allowed_users.map(([e, papel]) => `${e}${papel}`).join(',')) === bruto.integrity.allowed_users
    if (!ok) { console.error('Arquivo de chaves corrompido (checksum não confere). Gere de novo.'); process.exit(2) }
  }
  return {
    candidatos: bruto.candidatos.map(([e, r, c], i) => ({ id: String(i), email_h: e, ra_h: r, cpf_h: c })),
    alunos: bruto.alunos.map(([e, r, c]) => ({ email_h: e, ra_h: r, cpf_h: c })),
    allowed_users: bruto.allowed_users.map(([e, papel]) => ({ email_h: e, papel })),
  }
}
const chaves: ChavesBanco | null = chavesArq ? lerChaves(chavesArq) : null
const banco = chaves ? conferirComBanco(resultado.planos, chaves) : null
const todos: Problema[] = [...resultado.problemas, ...(banco?.problemas ?? [])]

// ------------------------------------------------------------------ report (no names, only row numbers and RA)
const porCodigo = new Map<string, Problema[]>()
for (const p of todos) porCodigo.set(`${p.severidade}|${p.codigo}`, [...(porCodigo.get(`${p.severidade}|${p.codigo}`) ?? []), p])
const ordem = { erro: 0, aviso: 1, info: 2 } as const
const grupos = [...porCodigo.entries()].sort((a, b) => ordem[a[0].split('|')[0] as keyof typeof ordem] - ordem[b[0].split('|')[0] as keyof typeof ordem] || b[1].length - a[1].length)
const n = (f: (p: (typeof resultado.planos)[number]) => unknown) => resultado.planos.filter((p) => f(p)).length
const soma = (f: (p: (typeof resultado.planos)[number]) => number) => resultado.planos.reduce((acc, p) => acc + f(p), 0)
const erros = todos.filter((p) => p.severidade === 'erro').length

const linhas: string[] = []
linhas.push('# Ensaio da importação — LISTA GERAL (dry-run)', '', `Gerado em ${new Date().toISOString()}. **Nada foi gravado em nenhum banco.**`, '')
linhas.push('## O que seria gravado', '')
linhas.push(`| Tabela | Linhas |`, `|---|---|`)
linhas.push(`| alunos.alunos | ${resultado.planos.length} |`, `| alunos.dados_pessoais | ${n((p) => p.dadosPessoais.cpf || p.dadosPessoais.endereco)} |`)
linhas.push(`| alunos.aluno_igreja | ${n((p) => p.igreja)} |`, `| alunos.aluno_saude | ${n((p) => p.saude)} |`)
linhas.push(`| alunos.matriculas | ${soma((p) => p.matriculas.length)} |`, `| alunos.ciclo_status | ${soma((p) => p.cicloStatus.length)} |`)
linhas.push(`| alunos.semestres a garantir | ${resultado.semestres.length} (${resultado.semestres.join(', ')}) |`, '')
linhas.push('## Resumo', '', `- Problemas que **bloqueiam** a importação (erro): **${erros}**`)
linhas.push(`- Avisos: ${todos.filter((p) => p.severidade === 'aviso').length} · Informações: ${todos.filter((p) => p.severidade === 'info').length}`, '')
const cont = (f: (p: (typeof resultado.planos)[number]) => string) => {
  const m = new Map<string, number>(); resultado.planos.forEach((p) => m.set(f(p), (m.get(f(p)) ?? 0) + 1))
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(' · ')
}
linhas.push(`- Status: ${cont((p) => p.aluno.status)}`, `- Casas: ${cont((p) => p.aluno.casa ?? '(sem casa)')}`)
linhas.push(`- Colaboradores: ${n((p) => p.aluno.colaborador)} · Com foto (URL): ${n((p) => p.aluno.foto_origem)} · Sem e-mail válido: ${n((p) => !p.aluno.email)}`, '')
if (banco) {
  linhas.push('## Conferência com o banco (só hashes de e-mail / RA / CPF)', '')
  linhas.push(`- Alunos que **não** são candidatos (nenhuma chave bate): ${banco.semCandidato}`)
  linhas.push(`- Alunos ligados a **um** candidato: ${banco.candidatoUnico} (em ${banco.candidatoUnicoChavesDivergentes} deles só algumas chaves coincidem)`)
  linhas.push(`- Alunos cujas chaves apontam para **candidatos diferentes** (conflito): ${banco.conflitoEntreCandidatos}`)
  linhas.push(`- Candidatos ligados a mais de um aluno: ${banco.candidatoCompartilhado}`)
  linhas.push(`- Alunos que **já existem** em alunos.alunos: ${banco.jaExisteEmAlunos}`)
  linhas.push(`- Alunos com login de aluno no portal: ${banco.comLoginAluno} · com login de equipe: ${banco.comLoginEquipe} · logins de aluno sem ficha na planilha: ${banco.loginsAlunoSemFicha}`, '')
} else linhas.push('## Conferência com o banco', '', '_Não executada (faltou `--db-keys`)._', '')
linhas.push('## Problemas por tipo (linha da planilha · RA)', '')
for (const [chave, itens] of grupos) {
  const [sev, cod] = chave.split('|')
  linhas.push(`### ${sev.toUpperCase()} · ${cod} — ${itens.length}`, '')
  linhas.push(itens.slice(0, 40).map((p) => `${p.aba}!${p.linha}${p.ra ? ` · ${p.ra}` : ''}${p.campo ? ` · ${p.campo}` : ''}${p.detalhe ? ` · ${p.detalhe}` : ''}`).join('\n'))
  if (itens.length > 40) linhas.push(`… e mais ${itens.length - 40}`)
  linhas.push('')
}
mkdirSync(saida, { recursive: true })
writeFileSync(path.join(saida, 'relatorio-importacao.md'), linhas.join('\n'))
writeFileSync(path.join(saida, 'problemas.json'), JSON.stringify(todos, null, 2))

// ------------------------------------------------------------------ console: counts only
console.log(`alunos planejados: ${resultado.planos.length} · matrículas: ${soma((p) => p.matriculas.length)} · status de ciclo: ${soma((p) => p.cicloStatus.length)} · saúde: ${n((p) => p.saude)} · semestres: ${resultado.semestres.length}`)
console.log(`erros: ${erros} · avisos: ${todos.filter((p) => p.severidade === 'aviso').length} · info: ${todos.filter((p) => p.severidade === 'info').length}`)
for (const [chave, itens] of grupos) console.log(`  ${chave.replace('|', ' ')}: ${itens.length}`)
if (banco) console.log(`banco: sem candidato ${banco.semCandidato} · candidato único ${banco.candidatoUnico} · conflitos ${banco.conflitoEntreCandidatos} · já existem ${banco.jaExisteEmAlunos} · com login ${banco.comLoginAluno}`)
console.log(`relatório gravado em ${saida} (fora do repositório)`)
