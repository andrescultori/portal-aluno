import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { STATUS_ALUNO, type Elegibilidade } from '../../types/alunos'

// Filtro de situação do aluno, compartilhado pelas abas de Avaliações (vive na URL: ?status=).
// "avaliaveis" é o padrão: só quem será avaliado (Ativo e sem plano Convênio), segundo o banco.
export type ValorFiltroStatus = 'avaliaveis' | 'todos' | 'convenio' | (typeof STATUS_ALUNO)[number]

export const FILTRO_PADRAO: ValorFiltroStatus = 'avaliaveis'

const OPCOES: [ValorFiltroStatus, string][] = [
  ['avaliaveis', 'Quem será avaliado (Ativo, sem convênio)'],
  ['todos', 'Todos os alunos'],
  ...STATUS_ALUNO.map((s) => [s, `Só ${s}`] as [ValorFiltroStatus, string]),
  ['convenio', 'Só plano Convênio'],
]

export function valorValido(v: string | null): ValorFiltroStatus {
  return OPCOES.some(([o]) => o === v) ? (v as ValorFiltroStatus) : FILTRO_PADRAO
}

export function passa(e: Elegibilidade | undefined, filtro: ValorFiltroStatus): boolean {
  // Sem veredito do banco (consulta não instalada ou aluno novo) não escondemos ninguém.
  if (!e) return filtro === 'todos' || filtro === 'avaliaveis'
  switch (filtro) {
    case 'todos':
      return true
    case 'avaliaveis':
      return e.avaliavel
    case 'convenio':
      return e.convenio
    default:
      return e.status === filtro
  }
}

// Busca no banco quem é avaliável no semestre. Se a consulta ainda não existe, devolve vazio + aviso.
export function useElegibilidade(semestreId: string | undefined) {
  const [mapa, setMapa] = useState<Map<string, Elegibilidade>>(new Map())
  const [aviso, setAviso] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!semestreId) return
    const { data, error } = await supabase.schema('alunos').rpc('avaliaveis_semestre', { p_semestre: semestreId })
    if (error) {
      setMapa(new Map())
      setAviso(
        error.message.includes('avaliaveis_semestre')
          ? 'O filtro por situação ainda não foi instalado no banco (migração 15): mostrando todos os alunos.'
          : `Não foi possível carregar a situação dos alunos: ${error.message}`,
      )
      return
    }
    setAviso(null)
    setMapa(new Map(((data as Elegibilidade[]) ?? []).map((e) => [e.aluno_id, e])))
  }, [semestreId])

  useEffect(() => {
    carregar()
  }, [carregar])

  return useMemo(() => ({ mapa, aviso, recarregar: carregar }), [mapa, aviso, carregar])
}

export default function FiltroStatus({
  valor,
  aoMudar,
  classeCampo,
}: {
  valor: ValorFiltroStatus
  aoMudar: (v: ValorFiltroStatus) => void
  classeCampo: string
}) {
  return (
    <label className="text-sm font-bold text-gunmetal-gray">
      Situação
      <select value={valor} onChange={(e) => aoMudar(e.target.value as ValorFiltroStatus)} className={classeCampo}>
        {OPCOES.map(([v, rotulo]) => (
          <option key={v} value={v}>
            {rotulo}
          </option>
        ))}
      </select>
    </label>
  )
}
