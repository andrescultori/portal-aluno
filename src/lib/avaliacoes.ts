import type { CategoriaAvaliacao } from '../types/alunos'
import { dataHoraLocal } from './datas'

// Escala única das avaliações. O valor 1 (não sei responder) não entra na média;
// os pontos (2→4, 3→6, 4→8, 5→10) são calculados só no banco.
export const ESCALA = [
  { valor: 2, rotulo: 'Insatisfatório' },
  { valor: 3, rotulo: 'Regular' },
  { valor: 4, rotulo: 'Bom' },
  { valor: 5, rotulo: 'Excelente' },
] as const
export const NAO_SEI = { valor: 1, rotulo: 'Não posso/não sei responder' } as const

export function rotuloDaResposta(valor: number): string {
  return valor === NAO_SEI.valor ? NAO_SEI.rotulo : (ESCALA.find((e) => e.valor === valor)?.rotulo ?? '')
}

// Abaixo de "Bom" (inclui "não sei responder") exige explicação na observação.
export const VALOR_MINIMO_SEM_EXPLICACAO = 4

// TODO(owner): no formulário original (Microsoft Forms) "Como você acredita que foi o desenvolvimento
// do(a) aluno(a)?" é obrigatória. Por enquanto segue a especificação (opcional). Trocar para true
// exige também a regra equivalente em alunos.enviar_avaliacao.
export const DESENVOLVIMENTO_OBRIGATORIO = false

export const textosCategoria: Record<CategoriaAvaliacao, { titulo: string; saudacao: string }> = {
  tutoria: { titulo: 'Tutoria', saudacao: 'Olá tutor(a)!' },
  mentoria: { titulo: 'Mentoria/Monitoria', saudacao: 'Olá mentor(a)/monitor(a)!' },
}

export interface LinhaAvaliar {
  aluno_id: string
  nome: string
  casa: string | null
  categoria: CategoriaAvaliacao
  avaliacao_id: string | null
  situacao: 'nao_iniciada' | 'rascunho' | 'enviada'
  respondidas: number
  total: number
  janela_aberta: boolean
  abre_em: string | null
  fecha_em: string | null
}

export interface PerguntaAvaliacao {
  id: number
  ordem: number
  texto: string
}
export interface GrupoAvaliacao {
  id: number
  ordem: number
  codigo: string
  nome: string
  perguntas: PerguntaAvaliacao[]
}
export interface ModeloAvaliacao {
  id: number
  categoria: CategoriaAvaliacao
  versao: number
  rotulo_observacoes: string
  ajuda_observacoes: string | null
  rotulo_desenvolvimento: string
  grupos: GrupoAvaliacao[]
}

// Resposta do PostgREST com os grupos e perguntas embutidos.
interface ModeloBruto extends Omit<ModeloAvaliacao, 'grupos'> {
  avaliacao_grupos: (Omit<GrupoAvaliacao, 'perguntas'> & { avaliacao_perguntas: PerguntaAvaliacao[] })[]
}
export const SELECT_MODELO =
  'id, categoria, versao, rotulo_observacoes, ajuda_observacoes, rotulo_desenvolvimento, ' +
  'avaliacao_grupos(id, ordem, codigo, nome, avaliacao_perguntas(id, ordem, texto))'

export function montarModelo(bruto: ModeloBruto): ModeloAvaliacao {
  const { avaliacao_grupos, ...resto } = bruto
  return {
    ...resto,
    grupos: [...avaliacao_grupos]
      .sort((a, b) => a.ordem - b.ordem)
      .map(({ avaliacao_perguntas, ...g }) => ({
        ...g,
        perguntas: [...avaliacao_perguntas].sort((a, b) => a.ordem - b.ordem),
      })),
  }
}

export function descreverJanela(l: Pick<LinhaAvaliar, 'janela_aberta' | 'abre_em' | 'fecha_em'>): string {
  if (!l.abre_em || !l.fecha_em) return 'A coordenação ainda não definiu o período de avaliação.'
  if (l.janela_aberta) return `Período aberto até ${dataHoraLocal(l.fecha_em)}.`
  if (Date.now() < new Date(l.abre_em).getTime()) return `O período abre em ${dataHoraLocal(l.abre_em)}.`
  return `O período de avaliação terminou em ${dataHoraLocal(l.fecha_em)}.`
}

// Mensagens do banco (alunos.enviar_avaliacao) -> português.
export function traduzirErro(mensagem: string): string {
  if (mensagem.includes('Answer all questions')) return 'Responda todas as perguntas antes de enviar.'
  if (mensagem.includes('observation is required'))
    return 'Explique na observação os itens marcados abaixo de “Bom” antes de enviar.'
  if (mensagem.includes('window is closed')) return 'O período de avaliação está fechado.'
  if (mensagem.includes('already submitted')) return 'Esta avaliação já foi enviada.'
  if (mensagem.includes('Not allowed') || mensagem.includes('row-level security'))
    return 'Não foi possível salvar: a avaliação está bloqueada (já enviada, fora do período ou sem atribuição).'
  return `Não foi possível concluir: ${mensagem}`
}

// Pendências devolvidas por alunos.notas_semestre / notas_aluno (jsonb) -> frase.
export interface Pendencia {
  codigo: string
  enviadas?: number
  esperados?: number
  faltando?: number | string[]
  com_nota?: number
  total?: number
}

export function descreverPendencia(p: Pendencia): string {
  switch (p.codigo) {
    case 'tutoria_sem_avaliacoes':
      return 'Tutoria: nenhuma avaliação enviada'
    case 'tutoria_avaliadores_faltando':
      return `Tutoria: ${p.enviadas} de ${p.esperados} avaliadores enviaram`
    case 'mentoria_sem_avaliacoes':
      return 'Mentoria: nenhuma avaliação enviada'
    case 'mentoria_avaliadores_faltando':
      return `Mentoria: ${p.enviadas} de ${p.esperados} avaliadores enviaram`
    case 'atividades_nao_cadastradas':
      return 'Atividades não cadastradas'
    case 'atividades_sem_notas':
      return 'Atividades sem notas'
    case 'atividades_parcial':
      return `Atividades: ${p.com_nota} de ${p.total} com nota`
    case 'projeto_sem_componentes':
      return 'Projeto sem componentes'
    case 'projeto_componentes_faltando':
      return `Projeto: falta ${Array.isArray(p.faltando) ? p.faltando.join(', ') : ''}`
    case 'presenca_sem_vinculo':
      return 'Presença: aluno sem login vinculado'
    case 'presenca_indisponivel':
      return 'Presença indisponível'
    default:
      return p.codigo
  }
}
