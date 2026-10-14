import { Link } from 'react-router-dom'
import { FaixaTricolor } from './marca'

// Cabeçalho enxuto da tela de check-in (pensada para o celular).
export default function HeaderCheckin() {
  return (
    <header>
      <div className="bg-gunmetal-gray">
        <div className="mx-auto flex h-16 max-w-xl items-center justify-between px-4">
          <Link to="/" aria-label="UniMissional — início" className="flex items-center">
            <img src="/logo/monocromia-branco.png" alt="UniMissional" className="h-12 w-auto" />
          </Link>
          <Link
            to="/"
            className="flex min-h-11 items-center px-2 font-display text-xl font-bold text-white underline decoration-mandarin-orange decoration-[3px] underline-offset-8"
          >
            Início
          </Link>
        </div>
      </div>
      <FaixaTricolor altura="h-2" />
    </header>
  )
}
