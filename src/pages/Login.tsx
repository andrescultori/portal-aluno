import { Navigate, useLocation, type Location } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { session, perfil, loading, naoAutorizado, signInWithProvider } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: Location } | null)?.from
  const destino = from ? from.pathname + from.search : undefined

  if (loading) return null
  if (session && perfil) return <Navigate to="/" replace />

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold text-slate-900">Portal do Aluno</h1>
        <p className="mb-6 text-sm text-slate-500">UniMissional</p>

        {naoAutorizado && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Acesso não autorizado para este e-mail. Fale com a coordenação.
          </p>
        )}

        <div className="space-y-2">
          <button
            onClick={() => signInWithProvider('google', destino)}
            className="w-full rounded-md bg-gunmetal-gray px-4 py-2.5 text-sm font-bold text-white transition hover:bg-gunmetal-gray-dark"
          >
            Entrar com Google
          </button>
          <button
            onClick={() => signInWithProvider('azure', destino)}
            className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-sm font-bold text-gunmetal-gray transition hover:bg-slate-50"
          >
            Entrar com Microsoft
          </button>
        </div>
      </div>
    </div>
  )
}
