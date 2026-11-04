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
