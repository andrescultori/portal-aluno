import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import type { AllowedUser } from '../types/database'

type ProviderLogin = 'google' | 'azure'

interface AuthContextValue {
  session: Session | null
  perfil: AllowedUser | null
  // Papéis de equipe (public.staff_roles) do usuário logado: admin, coordenacao, tutor...
  // A autorização de verdade é sempre do banco (RLS); isto só decide o que mostrar.
  papeis: string[]
  temPapel: (...papeis: string[]) => boolean
  loading: boolean
  naoAutorizado: boolean
  signInWithProvider: (provider: ProviderLogin, destino?: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<AllowedUser | null>(null)
  const [papeis, setPapeis] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [naoAutorizado, setNaoAutorizado] = useState(false)
  // Quem está logado agora (id do usuário). Serve para reconhecer que um evento de
  // autenticação é só a mesma pessoa voltando à aba, e não um login de verdade.
  const usuarioAtual = useRef<string | null>(null)

  async function carregarPerfil(currentSession: Session | null) {
    if (!currentSession?.user?.email) {
      setPerfil(null)
      setPapeis([])
      setNaoAutorizado(false)
      return
    }

    const { data, error } = await supabase
      .from('allowed_users')
      .select('*')
      .eq('email', currentSession.user.email.toLowerCase())
      .eq('ativo', true)
      .maybeSingle()

    if (error || !data) {
      setPerfil(null)
      setPapeis([])
      setNaoAutorizado(true)
      await supabase.auth.signOut()
      setSession(null)
      return
    }

    // Perfil e papéis entram juntos: se o perfil aparecesse antes, uma rota restrita por papel
    // mandaria a pessoa para a Home por achar que ela ainda não tem o papel.
    const { data: papeisData, error: papeisErro } = await supabase.rpc('current_roles')
    setPapeis(papeisErro || !Array.isArray(papeisData) ? [] : (papeisData as string[]))
    setPerfil(data as AllowedUser)
    setNaoAutorizado(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      usuarioAtual.current = data.session?.user?.id ?? null
      setSession(data.session)
      carregarPerfil(data.session).finally(() => setLoading(false))
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      const idNovo = newSession?.user?.id ?? null
      // Sempre que a aba volta ao foco o Supabase reverifica a sessão e dispara SIGNED_IN
      // para a MESMA pessoa. Tratar isso como login recarregava o perfil, mostrava
      // "Carregando..." e desmontava a tela, apagando o que o usuário estava digitando.
      // Mesma pessoa = só atualiza a sessão (token novo), sem mexer na tela.
      if (idNovo && idNovo === usuarioAtual.current && event !== 'SIGNED_OUT') {
        setSession(newSession)
        return
      }
      usuarioAtual.current = idNovo
      setSession(newSession)

      // O Supabase dispara TOKEN_REFRESHED sempre que a aba volta a ficar
      // em foco (ele reverifica a sessão) e INITIAL_SESSION duplica o que
      // getSession() acima já tratou. Reagir a esses eventos como se fosse
      // login/logout fazia a tela toda "piscar" pra Carregando... toda vez
      // que o usuário voltava pra aba, sem necessidade — nada realmente
      // mudou pro usuário nesses casos.
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return

      setLoading(true)
      carregarPerfil(newSession).finally(() => setLoading(false))
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signInWithProvider(provider: ProviderLogin, destino?: string) {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + (destino ?? window.location.pathname) },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    usuarioAtual.current = null
    setPerfil(null)
    setPapeis([])
    setSession(null)
  }

  const temPapel = (...desejados: string[]) => desejados.some((p) => papeis.includes(p))

  return (
    <AuthContext.Provider
      value={{ session, perfil, papeis, temPapel, loading, naoAutorizado, signInWithProvider, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
