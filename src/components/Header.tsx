import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Menu, User, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import type { LinkSection } from '../types/database'

interface ItemNav {
  to: string
  label: string
  end?: boolean
}

const dropdownLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-soft-pink text-onyx-black' : 'text-gunmetal-gray hover:bg-neutral-tint'
  }`

const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition ${
    isActive ? 'bg-white/20 text-white' : 'text-white/85 hover:bg-white/10 hover:text-white'
  }`

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/)
  const primeiro = partes[0]?.[0] ?? ''
  const ultimo = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (primeiro + ultimo).toUpperCase()
}

export default function Header() {
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
      <header className="header-gradiente rounded-b-[36px] px-brand-3 py-6">
        <p className="mx-auto max-w-6xl text-center font-display text-xl font-bold text-white">
          Portal do Aluno
        </p>
      </header>
    )
  }

  const itens: ItemNav[] = [
    { to: '/', label: 'Início', end: true },
    { to: '/manual', label: 'Manual do Aluno' },
    { to: '/classroom', label: 'Google Classroom' },
    { to: '/calendario', label: 'Calendário' },
    { to: '/presenca', label: 'Presença' },
    ...sections.map((s) => ({ to: `/links/${s.id}`, label: s.titulo })),
    ...(perfil.papel === 'equipe' ? [{ to: '/admin', label: 'Admin' }] : []),
  ]

  return (
    <header className="header-gradiente relative px-brand-3 pb-6 pt-5 rounded-b-[36px]">
      <div className="mx-auto flex max-w-6xl items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg font-bold text-white">
            {iniciais(perfil.nome)}
          </div>
          <div>
            <p className="font-display text-2xl font-bold leading-tight text-white md:text-[28px]">
              Olá, {perfil.nome.split(' ')[0]}!
            </p>
            <p className="text-[13px] text-white/90">Portal do Aluno · UniMissional</p>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
              <User size={12} />
              {perfil.papel === 'equipe' ? 'Equipe' : 'Aluno'}
            </span>
          </div>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-white md:hidden"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Menu completo — telas médias/grandes */}
      <nav className="mx-auto mt-4 hidden max-w-6xl flex-wrap items-center gap-1 md:flex">
        {itens.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={desktopLinkClass}>
            {item.label}
          </NavLink>
        ))}
        <button
          onClick={signOut}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-white/85 transition hover:bg-white/10 hover:text-white"
        >
          Sair
        </button>
      </nav>

      {/* Menu em painel — só mobile */}
      {open && (
        <nav className="absolute right-brand-3 top-full z-50 mt-2 w-64 rounded-xl bg-white p-2 text-left shadow-[0_14px_34px_rgba(59,50,78,0.14)] md:hidden">
          {itens.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={dropdownLinkClass}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
          <button
            onClick={signOut}
            className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-neutral-tint"
          >
            Sair
          </button>
        </nav>
      )}
    </header>
  )
}
