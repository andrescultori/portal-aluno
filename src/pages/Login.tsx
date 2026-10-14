import { Navigate, useLocation, type Location } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { FaixaTricolor, MeridianosDecor } from '../components/marca'

export default function Login() {
  const { session, perfil, loading, naoAutorizado, signInWithProvider } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: Location } | null)?.from
  const destino = from ? from.pathname + from.search : undefined

  if (loading) return null
  if (session && perfil) return <Navigate to="/" replace />

  return (
    <div className="relative flex min-h-[calc(100svh-64px)] items-center justify-center overflow-hidden bg-pure-white px-4 py-10">
      <MeridianosDecor className="pointer-events-none absolute -right-28 -top-28 h-[440px] w-[440px]" />
      <MeridianosDecor className="pointer-events-none absolute -bottom-28 -left-28 h-[440px] w-[440px]" />

      <div className="relative w-full max-w-[440px] border border-gunmetal-gray/20 bg-pure-white shadow-[0_18px_40px_rgba(59,50,78,0.12)]">
        <FaixaTricolor altura="h-3" />

        <div className="px-6 pb-8 pt-8 text-center sm:px-10">
          <img
            src="/logo/logo-roxo.png"
            alt="UniMissional"
            width={200}
            height={200}
            className="mx-auto h-auto w-[200px]"
          />

          <h1 className="mt-4 font-display text-[40px] leading-none text-gunmetal-gray">
            Portal do Aluno
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-onyx-black">
            Entre com o e-mail institucional cadastrado.
          </p>

          {naoAutorizado && (
            <p
              role="alert"
              className="mt-5 border-l-4 border-mandarin-orange bg-soft-pink px-3 py-2 text-left text-sm text-onyx-black"
            >
              Acesso não autorizado para este e-mail. Fale com a coordenação.
            </p>
          )}

          <div className="mt-6 space-y-3">
            <button
              onClick={() => signInWithProvider('google', destino)}
              className="min-h-[52px] w-full rounded-sm bg-gunmetal-gray px-4 text-base font-bold text-white transition hover:bg-gunmetal-gray-dark"
            >
              Entrar com Google
            </button>
            <button
              onClick={() => signInWithProvider('azure', destino)}
              className="min-h-[52px] w-full rounded-sm border-2 border-gunmetal-gray px-4 text-base font-bold text-gunmetal-gray transition hover:bg-soft-pink"
            >
              Entrar com Microsoft
            </button>
          </div>

          <p className="mt-6 text-[13px] leading-relaxed text-muted-purple">
            Acesso restrito a alunos e equipe cadastrados. Problemas para entrar? Fale com a
            coordenação.
          </p>
        </div>
      </div>
    </div>
  )
}
