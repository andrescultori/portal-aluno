import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { dataHoraLocal, inputParaIso, isoParaInput } from '../../lib/datas'
import { descreverPendencia, textosCategoria, type Pendencia } from '../../lib/avaliacoes'
import type { CategoriaAvaliacao, Semestre } from '../../types/alunos'

const db = () => supabase.schema('alunos')

const campo =
  'mt-1 block min-h-11 w-full min-w-0 max-w-full rounded-sm border border-gunmetal-gray/40 bg-pure-white px-2 text-sm font-normal text-onyx-black'
const botao =
  'min-h-11 rounded-sm bg-gunmetal-gray px-4 text-sm font-bold text-white transition hover:bg-gunmetal-gray-dark disabled:opacity-50'
const botaoLaranja =
  'min-h-11 rounded-sm bg-mandarin-orange px-4 text-sm font-bold text-onyx-black transition hover:bg-mandarin-orange-dark disabled:opacity-50'
const botaoLinha =
  'min-h-11 rounded-sm border-2 border-gunmetal-gray px-4 text-sm font-bold text-gunmetal-gray transition hover:bg-soft-pink/50 disabled:opacity-50'

const CATEGORIAS: CategoriaAvaliacao[] = ['tutoria', 'mentoria']

interface LinhaJanela {
  categoria: CategoriaAvaliacao
  abre_em: string | null
  fecha_em: string | null
  liberada_em: string | null
}

interface ResumoAluno {
  aluno_id: string
  nome: string
  completo: boolean
  pendencias: Pendencia[]
}

type Mensagem = { tipo: 'ok' | 'erro'; texto: string } | null

function estadoPeriodo(j: { abre_em: string | null; fecha_em: string | null }, agora: number): string {
  if (!j.abre_em || !j.fecha_em) return 'Período ainda não definido.'
  if (agora < new Date(j.abre_em).getTime()) return `Ainda não abriu (abre em ${dataHoraLocal(j.abre_em)}).`
  if (agora > new Date(j.fecha_em).getTime()) return `Encerrado em ${dataHoraLocal(j.fecha_em)}.`
  return `Aberto agora, até ${dataHoraLocal(j.fecha_em)}.`
}

export default function AvaliacoesJanelas({ semestre }: { semestre: Semestre }) {
  const [janelas, setJanelas] = useState<Record<CategoriaAvaliacao, LinhaJanela>>({
    tutoria: { categoria: 'tutoria', abre_em: null, fecha_em: null, liberada_em: null },
    mentoria: { categoria: 'mentoria', abre_em: null, fecha_em: null, liberada_em: null },
  })
  const [existentes, setExistentes] = useState<Set<CategoriaAvaliacao>>(new Set())
  const [campos, setCampos] = useState<Record<CategoriaAvaliacao, { abre: string; fecha: string }>>({
    tutoria: { abre: '', fecha: '' },
    mentoria: { abre: '', fecha: '' },
  })
  const [agendar, setAgendar] = useState('')
  const [resumo, setResumo] = useState<ResumoAluno[] | null>(null)
  const [mostrarPendentes, setMostrarPendentes] = useState(false)
  // Relógio lido quando os dados chegam (não durante a renderização).
  const [agora, setAgora] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [mensagem, setMensagem] = useState<Mensagem>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setAgora(Date.now())
    const [{ data, error }, resposta] = await Promise.all([
      db()
        .from('avaliacao_janelas')
        .select('categoria, abre_em, fecha_em, liberada_em')
        .eq('semestre_id', semestre.id),
      db().rpc('notas_semestre', { p_semestre: semestre.id }),
    ])
    if (error) setMensagem({ tipo: 'erro', texto: `Não foi possível carregar os períodos: ${error.message}` })
    const linhas = (data as LinhaJanela[]) ?? []
    const novo = {
      tutoria: { categoria: 'tutoria', abre_em: null, fecha_em: null, liberada_em: null },
      mentoria: { categoria: 'mentoria', abre_em: null, fecha_em: null, liberada_em: null },
    } as Record<CategoriaAvaliacao, LinhaJanela>
    for (const l of linhas) novo[l.categoria] = l
    setJanelas(novo)
    setExistentes(new Set(linhas.map((l) => l.categoria)))
    setCampos({
      tutoria: { abre: isoParaInput(novo.tutoria.abre_em), fecha: isoParaInput(novo.tutoria.fecha_em) },
      mentoria: { abre: isoParaInput(novo.mentoria.abre_em), fecha: isoParaInput(novo.mentoria.fecha_em) },
    })
    setResumo(
      resposta.error
        ? null
        : ((resposta.data as ResumoAluno[]) ?? []).map((r) => ({ ...r, pendencias: r.pendencias ?? [] })),
    )
    setCarregando(false)
  }, [semestre.id])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function salvarPeriodos() {
    setMensagem(null)
    const linhas: { semestre_id: string; categoria: CategoriaAvaliacao; abre_em: string | null; fecha_em: string | null }[] = []
    for (const cat of CATEGORIAS) {
      const abre = inputParaIso(campos[cat].abre)
      const fecha = inputParaIso(campos[cat].fecha)
      if (!abre && !fecha && !existentes.has(cat)) continue
      if ((abre && !fecha) || (!abre && fecha)) {
        setMensagem({ tipo: 'erro', texto: `${textosCategoria[cat].titulo}: preencha o início e o fim do período (ou deixe os dois em branco).` })
        return
      }
      if (abre && fecha && new Date(fecha) <= new Date(abre)) {
        setMensagem({ tipo: 'erro', texto: `${textosCategoria[cat].titulo}: o fim precisa ser depois do início.` })
        return
      }
      linhas.push({ semestre_id: semestre.id, categoria: cat, abre_em: abre, fecha_em: fecha })
    }
    if (linhas.length === 0) {
      setMensagem({ tipo: 'erro', texto: 'Defina pelo menos um período.' })
      return
    }
    setOcupado(true)
    // upsert só com estas colunas: a data de liberação, se já existir, não é tocada.
    const { error } = await db().from('avaliacao_janelas').upsert(linhas, { onConflict: 'semestre_id,categoria' })
    setOcupado(false)
    if (error) {
      setMensagem({ tipo: 'erro', texto: `Não foi possível salvar: ${error.message}` })
      return
    }
    setMensagem({ tipo: 'ok', texto: 'Períodos salvos. Tutores e mentores só conseguem preencher e enviar dentro deles.' })
    await carregar()
  }

  async function definirLiberacao(iso: string | null, confirmacao: string | null, sucesso: string) {
    if (existentes.size === 0) {
      setMensagem({ tipo: 'erro', texto: 'Defina e salve os períodos de avaliação antes de liberar os resultados.' })
      return
    }
    if (confirmacao && !confirm(confirmacao)) return
    setMensagem(null)
    setOcupado(true)
    const { error } = await db().from('avaliacao_janelas').update({ liberada_em: iso }).eq('semestre_id', semestre.id)
    setOcupado(false)
    if (error) {
      setMensagem({ tipo: 'erro', texto: `Não foi possível atualizar a liberação: ${error.message}` })
      return
    }
    setMensagem({ tipo: 'ok', texto: sucesso })
    setAgendar('')
    await carregar()
  }

  const liberacoes = CATEGORIAS.filter((c) => existentes.has(c)).map((c) => janelas[c].liberada_em)
  const todasLiberadas = liberacoes.length > 0 && liberacoes.every((l) => l && new Date(l).getTime() <= agora)
  const agendada = liberacoes.length > 0 && liberacoes.every((l) => l && new Date(l).getTime() > agora)
  const dataLiberacao = liberacoes.find((l) => l) ?? null
  const semDefinir = CATEGORIAS.filter((c) => !existentes.has(c))
  const incompletos = resumo?.filter((r) => !r.completo) ?? []

  if (carregando) return <p className="text-onyx-black">Carregando...</p>

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section aria-labelledby="jan-periodos">
        <h2 id="jan-periodos" className="font-display text-3xl text-gunmetal-gray">
          Períodos de avaliação — {semestre.codigo}
        </h2>
        <p className="mt-1 text-sm text-onyx-black">
          Em que dias e horas tutores e mentores podem preencher e enviar. Fora do período, a avaliação abre só para consulta.
          Horário de Brasília.
        </p>

        {CATEGORIAS.map((cat) => (
          <fieldset key={cat} className="mt-4 border border-gunmetal-gray/25 p-4">
            <legend className="px-1 font-display text-2xl text-gunmetal-gray">{textosCategoria[cat].titulo}</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold text-gunmetal-gray">
                Abre em
                <input
                  type="datetime-local"
                  value={campos[cat].abre}
                  onChange={(e) => {
                    setMensagem(null)
                    setCampos({ ...campos, [cat]: { ...campos[cat], abre: e.target.value } })
                  }}
                  className={campo}
                />
              </label>
              <label className="text-sm font-bold text-gunmetal-gray">
                Fecha em
                <input
                  type="datetime-local"
                  value={campos[cat].fecha}
                  onChange={(e) => {
                    setMensagem(null)
                    setCampos({ ...campos, [cat]: { ...campos[cat], fecha: e.target.value } })
                  }}
                  className={campo}
                />
              </label>
            </div>
            <p className="mt-2 text-sm text-onyx-black">Hoje: {estadoPeriodo(janelas[cat], agora)}</p>
          </fieldset>
        ))}
        <button type="button" onClick={salvarPeriodos} disabled={ocupado} className={`${botao} mt-4`}>
          Salvar períodos
        </button>
      </section>

      <section aria-labelledby="jan-liberar">
        <h2 id="jan-liberar" className="font-display text-3xl text-gunmetal-gray">
          Liberar resultados aos alunos
        </h2>
        <p className="mt-1 text-sm text-onyx-black">
          Os alunos só veem o resultado do semestre depois da liberação, e só quando <strong>todos</strong> os períodos estão
          liberados. Eles veem médias — nunca quem avaliou nem as observações.
        </p>

        <div className="mt-4 border border-gunmetal-gray/25 p-4">
          <p className="text-sm text-onyx-black">
            Situação:{' '}
            <strong className="text-gunmetal-gray">
              {todasLiberadas
                ? `liberado desde ${dataLiberacao ? dataHoraLocal(dataLiberacao) : ''}`
                : agendada
                  ? `agendado para ${dataLiberacao ? dataHoraLocal(dataLiberacao) : ''}`
                  : 'não liberado'}
            </strong>
          </p>
          {semDefinir.length > 0 && existentes.size > 0 && (
            <p className="mt-1 text-sm text-mandarin-orange-dark">
              {semDefinir.map((c) => textosCategoria[c].titulo).join(' e ')} ainda não tem período: a liberação vale só para o que
              está definido.
            </p>
          )}

          {resumo === null ? (
            <p className="mt-3 text-sm text-muted-purple">Não foi possível calcular os resultados agora.</p>
          ) : (
            <div className="mt-3">
              <p className="text-sm text-onyx-black">
                <strong>{resumo.length - incompletos.length}</strong> de <strong>{resumo.length}</strong> alunos com resultado
                completo
                {incompletos.length > 0 && (
                  <>
                    ; <strong className="text-mandarin-orange-dark">{incompletos.length}</strong> com pendências
                  </>
                )}
                .
              </p>
              {incompletos.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setMostrarPendentes((v) => !v)}
                    aria-expanded={mostrarPendentes}
                    className="mt-1 min-h-11 text-sm font-bold text-gunmetal-gray underline underline-offset-4"
                  >
                    {mostrarPendentes ? 'Esconder pendências' : 'Ver pendências por aluno'}
                  </button>
                  {mostrarPendentes && (
                    <ul className="mt-1 max-h-72 divide-y divide-gunmetal-gray/15 overflow-y-auto border border-gunmetal-gray/25">
                      {incompletos.map((r) => (
                        <li key={r.aluno_id} className="p-3 text-sm">
                          <span className="font-bold text-gunmetal-gray">{r.nome}</span>
                          <ul className="mt-1 list-disc pl-5 text-onyx-black">
                            {r.pendencias.map((p, i) => (
                              <li key={i}>{descreverPendencia(p)}</li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={ocupado || todasLiberadas}
              onClick={() =>
                definirLiberacao(
                  new Date().toISOString(),
                  incompletos.length > 0
                    ? `${incompletos.length} aluno(s) ainda têm pendências e verão um resultado PARCIAL, marcado como incompleto. Liberar mesmo assim?`
                    : 'Liberar agora os resultados do semestre para os alunos?',
                  'Resultados liberados: os alunos já podem ver.',
                )
              }
              className={botaoLaranja}
            >
              Liberar agora
            </button>
            <button
              type="button"
              disabled={ocupado || (!todasLiberadas && !agendada)}
              onClick={() =>
                definirLiberacao(null, 'Retirar a liberação? Os alunos deixam de ver os resultados.', 'Liberação retirada: os alunos não veem mais os resultados.')
              }
              className={botaoLinha}
            >
              Retirar liberação
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_auto]">
            <label className="text-sm font-bold text-gunmetal-gray">
              Ou agendar para
              <input type="datetime-local" value={agendar} onChange={(e) => setAgendar(e.target.value)} className={campo} />
            </label>
            <button
              type="button"
              disabled={ocupado || !inputParaIso(agendar)}
              onClick={() => {
                const iso = inputParaIso(agendar)
                if (iso) definirLiberacao(iso, null, `Liberação agendada para ${dataHoraLocal(iso)}.`)
              }}
              className={botaoLinha}
            >
              Agendar
            </button>
          </div>
        </div>
      </section>

      <div aria-live="polite" className="lg:col-span-2">
        {mensagem && (
          <p
            role={mensagem.tipo === 'erro' ? 'alert' : 'status'}
            className={`border-l-4 p-3 text-sm text-onyx-black ${
              mensagem.tipo === 'erro' ? 'border-mandarin-orange bg-soft-pink/60' : 'border-gunmetal-gray bg-neutral-tint'
            }`}
          >
            {mensagem.texto}
          </p>
        )}
      </div>
    </div>
  )
}
