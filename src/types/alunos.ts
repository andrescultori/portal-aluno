// Tipos do schema `alunos` (ficha do aluno e módulo de avaliação).
// Escritos à mão: o front usa supabase.schema('alunos') sem tipos gerados.

export type CategoriaAvaliacao = 'tutoria' | 'mentoria'

export interface Semestre {
  id: string
  codigo: string
  inicio: string | null
  fim: string | null
  atual: boolean
}

export interface Casa {
  id: number
  nome: string
}

export interface AlunoResumo {
  id: string
  nome: string
  nome_exibicao: string | null
  casa_id: number | null
  status: string
}

export interface MembroEquipe {
  id: string
  nome: string
  email: string
  ativo: boolean
  // Funções (staff_roles); só vem preenchido quando a consulta listar_equipe está instalada.
  papeis?: string[]
}

export const STATUS_ALUNO = ['Ativo', 'Trancado', 'Formado', 'Desistente', 'Desativado'] as const

// Veredito do banco (alunos.avaliaveis_semestre) para cada aluno no semestre.
export interface Elegibilidade {
  aluno_id: string
  status: string
  plano: string | null
  convenio: boolean
  avaliavel: boolean
}

// Funções de equipe (staff_roles) e como aparecem na tela.
export const ROTULO_PAPEL: Record<string, string> = {
  admin: 'Administrador(a)',
  coordenacao: 'Coordenação',
  secretaria: 'Secretaria',
  financeiro: 'Financeiro',
  tutor: 'Tutor(a)',
  mentor: 'Mentor(a)',
  lider_casa: 'Líder de Casa',
  emissor: 'Emissor (legado)',
}

export interface Atribuicao {
  id: string
  aluno_id: string
  semestre_id: string
  equipe_id: string
  categoria: CategoriaAvaliacao
}

export interface EquipeCasa {
  equipe_id: string
  casa_id: number
}

export const rotuloCategoria: Record<CategoriaAvaliacao, string> = {
  tutoria: 'Tutoria',
  mentoria: 'Mentoria',
}
