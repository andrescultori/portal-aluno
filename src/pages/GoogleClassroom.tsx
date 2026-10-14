import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { ClassroomLink } from '../types/database'

export default function GoogleClassroom() {
  const [links, setLinks] = useState<ClassroomLink[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    supabase
      .from('classroom_links')
      .select('*')
      .order('ordem')
      .then(({ data }) => {
        setLinks((data as ClassroomLink[]) ?? [])
        setCarregando(false)
      })
  }, [])

  return (
    <div className="mx-auto max-w-4xl px-brand-3 py-brand-4">
      <h1 className="mb-6 font-display text-[40px] leading-none text-gunmetal-gray">Google Classroom</h1>

      {carregando ? (
        <p className="text-onyx-black">Carregando...</p>
      ) : links.length === 0 ? (
        <p className="text-sm text-muted-purple">Nenhuma turma configurada ainda.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-none border border-gunmetal-gray/25 bg-white p-8 text-center shadow-sm transition hover:border-mandarin-orange hover:shadow-md"
            >
              <h2 className="font-display text-3xl text-gunmetal-gray">{link.nome_turma}</h2>
              <p className="mt-2 text-sm text-onyx-black">Acessar turma no Classroom →</p>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
