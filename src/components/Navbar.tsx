import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import type { LinkSection } from '../types/database'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
  }`

export default function Navbar() {
  const { perfil, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [sections, setSections] = useState<LinkSection[]>([])

  useEffect(() => {
    if (!perfil) return
    supabase
      .from('link_sections')
      .select('*')
      .order('ordem')
      .then(({ data }) => setSections((data as LinkSection[]) ?? []))
  }, [perfil])

  if (!perfil) {
    return (
      <header className="sticky top-0 z-50 bg-gunmetal-gray shadow-md">
        <div className="mx-auto flex max-w-6xl items-center px-brand-3 py-3">
          <img src="logo/monocromia-branco.png" alt="UniMissional" className="h-10 w-auto" />
        </div>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-50 bg-gunmetal-gray shadow-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-brand-3 py-3">
        <NavLink to="/" className="flex items-center">
          <img src="logo/monocromia-branco.png" alt="UniMissional" className="h-10 w-auto" />
        </NavLink>

        <button
          className="text-white md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menu"
        >
          ☰
        </button>

        <nav
          className={`${open ? 'flex' : 'hidden'} absolute left-0 top-full w-full flex-col gap-1 bg-gunmetal-gray px-brand-3 py-3 md:static md:flex md:w-auto md:flex-row md:items-center md:gap-1 md:bg-transparent md:py-0`}
        >
          <NavLink to="/" className={linkClass} end onClick={() => setOpen(false)}>
            Início
          </NavLink>
          <NavLink to="/manual" className={linkClass} onClick={() => setOpen(false)}>
            Manual do Aluno
          </NavLink>
          <NavLink to="/classroom" className={linkClass} onClick={() => setOpen(false)}>
            Google Classroom
          </NavLink>
          <NavLink to="/calendario" className={linkClass} onClick={() => setOpen(false)}>
            Calendário
          </NavLink>
          <NavLink to="/presenca" className={linkClass} onClick={() => setOpen(false)}>
            Presença
          </NavLink>
          {sections.map((section) => (
            <NavLink
              key={section.id}
              to={`/links/${section.id}`}
              className={linkClass}
              onClick={() => setOpen(false)}
            >
              {section.titulo}
            </NavLink>
          ))}

          {perfil.papel === 'equipe' && (
            <NavLink to="/admin" className={linkClass} onClick={() => setOpen(false)}>
              Admin
            </NavLink>
          )}

          <button
            onClick={signOut}
            className="rounded-md px-3 py-2 text-left text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            Sair ({perfil.nome})
          </button>
        </nav>
      </div>
    </header>
  )
}
