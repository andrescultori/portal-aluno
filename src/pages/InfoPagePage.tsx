import { useParams, Navigate } from 'react-router-dom'
import { mockInfoPages } from '../data/mock'

export default function InfoPagePage() {
  const { slug } = useParams()
  const page = mockInfoPages.find((p) => p.slug === slug)

  if (!page) return <Navigate to="/" replace />

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">{page.titulo}</h1>
      <div className="whitespace-pre-line text-slate-700">{page.conteudo}</div>
    </div>
  )
}
