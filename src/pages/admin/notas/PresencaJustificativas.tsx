import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { fmtNota } from '../../../lib/notas'
import { NOMES_DIA, diaDaSemana } from '../../../lib/diasSemAula'
import type { Semestre } from '../../../types/alunos'
import { useAlunosDoEscopo, type Permissoes } from './escopo'

const db = () => supabase.schema('alunos')

interface Resumo {
  dias_letivos: number
  presentes: number
  atrasos: number
  faltas: number
  justificadas: number
  presenca: number | null
  vinculado: boolean
}
interface Falta {
  data: string
  justificada: boolean
  motivo: string | null
}

const campo =
  'mt-1 block min-h-11 w-full min-w-0 rounded-sm border border-gunmetal-gray/40 bg-pure-white px-2 text-sm font-normal text-onyx-black'
const botaoLaranja =
  'min-h-11 rounded-sm bg-mandarin-orange px-4 text-sm font-bold text-onyx-black transition hover:bg-mandarin-orange-dark disabled:opacity-50'
const botaoLinha =
  'min-h-11 rounded-sm border-2 border-gunmetal-gray px-3 text-sm font-bold text-gunmetal-gray transition hover:bg-soft-pink/50 disabled:opacity-50'

function formatar(iso: string) {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a} (${NOMES_DIA[diaDaSemana(iso)]})`
}

export default function PresencaJustificativas({ semestre, perm }: { semestre: Semestre; perm: Permissoes }) {
  const { alunos, carregando: carregandoAlunos, erro: erroAlunos } = useAlunosDoEscopo(semestre.id, perm)
  const [alunoId, setAlunoId] = useState('')
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [faltas, setFaltas] = useState<Falta[]>([])
  const [motivos, setMotivos] = useState<Record<string, string>>({})
  const [carregando, setCarregando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // primeiro aluno da lista como padrão
  useEffect(() => {
    if (!alunoId && alunos.length > 0) setAlunoId(alunos[0].id)
  }, [alunos, alunoId])

  const carregar = useCallback(async () => {
    if (!alunoId) return
    setCarregando(true)
    const [r, f] = await Promise.all([
      db().rpc('presenca_aluno', { p_aluno: alunoId, p_semestre: semestre.id }),
      db().rpc('faltas_aluno', { p_aluno: alunoId, p_semestre: semestre.id }),
    ])
    if (r.error || f.error) {
      const msg = (r.error ?? f.error)!.message
      setMensagem({
        tipo: 'erro',
        texto: msg.includes('faltas_aluno') ? 'A lista de faltas ainda não foi instalada no banco (migração 19).' : msg.includes('not allowed') ? 'Você não pode ver a presença deste aluno.' : `Não foi possível carregar: ${msg}`,
      })
      setResumo(null)
      setFaltas([])
    } else {
      setResumo(((r.data as Resumo[]) ?? [])[0] ?? null)
      setFaltas((f.data as Falta[]) ?? [])
    }
    setCarregando(false)
  }, [alunoId, semestre.id])

  useEffect(() => {
    setMensagem(null)
    carregar()
  }, [carregar])

  async function justificar(data: string) {
    const motivo = (motivos[data] ?? '').trim()
    if (!motivo) return
    setOcupado(true)
    setMensagem(null)
    const { error } = await db().from('justificativas').insert({ aluno_id: alunoId, data, motivo })
    setOcupado(false)
    if (error) {
      setMensagem({ tipo: 'erro', texto: error.message.includes('row-level security') ? 'Você não pode justificar faltas deste aluno.' : `Não foi possível justificar: ${error.message}` })
      return
    }
    setMensagem({ tipo: 'ok', texto: `Falta de ${formatar(data)} justificada.` })
    await carregar()
  }

  async function desfazer(data: string) {
    if (!confirm(`Desfazer a justificativa de ${formatar(data)}? A falta volta a contar.`)) return
    setOcupado(true)
    setMensagem(null)
    const { error } = await db().from('justificativas').delete().eq('aluno_id', alunoId).eq('data', data)
    setOcupado(false)
    if (error) {
      setMensagem({ tipo: 'erro', texto: `Não foi possível desfazer: ${error.message}` })
      return
    }
    setMensagem({ tipo: 'ok', texto: `Justificativa de ${formatar(data)} desfeita.` })
    await carregar()
  }

  if (carregandoAlunos) return <p className="text-onyx-black">Carregando...</p>

  return (
    <section aria-labelledby="pres-titulo">
      <h2 id="pres-titulo" className="sr-only">
        Presença e justificativas
      </h2>
      {erroAlunos && (
        <p role="alert" className="mb-3 border-l-4 border-mandarin-orange bg-soft-pink/60 p-3 text-sm text-onyx-black">
          {erroAlunos}
        </p>
      )}
      {alunos.length === 0 ? (
        <p className="border border-gunmetal-gray/25 p-4 text-sm text-onyx-black">
          {perm.veTodos ? 'Nenhum aluno neste semestre.' : 'Você ainda não tem alunos atribuídos na Tutoria neste semestre.'}
        </p>
      ) : (
        <>
          <label className="block max-w-md text-sm font-bold text-gunmetal-gray">
            Aluno
            <select value={alunoId} onChange={(e) => setAlunoId(e.target.value)} className={campo}>
              {alunos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
          </label>

          <div aria-live="polite" className="mt-3">
            {mensagem && (
              <p
                role={mensagem.tipo === 'erro' ? 'alert' : 'status'}
                className={`border-l-4 p-3 text-sm text-onyx-black ${mensagem.tipo === 'erro' ? 'border-mandarin-orange bg-soft-pink/60' : 'border-gunmetal-gray bg-neutral-tint'}`}
              >
                {mensagem.texto}
              </p>
            )}
          </div>

          {carregando ? (
            <p className="mt-3 text-onyx-black">Carregando...</p>
          ) : (
            <>
              {resumo && (
                <>
                  {!resumo.vinculado && (
                    <p role="status" className="mt-3 border-l-4 border-mandarin-orange bg-soft-pink/60 p-3 text-sm text-onyx-black">
                      Este aluno não tem login ligado ao check-in, então a presença não pode ser calculada. A secretaria precisa cadastrar o acesso dele (Turmas e alunos › Acessos de alunos).
                    </p>
                  )}
                  <ul className="mt-3 grid grid-cols-2 gap-3 text-center sm:grid-cols-3 lg:grid-cols-6">
                    {[
                      ['Dias com aula', resumo.dias_letivos],
                      ['Presenças', resumo.presentes],
                      ['Atrasos', resumo.atrasos],
                      ['Faltas', resumo.faltas],
                      ['Justificadas', resumo.justificadas],
                      ['Nota de presença', fmtNota(resumo.presenca)],
                    ].map(([rotulo, valor], i) => (
                      <li key={rotulo as string} className={i === 5 ? 'bg-gunmetal-gray p-3 text-white' : 'border border-gunmetal-gray/25 p-3 text-onyx-black'}>
                        <span className="block font-display text-4xl font-bold leading-none">{valor as string | number}</span>
                        <span className="text-xs font-bold uppercase tracking-wide">{rotulo as string}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted-purple">Conta até ontem. Atraso vale meia presença; falta justificada sai da conta. Feriados e recessos: Avaliações › Semestre › Dias sem aula.</p>
                </>
              )}

              <h3 className="mt-5 font-display text-2xl text-gunmetal-gray">Faltas</h3>
              {faltas.length === 0 ? (
                <p className="mt-1 border border-gunmetal-gray/25 p-3 text-sm text-onyx-black">Nenhuma falta até agora. 🎉</p>
              ) : (
                <ul className="mt-1 divide-y divide-gunmetal-gray/15 border border-gunmetal-gray/25">
                  {faltas.map((f) => (
                    <li key={f.data} className="grid gap-2 p-3 text-sm md:grid-cols-[13rem_1fr_auto] md:items-center">
                      <span className="font-bold text-gunmetal-gray">{formatar(f.data)}</span>
                      {f.justificada ? (
                        <>
                          <span className="text-onyx-black">
                            <span className="mr-2 rounded-sm bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">Justificada</span>
                            {f.motivo}
                          </span>
                          <button type="button" disabled={ocupado} onClick={() => desfazer(f.data)} className={botaoLinha}>
                            Desfazer
                          </button>
                        </>
                      ) : (
                        <>
                          <input
                            aria-label={`Motivo da falta de ${formatar(f.data)}`}
                            value={motivos[f.data] ?? ''}
                            onChange={(e) => setMotivos({ ...motivos, [f.data]: e.target.value })}
                            placeholder="Motivo (ex.: consulta médica)"
                            className={campo.replace('mt-1 ', '')}
                          />
                          <button type="button" disabled={ocupado || !(motivos[f.data] ?? '').trim()} onClick={() => justificar(f.data)} className={botaoLaranja}>
                            Justificar
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}
