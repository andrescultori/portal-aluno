import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { Papel } from '../types/database'

export default function ProtectedRoute({
  children,
  papel,
}: {
  children: ReactNode
  papel?: Papel
}) {
  const { session, perfil, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="flex flex-1 items-center justify-center text-slate-400">Carregando...</div>
  }

  if (!session || !perfil) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (papel && perfil.papel !== papel) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
