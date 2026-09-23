import { NavLink, Outlet } from 'react-router-dom'

const itemClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-[var(--color-brand)] text-white' : 'text-slate-600 hover:bg-slate-100'
  }`

export default function AdminLayout() {
  return (
    <div className="mx-auto flex max-w-6xl gap-6 px-4 py-8">
      <aside className="w-52 shrink-0 space-y-1">
        <NavLink to="/admin" end className={itemClass}>
          Visão geral
        </NavLink>
        <NavLink to="/admin/usuarios" className={itemClass}>
          Usuários (whitelist)
        </NavLink>
        <NavLink to="/admin/turmas" className={itemClass}>
          Turmas
        </NavLink>
        <NavLink to="/admin/conteudo" className={itemClass}>
          Conteúdo do site
        </NavLink>
        <NavLink to="/admin/relatorio" className={itemClass}>
          Relatório de presença
        </NavLink>
      </aside>
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  )
}
