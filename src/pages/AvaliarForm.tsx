import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import {
  DESENVOLVIMENTO_OBRIGATORIO,
  ESCALA,
  NAO_SEI,
  SELECT_MODELO,
  VALOR_MINIMO_SEM_EXPLICACAO,
  descreverJanela,
  montarModelo,
  rotuloDaResposta,
  textosCategoria,
  traduzirErro,
  type LinhaAvaliar,
  type ModeloAvaliacao,
} from '../lib/avaliacoes'
import type { CategoriaAvaliacao } from '../types/alunos'

const db = () => supabase.schema('alunos')

const botaoLaranja =
  'min-h-12 rounded-sm bg-mandarin-orange px-6 font-display text-2xl font-bold text-onyx-black transition hover:bg-mandarin-orange-dark disabled:opacity-50'
const botaoContorno =
  'min-h-12 rounded-sm border-2 border-gunmetal-gray px-6 font-display text-2xl font-bold text-gunmetal-gray transition hover:bg-soft-pink/50 disabled:opacity-50'
const areaTexto =
  'mt-2 block w-full min-w-0 rounded-sm border border-gunmetal-gray/40 bg-pure-white p-3 text-base text-onyx-black disabled:bg-neutral-tint'

type Fase = 'form' | 'revisao' | 'enviada'
type Salvamento = { tipo: 'ocioso' | 'salvando' | 'salvo' | 'erro'; quando?: Date; mensagem?: string }

function hora(d?: Date) {
  return d?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) ?? ''
}

export default function AvaliarForm() {
  const params = useParams()
  const categoria = params.categoria as CategoriaAvaliacao
  const alunoId = params.alunoId ?? ''
  const categoriaValida = categoria === 'tutoria' || categoria === 'mentoria'

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [semestre, setSemestre] = useState<{ id: string; codigo: string } | null>(null)
  const [linha, setLinha] = useState<LinhaAvaliar | null>(null)
  const [modelo, setModelo] = useState<ModeloAvaliacao | null>(null)
  const [status, setStatus] = useState<'rascunho' | 'enviada'>('rascunho')
  const [respostas, setRespostas] = useState<Record<number, number>>({})
  const [textos, setTextos] = useState({ observacoes: '', desenvolvimento: '' })
  const [salvamento, setSalvamento] = useState<Salvamento>({ tipo: 'ocioso' })
  const [fase, setFase] = useState<Fase>('form')
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)

  const idRef = useRef<string | null>(null)
  const criandoRef = useRef<Promise<string> | null>(null)
  const textosRef = useRef(textos)
  const timerRef = useRef<number | undefined>(undefined)
  const pendentesRef = useRef(0)
  const temTextoSalvoRef = useRef(false)

  useEffect(() => {
    if (!categoriaValida) {
      setErro('Endereço inválido.')
      setCarregando(false)
      return
    }
    let ativo = true
    async function carregar() {
      const { data: sem, error: erroSem } = await db().from('semestres').select('id, codigo').eq('atual', true).maybeSingle()
      if (!ativo) return
      if (erroSem || !sem) {
        setErro(erroSem ? `Não foi possível carregar o semestre: ${erroSem.message}` : 'A coordenação ainda não definiu o semestre atual.')
        setCarregando(false)
        return
      }
      setSemestre(sem as { id: string; codigo: string })

      const { data: lista, error: erroLista } = await db().rpc('meus_alunos_avaliar', { p_semestre: sem.id })
      if (!ativo) return
      if (erroLista) {
        setErro(`Não foi possível carregar a avaliação: ${erroLista.message}`)
        setCarregando(false)
        return
      }
      const minha = ((lista as LinhaAvaliar[]) ?? []).find((l) => l.aluno_id === alunoId && l.categoria === categoria)
      if (!minha) {
        setErro('Este aluno não está atribuído a você neste semestre.')
        setCarregando(false)
        return
      }
      setLinha(minha)

      let modeloId: number | null = null
      if (minha.avaliacao_id) {
        idRef.current = minha.avaliacao_id
        const [{ data: av }, { data: rs }, { data: cm }] = await Promise.all([
          db().from('avaliacoes').select('status, modelo_id').eq('id', minha.avaliacao_id).single(),
          db().from('avaliacao_respostas').select('pergunta_id, valor').eq('avaliacao_id', minha.avaliacao_id),
          db().from('avaliacao_comentarios').select('observacoes, desenvolvimento').eq('avaliacao_id', minha.avaliacao_id).maybeSingle(),
        ])
        if (!ativo) return
        modeloId = (av as { modelo_id: number } | null)?.modelo_id ?? null
        setStatus((av as { status: 'rascunho' | 'enviada' } | null)?.status ?? 'rascunho')
        setRespostas(Object.fromEntries(((rs as { pergunta_id: number; valor: number }[]) ?? []).map((r) => [r.pergunta_id, r.valor])))
        const c = cm as { observacoes: string | null; desenvolvimento: string | null } | null
        const t = { observacoes: c?.observacoes ?? '', desenvolvimento: c?.desenvolvimento ?? '' }
        textosRef.current = t
        temTextoSalvoRef.current = !!c
        setTextos(t)
      }

      const consulta = db().from('avaliacao_modelos').select(SELECT_MODELO)
      const { data: mod, error: erroMod } = await (modeloId !== null
        ? consulta.eq('id', modeloId)
        : consulta.eq('categoria', categoria).eq('ativo', true)
      ).single()
      if (!ativo) return
      if (erroMod || !mod) {
        setErro('Não foi possível carregar as perguntas.')
        setCarregando(false)
        return
      }
      setModelo(montarModelo(mod as never))
      setCarregando(false)
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [alunoId, categoria, categoriaValida])

  const somenteLeitura = status === 'enviada' || (linha !== null && !linha.janela_aberta)

  // Cria a avaliação (rascunho) na primeira resposta; chamadas simultâneas esperam a mesma criação.
  const garantirAvaliacao = useCallback(async (): Promise<string> => {
    if (idRef.current) return idRef.current
    if (!criandoRef.current) {
      criandoRef.current = (async () => {
        if (!semestre || !modelo) throw new Error('Avaliação ainda não carregada.')
        const { data: equipeId, error: erroEquipe } = await db().rpc('minha_equipe_id')
        if (erroEquipe || !equipeId) throw new Error('Seu usuário não está na equipe cadastrada. Fale com a coordenação.')
        const { data, error } = await db()
          .from('avaliacoes')
          .insert({ semestre_id: semestre.id, aluno_id: alunoId, avaliador_equipe_id: equipeId, modelo_id: modelo.id, categoria })
          .select('id')
          .single()
        if (error || !data) throw new Error(error?.message ?? 'Não foi possível iniciar a avaliação.')
        idRef.current = data.id
        return data.id as string
      })().catch((e) => {
        criandoRef.current = null
        throw e
      })
    }
    return criandoRef.current
  }, [semestre, modelo, alunoId, categoria])

  const salvar = useCallback(
    async (tarefa: (avaliacaoId: string) => PromiseLike<{ error: { message: string } | null }>) => {
      pendentesRef.current += 1
      setSalvamento({ tipo: 'salvando' })
      try {
        const id = await garantirAvaliacao()
        const { error } = await tarefa(id)
        if (error) throw new Error(error.message)
        pendentesRef.current -= 1
        if (pendentesRef.current === 0) setSalvamento({ tipo: 'salvo', quando: new Date() })
      } catch (e) {
        pendentesRef.current -= 1
        setSalvamento({ tipo: 'erro', mensagem: traduzirErro(e instanceof Error ? e.message : String(e)) })
      }
    },
    [garantirAvaliacao],
  )

  function escolher(perguntaId: number, valor: number) {
    if (somenteLeitura) return
    setRespostas((r) => ({ ...r, [perguntaId]: valor }))
    salvar((id) =>
      db().from('avaliacao_respostas').upsert({ avaliacao_id: id, pergunta_id: perguntaId, valor }, { onConflict: 'avaliacao_id,pergunta_id' }),
    )
  }

  const gravarTextos = useCallback(async () => {
    window.clearTimeout(timerRef.current)
    timerRef.current = undefined
    const t = textosRef.current
    if (!temTextoSalvoRef.current && !t.observacoes.trim() && !t.desenvolvimento.trim()) return
    temTextoSalvoRef.current = true
    await salvar((id) =>
      db()
        .from('avaliacao_comentarios')
        .upsert({ avaliacao_id: id, observacoes: t.observacoes, desenvolvimento: t.desenvolvimento }, { onConflict: 'avaliacao_id' }),
    )
  }, [salvar])

  function digitar(campo: 'observacoes' | 'desenvolvimento', valor: string) {
    const novo = { ...textosRef.current, [campo]: valor }
    textosRef.current = novo
    setTextos(novo)
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      gravarTextos()
    }, 800)
  }

  // Ao sair da tela, grava o que ainda estava no temporizador.
  useEffect(
    () => () => {
      if (timerRef.current !== undefined) gravarTextos()
    },
    [gravarTextos],
  )

  const perguntas = useMemo(() => modelo?.grupos.flatMap((g) => g.perguntas) ?? [], [modelo])
  const respondidas = perguntas.filter((p) => respostas[p.id] !== undefined).length
  const baixas = perguntas.filter((p) => respostas[p.id] !== undefined && respostas[p.id] < VALOR_MINIMO_SEM_EXPLICACAO)
  const precisaObservacao = baixas.length > 0
  const observacaoVazia = !textos.observacoes.trim()
  const faltaDesenvolvimento = DESENVOLVIMENTO_OBRIGATORIO && !textos.desenvolvimento.trim()
  const podeEnviar =
    respondidas === perguntas.length && perguntas.length > 0 && !(precisaObservacao && observacaoVazia) && !faltaDesenvolvimento

  async function revisar() {
    await gravarTextos()
    setErroEnvio(null)
    setFase('revisao')
    window.scrollTo({ top: 0 })
  }

  async function enviar() {
    setEnviando(true)
    setErroEnvio(null)
    try {
      await gravarTextos()
      const id = await garantirAvaliacao()
      const { error } = await db().rpc('enviar_avaliacao', { p_avaliacao: id })
      if (error) throw new Error(error.message)
      setStatus('enviada')
      setFase('enviada')
      window.scrollTo({ top: 0 })
    } catch (e) {
      setErroEnvio(traduzirErro(e instanceof Error ? e.message : String(e)))
      setFase('form')
    } finally {
      setEnviando(false)
    }
  }

  if (carregando) return <p className="mx-auto max-w-3xl px-4 py-6 text-onyx-black">Carregando...</p>
  if (erro || !linha || !modelo || !semestre || !categoriaValida) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <p role="alert" className="border-l-4 border-mandarin-orange bg-soft-pink/60 p-3 text-sm text-onyx-black">
          {erro ?? 'Não foi possível abrir esta avaliação.'}
        </p>
        <Link to="/avaliar" className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-gunmetal-gray underline underline-offset-4">
          ← Meus alunos
        </Link>
      </div>
    )
  }

  const titulo = textosCategoria[categoria]

  if (fase === 'enviada') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-display text-[40px] leading-none text-gunmetal-gray md:text-[48px]">Avaliação enviada</h1>
        <p className="mt-3 text-onyx-black">
          Obrigado! Sua avaliação de <strong>{linha.nome}</strong> ({titulo.titulo}) foi enviada e não pode mais ser alterada por você.
          Se precisar corrigir algo, fale com a coordenação.
        </p>
        <Link to="/avaliar" className={`${botaoLaranja} mt-6 inline-flex items-center`}>
          Voltar para meus alunos
        </Link>
      </div>
    )
  }

  const numero = (id: number) => perguntas.findIndex((p) => p.id === id) + 1

  if (fase === 'revisao') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="font-display text-[40px] leading-none text-gunmetal-gray md:text-[48px]">Revisar e enviar</h1>
        <p className="mt-2 text-sm text-onyx-black">
          {linha.nome} · {titulo.titulo}. Depois de enviar, você não consegue mais editar.
        </p>

        {modelo.grupos.map((g) => (
          <section key={g.id} className="mt-5" aria-labelledby={`rev-${g.id}`}>
            <h2 id={`rev-${g.id}`} className="font-display text-2xl text-gunmetal-gray">
              {g.nome}
            </h2>
            <ul className="mt-1 divide-y divide-gunmetal-gray/15 border border-gunmetal-gray/25">
              {g.perguntas.map((p) => {
                const v = respostas[p.id]
                const baixo = v !== undefined && v < VALOR_MINIMO_SEM_EXPLICACAO
                return (
                  <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3 text-sm">
                    <span className="min-w-0 flex-1 basis-60 text-onyx-black">
                      {numero(p.id)}. {p.texto}
                    </span>
                    <span className={`font-bold ${v === undefined ? 'text-mandarin-orange-dark' : baixo ? 'text-mandarin-orange-dark' : 'text-gunmetal-gray'}`}>
                      {v === undefined ? 'Sem resposta' : rotuloDaResposta(v)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}

        <section className="mt-5">
          <h2 className="font-display text-2xl text-gunmetal-gray">{modelo.rotulo_observacoes}</h2>
          <p className="mt-1 whitespace-pre-wrap border border-gunmetal-gray/25 p-3 text-sm text-onyx-black">
            {textos.observacoes.trim() || '—'}
          </p>
          <h2 className="mt-4 font-display text-2xl text-gunmetal-gray">{modelo.rotulo_desenvolvimento}</h2>
          <p className="mt-1 whitespace-pre-wrap border border-gunmetal-gray/25 p-3 text-sm text-onyx-black">
            {textos.desenvolvimento.trim() || '—'}
          </p>
        </section>

        <div aria-live="polite">
          {erroEnvio && (
            <p role="alert" className="mt-4 border-l-4 border-mandarin-orange bg-soft-pink/60 p-3 text-sm text-onyx-black">
              {erroEnvio}
            </p>
          )}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => setFase('form')} disabled={enviando} className={botaoContorno}>
            Voltar e editar
          </button>
          <button type="button" onClick={enviar} disabled={enviando || !podeEnviar} className={botaoLaranja}>
            {enviando ? 'Enviando...' : 'Enviar avaliação'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-4">
      <Link to="/avaliar" className="inline-flex min-h-11 items-center text-sm font-bold text-gunmetal-gray underline underline-offset-4">
        ← Meus alunos
      </Link>

      <p className="mt-1 text-sm font-bold uppercase tracking-[0.12em] text-gunmetal-gray">Semestre {semestre.codigo}</p>
      <h1 className="font-display text-[40px] leading-none text-gunmetal-gray md:text-[48px]">
        Avaliação Pedagógica: {titulo.titulo}
      </h1>

      <section className="mt-4 bg-soft-pink p-4" aria-label="Aluno avaliado">
        <p className="text-xs font-bold uppercase tracking-wide text-gunmetal-gray">Aluno(a)</p>
        <p className="font-display text-3xl font-bold leading-tight text-gunmetal-gray">{linha.nome}</p>
        {linha.casa && <p className="text-sm text-onyx-black">{linha.casa}</p>}
      </section>

      <div className="mt-4 space-y-2 text-sm text-onyx-black">
        <p>{titulo.saudacao}</p>
        <p>
          Esse espaço é para que você consiga avaliar cada aluno, para que no final possamos avaliá-lo da melhor maneira.
          <br />
          <strong>Por favor, seja o(a) mais sincero(a) possível!</strong>
        </p>
        <p>Esta avaliação é individual: uma para cada aluno(a). Suas respostas ficam salvas sozinhas enquanto você preenche.</p>
        <p className="text-muted-purple">
          Seu nome fica registrado nesta avaliação. As respostas e as observações são vistas só por você e pela coordenação; o
          aluno vê apenas médias, depois que a coordenação liberar os resultados.
        </p>
        <p>
          <span className="text-mandarin-orange-dark" aria-hidden="true">*</span> Obrigatória
        </p>
      </div>

      {somenteLeitura && (
        <p role="status" className="mt-4 border-l-4 border-gunmetal-gray bg-neutral-tint p-3 text-sm text-onyx-black">
          {status === 'enviada'
            ? 'Esta avaliação já foi enviada. Você pode apenas consultar.'
            : `Não é possível editar agora. ${descreverJanela(linha)}`}
        </p>
      )}

      <div className="sticky top-0 z-10 -mx-4 mt-4 flex flex-wrap items-center justify-between gap-2 border-y border-gunmetal-gray/20 bg-pure-white px-4 py-2">
        <span className="text-sm font-bold text-gunmetal-gray">
          {respondidas} de {perguntas.length} respondidas
        </span>
        <span aria-live="polite" className="text-xs text-muted-purple">
          {salvamento.tipo === 'salvando' && 'Salvando...'}
          {salvamento.tipo === 'salvo' && `Salvo às ${hora(salvamento.quando)}`}
          {salvamento.tipo === 'ocioso' && !somenteLeitura && 'As respostas são salvas automaticamente'}
        </span>
      </div>
      {salvamento.tipo === 'erro' && (
        <p role="alert" className="mt-2 border-l-4 border-mandarin-orange bg-soft-pink/60 p-3 text-sm text-onyx-black">
          {salvamento.mensagem}
        </p>
      )}

      {modelo.grupos.map((g) => (
        <section key={g.id} className="mt-6" aria-labelledby={`grupo-${g.id}`}>
          <h2 id={`grupo-${g.id}`} className="border-b-4 border-mandarin-orange pb-1 font-display text-3xl text-gunmetal-gray">
            {g.nome}
          </h2>
          {g.perguntas.map((p) => {
            const v = respostas[p.id]
            return (
              <fieldset key={p.id} disabled={somenteLeitura} className="mt-4 min-w-0 border-b border-gunmetal-gray/15 pb-4">
                <legend className="text-base font-bold text-gunmetal-gray">
                  {numero(p.id)}. {p.texto}{' '}
                  <span className="text-mandarin-orange-dark" aria-hidden="true">*</span>
                  <span className="sr-only">(obrigatória)</span>
                </legend>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {ESCALA.map((o) => (
                    <label key={o.valor} className="block cursor-pointer">
                      <input
                        type="radio"
                        name={`p-${p.id}`}
                        value={o.valor}
                        checked={v === o.valor}
                        onChange={() => escolher(p.id, o.valor)}
                        className="peer sr-only"
                      />
                      <span className="flex min-h-12 items-center justify-center rounded-sm border-2 border-gunmetal-gray/40 px-2 text-center text-sm font-bold text-gunmetal-gray transition [input:not(:checked)+&]:hover:bg-soft-pink/60 peer-checked:border-gunmetal-gray peer-checked:bg-gunmetal-gray peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-mandarin-orange peer-disabled:opacity-60">
                        {o.rotulo}
                      </span>
                    </label>
                  ))}
                </div>
                <label className="mt-3 block cursor-pointer sm:w-fit">
                  <input
                    type="radio"
                    name={`p-${p.id}`}
                    value={NAO_SEI.valor}
                    checked={v === NAO_SEI.valor}
                    onChange={() => escolher(p.id, NAO_SEI.valor)}
                    className="peer sr-only"
                  />
                  <span className="flex min-h-11 items-center justify-center rounded-sm border border-dashed border-muted-purple px-3 text-center text-sm text-muted-purple transition [input:not(:checked)+&]:hover:bg-neutral-tint peer-checked:border-solid peer-checked:border-mandarin-orange peer-checked:bg-soft-pink peer-checked:font-bold peer-checked:text-gunmetal-gray peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-mandarin-orange peer-disabled:opacity-60">
                    {NAO_SEI.rotulo}
                  </span>
                </label>
              </fieldset>
            )
          })}
        </section>
      ))}

      <section className="mt-8">
        <label htmlFor="obs" className="block text-base font-bold text-gunmetal-gray">
          {modelo.rotulo_observacoes}{' '}
          {precisaObservacao ? (
            <span className="text-mandarin-orange-dark">* obrigatória</span>
          ) : (
            <span className="text-sm font-normal text-muted-purple">(opcional se tudo for Bom ou Excelente)</span>
          )}
        </label>
        {modelo.ajuda_observacoes && <p className="text-sm text-muted-purple">{modelo.ajuda_observacoes}</p>}
        <textarea
          id="obs"
          rows={4}
          value={textos.observacoes}
          disabled={somenteLeitura}
          onChange={(e) => digitar('observacoes', e.target.value)}
          onBlur={() => gravarTextos()}
          aria-required={precisaObservacao}
          className={areaTexto}
        />
        {precisaObservacao && observacaoVazia && !somenteLeitura && (
          <p className="mt-1 text-sm font-bold text-mandarin-orange-dark">
            Há {baixas.length} resposta(s) abaixo de “Bom”: explique aqui antes de enviar.
          </p>
        )}

        <label htmlFor="dev" className="mt-6 block text-base font-bold text-gunmetal-gray">
          {modelo.rotulo_desenvolvimento}{' '}
          {DESENVOLVIMENTO_OBRIGATORIO && <span className="text-mandarin-orange-dark">*</span>}
        </label>
        <textarea
          id="dev"
          rows={4}
          value={textos.desenvolvimento}
          disabled={somenteLeitura}
          onChange={(e) => digitar('desenvolvimento', e.target.value)}
          onBlur={() => gravarTextos()}
          className={areaTexto}
        />
      </section>

      <div aria-live="polite">
        {erroEnvio && (
          <p role="alert" className="mt-4 border-l-4 border-mandarin-orange bg-soft-pink/60 p-3 text-sm text-onyx-black">
            {erroEnvio}
          </p>
        )}
      </div>

      {!somenteLeitura && (
        <div className="mt-6">
          <button type="button" onClick={revisar} disabled={!podeEnviar} className={botaoLaranja}>
            Revisar e enviar
          </button>
          {!podeEnviar && (
            <p className="mt-2 text-sm text-muted-purple">
              {respondidas < perguntas.length
                ? `Faltam ${perguntas.length - respondidas} pergunta(s) para responder.`
                : precisaObservacao && observacaoVazia
                  ? 'Escreva a observação para poder enviar.'
                  : 'Preencha o campo obrigatório para poder enviar.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
