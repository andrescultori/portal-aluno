import type {
  ClassroomLink,
  HeroConfig,
  InfoPage,
  LinkSection,
  LinkSectionItem,
  ManualDoAluno,
} from '../types/database'

export const mockHeroConfig: HeroConfig = {
  id: 1,
  modo: 'carrossel',
  video_url: null,
  imagens: [
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=1600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1600&auto=format&fit=crop',
  ],
  intervalo_segundos: 5,
}

export const mockManual: ManualDoAluno = {
  id: 1,
  pdf_url: null,
  resumo:
    'O Manual do Aluno reúne as normas acadêmicas, disciplinares e de convivência da UniMissional. Baixe o PDF completo para consultar todos os detalhes.',
}

export const mockClassroomLinks: ClassroomLink[] = [
  { id: '1', nome_turma: 'Turma A - Manhã', url: 'https://classroom.google.com', ordem: 1 },
  { id: '2', nome_turma: 'Turma B - Noite', url: 'https://classroom.google.com', ordem: 2 },
]

export const mockLinkSections: LinkSection[] = [
  { id: 's1', titulo: 'Biblioteca e Pesquisa', ordem: 1 },
  { id: 's2', titulo: 'Financeiro e Secretaria', ordem: 2 },
  { id: 's3', titulo: 'Comunidade', ordem: 3 },
]

export const mockLinkSectionItems: LinkSectionItem[] = [
  { id: 'i1', section_id: 's1', nome: 'Biblioteca Virtual', url: 'https://example.com', descricao: 'Acervo digital', ordem: 1 },
  { id: 'i2', section_id: 's2', nome: 'Portal Financeiro', url: 'https://example.com', descricao: 'Boletos e mensalidades', ordem: 1 },
  { id: 'i3', section_id: 's3', nome: 'Instagram', url: 'https://instagram.com', descricao: null, ordem: 1 },
]

export const mockInfoPages: InfoPage[] = [
  {
    id: 'p1',
    titulo: 'Sobre a UniMissional',
    slug: 'sobre',
    conteudo: 'Conteúdo institucional de exemplo.',
    ordem: 1,
  },
]
