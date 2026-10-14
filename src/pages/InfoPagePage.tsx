import { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { InfoPage } from '../types/database'

export default function InfoPagePage() {
  const { slug } = useParams()
  const [page, setPage] = useState<InfoPage | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!slug) return
    setCarregando(true)
    supabase
      .from('info_pages')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => {
        setPage((data as InfoPage) ?? null)
        setCarregando(false)
      })
  }, [slug])

  if (carregando) {
    return <p className="mx-auto max-w-3xl px-brand-3 py-brand-4 text-onyx-black">Carregando...</p>
  }

  if (!page) return <Navigate to="/" replace />

  return (
    <div className="mx-auto max-w-3xl px-brand-3 py-brand-4">
      <h1 className="mb-6 font-display text-[40px] leading-none text-gunmetal-gray">{page.titulo}</h1>
      <div className="whitespace-pre-line text-onyx-black">{page.conteudo}</div>
    </div>
  )
}
