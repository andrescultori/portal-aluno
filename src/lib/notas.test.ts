// Testes da leitura de notas digitadas. FAKE DATA. Rodar: npm run test:lib
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { codigoDeNome, fmtNota, lerNota, textoDoCampo } from './notas.ts'

test('vazio = sem nota (nunca zero)', () => {
  assert.deepEqual(lerNota('', 0, 9, 1), { ok: true, valor: null })
  assert.deepEqual(lerNota('   ', 0, 9, 1), { ok: true, valor: null })
})

test('vírgula e ponto, zero é uma nota válida', () => {
  assert.deepEqual(lerNota('8,5', 0, 9, 1), { ok: true, valor: 8.5 })
  assert.deepEqual(lerNota('8.5', 0, 9, 1), { ok: true, valor: 8.5 })
  assert.deepEqual(lerNota('0', 0, 9, 1), { ok: true, valor: 0 })
  assert.deepEqual(lerNota(' 9 ', 0, 9, 1), { ok: true, valor: 9 })
})

test('limites do banco: atividade 0..9, quiz 0..1, projeto 0..10 com 2 casas', () => {
  assert.equal(lerNota('9,1', 0, 9, 1).ok, false)
  assert.equal(lerNota('1,1', 0, 1, 1).ok, false)
  assert.equal(lerNota('-1', 0, 9, 1).ok, false)
  assert.deepEqual(lerNota('10', 0, 10, 2), { ok: true, valor: 10 })
  assert.deepEqual(lerNota('8,75', 0, 10, 2), { ok: true, valor: 8.75 })
})

test('casas decimais demais são recusadas, não arredondadas em silêncio', () => {
  assert.equal(lerNota('8,55', 0, 9, 1).ok, false)
  assert.equal(lerNota('8,755', 0, 10, 2).ok, false)
})

test('lixo é recusado', () => {
  for (const t of ['abc', '8,5,1', '8..5', '1e3', ',5', '8,']) assert.equal(lerNota(t, 0, 10, 2).ok, false, t)
})

test('formatação e código de componente', () => {
  assert.equal(fmtNota(8.5), '8,5')
  assert.equal(fmtNota(9.125), '9,13')
  assert.equal(fmtNota(null), '—')
  assert.equal(textoDoCampo(8.5), '8,5')
  assert.equal(textoDoCampo(null), '')
  assert.equal(codigoDeNome('Trabalho escrito'), 'trabalho_escrito')
  assert.equal(codigoDeNome(' Apresentação final! '), 'apresentacao_final')
})
