import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { descreverPendencia, type Pendencia } from '../../lib/avaliacoes'
import type { Casa, Semestre } from '../../types/alunos'
import CabecalhoAdmin from './CabecalhoAdmin'
import FiltroStatus, { passa, useElegibilidade, valorValido, type ValorFiltroStatus } from './FiltroStatus'

const db = () => supabase.schema('alunos')

// Uma linha de alunos.notas_semestre (tudo calculado no banco; aqui só mostramos).
interface Nota {
  aluno_id: string
  nome: string
  teoria: number | null
  pratica: number | null
  atividades: number | null
  projeto: number | null
  presenca: number | null
  tutoria: number | null
  mentoria: number | null
  final: number | null
  conceito: string | null
  aprovado: boolean | null
  completo: boolean
  pendencias: Pendencia[] | null
  tutoria_enviadas: number
  tutoria_esperados: number
  mentoria_enviadas: number
  mentoria_esperados: number
}
interface Pergunta {
  categoria: 'tutoria' | 'mentoria'
  grupo_codigo: string
  grupo_nome: string
  grupo_ordem: number
  pergunta_ordem: number
  texto: string
  media: number | null
  avaliadores: number
}
interface AlunoCasa {
  id: string
  casa_id: number | null
}

const campo =
  'mt-1 block min-h-11 w-full min-w-0 max-w-full rounded-sm border border-gunmetal-gray/40 bg-pure-white px-2 text-sm font-normal text-onyx-black'
const botaoLaranja =
  'min-h-11 rounded-sm bg-mandarin-orange px-4 text-sm font-bold text-onyx-black transition hover:bg-mandarin-orange-dark disabled:opacity-50'

const sem = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Notas: até 2 casas (as médias dos componentes ficam sem arredondar no banco; tutoria, mentoria e final já vêm com 1).
function fmt(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
}

type Situacao = 'aprovado' | 'reprovado' | 'parcial' | 'sem_nota'
function situacaoDe(n: Nota): Situacao {
  if (n.final === null) return 'sem_nota'
  if (!n.completo) return 'parcial'
  return n.aprovado ? 'aprovado' : 'reprovado'
}
const rotuloSituacao: Record<Situacao, string> = {
  aprovado: 'Aprovado(a)',
  reprovado: 'Reprovado(a)',
  parcial: 'Parcial',
  sem_nota: 'Sem nota',
}
const classeSituacao: Record<Situacao, string> = {
  aprovado: 'bg-green-100 text-green-800',
  reprovado: 'bg-soft-pink text-gunmetal-gray',
  parcial: 'border border-mandarin-orange bg-mandarin-orange/15 text-onyx-black',
  sem_nota: 'border border-gunmetal-gray/40 text-onyx-black',
}

function celulaCsv(valor: string) {
  return `"${valor.replace(/"/g, '""')}"`
}

type Ordem = 'nome' | 'final_desc' | 'final_asc'

export default function AdminResultados() {
  const [params, setParams] = useSearchParams()
  const mudarParams = (mudar: (p: URLSearchParams) => void) =>
    setParams(
      (atual) => {
        const p = new URLSearchParams(atual)
        mudar(p)
        return p
      },
      { replace: true },
    )

  const [semestres, setSemestres] = useState<Semestre[]>([])
  const [casas, setCasas] = useState<Casa[]>([])
  const [casaDoAluno, setCasaDoAluno] = useState<Map<string, number | null>>(new Map())
  const [notas, setNotas] = useState<Nota[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [casa, setCasa] = useState('')
  const [soPendentes, setSoPendentes] = useState(false)
  const [ordem, setOrdem] = useState<Ordem>('nome')
  const [aberto, setAberto] = useState<string | null>(null)
  const [perguntas, setPerguntas] = useState<Record<string, Pergunta[] | 'erro'>>({})

  // semestre e situação ficam na URL (ao voltar da ficha de um aluno, a tela volta igual)
  const semParam = params.get('sem')
  const statusFiltro = valorValido(params.get('status'))
  const semestre = useMemo(
    () => semestres.find((s) => s.codigo === semParam) ?? semestres.find((s) => s.atual) ?? semestres[0] ?? null,
    [semestres, semParam],
  )
  const elegibilidade = useElegibilidade(semestre?.id)

  useEffect(() => {
    ;(async () => {
      const [s, c, a] = await Promise.all([
        db().from('semestres').select('id, codigo, inicio, fim, atual').order('codigo', { ascending: false }),
        db().from('casas').select('id, nome').order('nome'),
        db().from('alunos').select('id, casa_id'),
      ])
      setSemestres((s.data as Semestre[]) ?? [])
      setCasas((c.data as Casa[]) ?? [])
      setCasaDoAluno(new Map(((a.data as AlunoCasa[]) ?? []).map((x) => [x.id, x.casa_id])))
    })()
  }, [])

  const carregar = useCallback(async () => {
    if (!semestre) return
    setCarregando(true)
    setErro(null)
    setAberto(null)
    const { data, error } = await db().rpc('notas_semestre', { p_semestre: semestre.id })
    if (error) {
      setErro(
        error.message.includes('not allowed')
          ? 'Só administração e coordenação veem os resultados dos alunos.'
          : `Não foi possível carregar os resultados: ${error.message}`,
      )
      setNotas([])
    } else {
      setNotas((data as Nota[]) ?? [])
    }
    setCarregando(false)
  }, [semestre])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function abrir(n: Nota) {
    if (aberto === n.aluno_id) {
      setAberto(null)
      return
    }
    setAberto(n.aluno_id)
    if (!semestre || perguntas[`${n.aluno_id}:${semestre.id}`]) return
    const { data, error } = await db().rpc('perguntas_aluno', { p_aluno: n.aluno_id, p_semestre: semestre.id })
    setPerguntas((p) => ({ ...p, [`${n.aluno_id}:${semestre.id}`]: error ? 'erro' : ((data as Pergunta[]) ?? []) }))
  }

  const visiveis = useMemo(() => {
    const termo = sem(busca.trim())
    const lista = notas.filter((n) => {
      if (!passa(elegibilidade.mapa.get(n.aluno_id), statusFiltro)) return false
      if (casa && String(casaDoAluno.get(n.aluno_id) ?? '') !== casa) return false
      if (soPendentes && n.completo) return false
      if (termo && !sem(n.nome).includes(termo)) return false
      return true
    })
    if (ordem === 'nome') return lista
    const chave = (n: Nota) => (n.final === null ? (ordem === 'final_desc' ? -1 : 99) : Number(n.final))
    return [...lista].sort((a, b) => (ordem === 'final_desc' ? chave(b) - chave(a) : chave(a) - chave(b)))
  }, [notas, elegibilidade.mapa, statusFiltro, casa, casaDoAluno, soPendentes, busca, ordem])

  const resumo = useMemo(() => {
    const s = visiveis.map(situacaoDe)
    return {
      total: visiveis.length,
      aprovados: s.filter((x) => x === 'aprovado').length,
      reprovados: s.filter((x) => x === 'reprovado').length,
      parciais: s.filter((x) => x === 'parcial' || x === 'sem_nota').length,
    }
  }, [visiveis])

  const nomeCasa = useMemo(() => new Map(casas.map((c) => [c.id, c.nome])), [casas])

  function exportar() {
    if (!semestre) return
    const cab = ['Aluno', 'Casa', 'Teoria', 'Prática', 'Atividades', 'Projeto', 'Presença', 'Tutoria', 'Mentoria', 'Final', 'Conceito', 'Situação', 'Pendências']
    const num = (n: number | null) => (n === null ? '' : String(n).replace('.', ','))
    const corpo = visiveis.map((n) =>
      [
        celulaCsv(n.nome),
        celulaCsv(nomeCasa.get(casaDoAluno.get(n.aluno_id) ?? -1) ?? ''),
        num(n.teoria),
        num(n.pratica),
        num(n.atividades),
        num(n.projeto),
        num(n.presenca),
        num(n.tutoria),
        num(n.mentoria),
        num(n.final),
        celulaCsv(n.conceito ?? ''),
        celulaCsv(rotuloSituacao[situacaoDe(n)]),
        celulaCsv((n.pendencias ?? []).map(descreverPendencia).join(' | ')),
      ].join(';'),
    )
    const blob = new Blob(['﻿' + cab.join(';') + '\n' + corpo.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `resultados-${semestre.codigo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const colunas: { chave: keyof Nota; rotulo: string }[] = [
    { chave: 'teoria', rotulo: 'Teoria' },
    { chave: 'pratica', rotulo: 'Prática' },
    { chave: 'atividades', rotulo: 'Ativ.' },
    { chave: 'projeto', rotulo: 'Projeto' },
    { chave: 'presenca', rotulo: 'Presença' },
    { chave: 'tutoria', rotulo: 'Tutoria' },
    { chave: 'mentoria', rotulo: 'Mentoria' },
    { chave: 'final', rotulo: 'Final' },
  ]

  return (
    <div className="mx-auto max-w-7xl">
      <CabecalhoAdmin
        titulo="Resultados"
        trilha={[{ rotulo: 'Resultados' }]}
        descricao="Notas e conceito de cada aluno no semestre, calculados pelo sistema a partir das avaliações enviadas, das atividades, do projeto e da presença. Resultado parcial = ainda faltam dados."
      />

      <div className="grid grid-cols-2 gap-3 border border-gunmetal-gray/25 p-4 lg:grid-cols-[1fr_1.4fr_1fr_1.3fr_1fr]">
        <label className="text-sm font-bold text-gunmetal-gray">
          Semestre
          <select
            value={semestre?.codigo ?? ''}
            onChange={(e) => mudarParams((p) => p.set('sem', e.target.value))}
            className={campo}
          >
            {semestres.map((s) => (
              <option key={s.id} value={s.codigo}>
                {s.codigo}
                {s.atual ? ' (atual)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 text-sm font-bold text-gunmetal-gray lg:col-span-1">
          Buscar aluno
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome" className={campo} />
        </label>
        <label className="text-sm font-bold text-gunmetal-gray">
          Casa
          <select value={casa} onChange={(e) => setCasa(e.target.value)} className={campo}>
            <option value="">Todas</option>
            {casas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <FiltroStatus valor={statusFiltro} aoMudar={(v: ValorFiltroStatus) => mudarParams((p) => p.set('status', v))} classeCampo={campo} />
        <label className="text-sm font-bold text-gunmetal-gray">
          Ordenar por
          <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} className={campo}>
            <option value="nome">Nome</option>
            <option value="final_desc">Nota final (maior)</option>
            <option value="final_asc">Nota final (menor)</option>
          </select>
        </label>
      </div>

      {elegibilidade.aviso && (
        <p role="status" className="mt-3 border-l-4 border-mandarin-orange bg-soft-pink/60 p-3 text-sm text-onyx-black">
          {elegibilidade.aviso}
        </p>
      )}
      {erro && (
        <p role="alert" className="mt-3 border-l-4 border-mandarin-orange bg-soft-pink/60 p-3 text-sm text-onyx-black">
          {erro}
        </p>
      )}

      <ul className="mt-4 grid grid-cols-2 gap-3 text-center sm:max-w-3xl sm:grid-cols-4">
        {[
          ['Alunos na lista', resumo.total, true],
          ['Aprovados', resumo.aprovados, true],
          ['Reprovados', resumo.reprovados, resumo.reprovados === 0],
          ['Parciais / sem nota', resumo.parciais, resumo.parciais === 0],
        ].map(([rotulo, valor, neutro]) => (
          <li key={rotulo as string} className={neutro ? 'bg-gunmetal-gray p-3 text-white' : 'border-[3px] border-mandarin-orange p-3 text-onyx-black'}>
            <span className="block font-display text-4xl font-bold leading-none">{valor as number}</span>
            <span className="text-xs font-bold uppercase tracking-wide">{rotulo as string}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm text-onyx-black">
          <input type="checkbox" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)} className="h-5 w-5 accent-mandarin-orange" />
          Só quem tem resultado parcial
        </label>
        <button type="button" onClick={exportar} disabled={visiveis.length === 0} className={botaoLaranja}>
          Exportar para Excel
        </button>
      </div>

      {carregando ? (
        <p className="mt-4 text-onyx-black">Carregando...</p>
      ) : visiveis.length === 0 ? (
        <p className="mt-4 border border-gunmetal-gray/25 p-4 text-sm text-onyx-black">Nenhum aluno com esses filtros.</p>
      ) : (
        <div className="mt-3 overflow-x-auto border border-gunmetal-gray/25 bg-white">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="bg-neutral-tint text-xs uppercase tracking-wide text-muted-purple">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Aluno
                </th>
                {colunas.map((c) => (
                  <th key={c.chave} scope="col" className="px-2 py-2 text-right">
                    {c.rotulo}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2">
                  Conceito
                </th>
                <th scope="col" className="px-3 py-2">
                  Situação
                </th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((n) => {
                const s = situacaoDe(n)
                const aberta = aberto === n.aluno_id
                const chavePerg = semestre ? `${n.aluno_id}:${semestre.id}` : ''
                const perg = perguntas[chavePerg]
                return (
                  <Fragment key={n.aluno_id}>
                    <tr className="border-t border-gunmetal-gray/15 hover:bg-soft-pink/30">
                      <td className="px-3 py-1">
                        <button
                          type="button"
                          onClick={() => abrir(n)}
                          aria-expanded={aberta}
                          className="flex min-h-11 w-full items-center gap-1 text-left font-bold text-gunmetal-gray"
                        >
                          {aberta ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                          {n.nome}
                        </button>
                      </td>
                      {colunas.map((c) => (
                        <td key={c.chave} className={`px-2 py-1 text-right tabular-nums ${c.chave === 'final' ? 'font-bold text-gunmetal-gray' : ''}`}>
                          {fmt(n[c.chave] as number | null)}
                        </td>
                      ))}
                      <td className="px-3 py-1">{n.conceito ?? '—'}</td>
                      <td className="px-3 py-1">
                        <span className={`rounded-sm px-2 py-0.5 text-xs font-bold ${classeSituacao[s]}`}>{rotuloSituacao[s]}</span>
                      </td>
                    </tr>
                    {aberta && (
                      <tr className="border-t border-gunmetal-gray/15 bg-neutral-tint/60">
                        <td colSpan={colunas.length + 3} className="px-4 py-3">
                          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
                            <div>
                              <h3 className="font-display text-2xl text-gunmetal-gray">O que falta</h3>
                              {(n.pendencias ?? []).length === 0 ? (
                                <p className="mt-1 text-sm text-onyx-black">Nada: o resultado está completo.</p>
                              ) : (
                                <ul className="mt-1 list-disc pl-5 text-sm text-onyx-black">
                                  {(n.pendencias ?? []).map((p, i) => (
                                    <li key={i}>{descreverPendencia(p)}</li>
                                  ))}
                                </ul>
                              )}
                              <p className="mt-2 text-sm text-onyx-black">
                                Avaliações enviadas — Tutoria: {n.tutoria_enviadas} de {n.tutoria_esperados} · Mentoria: {n.mentoria_enviadas} de {n.mentoria_esperados}
                              </p>
                              <Link
                                to={`/admin/alunos/${n.aluno_id}`}
                                className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-gunmetal-gray underline underline-offset-4"
                              >
                                Abrir a ficha do aluno →
                              </Link>
                            </div>
                            <div>
                              <h3 className="font-display text-2xl text-gunmetal-gray">Média por pergunta</h3>
                              {perg === undefined ? (
                                <p className="mt-1 text-sm text-onyx-black">Carregando...</p>
                              ) : perg === 'erro' ? (
                                <p className="mt-1 text-sm text-onyx-black">Não foi possível carregar as perguntas.</p>
                              ) : perg.length === 0 ? (
                                <p className="mt-1 text-sm text-onyx-black">Ainda não há avaliações enviadas.</p>
                              ) : (
                                <PerguntasPorGrupo perguntas={perg} />
                              )}
                              <p className="mt-2 text-xs text-muted-purple">Médias de todos os avaliadores juntos; comentários não aparecem aqui.</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function PerguntasPorGrupo({ perguntas }: { perguntas: Pergunta[] }) {
  const grupos = useMemo(() => {
    const mapa = new Map<string, { titulo: string; ordem: number; itens: Pergunta[] }>()
    for (const p of perguntas) {
      const chave = `${p.categoria}:${p.grupo_codigo}`
      const g = mapa.get(chave) ?? { titulo: `${p.categoria === 'tutoria' ? 'Tutoria' : 'Mentoria'} — ${p.grupo_nome}`, ordem: p.grupo_ordem + (p.categoria === 'mentoria' ? 100 : 0), itens: [] }
      g.itens.push(p)
      mapa.set(chave, g)
    }
    return [...mapa.values()].sort((a, b) => a.ordem - b.ordem)
  }, [perguntas])
  return (
    <div className="mt-1 space-y-3">
      {grupos.map((g) => (
        <div key={g.titulo}>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-purple">{g.titulo}</p>
          <ul className="mt-1 divide-y divide-gunmetal-gray/15 border border-gunmetal-gray/15 bg-white">
            {g.itens
              .sort((a, b) => a.pergunta_ordem - b.pergunta_ordem)
              .map((p) => (
                <li key={`${p.grupo_codigo}-${p.pergunta_ordem}`} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-1.5 text-sm">
                  <span className="text-onyx-black">{p.texto}</span>
                  <span className="whitespace-nowrap text-right tabular-nums">
                    <strong className="text-gunmetal-gray">{fmt(p.media)}</strong>
                    <span className="ml-2 text-xs text-muted-purple">{p.avaliadores} aval.</span>
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
