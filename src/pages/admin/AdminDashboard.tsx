import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { destinoAdmin, itensAdmin } from './adminMenu'

export default function AdminDashboard() {
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-bold uppercase tracking-[0.12em] text-gunmetal-gray">
        Administração
      </p>
      <h1 className="font-display text-[40px] leading-none text-gunmetal-gray md:text-[48px]">
        O que você quer gerenciar?
      </h1>

      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {itensAdmin.map((item) => (
          <li key={item.rotulo} className="min-w-0">
            <Link
              to={destinoAdmin(item)}
              className="flex h-full min-h-24 items-center gap-3 border border-gunmetal-gray/25 bg-pure-white p-4 transition hover:border-mandarin-orange hover:bg-soft-pink/40"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-display text-2xl font-bold leading-tight text-gunmetal-gray">
                  {item.rotulo}
                </span>
                <span className="mt-1 block text-sm text-onyx-black">{item.descricao}</span>
              </span>
              <ChevronRight size={20} aria-hidden="true" className="shrink-0 text-gunmetal-gray" />
            </Link>
          </li>
        ))}
      </ul>

      <Link
        to="/"
        className="mt-6 inline-flex min-h-11 items-center text-sm font-bold text-gunmetal-gray underline underline-offset-4"
      >
        ← Ver portal do aluno
      </Link>
    </div>
  )
}
