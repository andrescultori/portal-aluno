import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { destinoAdmin, gruposAdmin, itensVisiveis } from './adminMenu'

export default function AdminDashboard() {
  const { temPapel } = useAuth()
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-bold uppercase tracking-[0.12em] text-gunmetal-gray">
        Administração
      </p>
      <h1 className="font-display text-[40px] leading-none text-gunmetal-gray md:text-[48px]">
        O que você quer gerenciar?
      </h1>

      {gruposAdmin.map((grupo) => {
        const itens = itensVisiveis(temPapel).filter((item) => item.grupo === grupo)
        if (itens.length === 0) return null
        return (
          <section key={grupo} className="mt-6" aria-labelledby={`grupo-${grupo}`}>
            <h2 id={`grupo-${grupo}`} className="text-sm font-bold uppercase tracking-[0.12em] text-muted-purple">
              {grupo}
            </h2>
            <ul className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {itens.map((item) => (
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
          </section>
        )
      })}

      <Link
        to="/"
        className="mt-6 inline-flex min-h-11 items-center text-sm font-bold text-gunmetal-gray underline underline-offset-4"
      >
        ← Ver portal do aluno
      </Link>
    </div>
  )
}
