import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import Modal from '../../../components/Modal'
import { fmtNota, lerNota, textoDoCampo } from '../../../lib/notas'
import type { Semestre } from '../../../types/alunos'
import { andarNaColuna, useAlunosDoEscopo, type Permissoes } from './escopo'

const db = () => supabase.schema('alunos')

interface Atividade {
  id: string
  ordem: number
  titulo: string
  data_aula: string | null
}
interface Linha {
  ativ: string
  quiz: string
  final: number | null
  estado: 'ocioso' | 'salvando' | 'salvo' | 'erro'
  msg?: string
  // mexeu e ainda não gravou (sair do campo sem mexer não grava nada)
  sujo?: boolean
}
interface Media {
  atividades: number | null
  total: number
  com_nota: number
}

const campoNota =
  'block min-h-11 w-20 rounded-sm border border-gunmetal-gray/40 bg-pure-white px-2 text-right text-sm tabular-nums text-onyx-black disabled:bg-neutral-tint'
const campo =
  'mt-1 block min-h-11 w-full min-w-0 rounded-sm border border-gunmetal-gray/40 bg-pure-white px-2 text-sm font-normal text-onyx-black'
const botaoLaranja =
  'min-h-11 rounded-sm bg-mandarin-orange px-4 text-sm font-bold text-onyx-black transition hover:bg-mandarin-orange-dark disabled:opacity-50'
const botaoLinha =
  'min-h-11 rounded-sm border-2 border-gunmetal-gray px-4 text-sm font-bold text-gunmetal-gray transition hover:bg-soft-pink/50 disabled:opacity-50'

function dataCurta(iso: string | null) {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export default function AtividadesNotas({ semestre, perm }: { semestre: Semestre; perm: Permissoes }) {
  const { alunos, carregando: carregandoAlunos, erro: erroAlunos } = useAlunosDoEscopo(semestre.id, perm)
  const [atividades, setAtividades] = useState<Atividade[]>([])
  const [atividadeId, setAtividadeId] = useState('')
  const [linhas, setLinhas] = useState<Record<string, Linha>>({})
  const [medias, setMedias] = useState<Record<string, Media>>({})
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [modal, setModal] = useState<null | { id: string | null; titulo: string; data: string }>(null)
  const [ocupado, setOcupado] = useState(false)

  const carregarAtividades = useCallback(
    async (manter?: string) => {
      const { data, error } = await db().from('atividades').select('id, ordem, titulo, data_aula').eq('semestre_id', semestre.id).order('ordem')
      if (error) setErro(`Não foi possível carregar as atividades: ${error.message}`)
      const lista = (data as Atividade[]) ?? []
      setAtividades(lista)
      setAtividadeId((atual) => {
        const alvo = manter ?? atual
        if (alvo && lista.some((a) => a.id === alvo)) return alvo
        // padrão: a aula mais recente que já aconteceu (ou a última cadastrada)
        const hoje = new Date().toISOString().slice(0, 10)
        const passadas = lista.filter((a) => a.data_aula && a.data_aula <= hoje)
        return (passadas[passadas.length - 1] ?? lista[lista.length - 1])?.id ?? ''
      })
      setCarregando(false)
    },
    [semestre.id],
  )

  useEffect(() => {
    carregarAtividades()
  }, [carregarAtividades])

  // notas já lançadas para a atividade escolhida
  useEffect(() => {
    if (!atividadeId) return
    let vivo = true
    ;(async () => {
      const { data, error } = await db().from('atividade_notas').select('aluno_id, ativ, quiz, final').eq('atividade_id', atividadeId)
      if (!vivo) return
      if (error) setErro(`Não foi possível carregar as notas: ${error.message}`)
      const novo: Record<string, Linha> = {}
      for (const r of (data as { aluno_id: string; ativ: number | null; quiz: number | null; final: number | null }[]) ?? []) {
        novo[r.aluno_id] = { ativ: textoDoCampo(r.ativ), quiz: textoDoCampo(r.quiz), final: r.final, estado: 'ocioso' }
      }
      setLinhas(novo)
    })()
    return () => {
      vivo = false
    }
  }, [atividadeId])

  // média das atividades de cada aluno (calculada no banco)
  const carregarMedia = useCallback(
    async (alunoId: string) => {
      const { data } = await db().rpc('atividades_aluno', { p_aluno: alunoId, p_semestre: semestre.id })
      const m = (data as Media[] | null)?.[0]
      if (m) setMedias((atual) => ({ ...atual, [alunoId]: m }))
    },
    [semestre.id],
  )
  useEffect(() => {
    alunos.forEach((a) => {
      carregarMedia(a.id)
    })
  }, [alunos, carregarMedia])

  const atividade = atividades.find((a) => a.id === atividadeId) ?? null
  const comNota = useMemo(() => alunos.filter((a) => linhas[a.id]?.final !== null && linhas[a.id]?.final !== undefined).length, [alunos, linhas])

  function digitar(alunoId: string, campoNome: 'ativ' | 'quiz', valor: string) {
    setLinhas((atual) => ({ ...atual, [alunoId]: { ...(atual[alunoId] ?? { ativ: '', quiz: '', final: null, estado: 'ocioso' }), [campoNome]: valor, estado: 'ocioso', msg: undefined, sujo: true } }))
  }

  async function salvar(alunoId: string) {
    const linha = linhas[alunoId]
    if (!linha || !linha.sujo || !atividade) return
    const a = lerNota(linha.ativ, 0, 9, 1)
    const q = lerNota(linha.quiz, 0, 1, 1)
    if (!a.ok || !q.ok) {
      setLinhas((atual) => ({ ...atual, [alunoId]: { ...linha, estado: 'erro', msg: (!a.ok ? `Atividade: ${a.erro}` : !q.ok ? `Quiz: ${q.erro}` : '') } }))
      return
    }
    setLinhas((atual) => ({ ...atual, [alunoId]: { ...linha, estado: 'salvando' } }))
    const { data, error } = await db()
      .from('atividade_notas')
      .upsert({ atividade_id: atividade.id, aluno_id: alunoId, ativ: a.valor, quiz: q.valor }, { onConflict: 'atividade_id,aluno_id' })
      .select('final')
      .single()
    if (error) {
      setLinhas((atual) => ({
        ...atual,
        [alunoId]: {
          ...linha,
          estado: 'erro',
          msg: error.message.includes('row-level security') ? 'Você não pode lançar nota para este aluno.' : `Não salvou: ${error.message}`,
        },
      }))
      return
    }
    setLinhas((atual) => ({ ...atual, [alunoId]: { ...linha, final: (data as { final: number | null }).final, estado: 'salvo', sujo: false } }))
    carregarMedia(alunoId)
  }

  async function salvarAtividade(e: React.FormEvent) {
    e.preventDefault()
    if (!modal) return
    setOcupado(true)
    const titulo = modal.titulo.trim()
    const dados = { titulo, data_aula: modal.data || null }
    const proximaOrdem = (atividades[atividades.length - 1]?.ordem ?? 0) + 1
    const { data, error } = modal.id
      ? await db().from('atividades').update(dados).eq('id', modal.id).select('id').single()
      : await db().from('atividades').insert({ ...dados, semestre_id: semestre.id, ordem: proximaOrdem }).select('id').single()
    setOcupado(false)
    if (error) {
      setErro(`Não foi possível salvar a atividade: ${error.message}`)
      return
    }
    setModal(null)
    setErro(null)
    await carregarAtividades((data as { id: string }).id)
  }

  if (carregando || carregandoAlunos) return <p className="text-onyx-black">Carregando...</p>

  return (
    <section aria-labelledby="atv-titulo">
      <h2 id="atv-titulo" className="sr-only">
        Notas das atividades
      </h2>
      {(erro || erroAlunos) && (
        <p role="alert" className="mb-3 border-l-4 border-mandarin-orange bg-soft-pink/60 p-3 text-sm text-onyx-black">
          {erro ?? erroAlunos}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-sm font-bold text-gunmetal-gray sm:max-w-md">
          Atividade (aula)
          <select value={atividadeId} onChange={(e) => setAtividadeId(e.target.value)} className={campo} disabled={atividades.length === 0}>
            {atividades.map((a) => (
              <option key={a.id} value={a.id}>
                {a.ordem}. {a.titulo}
                {a.data_aula ? ` (${dataCurta(a.data_aula)})` : ''}
              </option>
            ))}
          </select>
        </label>
        {perm.configura && (
          <>
            <button type="button" onClick={() => setModal({ id: null, titulo: '', data: '' })} className={botaoLaranja}>
              Nova atividade
            </button>
            {atividade && (
              <button type="button" onClick={() => setModal({ id: atividade.id, titulo: atividade.titulo, data: atividade.data_aula ?? '' })} className={botaoLinha}>
                Editar esta atividade
              </button>
            )}
          </>
        )}
      </div>

      {atividades.length === 0 ? (
        <p className="mt-4 border border-gunmetal-gray/25 p-4 text-sm text-onyx-black">
          {perm.configura ? 'Ainda não há atividades neste semestre. Crie a primeira em “Nova atividade”.' : 'A coordenação ainda não cadastrou as atividades deste semestre.'}
        </p>
      ) : alunos.length === 0 ? (
        <p className="mt-4 border border-gunmetal-gray/25 p-4 text-sm text-onyx-black">
          {perm.veTodos ? 'Nenhum aluno a ser avaliado neste semestre.' : 'Você ainda não tem alunos atribuídos na Tutoria neste semestre.'}
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm text-onyx-black">
            <strong>Atividade</strong> vale de 0 a 9 e <strong>Quiz</strong> de 0 a 1 (uma casa decimal, vírgula ou ponto). A nota da aula é a soma. Deixe em branco quem não fez:
            em branco não é zero. Use <kbd className="rounded border border-gunmetal-gray/40 px-1">Enter</kbd> ou as setas ↑ ↓ para descer; cada nota é salva ao sair do campo.
            {!perm.lanca && ' Você pode ver as notas, mas só tutores e a administração as lançam.'}
          </p>
          <p className="mt-2 text-sm text-muted-purple" aria-live="polite">
            {comNota} de {alunos.length} alunos com nota nesta aula
          </p>
          <div className="mt-2 overflow-x-auto border border-gunmetal-gray/25 bg-white">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-neutral-tint text-xs uppercase tracking-wide text-muted-purple">
                <tr>
                  <th scope="col" className="px-3 py-2">Aluno</th>
                  <th scope="col" className="px-2 py-2 text-right">Atividade (0–9)</th>
                  <th scope="col" className="px-2 py-2 text-right">Quiz (0–1)</th>
                  <th scope="col" className="px-2 py-2 text-right">Nota da aula</th>
                  <th scope="col" className="px-3 py-2 text-right">Média das atividades</th>
                  <th scope="col" className="px-3 py-2"><span className="sr-only">Situação</span></th>
                </tr>
              </thead>
              <tbody>
                {alunos.map((al, i) => {
                  const l = linhas[al.id] ?? { ativ: '', quiz: '', final: null, estado: 'ocioso' as const }
                  const m = medias[al.id]
                  return (
                    <tr key={al.id} className="border-t border-gunmetal-gray/15">
                      <th scope="row" className="px-3 py-1 font-bold text-gunmetal-gray">{al.nome}</th>
                      {(['ativ', 'quiz'] as const).map((c, ci) => (
                        <td key={c} className="px-2 py-1">
                          <input
                            inputMode="decimal"
                            aria-label={`${c === 'ativ' ? 'Atividade' : 'Quiz'} de ${al.nome}`}
                            data-g="atv"
                            data-r={i}
                            data-c={ci}
                            value={l[c]}
                            disabled={!perm.lanca}
                            onChange={(e) => digitar(al.id, c, e.target.value)}
                            onBlur={() => salvar(al.id)}
                            onKeyDown={(e) => andarNaColuna(e, 'atv', i, ci)}
                            onFocus={(e) => e.currentTarget.select()}
                            className={`${campoNota} ml-auto ${l.estado === 'erro' ? 'border-mandarin-orange' : ''}`}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1 text-right font-bold tabular-nums text-gunmetal-gray">{fmtNota(l.final)}</td>
                      <td className="px-3 py-1 text-right tabular-nums">
                        {m ? (
                          <span title={`${m.com_nota} de ${m.total} atividades com nota`}>
                            {fmtNota(m.atividades)} <span className="text-xs text-muted-purple">({m.com_nota}/{m.total})</span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-1 text-xs" aria-live="polite">
                        {l.estado === 'salvando' && <span className="text-muted-purple">Salvando...</span>}
                        {l.estado === 'salvo' && <span className="text-green-800">Salvo ✓</span>}
                        {l.estado === 'erro' && <span className="font-bold text-red-700">{l.msg}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal aberto={modal !== null} aoFechar={() => setModal(null)} titulo={modal?.id ? 'Editar atividade' : 'Nova atividade'}>
        {modal && (
          <form onSubmit={salvarAtividade} className="mt-4 space-y-4">
            <label className="block text-sm font-bold text-gunmetal-gray">
              Título (o tema da aula)
              <input required value={modal.titulo} onChange={(e) => setModal({ ...modal, titulo: e.target.value })} className={campo} />
            </label>
            <label className="block text-sm font-bold text-gunmetal-gray">
              Data da aula (opcional)
              <input type="date" value={modal.data} onChange={(e) => setModal({ ...modal, data: e.target.value })} className={campo} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={ocupado || !modal.titulo.trim()} className={botaoLaranja}>Salvar</button>
              <button type="button" onClick={() => setModal(null)} className={botaoLinha}>Cancelar</button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  )
}
