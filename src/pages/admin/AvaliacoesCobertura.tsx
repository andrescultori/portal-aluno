import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { textosCategoria } from '../../lib/avaliacoes'
import type { CategoriaAvaliacao, Semestre } from '../../types/alunos'

const db = () => supabase.schema('alunos')

const campo =
  'mt-1 block min-h-11 w-full min-w-0 max-w-full rounded-sm border border-gunmetal-gray/40 bg-pure-white px-2 text-sm font-normal text-onyx-black'
const botaoLaranja =
  'min-h-11 rounded-sm bg-mandarin-orange px-4 text-sm font-bold text-onyx-black transition hover:bg-mandarin-orange-dark disabled:opacity-50'

type Situacao = 'nao_iniciada' | 'rascunho' | 'enviada' | 'sem_avaliador'

interface LinhaCobertura {
  aluno_id: string
  aluno: string
  casa: string | null
  categoria: CategoriaAvaliacao
  equipe_id: string | null
  avaliador: string | null
  esperado: boolean | null
  situacao: Situacao
  respondidas: number
  total: number
}

const rotuloSituacao = (l: LinhaCobertura): string =>
  l.situacao === 'enviada'
    ? 'Enviada'
    : l.situacao === 'rascunho'
      ? `Rascunho ${l.respondidas}/${l.total}`
      : l.situacao === 'nao_iniciada'
        ? 'Não iniciada'
        : 'Sem avaliador'

const classeSituacao: Record<Situacao, string> = {
  enviada: 'bg-gunmetal-gray text-white',
  rascunho: 'bg-soft-pink text-gunmetal-gray',
  nao_iniciada: 'border border-gunmetal-gray/50 text-gunmetal-gray',
  sem_avaliador: 'border border-mandarin-orange bg-mandarin-orange/15 text-onyx-black',
}

// Pendente = esperado e ainda não enviado (ou aluno sem nenhum avaliador).
const ehPendente = (l: LinhaCobertura) =>
  l.situacao === 'sem_avaliador' || (l.esperado === true && l.situacao !== 'enviada')

type Visao = 'avaliador' | 'aluno'

export default function AvaliacoesCobertura({ semestre }: { semestre: Semestre }) {
  const [linhas, setLinhas] = useState<LinhaCobertura[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [visao, setVisao] = useState<Visao>('avaliador')
  const [categoria, setCategoria] = useState<'' | CategoriaAvaliacao>('')
  const [soPendentes, setSoPendentes] = useState(true)
  const [casa, setCasa] = useState('')
  const [busca, setBusca] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    const { data, error } = await db().rpc('cobertura_semestre', { p_semestre: semestre.id })
    if (error) {
      setErro(
        error.message.includes('cobertura_semestre')
          ? 'A consulta de cobertura ainda não foi instalada no banco (migração 14).'
          : `Não foi possível carregar a cobertura: ${error.message}`,
      )
      setLinhas([])
    } else {
      setLinhas((data as LinhaCobertura[]) ?? [])
    }
    setCarregando(false)
  }, [semestre.id])

  useEffect(() => {
    carregar()
  }, [carregar])

  const casas = useMemo(() => [...new Set(linhas.map((l) => l.casa).filter((c): c is string => !!c))].sort(), [linhas])

  const filtradas = useMemo(() => {
    const termo = busca
      .trim()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
    const sem = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    return linhas.filter((l) => {
      if (categoria && l.categoria !== categoria) return false
      if (casa && l.casa !== casa) return false
      if (termo && !sem(l.aluno).includes(termo) && !sem(l.avaliador ?? '').includes(termo)) return false
      return true
    })
  }, [linhas, categoria, casa, busca])

  const contagem = useMemo(() => {
    const esperadas = filtradas.filter((l) => l.esperado === true)
    return {
      esperadas: esperadas.length,
      enviadas: esperadas.filter((l) => l.situacao === 'enviada').length,
      rascunhos: esperadas.filter((l) => l.situacao === 'rascunho').length,
      naoIniciadas: esperadas.filter((l) => l.situacao === 'nao_iniciada').length,
      semAvaliador: filtradas.filter((l) => l.situacao === 'sem_avaliador').length,
    }
  }, [filtradas])

  const porAvaliador = useMemo(() => {
    const mapa = new Map<string, { nome: string; itens: LinhaCobertura[] }>()
    for (const l of filtradas) {
      if (!l.equipe_id || l.esperado !== true) continue
      const m = mapa.get(l.equipe_id) ?? { nome: l.avaliador ?? '—', itens: [] }
      m.itens.push(l)
      mapa.set(l.equipe_id, m)
    }
    return [...mapa.entries()]
      .map(([id, m]) => ({
        id,
        nome: m.nome,
        enviadas: m.itens.filter((i) => i.situacao === 'enviada').length,
        total: m.itens.length,
        pendentes: m.itens.filter(ehPendente),
      }))
      .filter((a) => !soPendentes || a.pendentes.length > 0)
      .sort((a, b) => b.pendentes.length - a.pendentes.length || a.nome.localeCompare(b.nome))
  }, [filtradas, soPendentes])

  const porAluno = useMemo(() => {
    const mapa = new Map<string, { nome: string; casa: string | null; itens: LinhaCobertura[] }>()
    for (const l of filtradas) {
      const m = mapa.get(l.aluno_id) ?? { nome: l.aluno, casa: l.casa, itens: [] }
      m.itens.push(l)
      mapa.set(l.aluno_id, m)
    }
    return [...mapa.entries()]
      .map(([id, m]) => ({ id, ...m, pendente: m.itens.some(ehPendente) }))
      .filter((a) => !soPendentes || a.pendente)
  }, [filtradas, soPendentes])

  const semSemAvaliador = filtradas.filter((l) => l.situacao === 'sem_avaliador')

  async function copiarPendencias() {
    const titulo = categoria ? textosCategoria[categoria].titulo : 'Tutoria e Mentoria'
    const linhasTexto = [`Pendências de avaliação — ${semestre.codigo} (${titulo})`]
    const comPendencia = porAvaliador.filter((a) => a.pendentes.length > 0)
    for (const a of comPendencia) {
      const detalhe = a.pendentes
        .filter((p) => p.situacao !== 'sem_avaliador')
        .map((p) => `${p.aluno}${categoria ? '' : ` (${textosCategoria[p.categoria].titulo})`}${p.situacao === 'rascunho' ? ' — rascunho' : ''}`)
        .join(', ')
      linhasTexto.push(`• ${a.nome} (${a.pendentes.length} pendente${a.pendentes.length === 1 ? '' : 's'}): ${detalhe}`)
    }
    if (semSemAvaliador.length > 0) {
      linhasTexto.push(
        `Sem avaliador atribuído: ${[...new Set(semSemAvaliador.map((l) => `${l.aluno}${categoria ? '' : ` (${textosCategoria[l.categoria].titulo})`}`))].join(', ')}`,
      )
    }
    if (linhasTexto.length === 1) linhasTexto.push('Nenhuma pendência. 🎉')
    const texto = linhasTexto.join('\n')
    try {
      await navigator.clipboard.writeText(texto)
      setAviso('Lista copiada. É só colar no WhatsApp ou no e-mail.')
    } catch {
      window.prompt('Copie a lista abaixo (Ctrl+C):', texto)
      setAviso(null)
    }
  }

  if (carregando) return <p className="text-onyx-black">Carregando...</p>
  if (erro)
    return (
      <p role="alert" className="border-l-4 border-mandarin-orange bg-soft-pink/60 p-3 text-sm text-onyx-black">
        {erro}
      </p>
    )

  return (
    <section aria-labelledby="cob-titulo">
      <h2 id="cob-titulo" className="font-display text-3xl text-gunmetal-gray">
        Quem já avaliou — {semestre.codigo}
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-onyx-black">
        Cada avaliação esperada (tutores e mentores atribuídos, e líderes de casa na Mentoria) e em que ponto está. Só aparecem
        contagens e nomes — as respostas e observações não são mostradas aqui.
      </p>

      <ul className="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4 lg:max-w-3xl">
        {[
          ['Enviadas', `${contagem.enviadas} de ${contagem.esperadas}`, true],
          ['Em rascunho', String(contagem.rascunhos), false],
          ['Não iniciadas', String(contagem.naoIniciadas), false],
          ['Alunos sem avaliador', String(contagem.semAvaliador), contagem.semAvaliador === 0],
        ].map(([rotulo, valor, neutro]) => (
          <li key={rotulo as string} className={neutro ? 'bg-gunmetal-gray p-3 text-white' : 'border-[3px] border-mandarin-orange p-3 text-onyx-black'}>
            <span className="block font-display text-4xl font-bold leading-none">{valor}</span>
            <span className="text-xs font-bold uppercase tracking-wide">{rotulo}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid grid-cols-2 gap-3 border border-gunmetal-gray/25 p-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <label className="col-span-2 text-sm font-bold text-gunmetal-gray lg:col-span-1">
          Buscar aluno ou avaliador
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome" className={campo} />
        </label>
        <label className="text-sm font-bold text-gunmetal-gray">
          Categoria
          <select value={categoria} onChange={(e) => setCategoria(e.target.value as '' | CategoriaAvaliacao)} className={campo}>
            <option value="">Todas</option>
            <option value="tutoria">Tutoria</option>
            <option value="mentoria">Mentoria/Monitoria</option>
          </select>
        </label>
        <label className="text-sm font-bold text-gunmetal-gray">
          Casa
          <select value={casa} onChange={(e) => setCasa(e.target.value)} className={campo}>
            <option value="">Todas</option>
            {casas.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 flex min-h-11 items-center gap-2 self-end text-sm text-onyx-black lg:col-span-1">
          <input type="checkbox" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)} className="h-5 w-5 accent-mandarin-orange" />
          Só o que falta enviar
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Visão" className="flex">
          {(
            [
              ['avaliador', 'Por avaliador'],
              ['aluno', 'Por aluno'],
            ] as [Visao, string][]
          ).map(([v, rotulo]) => (
            <button
              key={v}
              type="button"
              aria-pressed={visao === v}
              onClick={() => setVisao(v)}
              className={`min-h-11 border-2 border-gunmetal-gray px-4 text-sm font-bold transition ${
                visao === v ? 'bg-gunmetal-gray text-white' : 'text-gunmetal-gray hover:bg-soft-pink/50'
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
        <button type="button" onClick={copiarPendencias} className={botaoLaranja}>
          Copiar lista de pendências
        </button>
      </div>
      <div aria-live="polite" className="mt-2">
        {aviso && <p role="status" className="border-l-4 border-gunmetal-gray bg-neutral-tint p-3 text-sm text-onyx-black">{aviso}</p>}
      </div>

      {semSemAvaliador.length > 0 && (
        <p className="mt-3 border-l-4 border-mandarin-orange bg-soft-pink/60 p-3 text-sm text-onyx-black">
          <strong>Sem avaliador atribuído:</strong>{' '}
          {[...new Set(semSemAvaliador.map((l) => `${l.aluno} (${textosCategoria[l.categoria].titulo})`))].join(', ')}. Atribua na aba
          “Atribuições”.
        </p>
      )}

      {visao === 'avaliador' ? (
        porAvaliador.length === 0 ? (
          <p className="mt-4 border border-gunmetal-gray/25 p-4 text-sm text-onyx-black">
            {soPendentes ? 'Nenhuma pendência com esses filtros. 🎉' : 'Nenhum avaliador com esses filtros.'}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-gunmetal-gray/15 border border-gunmetal-gray/25">
            {porAvaliador.map((a) => (
              <li key={a.id} className="grid gap-2 p-4 md:grid-cols-[14rem_1fr]">
                <div>
                  <p className="font-bold text-gunmetal-gray">{a.nome}</p>
                  <p className="text-sm text-onyx-black">
                    {a.enviadas} de {a.total} enviadas
                  </p>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {a.pendentes
                    .filter((p) => p.situacao !== 'sem_avaliador')
                    .map((p) => (
                      <li key={`${p.aluno_id}-${p.categoria}`} className={`rounded-sm px-2 py-1 text-sm ${classeSituacao[p.situacao]}`}>
                        {p.aluno}
                        {!categoria && ` · ${textosCategoria[p.categoria].titulo}`} — {rotuloSituacao(p)}
                      </li>
                    ))}
                  {a.pendentes.length === 0 && <li className="text-sm text-muted-purple">Tudo enviado.</li>}
                </ul>
              </li>
            ))}
          </ul>
        )
      ) : porAluno.length === 0 ? (
        <p className="mt-4 border border-gunmetal-gray/25 p-4 text-sm text-onyx-black">
          {soPendentes ? 'Nenhum aluno com pendência nesses filtros. 🎉' : 'Nenhum aluno com esses filtros.'}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-gunmetal-gray/15 border border-gunmetal-gray/25">
          {porAluno.map((a) => (
            <li key={a.id} className="grid gap-2 p-4 md:grid-cols-[14rem_1fr]">
              <div>
                <p className="font-bold text-gunmetal-gray">{a.nome}</p>
                <p className="text-sm text-onyx-black">{a.casa ?? 'Sem casa'}</p>
              </div>
              <div className="space-y-2">
                {(['tutoria', 'mentoria'] as CategoriaAvaliacao[])
                  .filter((c) => !categoria || categoria === c)
                  .map((c) => (
                    <div key={c} className="flex flex-wrap items-center gap-2">
                      <span className="w-20 shrink-0 text-xs font-bold uppercase tracking-wide text-muted-purple">
                        {textosCategoria[c].titulo.split('/')[0]}
                      </span>
                      <ul className="flex flex-wrap gap-2">
                        {a.itens
                          .filter((i) => i.categoria === c)
                          .map((i) => (
                            <li key={`${i.equipe_id}-${c}`} className={`rounded-sm px-2 py-1 text-sm ${classeSituacao[i.situacao]}`}>
                              {i.avaliador ? `${i.avaliador} — ` : ''}
                              {rotuloSituacao(i)}
                              {i.esperado === false && ' (não atribuído)'}
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
