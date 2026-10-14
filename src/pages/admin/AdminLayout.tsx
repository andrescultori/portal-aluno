import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Footer from '../../components/Footer'

interface ItemMenu {
  rotulo: string
  caminho: string
  // Aba do AdminConteudo (?aba=), quando o item aponta para uma delas.
  aba?: string
  // Outras abas que também deixam o item ativo.
  abasExtras?: string[]
}

const itens: ItemMenu[] = [
  { rotulo: 'Relatório de presença', caminho: '/admin/relatorio' },
  { rotulo: 'Turmas e alunos', caminho: '/admin/turmas' },
  { rotulo: 'Equipe e acessos', caminho: '/admin/usuarios' },
  { rotulo: 'Avisos', caminho: '/admin/avisos' },
  { rotulo: 'Manual do Aluno', caminho: '/admin/conteudo', aba: 'manual' },
  { rotulo: 'Destaque da home', caminho: '/admin/conteudo', aba: 'hero' },
  { rotulo: 'Links e Classroom', caminho: '/admin/conteudo', aba: 'classroom', abasExtras: ['links'] },
]

function Menu_({ aoNavegar }: { aoNavegar?: () => void }) {
  const { pathname, search } = useLocation()
  const abaAtual = new URLSearchParams(search).get('aba') ?? 'hero'

  return (
    <nav aria-label="Administração" className="flex flex-1 flex-col">
      <ul>
        {itens.map((item) => {
          const ativo = item.aba
            ? pathname === item.caminho &&
              (abaAtual === item.aba || !!item.abasExtras?.includes(abaAtual))
            : pathname === item.caminho
          return (
            <li key={item.rotulo}>
              <NavLink
                to={item.aba ? `${item.caminho}?aba=${item.aba}` : item.caminho}
                onClick={aoNavegar}
                aria-current={ativo ? 'page' : undefined}
                className={`flex h-11 items-center border-l-4 px-5 text-sm text-white transition hover:bg-white/10 ${
                  ativo ? 'border-mandarin-orange bg-white/12 font-bold' : 'border-transparent'
                }`}
              >
                {item.rotulo}
              </NavLink>
            </li>
          )
        })}
      </ul>

      <Link
        to="/"
        onClick={aoNavegar}
        className="mt-auto flex h-11 items-center border-t border-white/15 px-5 text-sm font-bold text-soft-pink underline-offset-4 hover:underline"
      >
        ← Ver portal do aluno
      </Link>
    </nav>
  )
}

export default function AdminLayout() {
  const [aberto, setAberto] = useState(false)
  const { pathname } = useLocation()

  // Fecha o menu do celular ao navegar.
  useEffect(() => setAberto(false), [pathname])

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      {/* Celular: header gunmetal com botão de menu */}
      <div className="relative bg-gunmetal-gray md:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <Link to="/admin" aria-label="Administração — início">
            <img src="/logo/monocromia-branco.png" alt="UniMissional" className="h-12 w-auto" />
          </Link>
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={aberto}
            className="flex h-11 w-11 items-center justify-center rounded-sm border-2 border-white/60 text-white"
          >
            {aberto ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {aberto && (
          <div className="absolute inset-x-0 top-full z-50 flex max-h-[calc(100svh-64px)] flex-col overflow-y-auto border-t border-white/15 bg-gunmetal-gray pb-2 shadow-[0_14px_34px_rgba(59,50,78,0.3)]">
            <Menu_ aoNavegar={() => setAberto(false)} />
          </div>
        )}
      </div>

      {/* Desktop: sidebar fixa */}
      <aside className="hidden w-[270px] shrink-0 flex-col bg-gunmetal-gray md:sticky md:top-0 md:flex md:h-svh">
        <Link to="/admin" aria-label="Administração — início" className="block px-5 pb-6 pt-6">
          <img src="/logo/monocromia-branco.png" alt="UniMissional" className="w-[160px]" />
        </Link>
        <p className="px-5 pb-2 text-xs font-bold uppercase tracking-[0.12em] text-soft-pink">
          Administração
        </p>
        <Menu_ />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 px-4 py-6 md:px-10 md:py-10">
          <Outlet />
        </div>
        <Footer variante="discreto" />
      </div>
    </div>
  )
}
