export type Papel = 'aluno' | 'equipe'
export type AttendanceStatus = 'presente' | 'atraso' | 'falta'
export type HeroModo = 'video' | 'carrossel'

export interface AllowedUser {
  id: string
  auth_user_id: string | null
  nome: string
  email: string
  papel: Papel
  turma_id: string | null
  ativo: boolean
  created_at: string
}

export interface Turma {
  id: string
  nome: string
  horario_inicio: string
  horario_fim_presente: string
  horario_fim_atraso: string
  ativo: boolean
}

export interface AttendanceRecord {
  id: string
  aluno_id: string
  turma_id: string
  data: string
  horario_checkin: string
  status: AttendanceStatus
  created_at: string
}

export interface HeroConfig {
  id: number
  modo: HeroModo
  video_url: string | null
  imagens: string[] | null
  intervalo_segundos: number
}

export interface ManualDoAluno {
  id: number
  pdf_url: string | null
  resumo: string | null
}

export interface ClassroomLink {
  id: string
  nome_turma: string
  url: string
  ordem: number
}

export interface LinkSection {
  id: string
  titulo: string
  ordem: number
}

export interface LinkSectionItem {
  id: string
  section_id: string
  nome: string
  url: string
  descricao: string | null
  ordem: number
}

export interface InfoPage {
  id: string
  titulo: string
  slug: string
  conteudo: string | null
  ordem: number
}

export interface Setting {
  chave: string
  valor: string
}
