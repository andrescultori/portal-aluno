import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Página não encontrada</h1>
      <Link to="/" className="text-[var(--color-brand)] hover:underline">
        Voltar ao início
      </Link>
    </div>
  )
}
