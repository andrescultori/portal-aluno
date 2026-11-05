import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import CabecalhoAdmin from './admin/CabecalhoAdmin'
import { ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { descreverJanela, textosCategoria, type LinhaAvaliar } from '../lib/avaliacoes'

const db = () => supabase.schema('alunos')

const rotuloSituacao: Record<LinhaAvaliar['situacao'], string> = {
  nao_iniciada: 'Não iniciada',
  rascunho: 'Rascunho',
  enviada: 'Enviada',
}

const campo =
  'mt-1 block min-h-11 w-full min-w-0 rounded-sm border border-gunmetal-gray/40 bg-pure-white px-2 text-sm font-normal text-onyx-black'

export default function Avaliar() {
  const [semestre, setSemestre] = useState<{ id: string; codigo: string } | null>(null)
  const [linhas, setLinhas] = useState<LinhaAvaliar[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<'todas' | 'pendentes' | 'enviadas'>('todas')

  useEffect(() => {
    let ativo = true
    async function carregar() {
      const { data: sem, error: erroSem } = await db()
        .from('semestres')
        .select('id, codigo')
        .eq('atual', true)
        .maybeSingle()
      if (!ativo) return
      if (erroSem) {
        setErro(`Não foi possível carregar o semestre: ${erroSem.message}`)
        setCarregando(false)
        return
      }
      setSemestre(sem as { id: string; codigo: string } | null)
      if (sem) {
        const { data, error } = await db().rpc('meus_alunos_avaliar', { p_semestre: sem.id })
        if (!ativo) return
        if (error) setErro(`Não foi possível carregar seus alunos: ${error.message}`)
        else setLinhas((data as LinhaAvaliar[]) ?? [])
      }
      setCarregando(false)
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [])

  const enviadas = linhas.filter((l) => l.situacao === 'enviada').length
  const visiveis = useMemo(
    () =>
      linhas.filter((l) =>
        filtro === 'todas' ? true : filtro === 'enviadas' ? l.situacao === 'enviada' : l.situacao !== 'enviada',
      ),
    [linhas, filtro],
  )
  const categorias = [...new Set(visiveis.map((l) => l.categoria))]
  const janelas = [...new Map(linhas.map((l) => [l.categoria, l])).values()]

  return (
    <div className="mx-auto w-full max-w-3xl">
      <CabecalhoAdmin
        titulo="Avaliar alunos"
        trilha={[{ rotulo: `Meus alunos${semestre ? ` · ${semestre.codigo}` : ''}` }]}
        descricao="Uma avaliação por aluno(a). Você pode parar e continuar depois: as respostas são salvas sozinhas até você enviar."
      />

      {carregando ? (
        <p className="mt-6 text-onyx-black">Carregando...</p>
      ) : erro ? (
        <p role="alert" className="mt-6 border-l-4 border-mandarin-orange bg-soft-pink/60 p-3 text-sm text-onyx-black">
          {erro}
        </p>
      ) : !semestre ? (
        <p className="mt-6 border border-gunmetal-gray/25 p-4 text-sm text-onyx-black">
          A coordenação ainda não definiu o semestre atual.
        </p>
      ) : linhas.length === 0 ? (
        <p className="mt-6 border border-gunmetal-gray/25 p-4 text-sm text-onyx-black">
          Você ainda não tem alunos atribuídos neste semestre. Se isso parecer errado, fale com a coordenação.
        </p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <div className="bg-gunmetal-gray px-5 py-3 text-white">
              <span className="font-display text-[44px] font-bold leading-none">{enviadas}</span>
              <span className="ml-2 text-sm font-bold uppercase tracking-wide">
                de {linhas.length} {linhas.length === 1 ? 'avaliação enviada' : 'avaliações enviadas'}
              </span>
            </div>
            <label className="text-sm font-bold text-gunmetal-gray">
              Mostrar
              <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} className={`${campo} w-52`}>
                <option value="todas">Todas</option>
                <option value="pendentes">Só as que faltam enviar</option>
                <option value="enviadas">Só as enviadas</option>
              </select>
            </label>
          </div>

          <ul className="mt-3 space-y-1 text-sm text-onyx-black">
            {janelas.map((j) => (
              <li key={j.categoria}>
                <strong>{textosCategoria[j.categoria].titulo}:</strong> {descreverJanela(j)}
              </li>
            ))}
          </ul>

          {visiveis.length === 0 && (
            <p className="mt-4 border border-gunmetal-gray/25 p-4 text-sm text-onyx-black">Nenhuma avaliação com esse filtro.</p>
          )}

          {categorias.map((cat) => (
            <section key={cat} className="mt-6" aria-labelledby={`cat-${cat}`}>
              <h2 id={`cat-${cat}`} className="font-display text-3xl text-gunmetal-gray">
                {textosCategoria[cat].titulo}
              </h2>
              <ul className="mt-2 divide-y divide-gunmetal-gray/15 border border-gunmetal-gray/25">
                {visiveis
                  .filter((l) => l.categoria === cat)
                  .map((l) => {
                    const pct = l.total > 0 ? Math.round((l.respondidas / l.total) * 100) : 0
                    return (
                      <li key={`${l.aluno_id}-${l.categoria}`}>
                        <Link
                          to={`/admin/avaliar/${l.categoria}/${l.aluno_id}`}
                          className="flex min-h-20 items-center gap-3 p-4 transition hover:bg-soft-pink/40"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block font-bold text-gunmetal-gray">{l.nome}</span>
                            <span className="block text-sm text-onyx-black">{l.casa ?? 'Sem casa'}</span>
                            <span className="mt-2 flex items-center gap-2">
                              <span
                                role="progressbar"
                                aria-valuenow={pct}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label={`${l.respondidas} de ${l.total} respondidas`}
                                className="h-2 w-24 shrink-0 bg-gunmetal-gray/15"
                              >
                                <span className="block h-full bg-mandarin-orange" style={{ width: `${pct}%` }} />
                              </span>
                              <span className="text-xs text-muted-purple">
                                {l.respondidas} de {l.total}
                              </span>
                            </span>
                          </span>
                          <span
                            className={`shrink-0 rounded-sm px-2 py-1 text-xs font-bold uppercase tracking-wide ${
                              l.situacao === 'enviada'
                                ? 'bg-gunmetal-gray text-white'
                                : l.situacao === 'rascunho'
                                  ? 'bg-soft-pink text-gunmetal-gray'
                                  : 'border border-gunmetal-gray/40 text-gunmetal-gray'
                            }`}
                          >
                            {rotuloSituacao[l.situacao]}
                          </span>
                          <ChevronRight size={20} aria-hidden="true" className="shrink-0 text-gunmetal-gray" />
                        </Link>
                      </li>
                    )
                  })}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
