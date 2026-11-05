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
  // Seção do menu lateral em que o item aparece.
  grupo: string
  // Outros caminhos que também deixam o item ativo (ex.: a ficha de um aluno fica sob "Turmas e alunos").
  prefixos?: string[]
}

export const gruposAdmin = ['Avaliações', 'Alunos', 'Equipe', 'Conteúdo do site']

// Fonte única dos itens: usada pela sidebar (AdminLayout) e pelos cartões da
// página inicial do Admin, que no celular é o jeito mais direto de navegar.
export const itensAdmin: ItemAdmin[] = [
  {
    rotulo: 'Avaliar alunos',
    grupo: 'Avaliações',
    prefixos: ['/admin/avaliar'],
    descricao: 'Preencha a avaliação pedagógica dos alunos que são seus.',
    caminho: '/admin/avaliar',
    papeis: ['tutor', 'mentor', 'lider_casa'],
  },
  {
    rotulo: 'Avaliações',
    grupo: 'Avaliações',
    descricao: 'Semestre, atribuição de tutores e mentores, janelas e liberação dos resultados.',
    caminho: '/admin/avaliacoes',
    papeis: ['admin', 'coordenacao'],
  },
  {
    rotulo: 'Relatório de presença',
    grupo: 'Alunos',
    descricao: 'Presentes, atrasos e faltas por turma e período.',
    caminho: '/admin/relatorio',
  },
  {
    rotulo: 'Turmas e alunos',
    grupo: 'Alunos',
    prefixos: ['/admin/alunos'],
    descricao: 'Lista de alunos, ficha de cada um, horários das turmas e QR Code de presença.',
    caminho: '/admin/turmas',
  },
  {
    rotulo: 'Equipe e acessos',
    papeis: ['admin', 'coordenacao'],
    grupo: 'Equipe',
    descricao: 'Quem é da equipe, com que função (coordenação, tutor, mentor, líder de casa) e o que cada um acessa.',
    caminho: '/admin/usuarios',
  },
  {
    rotulo: 'Avisos',
    grupo: 'Conteúdo do site',
    descricao: 'Comunicados que aparecem na Home dos alunos.',
    caminho: '/admin/avisos',
  },
  {
    rotulo: 'Manual do Aluno',
    grupo: 'Conteúdo do site',
    descricao: 'PDF e resumo do manual.',
    caminho: '/admin/conteudo',
    aba: 'manual',
  },
  {
    rotulo: 'Destaque da home',
    grupo: 'Conteúdo do site',
    descricao: 'Vídeo ou fotos do topo da Home.',
    caminho: '/admin/conteudo',
    aba: 'hero',
  },
  {
    rotulo: 'Links e Classroom',
    grupo: 'Conteúdo do site',
    descricao: 'Turmas do Classroom, seções de links e páginas gerais.',
    caminho: '/admin/conteudo',
    aba: 'classroom',
    abasExtras: ['links', 'paginas'],
  },
]

// Item ativo no menu: o caminho do item, ou qualquer caminho sob um de seus prefixos.
export function itemAtivo(item: ItemAdmin, pathname: string, abaAtual: string) {
  if (item.aba) {
    return pathname === item.caminho && (abaAtual === item.aba || !!item.abasExtras?.includes(abaAtual))
  }
  if (pathname === item.caminho) return true
  return !!item.prefixos?.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function destinoAdmin(item: ItemAdmin) {
  return item.aba ? `${item.caminho}?aba=${item.aba}` : item.caminho
}

export function itensVisiveis(temPapel: (...papeis: string[]) => boolean) {
  return itensAdmin.filter((item) => !item.papeis || temPapel(...item.papeis))
}
