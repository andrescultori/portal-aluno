import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, Menu, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import type { InfoPage, LinkSection } from '../types/database'

interface ItemNav {
  to: string
  label: string
  end?: boolean
}

interface GrupoNav {
  rotulo: string
  itens: ItemNav[]
  // Prefixos de rota que deixam o grupo "ativo" no menu.
  prefixos: string[]
}

function inicial(nome: string) {
  return (nome.trim()[0] ?? '?').toUpperCase()
}

const itemClasse = (ativo: boolean) =>
  `relative flex h-16 items-center px-3 font-display text-[18px] transition hover:text-white after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] ${
    ativo
      ? 'font-bold text-white after:bg-mandarin-orange'
      : 'font-semibold text-white/85 after:bg-transparent'
  }`

function MenuSuspenso({ grupo, ativo }: { grupo: GrupoNav; ativo: boolean }) {
  const [aberto, setAberto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()

  useEffect(() => setAberto(false), [pathname])

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        aria-expanded={aberto}
        aria-haspopup="true"
        onClick={() => setAberto((v) => !v)}
        className={`${itemClasse(ativo)} gap-1`}
      >
        {grupo.rotulo}
        <ChevronDown size={16} aria-hidden="true" className={aberto ? 'rotate-180' : ''} />
      </button>
      {aberto && (
        <div className="absolute left-0 top-full z-50 min-w-60 border border-gunmetal-gray/20 bg-pure-white py-1 shadow-[0_14px_34px_rgba(59,50,78,0.18)]">
          {grupo.itens.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block min-h-11 px-4 py-2.5 text-[15px] text-gunmetal-gray hover:bg-soft-pink ${
                  isActive ? 'bg-soft-pink font-bold' : ''
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Header() {
  const { perfil, signOut } = useAuth()
  const { pathname } = useLocation()
  const [menuAberto, setMenuAberto] = useState(false)
  const [sections, setSections] = useState<LinkSection[]>([])
  const [paginas, setPaginas] = useState<InfoPage[]>([])

  useEffect(() => setMenuAberto(false), [pathname])

  useEffect(() => {
    if (!perfil) return
    supabase
      .from('link_sections')
      .select('*')
      .order('ordem')
      .then(({ data }) => setSections((data as LinkSection[]) ?? []))
    supabase
      .from('info_pages')
      .select('*')
      .order('ordem')
      .then(({ data }) => setPaginas((data as InfoPage[]) ?? []))
  }, [perfil])

  const logo = (
    <Link to="/" aria-label="Portal do Aluno UniMissional — início" className="flex shrink-0 items-center">
      <img src="/logo/monocromia-branco.png" alt="UniMissional" className="h-12 w-auto" />
    </Link>
  )

  if (!perfil) {
    return (
      <header className="bg-gunmetal-gray">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4">{logo}</div>
      </header>
    )
  }

  const principais: ItemNav[] = [
    { to: '/', label: 'Início', end: true },
    { to: '/presenca', label: 'Presença' },
    { to: '/calendario', label: 'Calendário' },
    { to: '/manual', label: 'Manual do Aluno' },
  ]

  const grupos: GrupoNav[] = [
    {
      rotulo: 'Classroom e links',
      prefixos: ['/classroom', '/links'],
      itens: [
        { to: '/classroom', label: 'Google Classroom' },
        ...sections.map((s) => ({ to: `/links/${s.id}`, label: s.titulo })),
      ],
    },
    ...(paginas.length > 0
      ? [
          {
            rotulo: 'Informações',
            prefixos: ['/paginas'],
            itens: paginas.map((p) => ({ to: `/paginas/${p.slug}`, label: p.titulo })),
          },
        ]
      : []),
  ]

  const primeiroNome = perfil.nome.trim().split(/\s+/)[0]

  return (
    <header className="relative bg-gunmetal-gray">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        {logo}

        {/* Menu completo — telas grandes */}
        <nav aria-label="Principal" className="ml-4 hidden flex-1 items-center lg:flex">
          {principais.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => itemClasse(isActive)}
            >
              {item.label}
            </NavLink>
          ))}
          {grupos.map((g) => (
            <MenuSuspenso
              key={g.rotulo}
              grupo={g}
              ativo={g.prefixos.some((p) => pathname.startsWith(p))}
            />
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {perfil.papel === 'equipe' && (
            <Link
              to="/admin"
              className="flex min-h-11 items-center px-2 text-sm font-bold text-soft-pink underline-offset-4 hover:underline"
            >
              Admin
            </Link>
          )}
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none bg-soft-pink font-display text-xl font-bold text-gunmetal-gray"
          >
            {inicial(perfil.nome)}
          </span>
          <span className="max-w-40 truncate text-sm font-bold text-white" title={perfil.nome}>
            {primeiroNome}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="min-h-11 rounded-sm px-3 text-sm font-bold text-white/85 underline-offset-4 hover:text-white hover:underline"
          >
            Sair
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMenuAberto((v) => !v)}
          aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuAberto}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border-2 border-white/60 text-white lg:hidden"
        >
          {menuAberto ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Menu em painel — celular e tablet */}
      {menuAberto && (
        <nav
          aria-label="Principal"
          className="absolute inset-x-0 top-full z-50 max-h-[calc(100svh-64px)] overflow-y-auto border-t border-white/15 bg-gunmetal-gray pb-4 shadow-[0_14px_34px_rgba(59,50,78,0.3)] lg:hidden"
        >
          <div className="flex items-center gap-3 px-4 py-4">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center bg-soft-pink font-display text-xl font-bold text-gunmetal-gray"
            >
              {inicial(perfil.nome)}
            </span>
            <span className="truncate text-sm font-bold text-white">{perfil.nome}</span>
          </div>

          <ul>
            {principais.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center border-l-4 px-4 py-2.5 text-base text-white ${
                      isActive
                        ? 'border-mandarin-orange bg-white/10 font-bold'
                        : 'border-transparent font-medium'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>

          {grupos.map((g) => (
            <div key={g.rotulo} className="mt-3">
              <p className="px-4 pb-1 text-xs font-bold uppercase tracking-wide text-soft-pink">
                {g.rotulo}
              </p>
              <ul>
                {g.itens.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `flex min-h-11 items-center border-l-4 px-4 py-2.5 text-base text-white ${
                          isActive
                            ? 'border-mandarin-orange bg-white/10 font-bold'
                            : 'border-transparent font-medium'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="mt-3 border-t border-white/15 pt-2">
            {perfil.papel === 'equipe' && (
              <Link to="/admin" className="flex min-h-11 items-center px-4 text-base font-bold text-soft-pink">
                Administração
              </Link>
            )}
            <button
              type="button"
              onClick={signOut}
              className="flex min-h-11 w-full items-center px-4 text-left text-base font-bold text-white"
            >
              Sair
            </button>
          </div>
        </nav>
      )}
    </header>
  )
}
