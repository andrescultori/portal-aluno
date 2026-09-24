import { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { LinkSection, LinkSectionItem } from '../types/database'

export default function LinkSectionPage() {
  const { sectionId } = useParams()
  const [section, setSection] = useState<LinkSection | null>(null)
  const [items, setItems] = useState<LinkSectionItem[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!sectionId) return
    setCarregando(true)
    Promise.all([
      supabase.from('link_sections').select('*').eq('id', sectionId).maybeSingle(),
      supabase.from('link_section_items').select('*').eq('section_id', sectionId).order('ordem'),
    ]).then(([{ data: s }, { data: i }]) => {
      setSection((s as LinkSection) ?? null)
      setItems((i as LinkSectionItem[]) ?? [])
      setCarregando(false)
    })
  }, [sectionId])

  if (carregando) {
    return <p className="mx-auto max-w-4xl px-brand-3 py-brand-4 text-slate-500">Carregando...</p>
  }

  if (!section) return <Navigate to="/" replace />

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
