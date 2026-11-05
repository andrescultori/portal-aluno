import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { useAuth } from '../../../contexts/AuthContext'
import type { Elegibilidade } from '../../../types/alunos'

const db = () => supabase.schema('alunos')

export interface AlunoLinha {
  id: string
  nome: string
}

export interface Permissoes {
  // vê todos os alunos (administração, coordenação, secretaria); tutor vê só os atribuídos a ele(a)
  veTodos: boolean
  // pode digitar notas (o banco confere de novo: administração, ou tutor DESTE aluno)
  lanca: boolean
  // define atividades e pesos do projeto
  configura: boolean
}

export function usePermissoes(): Permissoes {
  const { temPapel } = useAuth()
  return {
    veTodos: temPapel('admin', 'coordenacao', 'secretaria'),
    lanca: temPapel('admin', 'tutor'),
    configura: temPapel('admin', 'coordenacao'),
  }
}

// Alunos que a pessoa vê neste semestre. Quem vê todos recebe só os que serão avaliados (regra do banco);
// tutor recebe os alunos que lhe foram atribuídos na Tutoria. Em ambos os casos o banco (RLS) decide o que volta.
export function useAlunosDoEscopo(semestreId: string | undefined, perm: Permissoes) {
  const [alunos, setAlunos] = useState<AlunoLinha[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!semestreId) return
    let vivo = true
    ;(async () => {
      setCarregando(true)
      setErro(null)
      let ids: string[] | null = null
      if (perm.veTodos) {
        // administração e coordenação conhecem o veredito do banco; secretaria cai no filtro "Ativo"
        const { data, error } = await db().rpc('avaliaveis_semestre', { p_semestre: semestreId })
        if (!error && Array.isArray(data)) ids = (data as Elegibilidade[]).filter((e) => e.avaliavel).map((e) => e.aluno_id)
      } else {
        const { data, error } = await db().from('aluno_tutores').select('aluno_id').eq('semestre_id', semestreId).eq('categoria', 'tutoria')
        if (error) {
          if (vivo) setErro(`Não foi possível carregar seus alunos: ${error.message}`)
        } else ids = [...new Set(((data as { aluno_id: string }[]) ?? []).map((r) => r.aluno_id))]
      }
      let consulta = db().from('alunos').select('id, nome, nome_exibicao, status').order('nome')
      if (ids !== null) consulta = ids.length > 0 ? consulta.in('id', ids) : consulta.in('id', ['00000000-0000-0000-0000-000000000000'])
      else consulta = consulta.eq('status', 'Ativo')
      const { data, error } = await consulta
      if (!vivo) return
      if (error) setErro(`Não foi possível carregar os alunos: ${error.message}`)
      setAlunos(((data as { id: string; nome: string; nome_exibicao: string | null }[]) ?? []).map((a) => ({ id: a.id, nome: a.nome_exibicao ?? a.nome })))
      setCarregando(false)
    })()
    return () => {
      vivo = false
    }
  }, [semestreId, perm.veTodos])

  return { alunos, carregando, erro }
}

// Enter / setas ↑ ↓ andam pela mesma coluna; a edição só é gravada ao sair do campo (blur).
export function andarNaColuna(e: React.KeyboardEvent<HTMLInputElement>, grupo: string, linha: number, coluna: number) {
  const alvo = e.key === 'Enter' || e.key === 'ArrowDown' ? linha + 1 : e.key === 'ArrowUp' ? linha - 1 : null
  if (alvo === null) return
  e.preventDefault()
  const prox = document.querySelector<HTMLInputElement>(`input[data-g="${grupo}"][data-r="${alvo}"][data-c="${coluna}"]`)
  if (prox) {
    prox.focus()
    prox.select()
  }
}
