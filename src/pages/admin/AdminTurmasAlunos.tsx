import { useSearchParams } from 'react-router-dom'
import CabecalhoAdmin from './CabecalhoAdmin'
import ListaAlunos from './alunos/ListaAlunos'
import AcessosAlunos from './alunos/AcessosAlunos'
import AdminTurmas from './AdminTurmas'

type Aba = 'alunos' | 'acessos' | 'turmas'
const ABAS: [Aba, string][] = [
  ['alunos', 'Alunos'],
  ['acessos', 'Acessos de alunos'],
  ['turmas', 'Turmas e QR Code'],
]

export default function AdminTurmasAlunos() {
  const [params, setParams] = useSearchParams()
  const abaParam = params.get('aba')
  const aba: Aba = ABAS.some(([v]) => v === abaParam) ? (abaParam as Aba) : 'alunos'
  const setAba = (nova: Aba) =>
    // Troca de aba mantém só a aba (os filtros de cada uma são dela).
    setParams({ aba: nova }, { replace: true })

  return (
    <div className="mx-auto max-w-6xl">
      <CabecalhoAdmin
        titulo="Turmas e alunos"
        trilha={[{ rotulo: ABAS.find(([v]) => v === aba)?.[1] ?? 'Alunos' }]}
        descricao="A lista de alunos e a ficha de cada um, quem tem acesso ao portal, e as turmas de presença com o QR Code."
      />
      <div role="tablist" aria-label="Seções" className="mb-6 flex flex-wrap gap-2 border-b border-gunmetal-gray/25">
        {ABAS.map(([valor, rotulo]) => (
          <button
            key={valor}
            role="tab"
            type="button"
            aria-selected={aba === valor}
            onClick={() => setAba(valor)}
            className={`min-h-11 border-b-4 px-4 text-sm font-bold transition ${
              aba === valor ? 'border-mandarin-orange text-gunmetal-gray' : 'border-transparent text-muted-purple hover:text-gunmetal-gray'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>
      {aba === 'alunos' && <ListaAlunos />}
      {aba === 'acessos' && <AcessosAlunos />}
      {aba === 'turmas' && <AdminTurmas />}
    </div>
  )
}
