import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { fmtNota } from '../lib/notas'

const db = () => supabase.schema('alunos')

// Tudo vem pronto do banco (alunos.meu_desenvolvimento*): só os semestres LIBERADOS, só os dados do próprio aluno.
interface Semestre {
  semestre_id: string
  semestre: string
  ciclo: string | null
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
interface Medias {
  media_basico: number | null
  media_avancado: number | null
  media_final: number | null
  semestres: number
  semestres_incompletos: number
}

const COMPONENTES: { chave: keyof Semestre; rotulo: string; destaque?: boolean }[] = [
  { chave: 'teoria', rotulo: 'Teoria' },
  { chave: 'pratica', rotulo: 'Prática' },
  { chave: 'atividades', rotulo: 'Atividades' },
  { chave: 'projeto', rotulo: 'Projeto final' },
  { chave: 'presenca', rotulo: 'Presença' },
  { chave: 'tutoria', rotulo: 'Tutoria' },
  { chave: 'mentoria', rotulo: 'Mentoria' },
  { chave: 'final', rotulo: 'Nota final', destaque: true },
]

const campo =
  'mt-1 block min-h-11 w-full min-w-0 max-w-xs rounded-sm border border-gunmetal-gray/40 bg-pure-white px-2 text-sm font-normal text-onyx-black'

/* ---------- gráfico: nota final por semestre (uma série, escala fixa 0–10) ---------- */
function GraficoEvolucao({ semestres }: { semestres: Semestre[] }) {
  const L = 600
  const A = 230
  const m = { e: 36, d: 20, t: 24, b: 38 }
  const largura = L - m.e - m.d
  const altura = A - m.t - m.b
  const x = (i: number) => m.e + (semestres.length === 1 ? largura / 2 : (i * largura) / (semestres.length - 1))
  const y = (v: number) => m.t + altura - (v / 10) * altura
  const pontos = semestres.map((s, i) => ({ s, i, v: s.final }))
  const comNota = pontos.filter((p) => p.v !== null) as { s: Semestre; i: number; v: number }[]
  const caminho = comNota.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i)},${y(p.v)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-labelledby="graf-titulo graf-desc" className="w-full">
      <title id="graf-titulo">Nota final por semestre</title>
      <desc id="graf-desc">
        {semestres.map((s) => `${s.semestre}: ${s.final === null ? 'sem nota' : fmtNota(s.final)}`).join('; ')}. A tabela logo abaixo traz os mesmos números.
      </desc>
      {[0, 5, 10].map((v) => (
        <g key={v}>
          <line x1={m.e} x2={L - m.d} y1={y(v)} y2={y(v)} stroke="#3b324e" strokeOpacity={v === 0 ? 0.45 : 0.15} strokeWidth={1} />
          <text x={m.e - 8} y={y(v) + 4} textAnchor="end" fontSize="12" fill="#6b6478">
            {v}
          </text>
        </g>
      ))}
      {comNota.length > 1 && <path d={caminho} fill="none" stroke="#3b324e" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
      {pontos.map(({ s, i, v }) => (
        <g key={s.semestre_id}>
          <text x={x(i)} y={A - 12} textAnchor="middle" fontSize="12" fill="#6b6478">
            {s.semestre}
          </text>
          {v !== null && (
            <>
              <circle cx={x(i)} cy={y(v)} r={14} fill="transparent">
                <title>{`${s.semestre}: nota final ${fmtNota(v)}${s.conceito ? ` (${s.conceito})` : ''}`}</title>
              </circle>
              <circle cx={x(i)} cy={y(v)} r={5.5} fill="#fc6d00" stroke="#ffffff" strokeWidth={2} pointerEvents="none" />
              <text x={x(i)} y={y(v) - 12} textAnchor="middle" fontSize="13" fontWeight="700" fill="#3b324e">
                {fmtNota(v)}
              </text>
            </>
          )}
        </g>
      ))}
    </svg>
  )
}

/* ---------- barras finas: componentes de um semestre (escala fixa 0–10) ---------- */
function Barras({ s }: { s: Semestre }) {
  return (
    <ul className="space-y-2" aria-label={`Notas de ${s.semestre}`}>
      {COMPONENTES.map((c) => {
        const v = s[c.chave] as number | null
        return (
          <li key={c.chave} className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-3 text-sm">
            <span className={c.destaque ? 'font-bold text-gunmetal-gray' : 'text-onyx-black'}>{c.rotulo}</span>
            <span className="h-2.5 bg-gunmetal-gray/10" role="img" aria-label={v === null ? `${c.rotulo}: sem nota` : `${c.rotulo}: ${fmtNota(v)} de 10`}>
              {v !== null && (
                <span
                  className={`block h-full rounded-r-[4px] ${c.destaque ? 'bg-mandarin-orange' : 'bg-gunmetal-gray'}`}
                  style={{ width: `${Math.min(100, Math.max(0, (v / 10) * 100))}%` }}
                />
              )}
            </span>
            <span className={`text-right tabular-nums ${c.destaque ? 'font-bold text-gunmetal-gray' : 'text-onyx-black'}`}>{fmtNota(v)}</span>
          </li>
        )
      })}
    </ul>
  )
}

export default function MeuDesenvolvimento() {
  const [semestres, setSemestres] = useState<Semestre[]>([])
  const [medias, setMedias] = useState<Medias | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [escolhido, setEscolhido] = useState('')
  const [perguntas, setPerguntas] = useState<Record<string, Pergunta[]>>({})

  useEffect(() => {
    ;(async () => {
      const [d, m] = await Promise.all([db().rpc('meu_desenvolvimento'), db().rpc('minhas_medias_ciclo')])
      if (d.error) {
        setErro(
          d.error.message.includes('meu_desenvolvimento')
            ? 'Esta área ainda não está disponível.'
            : `Não foi possível carregar seus resultados: ${d.error.message}`,
        )
      } else {
        const lista = ((d.data as Semestre[]) ?? []).sort((a, b) => a.semestre.localeCompare(b.semestre))
        setSemestres(lista)
        setEscolhido(lista[lista.length - 1]?.semestre_id ?? '')
      }
      setMedias(((m.data as Medias[]) ?? [])[0] ?? null)
      setCarregando(false)
    })()
  }, [])

  const atual = semestres.find((s) => s.semestre_id === escolhido) ?? null

  useEffect(() => {
    if (!escolhido || perguntas[escolhido]) return
    db()
      .rpc('meu_desenvolvimento_perguntas', { p_semestre: escolhido })
      .then(({ data, error }) => setPerguntas((p) => ({ ...p, [escolhido]: error ? [] : ((data as Pergunta[]) ?? []) })))
  }, [escolhido, perguntas])

  const grupos = useMemo(() => {
    const lista = perguntas[escolhido] ?? []
    const mapa = new Map<string, { titulo: string; ordem: number; itens: Pergunta[] }>()
    for (const p of lista) {
      const chave = `${p.categoria}:${p.grupo_codigo}`
      const g = mapa.get(chave) ?? { titulo: `${p.categoria === 'tutoria' ? 'Tutoria' : 'Mentoria'} — ${p.grupo_nome}`, ordem: p.grupo_ordem + (p.categoria === 'mentoria' ? 100 : 0), itens: [] }
      g.itens.push(p)
      mapa.set(chave, g)
    }
    return [...mapa.values()].sort((a, b) => a.ordem - b.ordem)
  }, [perguntas, escolhido])

  return (
    <div className="mx-auto max-w-4xl px-brand-3 py-brand-4">
      <h1 className="font-display text-[40px] leading-none text-gunmetal-gray md:text-[48px]">Meu desenvolvimento</h1>
      <p className="mt-2 max-w-2xl text-sm text-onyx-black">
        Suas notas por semestre, de 0 a 10. Elas aparecem aqui quando a coordenação libera os resultados do semestre.
      </p>

      {carregando ? (
        <p className="mt-6 text-onyx-black">Carregando...</p>
      ) : erro ? (
        <p role="alert" className="mt-6 border-l-4 border-mandarin-orange bg-soft-pink/60 p-3 text-sm text-onyx-black">
          {erro}
        </p>
      ) : semestres.length === 0 ? (
        <div className="mt-6 border border-gunmetal-gray/25 bg-white p-6">
          <h2 className="font-display text-3xl text-gunmetal-gray">Resultados ainda não liberados</h2>
          <p className="mt-2 text-sm text-onyx-black">
            Assim que a coordenação liberar os resultados do semestre, suas notas e o gráfico do seu desenvolvimento aparecem nesta página.
          </p>
        </div>
      ) : (
        <>
          {medias && (
            <ul className="mt-6 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
              {[
                ['Média final', medias.media_final],
                ['Média Básico', medias.media_basico],
                ['Média Avançado', medias.media_avancado],
              ]
                .filter(([, v]) => v !== null || false)
                .map(([rotulo, valor]) => (
                  <li key={rotulo as string} className="bg-gunmetal-gray p-3 text-white">
                    <span className="block font-display text-4xl font-bold leading-none">{fmtNota(valor as number | null)}</span>
                    <span className="text-xs font-bold uppercase tracking-wide">{rotulo as string}</span>
                  </li>
                ))}
              <li className="border border-gunmetal-gray/25 p-3 text-onyx-black">
                <span className="block font-display text-4xl font-bold leading-none">{semestres.length}</span>
                <span className="text-xs font-bold uppercase tracking-wide">{semestres.length === 1 ? 'Semestre' : 'Semestres'}</span>
              </li>
            </ul>
          )}

          <section className="mt-8" aria-labelledby="evolucao">
            <h2 id="evolucao" className="font-display text-3xl text-gunmetal-gray">
              Nota final por semestre
            </h2>
            <div className="mt-2 border border-gunmetal-gray/25 bg-white p-3">
              <GraficoEvolucao semestres={semestres} />
            </div>
            <details className="mt-2">
              <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-bold text-gunmetal-gray underline underline-offset-4">
                Ver os números em tabela
              </summary>
              <div className="mt-1 overflow-x-auto border border-gunmetal-gray/25 bg-white">
                <table className="w-full min-w-[30rem] text-left text-sm">
                  <thead className="bg-neutral-tint text-xs uppercase tracking-wide text-muted-purple">
                    <tr>
                      <th scope="col" className="px-3 py-2">Semestre</th>
                      <th scope="col" className="px-2 py-2 text-right">Tutoria</th>
                      <th scope="col" className="px-2 py-2 text-right">Mentoria</th>
                      <th scope="col" className="px-2 py-2 text-right">Nota final</th>
                      <th scope="col" className="px-3 py-2">Conceito</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...semestres].reverse().map((s) => (
                      <tr key={s.semestre_id} className="border-t border-gunmetal-gray/15">
                        <th scope="row" className="px-3 py-2 font-bold text-gunmetal-gray">
                          {s.semestre}
                          {s.ciclo && <span className="ml-2 text-xs font-normal text-muted-purple">{s.ciclo}</span>}
                        </th>
                        <td className="px-2 py-2 text-right tabular-nums">{fmtNota(s.tutoria)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{fmtNota(s.mentoria)}</td>
                        <td className="px-2 py-2 text-right font-bold tabular-nums text-gunmetal-gray">{fmtNota(s.final)}</td>
                        <td className="px-3 py-2">{s.conceito ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>

          {atual && (
            <section className="mt-8" aria-labelledby="detalhe">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 id="detalhe" className="font-display text-3xl text-gunmetal-gray">
                  Semestre {atual.semestre}
                </h2>
                {semestres.length > 1 && (
                  <label className="text-sm font-bold text-gunmetal-gray">
                    Ver outro semestre
                    <select value={escolhido} onChange={(e) => setEscolhido(e.target.value)} className={campo}>
                      {[...semestres].reverse().map((s) => (
                        <option key={s.semestre_id} value={s.semestre_id}>
                          {s.semestre}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {atual.conceito && <span className="rounded-sm bg-gunmetal-gray px-2 py-1 text-xs font-bold uppercase tracking-wide text-white">{atual.conceito}</span>}
                {atual.final !== null && atual.completo && (
                  <span className={`rounded-sm px-2 py-1 text-xs font-bold uppercase tracking-wide ${atual.aprovado ? 'bg-green-100 text-green-800' : 'bg-soft-pink text-gunmetal-gray'}`}>
                    {atual.aprovado ? 'Aprovado(a)' : 'Não aprovado(a)'}
                  </span>
                )}
                {!atual.completo && <span className="rounded-sm border border-mandarin-orange bg-mandarin-orange/15 px-2 py-1 text-xs font-bold uppercase tracking-wide text-onyx-black">Resultado parcial</span>}
                {atual.ciclo && <span className="text-sm text-muted-purple">Ciclo {atual.ciclo}</span>}
              </div>
              {!atual.completo && (
                <p className="mt-2 border-l-4 border-mandarin-orange bg-soft-pink/60 p-3 text-sm text-onyx-black">
                  Alguma parte da sua nota ainda não foi lançada, então este resultado pode mudar.
                </p>
              )}

              <div className="mt-3 border border-gunmetal-gray/25 bg-white p-4">
                <Barras s={atual} />
              </div>

              <h3 className="mt-6 font-display text-2xl text-gunmetal-gray">Como seus avaliadores viram você</h3>
              <p className="mt-1 text-sm text-onyx-black">Média das respostas dos avaliadores a cada pergunta (de 4 a 10). Os comentários e quem avaliou não aparecem.</p>
              {grupos.length === 0 ? (
                <p className="mt-2 border border-gunmetal-gray/25 p-3 text-sm text-onyx-black">Sem respostas de avaliadores neste semestre.</p>
              ) : (
                <div className="mt-2 space-y-4">
                  {grupos.map((g) => (
                    <div key={g.titulo}>
                      <h4 className="text-xs font-bold uppercase tracking-wide text-muted-purple">{g.titulo}</h4>
                      <ul className="mt-1 divide-y divide-gunmetal-gray/15 border border-gunmetal-gray/25 bg-white">
                        {g.itens
                          .sort((a, b) => a.pergunta_ordem - b.pergunta_ordem)
                          .map((p) => (
                            <li key={`${p.grupo_codigo}-${p.pergunta_ordem}`} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2 text-sm">
                              <span className="text-onyx-black">{p.texto}</span>
                              <span className="whitespace-nowrap text-right tabular-nums">
                                <strong className="text-gunmetal-gray">{fmtNota(p.media)}</strong>
                                <span className="ml-2 text-xs text-muted-purple">{p.avaliadores} {p.avaliadores === 1 ? 'avaliador' : 'avaliadores'}</span>
                              </span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
