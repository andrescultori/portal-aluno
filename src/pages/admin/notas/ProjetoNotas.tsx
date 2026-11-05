import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import Modal from '../../../components/Modal'
import { codigoDeNome, fmtNota, lerNota, textoDoCampo } from '../../../lib/notas'
import type { Semestre } from '../../../types/alunos'
import { andarNaColuna, useAlunosDoEscopo, type Permissoes } from './escopo'

const db = () => supabase.schema('alunos')

interface Componente {
  codigo: string
  nome: string
  peso: number
}
interface Celula {
  texto: string
  estado: 'ocioso' | 'salvando' | 'salvo' | 'erro'
  msg?: string
  sujo?: boolean
}
interface Resumo {
  projeto: number | null
  componentes: number
  com_nota: number
  faltando: string[] | null
}

const campoNota =
  'block min-h-11 w-20 rounded-sm border border-gunmetal-gray/40 bg-pure-white px-2 text-right text-sm tabular-nums text-onyx-black disabled:bg-neutral-tint'
const campo =
  'mt-1 block min-h-11 w-full min-w-0 rounded-sm border border-gunmetal-gray/40 bg-pure-white px-2 text-sm font-normal text-onyx-black'
const botaoLaranja =
  'min-h-11 rounded-sm bg-mandarin-orange px-4 text-sm font-bold text-onyx-black transition hover:bg-mandarin-orange-dark disabled:opacity-50'
const botaoLinha =
  'min-h-11 rounded-sm border-2 border-gunmetal-gray px-4 text-sm font-bold text-gunmetal-gray transition hover:bg-soft-pink/50 disabled:opacity-50'

export default function ProjetoNotas({ semestre, perm }: { semestre: Semestre; perm: Permissoes }) {
  const { alunos, carregando: carregandoAlunos, erro: erroAlunos } = useAlunosDoEscopo(semestre.id, perm)
  const [componentes, setComponentes] = useState<Componente[]>([])
  const [pesos, setPesos] = useState<Record<string, string>>({})
  const [celulas, setCelulas] = useState<Record<string, Celula>>({}) // chave: aluno|codigo
  const [resumos, setResumos] = useState<Record<string, Resumo>>({})
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [novo, setNovo] = useState<null | { nome: string }>(null)

  const carregarComponentes = useCallback(async () => {
    const { data, error } = await db().from('projeto_componentes').select('codigo, nome, peso').eq('semestre_id', semestre.id).order('nome')
    if (error) setErro(`Não foi possível carregar os componentes: ${error.message}`)
    const lista = ((data as { codigo: string; nome: string; peso: number | string }[]) ?? []).map((c) => ({ ...c, peso: Number(c.peso) }))
    setComponentes(lista)
    setPesos(Object.fromEntries(lista.map((c) => [c.codigo, textoDoCampo(c.peso)])))
    setCarregando(false)
  }, [semestre.id])

  useEffect(() => {
    carregarComponentes()
  }, [carregarComponentes])

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const { data, error } = await db().from('projeto_notas').select('aluno_id, codigo, nota').eq('semestre_id', semestre.id)
      if (!vivo) return
      if (error) setErro(`Não foi possível carregar as notas: ${error.message}`)
      const novo: Record<string, Celula> = {}
      for (const r of (data as { aluno_id: string; codigo: string; nota: number | null }[]) ?? []) {
        novo[`${r.aluno_id}|${r.codigo}`] = { texto: textoDoCampo(r.nota), estado: 'ocioso' }
      }
      setCelulas(novo)
    })()
    return () => {
      vivo = false
    }
  }, [semestre.id])

  const carregarResumo = useCallback(
    async (alunoId: string) => {
      const { data } = await db().rpc('projeto_aluno', { p_aluno: alunoId, p_semestre: semestre.id })
      const r = (data as Resumo[] | null)?.[0]
      if (r) setResumos((atual) => ({ ...atual, [alunoId]: r }))
    },
    [semestre.id],
  )
  useEffect(() => {
    alunos.forEach((a) => {
      carregarResumo(a.id)
    })
  }, [alunos, carregarResumo])

  const pesosIguais = useMemo(() => componentes.length > 0 && new Set(componentes.map((c) => c.peso)).size === 1, [componentes])
  const nomePorCodigo = useMemo(() => new Map(componentes.map((c) => [c.codigo, c.nome])), [componentes])

  async function salvarPesos() {
    setMensagem(null)
    const mudados: { codigo: string; peso: number }[] = []
    for (const c of componentes) {
      const lido = lerNota(pesos[c.codigo] ?? '', 0, 1000, 2)
      if (!lido.ok || lido.valor === null) {
        setMensagem({ tipo: 'erro', texto: `Peso de “${c.nome}”: ${lido.ok ? 'informe um número (0 = não conta).' : lido.erro}` })
        return
      }
      if (lido.valor !== c.peso) mudados.push({ codigo: c.codigo, peso: lido.valor })
    }
    if (mudados.length === 0) {
      setMensagem({ tipo: 'ok', texto: 'Nenhum peso mudou.' })
      return
    }
    setOcupado(true)
    for (const m of mudados) {
      const { error } = await db().from('projeto_componentes').update({ peso: m.peso }).eq('semestre_id', semestre.id).eq('codigo', m.codigo)
      if (error) {
        setOcupado(false)
        setMensagem({ tipo: 'erro', texto: `Não foi possível salvar: ${error.message}` })
        return
      }
    }
    setOcupado(false)
    setMensagem({ tipo: 'ok', texto: 'Pesos salvos. As notas do projeto já foram recalculadas.' })
    await carregarComponentes()
    alunos.forEach((a) => carregarResumo(a.id))
  }

  async function adicionarComponente(e: React.FormEvent) {
    e.preventDefault()
    if (!novo) return
    const nome = novo.nome.trim()
    const codigo = codigoDeNome(nome)
    if (!codigo) return
    if (componentes.some((c) => c.codigo === codigo)) {
      setMensagem({ tipo: 'erro', texto: 'Já existe um componente com esse nome.' })
      return
    }
    setOcupado(true)
    // peso 0 = ainda não conta: a coordenação define o peso antes de valer
    const { error } = await db().from('projeto_componentes').insert({ semestre_id: semestre.id, codigo, nome, peso: 0 })
    setOcupado(false)
    if (error) {
      setMensagem({ tipo: 'erro', texto: `Não foi possível criar: ${error.message}` })
      return
    }
    setNovo(null)
    setMensagem({ tipo: 'ok', texto: `“${nome}” criado com peso 0 (não conta). Defina o peso e salve.` })
    await carregarComponentes()
  }

  function digitar(alunoId: string, codigo: string, texto: string) {
    setCelulas((atual) => ({ ...atual, [`${alunoId}|${codigo}`]: { texto, estado: 'ocioso', sujo: true } }))
  }

  async function salvarNota(alunoId: string, codigo: string) {
    const chave = `${alunoId}|${codigo}`
    const c = celulas[chave]
    if (!c || !c.sujo) return
    const lido = lerNota(c.texto, 0, 10, 2)
    if (!lido.ok) {
      setCelulas((atual) => ({ ...atual, [chave]: { ...c, estado: 'erro', msg: lido.erro } }))
      return
    }
    setCelulas((atual) => ({ ...atual, [chave]: { ...c, estado: 'salvando' } }))
    const { error } = await db()
      .from('projeto_notas')
      .upsert({ semestre_id: semestre.id, aluno_id: alunoId, codigo, nota: lido.valor }, { onConflict: 'semestre_id,aluno_id,codigo' })
    if (error) {
      setCelulas((atual) => ({
        ...atual,
        [chave]: { ...c, estado: 'erro', msg: error.message.includes('row-level security') ? 'Você não pode lançar nota para este aluno.' : `Não salvou: ${error.message}` },
      }))
      return
    }
    setCelulas((atual) => ({ ...atual, [chave]: { ...c, estado: 'salvo', sujo: false } }))
    carregarResumo(alunoId)
  }

  if (carregando || carregandoAlunos) return <p className="text-onyx-black">Carregando...</p>

  return (
    <section aria-labelledby="proj-titulo">
      <h2 id="proj-titulo" className="sr-only">
        Projeto final
      </h2>
      {(erro || erroAlunos) && (
        <p role="alert" className="mb-3 border-l-4 border-mandarin-orange bg-soft-pink/60 p-3 text-sm text-onyx-black">
          {erro ?? erroAlunos}
        </p>
      )}

      <div className="border border-gunmetal-gray/25 p-4">
        <h3 className="font-display text-2xl text-gunmetal-gray">Componentes e pesos</h3>
        <p className="mt-1 text-sm text-onyx-black">
          A nota do projeto é a média ponderada dos componentes que o aluno já tem nota (os pesos se reajustam entre eles). Peso 0 = o componente não conta.
          {!perm.configura && ' Só a coordenação e a administração mudam os pesos.'}
        </p>
        {pesosIguais && (
          <p role="status" className="mt-2 border-l-4 border-mandarin-orange bg-soft-pink/60 p-3 text-sm text-onyx-black">
            Os pesos ainda estão todos iguais (valor provisório). A coordenação precisa confirmar os pesos reais antes de valer para as notas finais.
          </p>
        )}
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {componentes.map((c) => (
            <li key={c.codigo}>
              <label className="block text-sm font-bold text-gunmetal-gray">
                {c.nome}
                <input
                  inputMode="decimal"
                  value={pesos[c.codigo] ?? ''}
                  disabled={!perm.configura}
                  onChange={(e) => setPesos({ ...pesos, [c.codigo]: e.target.value })}
                  className={`${campo} w-28 text-right tabular-nums`}
                  aria-label={`Peso de ${c.nome}`}
                />
              </label>
            </li>
          ))}
        </ul>
        {perm.configura && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={salvarPesos} disabled={ocupado} className={botaoLaranja}>
              Salvar pesos
            </button>
            <button type="button" onClick={() => setNovo({ nome: '' })} className={botaoLinha}>
              Novo componente
            </button>
          </div>
        )}
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
      </div>

      <h3 className="mt-6 font-display text-2xl text-gunmetal-gray">Notas do projeto</h3>
      {alunos.length === 0 ? (
        <p className="mt-2 border border-gunmetal-gray/25 p-4 text-sm text-onyx-black">
          {perm.veTodos ? 'Nenhum aluno a ser avaliado neste semestre.' : 'Você ainda não tem alunos atribuídos na Tutoria neste semestre.'}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-onyx-black">
            Cada componente vale de 0 a 10 (até 2 casas decimais). Em branco = ainda sem nota (não é zero). Enter ou ↑ ↓ descem na coluna; a nota é salva ao sair do campo.
            {!perm.lanca && ' Você pode ver as notas, mas só tutores e a administração as lançam.'}
          </p>
          <div className="mt-2 overflow-x-auto border border-gunmetal-gray/25 bg-white">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-neutral-tint text-xs uppercase tracking-wide text-muted-purple">
                <tr>
                  <th scope="col" className="px-3 py-2">Aluno</th>
                  {componentes.map((c) => (
                    <th key={c.codigo} scope="col" className="px-2 py-2 text-right">
                      {c.nome}
                      <span className="block font-normal normal-case">peso {fmtNota(c.peso)}</span>
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2 text-right">Nota do projeto</th>
                </tr>
              </thead>
              <tbody>
                {alunos.map((al, i) => {
                  const r = resumos[al.id]
                  return (
                    <tr key={al.id} className="border-t border-gunmetal-gray/15">
                      <th scope="row" className="px-3 py-1 font-bold text-gunmetal-gray">{al.nome}</th>
                      {componentes.map((c, ci) => {
                        const cel = celulas[`${al.id}|${c.codigo}`] ?? { texto: '', estado: 'ocioso' as const }
                        return (
                          <td key={c.codigo} className="px-2 py-1">
                            <input
                              inputMode="decimal"
                              aria-label={`${c.nome} de ${al.nome}`}
                              data-g="proj"
                              data-r={i}
                              data-c={ci}
                              value={cel.texto}
                              disabled={!perm.lanca}
                              onChange={(e) => digitar(al.id, c.codigo, e.target.value)}
                              onBlur={() => salvarNota(al.id, c.codigo)}
                              onKeyDown={(e) => andarNaColuna(e, 'proj', i, ci)}
                              onFocus={(e) => e.currentTarget.select()}
                              title={cel.estado === 'erro' ? cel.msg : undefined}
                              className={`${campoNota} ml-auto ${cel.estado === 'erro' ? 'border-mandarin-orange' : ''}`}
                            />
                            <span className="block min-h-4 text-right text-xs" aria-live="polite">
                              {cel.estado === 'salvando' && <span className="text-muted-purple">Salvando...</span>}
                              {cel.estado === 'salvo' && <span className="text-green-800">Salvo ✓</span>}
                              {cel.estado === 'erro' && <span className="font-bold text-red-700">{cel.msg}</span>}
                            </span>
                          </td>
                        )
                      })}
                      <td className="px-3 py-1 text-right tabular-nums">
                        <strong className="text-gunmetal-gray">{fmtNota(r?.projeto)}</strong>
                        {r?.faltando && r.faltando.length > 0 && (
                          <span className="block text-xs text-muted-purple">falta: {r.faltando.map((k) => nomePorCodigo.get(k) ?? k).join(', ')}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal aberto={novo !== null} aoFechar={() => setNovo(null)} titulo="Novo componente do projeto">
        {novo && (
          <form onSubmit={adicionarComponente} className="mt-4 space-y-4">
            <label className="block text-sm font-bold text-gunmetal-gray">
              Nome (ex.: Banca)
              <input required value={novo.nome} onChange={(e) => setNovo({ nome: e.target.value })} className={campo} />
            </label>
            <p className="text-sm text-onyx-black">Ele nasce com peso 0 (não conta) até você definir o peso. Componentes não podem ser apagados: as notas já lançadas ficam guardadas.</p>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={ocupado || !codigoDeNome(novo.nome)} className={botaoLaranja}>Criar</button>
              <button type="button" onClick={() => setNovo(null)} className={botaoLinha}>Cancelar</button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  )
}
