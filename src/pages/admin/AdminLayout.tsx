import { NavLink, Outlet } from 'react-router-dom'

const itens = [
  { to: '/admin', label: 'Visão geral', end: true },
  { to: '/admin/usuarios', label: 'Usuários (whitelist)' },
  { to: '/admin/turmas', label: 'Turmas' },
  { to: '/admin/conteudo', label: 'Conteúdo do site' },
  { to: '/admin/relatorio', label: 'Relatório de presença' },
]

const itemClass = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
    isActive
      ? 'border-mandarin-orange text-onyx-black'
      : 'border-transparent text-slate-500 hover:text-gunmetal-gray'
  }`

export default function AdminLayout() {
  return (
    <div className="mx-auto max-w-6xl px-brand-3 py-brand-4">
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {itens.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={itemClass}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
