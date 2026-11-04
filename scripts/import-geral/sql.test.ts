// Unit tests for the SQL generator with FAKE data only. Run: npm run test:import
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { gerarSql } from './sql.ts'
import type { PlanoAluno } from './core.ts'

const plano = (i: number, obs: string | null = null): PlanoAluno => ({
  linha: i, ra: `9000${i}`, chaves: {},
  aluno: {
    ra: `9000${i}`, nome: `Aluno ${i}`, nome_exibicao: null, email: `a${i}@example.test`, telefone: null, sexo: 'F', data_nascimento: null,
    curso: null, nivel: null, modalidade: null, turno: null, plano: 'Completo', semestre_ingresso: '2025-1', status: 'Ativo', casa: 'Casa Amarela',
    colaborador: false, inicio: null, conclusao: null, obs, celular: null, whatsapp: null, tel_residencial: null, foto_origem: null, origem: 'planilha',
  },
  dadosPessoais: {} as PlanoAluno['dadosPessoais'],
  igreja: i === 1 ? null : { igreja_anterior: 'A', igreja_atual: 'B' },
  saude: null,
  matriculas: [{ semestre: '2025-1', ciclo: 'Básico', modulo_ordem: 1, cenario: '', plano: 'Completo', alimentacao: '', moradia: '', academia: '' }],
  cicloStatus: [{ ciclo: 'Básico', status: 'Cursando' }],
} as unknown as PlanoAluno)

test('SQL is one atomic block, never overwrites and states the expected counts', () => {
  const sql = gerarSql([plano(1), plano(2)], ['2025-1'], { vincularCandidatos: true, geradoEm: '2026-01-01' })
  assert.match(sql, /do \$import\$/)
  assert.equal(sql.match(/on conflict[^;]*do nothing/g)?.length, 7)
  assert.doesNotMatch(sql, /\bon conflict[^;]*do update\b/i)
  assert.doesNotMatch(sql, /\b(delete|truncate)\b|\bdrop\s+(table|schema|function|column)/i) // "on commit drop" on temp tables is fine
  assert.match(sql, /v_vincular boolean := true/)
  assert.match(sql, /'alunos \(origem planilha\)'[^;]*2 as esperado/)
  assert.match(sql, /'aluno_igreja', count\(\*\)::int, 1 from/)
  assert.match(gerarSql([plano(1)], ['2025-1'], { vincularCandidatos: false }), /v_vincular boolean := false/)
})

test('SQL never touches selecao / propostas / registrar_checkin writes', () => {
  const sql = gerarSql([plano(1)], ['2025-1'], { vincularCandidatos: true }).replace(/^\s*--.*$/gm, '')
  assert.doesNotMatch(sql, /(insert into|update|delete from|alter|create)\s+(selecao|propostas)\./i)
  assert.doesNotMatch(sql, /registrar_checkin/)
})

test('data with quotes and dollar signs is carried safely inside the JSON literal', () => {
  const sql = gerarSql([plano(1, "d'Ávila $1 \\ fim")], ['2025-1'], { vincularCandidatos: true })
  assert.ok(sql.includes("d'Ávila $1 \\\\ fim"))
  assert.throws(() => gerarSql([plano(1, 'quebra $json$ aqui')], ['2025-1'], { vincularCandidatos: true }), /delimitador/)
})
