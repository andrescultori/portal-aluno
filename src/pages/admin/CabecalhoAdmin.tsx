import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export interface Migalha {
  rotulo: string
  // Sem "to" = a tela atual (último item).
  to?: string
}

// Título da tela com o caminho clicável logo abaixo ("Administração › Avaliações › Atribuições").
// "Administração" é sempre o primeiro item e leva ao início do Admin.
export default function CabecalhoAdmin({
  titulo,
  trilha = [],
  descricao,
  children,
}: {
  titulo: string
  trilha?: Migalha[]
  descricao?: ReactNode
  children?: ReactNode
}) {
  const itens: Migalha[] = [{ rotulo: 'Administração', to: '/admin' }, ...trilha]
  return (
    <header className="mb-6">
      <h1 className="font-display text-[40px] leading-none text-gunmetal-gray md:text-[48px]">{titulo}</h1>
      <nav aria-label="Você está em" className="mt-2">
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm text-onyx-black">
          {itens.map((m, i) => {
            const ultimo = i === itens.length - 1
            return (
              <li key={`${m.rotulo}-${i}`} className="flex items-center gap-1">
                {m.to && !ultimo ? (
                  <Link to={m.to} className="inline-flex min-h-11 items-center font-bold text-gunmetal-gray underline underline-offset-4 hover:text-mandarin-orange">
                    {m.rotulo}
                  </Link>
                ) : (
                  <span aria-current={ultimo ? 'page' : undefined} className={ultimo ? 'font-bold' : undefined}>
                    {m.rotulo}
                  </span>
                )}
                {!ultimo && <ChevronRight size={14} aria-hidden="true" className="text-muted-purple" />}
              </li>
            )
          })}
        </ol>
      </nav>
      {descricao && <p className="mt-3 max-w-3xl text-sm text-onyx-black">{descricao}</p>}
      {children}
    </header>
  )
}
