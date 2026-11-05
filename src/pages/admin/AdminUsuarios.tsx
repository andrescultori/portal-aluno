import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import Modal from '../../components/Modal'
import { ROTULO_PAPEL } from '../../types/alunos'
import CabecalhoAdmin from './CabecalhoAdmin'

// "Equipe e acessos": só a equipe. Uma ação só cuida do login, das funções e da lista de quem pode ser
// escolhido nas Atribuições (função do banco public.salvar_membro_equipe, migração 16).

interface Membro {
  email: string
  nome: string
  ativo: boolean
  papeis: string[]
  equipe_id: string | null
  tem_login: boolean
}

// As quatro funções do dia a dia, com o que cada uma acessa.
const FUNCOES_COMUNS: { papel: string; descricao: string }[] = [
  {
    papel: 'coordenacao',
    descricao: 'Configura as avaliações, atribui tutores e mentores, vê resultados e o cadastro dos alunos, e cuida da equipe de tutores, mentores e líderes.',
  },
  { papel: 'tutor', descricao: 'Avalia (Tutoria) e lança as notas das atividades dos alunos que foram atribuídos a ele(a); vê o resultado desses alunos.' },
  { papel: 'mentor', descricao: 'Avalia (Mentoria) os alunos que foram atribuídos a ele(a).' },
  { papel: 'lider_casa', descricao: 'Avalia a Mentoria dos alunos da sua casa e vê os alunos da casa.' },
]
const FUNCOES_ADMIN = ['admin', 'secretaria', 'financeiro']
const FUNCOES_AVALIADORAS = ['tutor', 'mentor', 'lider_casa']

const campo =
  'mt-1 block min-h-11 w-full min-w-0 rounded-sm border border-gunmetal-gray/40 bg-pure-white px-2 text-sm font-normal text-onyx-black'
const botaoLaranja =
  'min-h-11 rounded-sm bg-mandarin-orange px-4 text-sm font-bold text-onyx-black transition hover:bg-mandarin-orange-dark disabled:opacity-50'
const botaoLinha =
  'min-h-11 rounded-sm border-2 border-gunmetal-gray px-4 text-sm font-bold text-gunmetal-gray transition hover:bg-soft-pink/50 disabled:opacity-50'

function traduzirErro(msg: string) {
  if (msg.includes('Only an admin')) return 'Só um(a) administrador(a) pode conceder ou alterar essas funções (administrador, coordenação, secretaria, financeiro).'
  if (msg.includes('cannot deactivate yourself')) return 'Você não pode se desativar nem tirar a sua própria função de administrador(a).'
  if (msg.includes('student login')) return 'Este e-mail é de um login de aluno. Use outro e-mail para a equipe.'
  if (msg.includes('Invalid e-mail')) return 'E-mail inválido.'
  if (msg.includes('Name is required')) return 'Informe o nome.'
  if (msg.includes('not allowed')) return 'Você não tem permissão para isto.'
  return msg
}

export default function AdminUsuarios() {
  const { temPapel } = useAuth()
  const souAdmin = temPapel('admin')
  const [equipe, setEquipe] = useState<Membro[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [busca, setBusca] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  // Pessoa em edição (null = fechado). "novo" = formulário de pessoa nova.
  const [form, setForm] = useState<null | { novo: boolean; email: string; nome: string; papeis: string[]; ativo: boolean }>(null)

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc('listar_equipe')
    if (error) {
      setErro(
        error.message.includes('listar_equipe')
          ? 'A gestão da equipe ainda não foi instalada no banco (migração 16).'
          : `Não foi possível carregar a equipe: ${error.message}`,
      )
      setEquipe([])
    } else {
      setErro(null)
      setEquipe((data as Membro[]) ?? [])
    }
    setCarregando(false)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Coordenação só mexe em quem tem apenas funções de avaliador; o resto é com administrador(a).
  const podeEditar = (m: Membro) =>
    souAdmin || m.papeis.every((p) => FUNCOES_AVALIADORAS.includes(p) || p === 'emissor')

  const visiveis = useMemo(() => {
    const sem = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    const termo = sem(busca.trim())
    return equipe.filter((m) => {
      if (!mostrarInativos && !m.ativo) return false
      return !termo || sem(m.nome).includes(termo) || sem(m.email).includes(termo)
    })
  }, [equipe, busca, mostrarInativos])

  async function salvar(dados: { email: string; nome: string; papeis: string[]; ativo: boolean }) {
    setMensagem(null)
    setOcupado(true)
    // Preserva funções que a pessoa já tem e que esta tela não mostra para o usuário atual.
    const atual = equipe.find((m) => m.email === dados.email.trim().toLowerCase())
    const ocultas = (atual?.papeis ?? []).filter(
      (p) => !FUNCOES_COMUNS.some((f) => f.papel === p) && !(souAdmin && FUNCOES_ADMIN.includes(p)) && p !== 'emissor',
    )
    const { error } = await supabase.rpc('salvar_membro_equipe', {
      p_email: dados.email,
      p_nome: dados.nome,
      p_papeis: [...new Set([...dados.papeis, ...ocultas])].filter((p) => p !== 'emissor'),
      p_ativo: dados.ativo,
    })
    setOcupado(false)
    if (error) {
      setMensagem({ tipo: 'erro', texto: traduzirErro(error.message) })
      return false
    }
    setMensagem({ tipo: 'ok', texto: `${dados.nome} — salvo.` })
    await carregar()
    return true
  }

  return (
    <div className="mx-auto max-w-6xl">
      <CabecalhoAdmin
        titulo="Equipe e acessos"
        trilha={[{ rotulo: 'Equipe' }]}
        descricao="Quem trabalha com os alunos e o que cada função pode fazer. Quem é tutor(a), mentor(a) ou líder de casa aparece automaticamente nas listas de Atribuições."
      />

      <section aria-labelledby="funcoes" className="mb-6">
        <h2 id="funcoes" className="font-display text-2xl text-gunmetal-gray">
          O que cada função acessa
        </h2>
        <dl className="mt-2 grid gap-px border border-gunmetal-gray/25 bg-gunmetal-gray/15 sm:grid-cols-2">
          {FUNCOES_COMUNS.map((f) => (
            <div key={f.papel} className="bg-pure-white p-3">
              <dt className="font-bold text-gunmetal-gray">{ROTULO_PAPEL[f.papel]}</dt>
              <dd className="mt-1 text-sm text-onyx-black">{f.descricao}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted-purple">
          Quem tem mais de uma função soma os acessos. Administrador(a), Secretaria e Financeiro são configurados só por administradores.
        </p>
      </section>

      {erro && (
        <p role="alert" className="mb-4 border-l-4 border-mandarin-orange bg-soft-pink/60 p-3 text-sm text-onyx-black">
          {erro}
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-bold text-gunmetal-gray">
            Buscar
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou e-mail" className={`${campo} w-64`} />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm text-onyx-black">
            <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} className="h-5 w-5 accent-mandarin-orange" />
            Mostrar inativos
          </label>
        </div>
        <button
          type="button"
          disabled={!!erro}
          onClick={() => setForm({ novo: true, email: '', nome: '', papeis: [], ativo: true })}
          className={botaoLaranja}
        >
          Adicionar pessoa
        </button>
      </div>

      <div aria-live="polite" className="mb-3">
        {mensagem && (
          <p
            role={mensagem.tipo === 'erro' ? 'alert' : 'status'}
            className={`border-l-4 p-3 text-sm text-onyx-black ${
              mensagem.tipo === 'erro' ? 'border-mandarin-orange bg-soft-pink/60' : 'border-gunmetal-gray bg-neutral-tint'
            }`}
          >
            {mensagem.texto}
          </p>
        )}
      </div>

      {carregando ? (
        <p className="text-onyx-black">Carregando...</p>
      ) : visiveis.length === 0 ? (
        <p className="border border-gunmetal-gray/25 p-4 text-sm text-onyx-black">Ninguém encontrado.</p>
      ) : (
        <div className="overflow-x-auto border border-gunmetal-gray/25 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-tint text-onyx-black">
              <tr>
                <th className="px-4 py-2">Nome</th>
                <th className="px-4 py-2">E-mail</th>
                <th className="px-4 py-2">Funções</th>
                <th className="px-4 py-2">Situação</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {visiveis.map((m) => {
                const editavel = podeEditar(m)
                return (
                  <tr key={m.email} className="border-t border-gunmetal-gray/25">
                    <td className="px-4 py-2 font-bold text-gunmetal-gray">{m.nome}</td>
                    <td className="px-4 py-2">{m.email}</td>
                    <td className="px-4 py-2">
                      {m.papeis.length === 0 ? (
                        <span className="text-muted-purple">Sem função</span>
                      ) : (
                        <ul className="flex flex-wrap gap-1">
                          {m.papeis.map((p) => (
                            <li key={p} className="rounded-sm bg-soft-pink px-2 py-0.5 text-xs font-bold text-gunmetal-gray">
                              {ROTULO_PAPEL[p] ?? p}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`rounded-sm px-2 py-0.5 text-xs font-medium ${m.ativo ? 'bg-green-100 text-green-700' : 'bg-neutral-tint text-onyx-black'}`}>
                        {m.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                      {!m.tem_login && <span className="ml-2 text-xs text-muted-purple">sem login</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {editavel ? (
                        <button
                          type="button"
                          onClick={() => setForm({ novo: false, email: m.email, nome: m.nome, papeis: m.papeis, ativo: m.ativo })}
                          className="min-h-11 px-2 text-sm font-bold text-gunmetal-gray underline underline-offset-4"
                        >
                          Editar
                        </button>
                      ) : (
                        <span className="text-xs text-muted-purple">Só administrador(a)</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal aberto={form !== null} aoFechar={() => setForm(null)} titulo={form?.novo ? 'Adicionar pessoa' : 'Editar pessoa'}>
        {form && (
          <form
            className="mt-4 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault()
              if (await salvar(form)) setForm(null)
            }}
          >
            <label className="block text-sm font-bold text-gunmetal-gray">
              Nome
              <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={campo} />
            </label>
            <label className="block text-sm font-bold text-gunmetal-gray">
              E-mail (o mesmo da conta Google ou Microsoft)
              <input
                required
                type="email"
                value={form.email}
                readOnly={!form.novo}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={`${campo} ${form.novo ? '' : 'bg-neutral-tint'}`}
              />
            </label>

            <fieldset>
              <legend className="text-sm font-bold text-gunmetal-gray">Funções</legend>
              {FUNCOES_COMUNS.map((f) => (
                <label key={f.papel} className="flex min-h-11 items-center gap-3 text-sm text-onyx-black">
                  <input
                    type="checkbox"
                    checked={form.papeis.includes(f.papel)}
                    // Coordenação só concede funções de avaliador; "Coordenação" é com administrador(a).
                    disabled={!souAdmin && !FUNCOES_AVALIADORAS.includes(f.papel)}
                    onChange={(e) =>
                      setForm({ ...form, papeis: e.target.checked ? [...form.papeis, f.papel] : form.papeis.filter((p) => p !== f.papel) })
                    }
                    className="h-5 w-5 accent-mandarin-orange"
                  />
                  {ROTULO_PAPEL[f.papel]}
                </label>
              ))}
            </fieldset>

            {souAdmin && (
              <fieldset>
                <legend className="text-sm font-bold text-gunmetal-gray">Outras funções (só administradores)</legend>
                {FUNCOES_ADMIN.map((p) => (
                  <label key={p} className="flex min-h-11 items-center gap-3 text-sm text-onyx-black">
                    <input
                      type="checkbox"
                      checked={form.papeis.includes(p)}
                      onChange={(e) => setForm({ ...form, papeis: e.target.checked ? [...form.papeis, p] : form.papeis.filter((x) => x !== p) })}
                      className="h-5 w-5 accent-mandarin-orange"
                    />
                    {ROTULO_PAPEL[p]}
                  </label>
                ))}
              </fieldset>
            )}

            {!form.novo && (
              <label className="flex min-h-11 items-center gap-3 text-sm text-onyx-black">
                <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} className="h-5 w-5 accent-mandarin-orange" />
                Ativo (desmarque para tirar o acesso; as avaliações e atribuições antigas ficam guardadas)
              </label>
            )}

            {form.papeis.some((p) => FUNCOES_AVALIADORAS.includes(p)) && (
              <p className="border-l-4 border-gunmetal-gray bg-neutral-tint p-3 text-sm text-onyx-black">
                Esta pessoa vai aparecer nas listas de Atribuições (Tutoria/Mentoria).
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={ocupado} className={botaoLaranja}>
                Salvar
              </button>
              <button type="button" onClick={() => setForm(null)} className={botaoLinha}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
