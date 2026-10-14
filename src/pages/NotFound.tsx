import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="font-display text-[40px] leading-none text-gunmetal-gray">Página não encontrada</h1>
      <Link to="/" className="font-bold text-gunmetal-gray underline underline-offset-4">
        Voltar ao início
      </Link>
    </div>
  )
}
