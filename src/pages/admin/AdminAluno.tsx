import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { dataHoraLocal } from '../../lib/datas'
import { STATUS_ALUNO } from '../../types/alunos'
import CabecalhoAdmin from './CabecalhoAdmin'
import { corStatus } from './alunos/ListaAlunos'

const db = () => supabase.schema('alunos')

interface Aluno {
  id: string
  nome: string
  nome_exibicao: string | null
  ra: string | null
  email: string
  telefone: string | null
  celular: string | null
  whatsapp: string | null
  sexo: string | null
  data_nascimento: string | null
  curso: string | null
  nivel: string | null
  modalidade: string | null
  turno: string | null
  plano: string | null
  semestre_ingresso: string | null
  status: string
  casa_id: number | null
  colaborador: boolean
  inicio: string | null
  conclusao: string | null
  obs: string | null
  origem: string
}
interface Matricula {
  id: string
  cenario: string | null
  plano: string | null
  semestres: { codigo: string } | null
  ciclos: { nome: string } | null
  modulos: { nome: string } | null
}
interface CicloStatus {
  status: string
  ciclos: { nome: string } | null
}
interface Historico {
  id: number
  status: string
  desde: string
  motivo: string | null
}
type Dados = Record<string, string | null>
interface Desenvolvimento {
  semestre_id: string
  semestre: string
  ciclo: string | null
  teoria: number | null
  pratica: number | null
  atividades: number | null
  projeto: number | null
  presenca: number | null
  tutoria: number | null
  mentoria: number | null
  final: number | null
  conceito: string | null
  aprovado: boolean | null
  completo: boolean
}
interface MediasCiclo {
  media_basico: number | null
  media_avancado: number | null
  media_final: number | null
  semestres: number
  semestres_incompletos: number
}
const nota = (n: number | null) =>
  n === null || n === undefined ? '—' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })

const campo =
  'mt-1 block min-h-11 w-full min-w-0 rounded-sm border border-gunmetal-gray/40 bg-pure-white px-2 text-sm font-normal text-onyx-black'

function formatarData(iso: string | null) {
  if (!iso) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

function Item({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold uppercase tracking-wide text-muted-purple">{rotulo}</dt>
      <dd className="mt-0.5 break-words text-sm text-onyx-black">{valor && valor.trim() ? valor : '—'}</dd>
    </div>
  )
}

function traduzirErro(msg: string) {
  if (msg.includes('A reason is required')) return 'Informe o motivo da mudança.'
  if (msg.includes('not allowed')) return 'Você não tem permissão para mudar a situação de alunos.'
  if (msg.includes('alunos_status_check')) return 'Situação inválida.'
  return msg
}

export default function AdminAluno() {
  const { id } = useParams()
  const { temPapel } = useAuth()
  const podeMudarStatus = temPapel('admin', 'coordenacao', 'secretaria')
  // As funções de notas do banco só respondem a administração e coordenação.
  const veDesenvolvimento = temPapel('admin', 'coordenacao')
  const [aluno, setAluno] = useState<Aluno | null>(null)
  const [casa, setCasa] = useState<string | null>(null)
  const [matriculas, setMatriculas] = useState<Matricula[]>([])
  const [ciclos, setCiclos] = useState<CicloStatus[]>([])
  const [historico, setHistorico] = useState<Historico[]>([])
  const [dados, setDados] = useState<Dados | null>(null)
  const [desenvolvimento, setDesenvolvimento] = useState<Desenvolvimento[]>([])
  const [medias, setMedias] = useState<MediasCiclo | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [novoStatus, setNovoStatus] = useState('')
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const carregar = useCallback(async () => {
    if (!id) return
    const [a, m, c, h, d, dv, md] = await Promise.all([
      db().from('alunos').select('*').eq('id', id).maybeSingle(),
      db().from('matriculas').select('id, cenario, plano, semestres(codigo), ciclos(nome), modulos(nome)').eq('aluno_id', id),
      db().from('ciclo_status').select('status, ciclos(nome)').eq('aluno_id', id),
      db().from('aluno_status_historico').select('id, status, desde, motivo').eq('aluno_id', id).order('desde', { ascending: false }),
      db().from('dados_pessoais').select('*').eq('aluno_id', id).maybeSingle(),
      veDesenvolvimento ? db().rpc('historico_aluno', { p_aluno: id }) : Promise.resolve({ data: [], error: null }),
      veDesenvolvimento ? db().rpc('medias_ciclo_aluno', { p_aluno: id }) : Promise.resolve({ data: [], error: null }),
    ])
    if (a.error) {
      setErro(`Não foi possível carregar o aluno: ${a.error.message}`)
    } else if (!a.data) {
      setErro('Aluno não encontrado (ou você não tem acesso a ele).')
    } else {
      const al = a.data as Aluno
      setAluno(al)
      setErro(null)
      if (al.casa_id !== null) {
        const { data } = await db().from('casas').select('nome').eq('id', al.casa_id).maybeSingle()
        setCasa((data as { nome: string } | null)?.nome ?? null)
      } else {
        setCasa(null)
      }
    }
    setMatriculas(
      ((m.data as unknown as Matricula[]) ?? []).sort((x, y) => (y.semestres?.codigo ?? '').localeCompare(x.semestres?.codigo ?? '')),
    )
    setCiclos((c.data as unknown as CicloStatus[]) ?? [])
    setHistorico((h.data as Historico[]) ?? [])
    setDados((d.data as Dados | null) ?? null)
    setDesenvolvimento(((dv.data as Desenvolvimento[]) ?? []).sort((x, y) => y.semestre.localeCompare(x.semestre)))
    setMedias(((md.data as MediasCiclo[]) ?? [])[0] ?? null)
    setCarregando(false)
  }, [id, veDesenvolvimento])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function mudarStatus(e: React.FormEvent) {
    e.preventDefault()
    if (!aluno || !novoStatus) return
    setMensagem(null)
    setOcupado(true)
    const { error } = await db().rpc('change_status', { p_aluno_id: aluno.id, p_status: novoStatus, p_reason: motivo })
    setOcupado(false)
    if (error) {
      setMensagem({ tipo: 'erro', texto: traduzirErro(error.message) })
      return
    }
    setMensagem({ tipo: 'ok', texto: `Situação alterada para ${novoStatus}. Fica registrada no histórico com o motivo.` })
    setNovoStatus('')
    setMotivo('')
    await carregar()
  }

  const nome = aluno ? (aluno.nome_exibicao ?? aluno.nome) : 'Aluno'
  const trilha = [{ rotulo: 'Turmas e alunos', to: '/admin/turmas' }, { rotulo: 'Alunos', to: '/admin/turmas?aba=alunos' }, { rotulo: nome }]

  if (carregando) {
    return <p className="text-onyx-black">Carregando...</p>
  }
  if (erro || !aluno) {
    return (
      <div className="mx-auto max-w-4xl">
        <CabecalhoAdmin titulo="Aluno" trilha={trilha} />
        <p role="alert" className="border-l-4 border-mandarin-orange bg-soft-pink/60 p-3 text-sm text-onyx-black">
          {erro ?? 'Aluno não encontrado.'}
        </p>
      </div>
    )
  }

  const endereco = dados
    ? [dados.endereco, dados.numero, dados.complemento, dados.bairro].filter(Boolean).join(', ')
    : ''
  const cidadeUf = dados ? [dados.cidade, dados.estado].filter(Boolean).join(' / ') : ''

  return (
    <div className="mx-auto max-w-5xl">
      <CabecalhoAdmin titulo={nome} trilha={trilha} />

      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-sm px-2 py-1 text-xs font-bold uppercase tracking-wide ${corStatus[aluno.status] ?? 'bg-neutral-tint'}`}>
          {aluno.status}
        </span>
        {aluno.colaborador && <span className="rounded-sm border border-gunmetal-gray/40 px-2 py-1 text-xs font-bold">Colaborador(a)</span>}
        <span className="text-sm text-onyx-black">{aluno.ra ? `RA ${aluno.ra}` : 'Sem RA'}</span>
      </div>

      <section className="mt-6" aria-labelledby="resumo">
        <h2 id="resumo" className="font-display text-3xl text-gunmetal-gray">
          Resumo
        </h2>
        <dl className="mt-2 grid grid-cols-2 gap-4 border border-gunmetal-gray/25 p-4 md:grid-cols-4">
          <Item rotulo="Nome completo" valor={aluno.nome} />
          <Item rotulo="E-mail" valor={aluno.email} />
          <Item rotulo="Celular" valor={aluno.celular ?? aluno.telefone} />
          <Item rotulo="WhatsApp" valor={aluno.whatsapp} />
          <Item rotulo="Casa" valor={casa} />
          <Item rotulo="Plano" valor={aluno.plano} />
          <Item rotulo="Turma (1º semestre)" valor={aluno.semestre_ingresso} />
          <Item rotulo="Nascimento" valor={aluno.data_nascimento ? formatarData(aluno.data_nascimento) : null} />
          <Item rotulo="Curso" valor={aluno.curso} />
          <Item rotulo="Nível" valor={aluno.nivel} />
          <Item rotulo="Modalidade / turno" valor={[aluno.modalidade, aluno.turno].filter(Boolean).join(' · ')} />
          <Item rotulo="Início → conclusão" valor={aluno.inicio || aluno.conclusao ? `${formatarData(aluno.inicio)} → ${formatarData(aluno.conclusao)}` : null} />
        </dl>
        {aluno.obs && <p className="mt-2 border-l-4 border-gunmetal-gray bg-neutral-tint p-3 text-sm text-onyx-black">{aluno.obs}</p>}
      </section>

      <section className="mt-8" aria-labelledby="situacao">
        <h2 id="situacao" className="font-display text-3xl text-gunmetal-gray">
          Situação
        </h2>
        {podeMudarStatus ? (
          <form onSubmit={mudarStatus} className="mt-2 border border-gunmetal-gray/25 p-4">
            <p className="text-sm text-onyx-black">
              Situação atual: <strong>{aluno.status}</strong>. Toda mudança precisa de um motivo e fica registrada no histórico.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-[14rem_1fr_auto] md:items-end">
              <label className="text-sm font-bold text-gunmetal-gray">
                Nova situação
                <select required value={novoStatus} onChange={(e) => setNovoStatus(e.target.value)} className={campo}>
                  <option value="">Escolha…</option>
                  {STATUS_ALUNO.filter((s) => s !== aluno.status).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-bold text-gunmetal-gray">
                Motivo
                <input
                  required
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ex.: trancou a matrícula a pedido do aluno"
                  className={campo}
                />
              </label>
              <button
                type="submit"
                disabled={ocupado || !novoStatus || !motivo.trim()}
                className="min-h-11 rounded-sm bg-mandarin-orange px-4 text-sm font-bold text-onyx-black transition hover:bg-mandarin-orange-dark disabled:opacity-50"
              >
                Registrar mudança
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-purple">
              Alunos que não estão “Ativo” saem das listas de avaliação (Atribuições e “Quem já avaliou”), mas o que já foi avaliado continua guardado.
            </p>
          </form>
        ) : (
          <p className="mt-2 text-sm text-onyx-black">
            Situação atual: <strong>{aluno.status}</strong>. Só coordenação e secretaria alteram a situação.
          </p>
        )}
        <div aria-live="polite" className="mt-3">
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

        {historico.length > 0 && (
          <>
            <h3 className="mt-4 font-display text-2xl text-gunmetal-gray">Histórico</h3>
            <ul className="mt-1 divide-y divide-gunmetal-gray/15 border border-gunmetal-gray/25">
              {historico.map((h) => (
                <li key={h.id} className="grid gap-1 p-3 text-sm md:grid-cols-[11rem_8rem_1fr]">
                  <span className="text-muted-purple">{dataHoraLocal(h.desde)}</span>
                  <span>
                    <span className={`rounded-sm px-2 py-0.5 text-xs font-bold ${corStatus[h.status] ?? 'bg-neutral-tint'}`}>{h.status}</span>
                  </span>
                  <span className="text-onyx-black">{h.motivo ?? '—'}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="mt-8" aria-labelledby="matriculas">
        <h2 id="matriculas" className="font-display text-3xl text-gunmetal-gray">
          Matrículas por semestre
        </h2>
        {matriculas.length === 0 ? (
          <p className="mt-2 border border-gunmetal-gray/25 p-4 text-sm text-onyx-black">Nenhuma matrícula registrada.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gunmetal-gray/15 border border-gunmetal-gray/25">
            {matriculas.map((m) => (
              <li key={m.id} className="grid gap-1 p-3 text-sm md:grid-cols-[6rem_1fr_1fr_1fr]">
                <span className="font-bold text-gunmetal-gray">{m.semestres?.codigo ?? '—'}</span>
                <span>{m.ciclos?.nome ?? '—'}</span>
                <span>{m.modulos?.nome ?? 'Módulo não informado'}</span>
                <span className="text-muted-purple">{[m.plano, m.cenario].filter(Boolean).join(' · ') || '—'}</span>
              </li>
            ))}
          </ul>
        )}
        {ciclos.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Situação por ciclo">
            {ciclos.map((c) => (
              <li key={c.ciclos?.nome} className="rounded-sm border border-gunmetal-gray/40 px-2 py-1 text-sm">
                <strong>{c.ciclos?.nome}</strong>: {c.status}
              </li>
            ))}
          </ul>
        )}
      </section>

      {veDesenvolvimento && (
        <section className="mt-8" aria-labelledby="desenvolvimento">
          <h2 id="desenvolvimento" className="font-display text-3xl text-gunmetal-gray">
            Desenvolvimento
          </h2>
          {desenvolvimento.length === 0 ? (
            <p className="mt-2 border border-gunmetal-gray/25 p-4 text-sm text-onyx-black">Ainda não há resultados para este aluno.</p>
          ) : (
            <>
              {medias && (
                <ul className="mt-2 grid grid-cols-3 gap-3 text-center sm:max-w-xl">
                  {[
                    ['Média Básico', medias.media_basico],
                    ['Média Avançado', medias.media_avancado],
                    ['Média final', medias.media_final],
                  ].map(([rotulo, valor]) => (
                    <li key={rotulo as string} className="bg-gunmetal-gray p-3 text-white">
                      <span className="block font-display text-4xl font-bold leading-none">{nota(valor as number | null)}</span>
                      <span className="text-xs font-bold uppercase tracking-wide">{rotulo as string}</span>
                    </li>
                  ))}
                </ul>
              )}
              {medias && medias.semestres_incompletos > 0 && (
                <p className="mt-2 border-l-4 border-mandarin-orange bg-soft-pink/60 p-3 text-sm text-onyx-black">
                  {medias.semestres_incompletos} de {medias.semestres} semestres ainda têm resultado parcial: as médias podem mudar.
                </p>
              )}
              <div className="mt-3 overflow-x-auto border border-gunmetal-gray/25 bg-white">
                <table className="w-full min-w-[44rem] text-left text-sm">
                  <thead className="bg-neutral-tint text-xs uppercase tracking-wide text-muted-purple">
                    <tr>
                      <th className="px-3 py-2">Semestre</th>
                      <th className="px-2 py-2 text-right">Tutoria</th>
                      <th className="px-2 py-2 text-right">Mentoria</th>
                      <th className="px-2 py-2 text-right">Final</th>
                      <th className="px-3 py-2">Conceito</th>
                      <th className="px-3 py-2">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {desenvolvimento.map((d) => (
                      <tr key={d.semestre_id} className="border-t border-gunmetal-gray/15">
                        <td className="px-3 py-2 font-bold text-gunmetal-gray">
                          {d.semestre}
                          <span className="ml-2 text-xs font-normal text-muted-purple">{d.ciclo ?? ''}</span>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{nota(d.tutoria)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{nota(d.mentoria)}</td>
                        <td className="px-2 py-2 text-right font-bold tabular-nums text-gunmetal-gray">{nota(d.final)}</td>
                        <td className="px-3 py-2">{d.conceito ?? '—'}</td>
                        <td className="px-3 py-2">
                          {d.final === null ? '—' : !d.completo ? 'Parcial' : d.aprovado ? 'Aprovado(a)' : 'Reprovado(a)'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted-purple">Detalhes por componente e por pergunta: tela Resultados.</p>
            </>
          )}
        </section>
      )}

      {dados && (
        <section className="mt-8" aria-labelledby="dados">
          <h2 id="dados" className="font-display text-3xl text-gunmetal-gray">
            Dados cadastrais
          </h2>
          <dl className="mt-2 grid grid-cols-2 gap-4 border border-gunmetal-gray/25 p-4 md:grid-cols-4">
            <Item rotulo="CPF" valor={dados.cpf} />
            <Item rotulo="RG" valor={[dados.rg, dados.orgao_rg].filter(Boolean).join(' ')} />
            <Item rotulo="Estado civil" valor={dados.estado_civil} />
            <Item rotulo="Nacionalidade" valor={dados.nacionalidade} />
            <div className="col-span-2">
              <Item rotulo="Endereço" valor={endereco} />
            </div>
            <Item rotulo="CEP" valor={dados.cep} />
            <Item rotulo="Cidade / UF" valor={cidadeUf} />
            <Item rotulo="Mãe" valor={dados.nome_mae} />
            <Item rotulo="Pai" valor={dados.nome_pai} />
          </dl>
          <p className="mt-2 text-xs text-muted-purple">A edição dos demais campos do cadastro virá em seguida; por enquanto só a situação pode ser alterada aqui.</p>
        </section>
      )}
    </div>
  )
}
