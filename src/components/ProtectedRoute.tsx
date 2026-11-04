import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { Papel } from '../types/database'

export default function ProtectedRoute({
  children,
  papel,
  papeis,
}: {
  children: ReactNode
  papel?: Papel
  // Papéis de equipe (staff_roles): basta ter um deles.
  papeis?: string[]
}) {
  const { session, perfil, loading, temPapel } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="flex flex-1 items-center justify-center text-muted-purple">Carregando...</div>
  }

  if (!session || !perfil) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (papel && perfil.papel !== papel) {
    return <Navigate to="/" replace />
  }

  if (papeis && !temPapel(...papeis)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
