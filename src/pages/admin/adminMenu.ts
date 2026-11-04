export interface ItemAdmin {
  rotulo: string
  descricao: string
  caminho: string
  // Aba do AdminConteudo (?aba=), quando o item aponta para uma delas.
  aba?: string
  // Outras abas que também deixam o item ativo no menu lateral.
  abasExtras?: string[]
  // Papéis de equipe (staff_roles) que enxergam o item. Sem isto, todo usuário de equipe vê.
  papeis?: string[]
}

// Fonte única dos itens: usada pela sidebar (AdminLayout) e pelos cartões da
// página inicial do Admin, que no celular é o jeito mais direto de navegar.
export const itensAdmin: ItemAdmin[] = [
  {
    rotulo: 'Avaliar alunos',
    descricao: 'Preencha a avaliação pedagógica dos alunos que são seus.',
    caminho: '/avaliar',
    papeis: ['tutor', 'mentor', 'lider_casa'],
  },
  {
    rotulo: 'Avaliações',
    descricao: 'Semestre, atribuição de tutores e mentores, janelas e liberação dos resultados.',
    caminho: '/admin/avaliacoes',
    papeis: ['admin', 'coordenacao'],
  },
  {
    rotulo: 'Relatório de presença',
    descricao: 'Presentes, atrasos e faltas por turma e período.',
    caminho: '/admin/relatorio',
  },
  {
    rotulo: 'Turmas e alunos',
    descricao: 'Horários das turmas e QR Code de presença.',
    caminho: '/admin/turmas',
  },
  {
    rotulo: 'Equipe e acessos',
    descricao: 'Quem pode entrar no portal, e como (aluno ou equipe).',
    caminho: '/admin/usuarios',
  },
  {
    rotulo: 'Avisos',
    descricao: 'Comunicados que aparecem na Home dos alunos.',
    caminho: '/admin/avisos',
  },
  {
    rotulo: 'Manual do Aluno',
    descricao: 'PDF e resumo do manual.',
    caminho: '/admin/conteudo',
    aba: 'manual',
  },
  {
    rotulo: 'Destaque da home',
    descricao: 'Vídeo ou fotos do topo da Home.',
    caminho: '/admin/conteudo',
    aba: 'hero',
  },
  {
    rotulo: 'Links e Classroom',
    descricao: 'Turmas do Classroom, seções de links e páginas gerais.',
    caminho: '/admin/conteudo',
    aba: 'classroom',
    abasExtras: ['links', 'paginas'],
  },
]

export function destinoAdmin(item: ItemAdmin) {
  return item.aba ? `${item.caminho}?aba=${item.aba}` : item.caminho
}

export function itensVisiveis(temPapel: (...papeis: string[]) => boolean) {
  return itensAdmin.filter((item) => !item.papeis || temPapel(...item.papeis))
}
