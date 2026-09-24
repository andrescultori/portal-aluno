import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Calendar,
  CheckSquare,
  ChevronRight,
  Link2,
  Settings,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import type { LinkSection } from '../types/database'

interface Modulo {
  titulo: string
  subtitulo: string
  icone: LucideIcon
  rota: string
}

const modulosFixos: Modulo[] = [
  { titulo: 'Manual do Aluno', subtitulo: 'Baixe o PDF e veja o resumo', icone: BookOpen, rota: '/manual' },
  { titulo: 'Google Classroom', subtitulo: 'Acesse suas turmas', icone: Video, rota: '/classroom' },
  { titulo: 'Calendário Acadêmico', subtitulo: 'Eventos e datas importantes', icone: Calendar, rota: '/calendario' },
  { titulo: 'Presença', subtitulo: 'Confirme sua presença em aula', icone: CheckSquare, rota: '/presenca' },
]

export default function Home() {
  const { perfil } = useAuth()
  const [sections, setSections] = useState<LinkSection[]>([])

  useEffect(() => {
    supabase
      .from('link_sections')
      .select('*')
      .order('ordem')
      .then(({ data }) => setSections((data as LinkSection[]) ?? []))
  }, [])

  const modulos: Modulo[] = [
    ...modulosFixos,
    ...sections.map((s) => ({
      titulo: s.titulo,
      subtitulo: 'Links úteis',
      icone: Link2,
      rota: `/links/${s.id}`,
    })),
    ...(perfil?.papel === 'equipe'
      ? [{ titulo: 'Administração', subtitulo: 'Gerenciar conteúdo e usuários', icone: Settings, rota: '/admin' }]
      : []),
  ]

  return (
    <div className="mx-auto max-w-3xl px-brand-3 py-brand-4">
      <div className="space-y-3">
        {modulos.map((modulo) => {
          const Icone = modulo.icone
          return (
            <Link
              key={modulo.rota}
              to={modulo.rota}
              className="flex items-center gap-3 rounded-lg bg-neutral-tint px-[15px] py-3.5 transition hover:bg-soft-pink"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-soft-pink">
                <Icone size={20} strokeWidth={2} className="text-mandarin-orange" />
              </span>
              <span className="flex-1">
                <span className="block text-[14.5px] font-semibold text-gunmetal-gray">{modulo.titulo}</span>
                <span className="block text-xs text-muted-purple">{modulo.subtitulo}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-chevron-gray" aria-hidden="true" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
