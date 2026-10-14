import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import Header from './Header'
import HeaderCheckin from './HeaderCheckin'
import Footer from './Footer'

// Moldura do app: decide cabeçalho e rodapé conforme a área da rota.
export default function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const ehLogin = pathname === '/login'
  const ehCheckin = pathname === '/presenca'
  const ehAdmin = pathname.startsWith('/admin')

  return (
    <>
      {ehCheckin ? <HeaderCheckin /> : !ehLogin && !ehAdmin && <Header />}
      <main className="flex-1">{children}</main>
      {/* No Admin o rodapé discreto fica dentro do AdminLayout, ao lado da sidebar. */}
      {!ehAdmin && <Footer variante={ehLogin ? 'discreto' : 'aluno'} />}
    </>
  )
}
