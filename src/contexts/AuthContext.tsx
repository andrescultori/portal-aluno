import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import type { AllowedUser } from '../types/database'

interface AuthContextValue {
  session: Session | null
  perfil: AllowedUser | null
  loading: boolean
  naoAutorizado: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<AllowedUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [naoAutorizado, setNaoAutorizado] = useState(false)

  async function carregarPerfil(currentSession: Session | null) {
    if (!currentSession?.user?.email) {
      setPerfil(null)
      setNaoAutorizado(false)
      return
    }

    const { data, error } = await supabase
      .from('allowed_users')
      .select('*')
      .eq('email', currentSession.user.email)
      .eq('ativo', true)
      .maybeSingle()

    if (error || !data) {
      setPerfil(null)
      setNaoAutorizado(true)
      await supabase.auth.signOut()
      setSession(null)
      return
    }

    setPerfil(data as AllowedUser)
    setNaoAutorizado(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      carregarPerfil(data.session).finally(() => setLoading(false))
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setLoading(true)
      carregarPerfil(newSession).finally(() => setLoading(false))
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    setPerfil(null)
    setSession(null)
  }

  return (
    <AuthContext.Provider
      value={{ session, perfil, loading, naoAutorizado, signInWithGoogle, signOut }}
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
