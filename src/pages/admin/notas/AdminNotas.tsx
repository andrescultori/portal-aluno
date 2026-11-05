import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabaseClient'
import type { Semestre } from '../../../types/alunos'
import CabecalhoAdmin from '../CabecalhoAdmin'
import { usePermissoes } from './escopo'
import AtividadesNotas from './AtividadesNotas'
import ProjetoNotas from './ProjetoNotas'
import PresencaJustificativas from './PresencaJustificativas'

type Aba = 'atividades' | 'projeto' | 'presenca'

const campo =
  'mt-1 block min-h-11 w-full min-w-0 rounded-sm border border-gunmetal-gray/40 bg-pure-white px-2 text-sm font-normal text-onyx-black'

export default function AdminNotas() {
  const perm = usePermissoes()
  const [params, setParams] = useSearchParams()
  const [semestres, setSemestres] = useState<Semestre[]>([])
  const [carregando, setCarregando] = useState(true)

  // Secretaria só mexe em presença (justificar faltas); os demais também lançam atividades e projeto.
  const abas = useMemo<[Aba, string][]>(
    () =>
      perm.lanca || perm.configura
        ? [
            ['atividades', 'Atividades'],
            ['projeto', 'Projeto final'],
            ['presenca', 'Presença e faltas'],
          ]
        : [['presenca', 'Presença e faltas']],
    [perm.lanca, perm.configura],
  )
  const abaParam = params.get('aba')
  const aba: Aba = abas.some(([v]) => v === abaParam) ? (abaParam as Aba) : abas[0][0]
  const semParam = params.get('sem')
  const semestre = useMemo(
    () => semestres.find((s) => s.codigo === semParam) ?? semestres.find((s) => s.atual) ?? semestres[0] ?? null,
    [semestres, semParam],
  )

  useEffect(() => {
    supabase
      .schema('alunos')
      .from('semestres')
      .select('id, codigo, inicio, fim, atual')
      .order('codigo', { ascending: false })
      .then(({ data }) => {
        setSemestres((data as Semestre[]) ?? [])
        setCarregando(false)
      })
  }, [])

  const mudar = (chave: string, valor: string) =>
    setParams(
      (atual) => {
        const p = new URLSearchParams(atual)
        p.set(chave, valor)
        return p
      },
      { replace: true },
    )

  return (
    <div className="mx-auto max-w-6xl">
      <CabecalhoAdmin
        titulo="Notas e presença"
        trilha={[{ rotulo: 'Avaliações', to: '/admin/avaliacoes' }, { rotulo: abas.find(([v]) => v === aba)?.[1] ?? 'Notas' }]}
        descricao="Notas das atividades e do projeto final, e justificativa de faltas. Tutores lançam as notas dos seus alunos; a coordenação define as atividades e os pesos do projeto."
      />

      {!carregando && semestres.length > 0 && (
        <label className="mb-4 block max-w-xs text-sm font-bold text-gunmetal-gray">
          Semestre
          <select value={semestre?.codigo ?? ''} onChange={(e) => mudar('sem', e.target.value)} className={campo}>
            {semestres.map((s) => (
              <option key={s.id} value={s.codigo}>
                {s.codigo}
                {s.atual ? ' (atual)' : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      <div role="tablist" aria-label="Seções" className="mb-5 flex flex-wrap gap-2 border-b border-gunmetal-gray/25">
        {abas.map(([valor, rotulo]) => (
          <button
            key={valor}
            role="tab"
            type="button"
            aria-selected={aba === valor}
            onClick={() => mudar('aba', valor)}
            className={`min-h-11 border-b-4 px-4 text-sm font-bold transition ${
              aba === valor ? 'border-mandarin-orange text-gunmetal-gray' : 'border-transparent text-muted-purple hover:text-gunmetal-gray'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {carregando ? (
        <p className="text-onyx-black">Carregando...</p>
      ) : !semestre ? (
        <p className="border border-gunmetal-gray/25 p-4 text-sm text-onyx-black">Ainda não há semestre cadastrado.</p>
      ) : aba === 'atividades' ? (
        <AtividadesNotas key={semestre.id} semestre={semestre} perm={perm} />
      ) : aba === 'projeto' ? (
        <ProjetoNotas key={semestre.id} semestre={semestre} perm={perm} />
      ) : (
        <PresencaJustificativas key={semestre.id} semestre={semestre} perm={perm} />
      )}
    </div>
  )
}
