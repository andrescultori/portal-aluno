import { useParams, Navigate } from 'react-router-dom'
import { mockLinkSections, mockLinkSectionItems } from '../data/mock'

export default function LinkSectionPage() {
  const { sectionId } = useParams()
  const section = mockLinkSections.find((s) => s.id === sectionId)

  if (!section) return <Navigate to="/" replace />

  const items = mockLinkSectionItems
    .filter((item) => item.section_id === section.id)
    .sort((a, b) => a.ordem - b.ordem)

  return (
    <div className="mx-auto max-w-4xl px-brand-3 py-brand-4">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">{section.titulo}</h1>

      <div className="space-y-3">
        {items.length === 0 && (
          <p className="text-sm text-slate-400">Nenhum link cadastrado nesta seção.</p>
        )}
        {items.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-none border border-slate-200 bg-white p-4 transition hover:border-mandarin-orange"
          >
            <p className="font-medium text-slate-900">{item.nome}</p>
            {item.descricao && <p className="text-sm text-slate-500">{item.descricao}</p>}
          </a>
        ))}
      </div>
    </div>
  )
}
