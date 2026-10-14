import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'

// Moldura do app: decide cabeçalho e rodapé conforme a área da rota.
export default function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const ehLogin = pathname === '/login'

  return (
    <>
      {!ehLogin && <Header />}
      <main className="flex-1">{children}</main>
      <Footer variante={ehLogin ? 'discreto' : 'aluno'} />
    </>
  )
}
