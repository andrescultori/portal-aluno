import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'
import { STATUS_ALUNO } from '../../../types/alunos'

const db = () => supabase.schema('alunos')

interface LinhaAluno {
  id: string
  nome: string
  nome_exibicao: string | null
  ra: string | null
  email: string
  status: string
  plano: string | null
  casa_id: number | null
  semestre_ingresso: string | null
}

const campo =
  'mt-1 block min-h-11 w-full min-w-0 rounded-sm border border-gunmetal-gray/40 bg-pure-white px-2 text-sm font-normal text-onyx-black'

export const corStatus: Record<string, string> = {
  Ativo: 'bg-green-100 text-green-800',
  Trancado: 'bg-amber-100 text-amber-900',
  Formado: 'bg-gunmetal-gray text-white',
  Desistente: 'bg-soft-pink text-gunmetal-gray',
  Desativado: 'bg-neutral-tint text-onyx-black',
}

const sem = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Lista de alunos (Turmas e alunos › Alunos). O que cada pessoa enxerga é decidido pelo banco:
// coordenação/secretaria veem todos; tutor, mentor e líder de casa veem só os seus.
export default function ListaAlunos() {
  const [params, setParams] = useSearchParams()
  const [alunos, setAlunos] = useState<LinhaAluno[]>([])
  const [casas, setCasas] = useState<{ id: number; nome: string }[]>([])
  const [comAcesso, setComAcesso] = useState<Set<string> | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  // Os filtros ficam na URL: ao voltar da ficha de um aluno a lista continua filtrada do mesmo jeito.
  const busca = params.get('q') ?? ''
  const status = params.get('situacao') ?? 'Ativo'
  const casa = params.get('casa') ?? ''
  const plano = params.get('plano') ?? ''
  const mudar = (chave: string, valor: string) =>
    setParams(
      (atual) => {
        const p = new URLSearchParams(atual)
        if (valor) p.set(chave, valor)
        else p.delete(chave)
        // "Todas" precisa ser lembrado: o padrão é Ativo.
        if (chave === 'situacao' && !valor) p.set('situacao', '')
        return p
      },
      { replace: true },
    )

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const [a, c, u] = await Promise.all([
        db().from('alunos').select('id, nome, nome_exibicao, ra, email, status, plano, casa_id, semestre_ingresso').order('nome'),
        db().from('casas').select('id, nome').order('nome'),
        supabase.from('allowed_users').select('email').eq('papel', 'aluno').eq('ativo', true),
      ])
      if (!vivo) return
      if (a.error) setErro(`Não foi possível carregar os alunos: ${a.error.message}`)
      setAlunos((a.data as LinhaAluno[]) ?? [])
      setCasas((c.data as { id: number; nome: string }[]) ?? [])
      setComAcesso(u.error ? null : new Set(((u.data as { email: string }[]) ?? []).map((x) => x.email.toLowerCase())))
      setCarregando(false)
    })()
    return () => {
      vivo = false
    }
  }, [])

  const planos = useMemo(() => [...new Set(alunos.map((a) => a.plano).filter((p): p is string => !!p))].sort(), [alunos])
  const casaPorId = useMemo(() => new Map(casas.map((c) => [c.id, c.nome])), [casas])

  const visiveis = useMemo(() => {
    const termo = sem(busca.trim())
    return alunos.filter((a) => {
      if (status && a.status !== status) return false
      if (casa && String(a.casa_id ?? '') !== casa) return false
      if (plano && a.plano !== plano) return false
      if (termo && !sem(`${a.nome} ${a.nome_exibicao ?? ''} ${a.ra ?? ''} ${a.email}`).includes(termo)) return false
      return true
    })
  }, [alunos, busca, status, casa, plano])

  return (
    <section aria-labelledby="lista-alunos">
      <h2 id="lista-alunos" className="sr-only">
        Alunos
      </h2>
      <div className="grid grid-cols-2 gap-3 border border-gunmetal-gray/25 p-4 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <label className="col-span-2 text-sm font-bold text-gunmetal-gray lg:col-span-1">
          Buscar
          <input type="search" value={busca} onChange={(e) => mudar('q', e.target.value)} placeholder="Nome, RA ou e-mail" className={campo} />
        </label>
        <label className="text-sm font-bold text-gunmetal-gray">
          Situação
          <select value={status} onChange={(e) => mudar('situacao', e.target.value)} className={campo}>
            <option value="">Todas</option>
            {STATUS_ALUNO.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold text-gunmetal-gray">
          Casa
          <select value={casa} onChange={(e) => mudar('casa', e.target.value)} className={campo}>
            <option value="">Todas</option>
            {casas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 text-sm font-bold text-gunmetal-gray lg:col-span-1">
          Plano
          <select value={plano} onChange={(e) => mudar('plano', e.target.value)} className={campo}>
            <option value="">Todos</option>
            {planos.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>

      {erro && (
        <p role="alert" className="mt-3 border-l-4 border-mandarin-orange bg-soft-pink/60 p-3 text-sm text-onyx-black">
          {erro}
        </p>
      )}

      <p className="mt-3 text-sm text-muted-purple" aria-live="polite">
        {carregando ? 'Carregando...' : `${visiveis.length} de ${alunos.length} alunos`}
      </p>

      {!carregando && visiveis.length === 0 ? (
        <p className="mt-2 border border-gunmetal-gray/25 p-4 text-sm text-onyx-black">Nenhum aluno com esses filtros.</p>
      ) : (
        <ul className="mt-2 divide-y divide-gunmetal-gray/15 border border-gunmetal-gray/25">
          {visiveis.map((a) => (
            <li key={a.id}>
              <Link
                to={`/admin/alunos/${a.id}`}
                className="grid min-h-16 items-center gap-x-3 gap-y-1 p-3 transition hover:bg-soft-pink/40 md:grid-cols-[2fr_1fr_1fr_1fr_auto_auto]"
              >
                <span className="min-w-0">
                  <span className="block font-bold text-gunmetal-gray">{a.nome_exibicao ?? a.nome}</span>
                  <span className="block truncate text-xs text-muted-purple">
                    {a.ra ? `RA ${a.ra}` : 'Sem RA'} · {a.email}
                  </span>
                </span>
                <span className="text-sm text-onyx-black">{a.casa_id !== null ? casaPorId.get(a.casa_id) : 'Sem casa'}</span>
                <span className="text-sm text-onyx-black">{a.plano ?? 'Sem plano'}</span>
                <span className="text-sm text-onyx-black">{a.semestre_ingresso ? `Turma ${a.semestre_ingresso}` : '—'}</span>
                <span className="flex flex-wrap items-center gap-1">
                  <span className={`rounded-sm px-2 py-0.5 text-xs font-bold ${corStatus[a.status] ?? 'bg-neutral-tint'}`}>{a.status}</span>
                  {comAcesso && !comAcesso.has(a.email.toLowerCase()) && (
                    <span className="rounded-sm border border-gunmetal-gray/40 px-2 py-0.5 text-xs text-onyx-black">sem acesso</span>
                  )}
                </span>
                <ChevronRight size={18} aria-hidden="true" className="hidden text-gunmetal-gray md:block" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
