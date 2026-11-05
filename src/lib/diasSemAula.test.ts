// Testes da lógica de dias sem aula. FAKE DATA. Rodar: npm run test:lib
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { diasDoEvento, diaDaSemana, ehFeriadoDeVerdade, montarSugestoes, somarDias } from './diasSemAula.ts'

test('datas e dias da semana', () => {
  assert.equal(diaDaSemana('2026-11-02'), 1) // segunda
  assert.equal(diaDaSemana('2026-11-15'), 0) // domingo
  assert.equal(somarDias('2026-11-30', 1), '2026-12-01')
  assert.equal(somarDias('2026-03-01', -1), '2026-02-28')
})

test('evento de vários dias: inclusivo e limitado ao semestre', () => {
  const e = { titulo: 'Recesso', inicio: '2026-10-30', fim: '2026-11-03' }
  assert.deepEqual(diasDoEvento(e, '2026-11-01', '2026-11-28'), ['2026-11-01', '2026-11-02', '2026-11-03'])
  assert.deepEqual(diasDoEvento({ titulo: 'Um dia', inicio: '2026-11-02T10:00:00-03:00' }, '2026-07-27', '2026-11-28'), ['2026-11-02'])
})

test('feriado de verdade x data comemorativa', () => {
  assert.equal(ehFeriadoDeVerdade({ titulo: 'Finados', inicio: '2026-11-02', descricao: 'Feriado nacional' }), true)
  assert.equal(ehFeriadoDeVerdade({ titulo: 'Dia dos Pais', inicio: '2026-08-09', descricao: 'Observância' }), false)
  assert.equal(ehFeriadoDeVerdade({ titulo: 'Proclamação da República', inicio: '2026-11-15' }), true)
})

test('sugestões: feriados marcados, comemorativas não, fim de semana ignorado, já marcados somem', () => {
  const s = montarSugestoes({
    feriados: [
      { titulo: 'Independência do Brasil', inicio: '2026-09-07', descricao: 'Feriado nacional' }, // segunda
      { titulo: 'Dia dos Pais', inicio: '2026-08-09', descricao: 'Observância' }, // domingo
      { titulo: 'Dia das Crianças', inicio: '2026-10-12', descricao: 'Observância' }, // segunda
      { titulo: 'Finados', inicio: '2026-11-02', descricao: 'Feriado nacional' }, // segunda
      { titulo: 'Proclamação da República', inicio: '2026-11-15', descricao: 'Feriado nacional' }, // domingo
    ],
    escola: [{ titulo: 'Recesso de outubro', inicio: '2026-10-19', fim: '2026-10-20' }, { titulo: 'Formatura', inicio: '2026-11-20' }],
    inicio: '2026-07-27', fim: '2026-11-28',
    jaSemAula: new Set(['2026-11-02']),
  })
  const por = (d: string) => s.find((x) => x.data === d)
  assert.equal(por('2026-09-07')?.marcado, true)
  assert.equal(por('2026-08-09'), undefined) // domingo
  assert.equal(por('2026-10-12')?.origem, 'comemorativa')
  assert.equal(por('2026-10-12')?.marcado, false)
  assert.equal(por('2026-11-02'), undefined) // já estava sem aula
  assert.equal(por('2026-11-15'), undefined) // domingo
  assert.equal(por('2026-10-19')?.marcado, true) // "recesso" na agenda da escola
  assert.equal(por('2026-11-20')?.marcado, false) // evento comum: sugerido, não marcado
  assert.deepEqual(s.map((x) => x.data), [...s.map((x) => x.data)].sort())
})

test('emenda: feriado na terça sugere a segunda; na quinta, a sexta; nunca marcada', () => {
  const s = montarSugestoes({
    feriados: [
      { titulo: 'Tiradentes', inicio: '2026-04-21', descricao: 'Feriado nacional' }, // terça
      { titulo: 'Corpus Christi', inicio: '2026-06-04', descricao: 'Feriado nacional' }, // quinta
      { titulo: 'Dia do Trabalho', inicio: '2026-05-01', descricao: 'Feriado nacional' }, // sexta (sem emenda)
    ],
    escola: [], inicio: '2026-02-02', fim: '2026-06-26', jaSemAula: new Set(),
  })
  const emendas = s.filter((x) => x.origem === 'emenda')
  assert.deepEqual(emendas.map((e) => e.data), ['2026-04-20', '2026-06-05'])
  assert.ok(emendas.every((e) => !e.marcado))
  assert.equal(s.find((x) => x.data === '2026-05-01')?.marcado, true)
})

test('a emenda não aparece se a data já é outro evento ou fora do semestre', () => {
  const s = montarSugestoes({
    feriados: [{ titulo: 'Tiradentes', inicio: '2026-04-21', descricao: 'Feriado nacional' }],
    escola: [{ titulo: 'Recesso', inicio: '2026-04-20' }],
    inicio: '2026-04-21', fim: '2026-06-26', jaSemAula: new Set(),
  })
  assert.equal(s.filter((x) => x.origem === 'emenda').length, 0)
})
