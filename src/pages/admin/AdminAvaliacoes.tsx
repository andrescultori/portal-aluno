import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import type {
  AlunoResumo,
  Atribuicao,
  CategoriaAvaliacao,
  Casa,
  Elegibilidade,
  EquipeCasa,
  MembroEquipe,
  Semestre,
} from '../../types/alunos'
import { ROTULO_PAPEL, rotuloCategoria } from '../../types/alunos'
import Modal from '../../components/Modal'
import CabecalhoAdmin from './CabecalhoAdmin'
import FiltroStatus, { passa, useElegibilidade, valorValido, type ValorFiltroStatus } from './FiltroStatus'
import AvaliacoesJanelas from './AvaliacoesJanelas'
import AvaliacoesCobertura from './AvaliacoesCobertura'

const db = () => supabase.schema('alunos')

const campo =
  'mt-1 block min-h-11 w-full min-w-0 max-w-full rounded-sm border border-gunmetal-gray/40 bg-pure-white px-2 text-sm font-normal text-onyx-black'
const botao =
  'min-h-11 rounded-sm bg-gunmetal-gray px-4 text-sm font-bold text-white transition hover:bg-gunmetal-gray-dark disabled:opacity-50'
const botaoLaranja =
  'min-h-11 rounded-sm bg-mandarin-orange px-4 text-sm font-bold text-onyx-black transition hover:bg-mandarin-orange-dark disabled:opacity-50'
const botaoLinha =
  'min-h-11 rounded-sm border-2 border-gunmetal-gray px-4 text-sm font-bold text-gunmetal-gray transition hover:bg-soft-pink/50 disabled:opacity-50'

function formatarData(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR')
}

function nomeAluno(a: AlunoResumo) {
  return a.nome_exibicao || a.nome
}

type Aba = 'semestre' | 'atribuicoes' | 'janelas' | 'cobertura'

const ABAS: [Aba, string][] = [
  ['semestre', 'Semestre'],
  ['atribuicoes', 'Atribuições'],
  ['janelas', 'Períodos e liberação'],
  ['cobertura', 'Quem já avaliou'],
]

export default function AdminAvaliacoes() {
  // A aba e o semestre escolhidos ficam na URL: se a tela recarregar ou a pessoa voltar para ela,
  // continua exatamente onde estava (em vez de cair de novo em "Semestre").
  const [params, setParams] = useSearchParams()
  const abaParam = params.get('aba')
  const aba: Aba = ABAS.some(([v]) => v === abaParam) ? (abaParam as Aba) : 'semestre'
  const semParam = params.get('sem')
  const mudarParams = (mudar: (p: URLSearchParams) => void) =>
    setParams(
      (atual) => {
        const p = new URLSearchParams(atual)
        mudar(p)
        return p
      },
      { replace: true },
    )
  const setAba = (nova: Aba) => mudarParams((p) => p.set('aba', nova))
  // Filtro de situação do aluno, o mesmo nas abas Atribuições e Quem já avaliou.
  const statusFiltro = valorValido(params.get('status'))
  const setStatusFiltro = (v: ValorFiltroStatus) => mudarParams((p) => p.set('status', v))

  const [semestres, setSemestres] = useState<Semestre[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const semestreId = useMemo(
    () =>
      semestres.find((s) => s.codigo === semParam)?.id ??
      semestres.find((s) => s.atual)?.id ??
      semestres[0]?.id ??
      '',
    [semestres, semParam],
  )
  const setSemestreId = (id: string) => {
    const codigo = semestres.find((s) => s.id === id)?.codigo
    if (codigo) mudarParams((p) => p.set('sem', codigo))
  }

  const carregarSemestres = useCallback(async (manter?: string) => {
    // Só mostra "Carregando..." na primeira carga; nas seguintes atualiza por baixo, sem desmontar a aba.
    setSemestres((atuais) => {
      if (atuais.length === 0) setCarregando(true)
      return atuais
    })
    const { data, error } = await db()
      .from('semestres')
      .select('id, codigo, inicio, fim, atual')
      .order('codigo', { ascending: false })
    if (error) {
      setErro(`Não foi possível carregar os semestres: ${error.message}`)
      setCarregando(false)
      return
    }
    const lista = (data as Semestre[]) ?? []
    setSemestres(lista)
    const alvo = manter ? lista.find((s) => s.id === manter) : undefined
    if (alvo) {
      setParams(
        (atual) => {
          const p = new URLSearchParams(atual)
          p.set('sem', alvo.codigo)
          return p
        },
        { replace: true },
      )
    }
    setCarregando(false)
  }, [setParams])

  useEffect(() => {
    carregarSemestres()
  }, [carregarSemestres])

  const semestre = semestres.find((s) => s.id === semestreId) ?? null
  const elegibilidade = useElegibilidade(semestre?.id)

  return (
    <div className="mx-auto max-w-6xl">
      <CabecalhoAdmin
        titulo="Avaliações"
        trilha={[{ rotulo: 'Avaliações', to: '/admin/avaliacoes' }, { rotulo: ABAS.find(([v]) => v === aba)?.[1] ?? 'Semestre' }]}
        descricao="Defina o semestre, quem avalia quem, o período de avaliação e quando os alunos veem os resultados. Cada avaliador só vê os alunos que você atribuir aqui."
      />

      {erro && (
        <p role="alert" className="mt-4 border-l-4 border-mandarin-orange bg-soft-pink/60 p-3 text-sm text-onyx-black">
          {erro}
        </p>
      )}

      <div role="tablist" aria-label="Seções" className="mt-6 flex flex-wrap gap-2 border-b border-gunmetal-gray/25">
        {ABAS.map(([valor, rotulo]) => (
          <button
            key={valor}
            role="tab"
            type="button"
            aria-selected={aba === valor}
            onClick={() => setAba(valor)}
            className={`min-h-11 border-b-4 px-4 text-sm font-bold transition ${
              aba === valor
                ? 'border-mandarin-orange text-gunmetal-gray'
                : 'border-transparent text-muted-purple hover:text-gunmetal-gray'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {carregando ? (
          <p className="text-onyx-black">Carregando...</p>
        ) : aba === 'semestre' ? (
          <SecaoSemestre
            semestres={semestres}
            semestre={semestre}
            aoEscolher={setSemestreId}
            aoMudar={carregarSemestres}
          />
        ) : semestre ? (
          <>
            <SeletorSemestre semestres={semestres} valor={semestreId} aoEscolher={setSemestreId} />
            {aba === 'atribuicoes' && (
              <SecaoAtribuicoes
                semestre={semestre}
                elegibilidade={elegibilidade.mapa}
                avisoElegibilidade={elegibilidade.aviso}
                statusFiltro={statusFiltro}
                aoMudarStatus={setStatusFiltro}
              />
            )}
            {aba === 'janelas' && <AvaliacoesJanelas semestre={semestre} />}
            {aba === 'cobertura' && (
              <AvaliacoesCobertura
                semestre={semestre}
                elegibilidade={elegibilidade.mapa}
                avisoElegibilidade={elegibilidade.aviso}
                statusFiltro={statusFiltro}
                aoMudarStatus={setStatusFiltro}
              />
            )}
          </>
        ) : (
          <p className="border border-gunmetal-gray/25 p-4 text-sm text-onyx-black">
            Cadastre um semestre na aba “Semestre” para começar.
          </p>
        )}
      </div>
    </div>
  )
}

function SeletorSemestre({
  semestres,
  valor,
  aoEscolher,
}: {
  semestres: Semestre[]
  valor: string
  aoEscolher: (id: string) => void
}) {
  return (
    <label className="mb-4 block max-w-xs text-sm font-bold text-gunmetal-gray">
      Semestre
      <select value={valor} onChange={(e) => aoEscolher(e.target.value)} className={campo}>
        {semestres.map((s) => (
          <option key={s.id} value={s.id}>
            {s.codigo}
            {s.atual ? ' (atual)' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}

/* ------------------------------------------------------------------ Semestre */

function SecaoSemestre({
  semestres,
  semestre,
  aoEscolher,
  aoMudar,
}: {
  semestres: Semestre[]
  semestre: Semestre | null
  aoEscolher: (id: string) => void
  aoMudar: (manter?: string) => Promise<void>
}) {
  const [novo, setNovo] = useState({ codigo: '', inicio: '', fim: '', atual: true })
  const [edicao, setEdicao] = useState({ inicio: '', fim: '' })
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [diasLetivos, setDiasLetivos] = useState<number | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [modalNovo, setModalNovo] = useState(false)

  useEffect(() => {
    setEdicao({ inicio: semestre?.inicio ?? '', fim: semestre?.fim ?? '' })
    setDiasLetivos(null)
    if (!semestre) return
    db()
      .from('dias_letivos')
      .select('data', { count: 'exact', head: true })
      .eq('semestre_id', semestre.id)
      .eq('aula', true)
      .then(({ count }) => setDiasLetivos(count ?? 0))
  }, [semestre])

  // Só um semestre pode ser o atual (índice único no banco): desmarca os outros antes.
  async function marcarAtual(id: string) {
    const { error: e1 } = await db().from('semestres').update({ atual: false }).eq('atual', true).neq('id', id)
    if (e1) return e1
    const { error: e2 } = await db().from('semestres').update({ atual: true }).eq('id', id)
    return e2
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setMensagem(null)
    setOcupado(true)
    const { data, error } = await db()
      .from('semestres')
      .insert({ codigo: novo.codigo.trim(), inicio: novo.inicio || null, fim: novo.fim || null, atual: false })
      .select('id')
      .single()
    if (error || !data) {
      setOcupado(false)
      setMensagem({
        tipo: 'erro',
        texto: error?.message.includes('semestres_codigo_check')
          ? 'O código precisa ter o formato AAAA-1 ou AAAA-2 (por exemplo, 2026-2).'
          : `Não foi possível criar: ${error?.message ?? 'erro desconhecido'}`,
      })
      return
    }
    if (novo.atual) {
      const erroAtual = await marcarAtual(data.id)
      if (erroAtual) setMensagem({ tipo: 'erro', texto: `Semestre criado, mas não foi possível marcá-lo como atual: ${erroAtual.message}` })
    }
    setNovo({ codigo: '', inicio: '', fim: '', atual: true })
    setModalNovo(false)
    await aoMudar(data.id)
    setOcupado(false)
    setMensagem((m) => m ?? { tipo: 'ok', texto: 'Semestre criado. Agora gere os dias letivos.' })
  }

  async function salvarDatas() {
    if (!semestre) return
    setMensagem(null)
    if (edicao.inicio && edicao.fim && edicao.fim < edicao.inicio) {
      setMensagem({ tipo: 'erro', texto: 'A data final não pode ser anterior à inicial.' })
      return
    }
    setOcupado(true)
    const { error } = await db()
      .from('semestres')
      .update({ inicio: edicao.inicio || null, fim: edicao.fim || null })
      .eq('id', semestre.id)
    setOcupado(false)
    if (error) {
      setMensagem({ tipo: 'erro', texto: `Não foi possível salvar: ${error.message}` })
      return
    }
    setMensagem({ tipo: 'ok', texto: 'Datas salvas.' })
    aoMudar(semestre.id)
  }

  async function tornarAtual() {
    if (!semestre) return
    setMensagem(null)
    setOcupado(true)
    const erroAtual = await marcarAtual(semestre.id)
    setOcupado(false)
    if (erroAtual) {
      setMensagem({ tipo: 'erro', texto: `Não foi possível marcar como atual: ${erroAtual.message}` })
      return
    }
    setMensagem({ tipo: 'ok', texto: `${semestre.codigo} é o semestre atual.` })
    aoMudar(semestre.id)
  }

  async function gerarDias() {
    if (!semestre) return
    setMensagem(null)
    setOcupado(true)
    const { data, error } = await supabase.schema('alunos').rpc('gerar_dias_letivos', { p_semestre: semestre.id })
    setOcupado(false)
    if (error) {
      setMensagem({
        tipo: 'erro',
        texto: error.message.includes('start and end dates')
          ? 'Preencha e salve as datas de início e fim do semestre antes de gerar os dias letivos.'
          : `Não foi possível gerar os dias letivos: ${error.message}`,
      })
      return
    }
    const adicionados = Number(data ?? 0)
    setMensagem({
      tipo: 'ok',
      texto:
        adicionados > 0
          ? `${adicionados} dias letivos (segunda a sexta) adicionados. Feriados você marca depois como “sem aula”.`
          : 'Os dias letivos deste semestre já estavam gerados.',
    })
    setDiasLetivos((n) => (n ?? 0) + adicionados)
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <section aria-labelledby="sem-lista">
        <h2 id="sem-lista" className="font-display text-3xl text-gunmetal-gray">
          Semestres
        </h2>
        {semestres.length === 0 ? (
          <p className="mt-3 border border-gunmetal-gray/25 p-4 text-sm text-onyx-black">
            Nenhum semestre cadastrado ainda.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-gunmetal-gray/15 border border-gunmetal-gray/25">
            {semestres.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => aoEscolher(s.id)}
                  aria-pressed={semestre?.id === s.id}
                  className={`flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left transition hover:bg-soft-pink/40 ${
                    semestre?.id === s.id ? 'bg-soft-pink/60' : ''
                  }`}
                >
                  <span>
                    <span className="block font-bold text-gunmetal-gray">{s.codigo}</span>
                    <span className="block text-sm text-onyx-black">
                      {formatarData(s.inicio)} a {formatarData(s.fim)}
                    </span>
                  </span>
                  {s.atual && (
                    <span className="shrink-0 rounded-sm bg-gunmetal-gray px-2 py-1 text-xs font-bold uppercase tracking-wide text-white">
                      Atual
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

      </section>

      <section aria-labelledby="sem-detalhe">
        <div className="mb-3 flex justify-end">
          <button type="button" onClick={() => setModalNovo(true)} className={botaoLaranja}>
            Novo semestre
          </button>
        </div>
        <Modal aberto={modalNovo} aoFechar={() => setModalNovo(false)} titulo="Novo semestre">
        <form onSubmit={criar}>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="col-span-2 text-sm font-bold text-gunmetal-gray sm:col-span-1">
              Código
              <input
                required
                value={novo.codigo}
                onChange={(e) => setNovo({ ...novo, codigo: e.target.value })}
                placeholder="2026-2"
                pattern="\d{4}-[12]"
                title="Use o formato AAAA-1 ou AAAA-2"
                className={campo}
              />
            </label>
            <div className="hidden sm:block" />
            <label className="text-sm font-bold text-gunmetal-gray">
              Início
              <input type="date" value={novo.inicio} onChange={(e) => setNovo({ ...novo, inicio: e.target.value })} className={campo} />
            </label>
            <label className="text-sm font-bold text-gunmetal-gray">
              Fim
              <input type="date" value={novo.fim} onChange={(e) => setNovo({ ...novo, fim: e.target.value })} className={campo} />
            </label>
            <label className="col-span-2 flex min-h-11 items-center gap-2 text-sm text-onyx-black">
              <input
                type="checkbox"
                checked={novo.atual}
                onChange={(e) => setNovo({ ...novo, atual: e.target.checked })}
                className="h-5 w-5 accent-mandarin-orange"
              />
              Marcar como semestre atual
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" disabled={ocupado} className={botaoLaranja}>
              Criar semestre
            </button>
            <button type="button" onClick={() => setModalNovo(false)} className={botaoLinha}>
              Cancelar
            </button>
          </div>
        </form>
        </Modal>
        <h2 id="sem-detalhe" className="font-display text-3xl text-gunmetal-gray">
          {semestre ? `Semestre ${semestre.codigo}` : 'Semestre'}
        </h2>
        {!semestre ? (
          <p className="mt-3 border border-gunmetal-gray/25 p-4 text-sm text-onyx-black">
            Escolha ou crie um semestre.
          </p>
        ) : (
          <div className="mt-3 border border-gunmetal-gray/25 p-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-bold text-gunmetal-gray">
                Início
                <input type="date" value={edicao.inicio} onChange={(e) => setEdicao({ ...edicao, inicio: e.target.value })} className={campo} />
              </label>
              <label className="text-sm font-bold text-gunmetal-gray">
                Fim
                <input type="date" value={edicao.fim} onChange={(e) => setEdicao({ ...edicao, fim: e.target.value })} className={campo} />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={salvarDatas} disabled={ocupado} className={botao}>
                Salvar datas
              </button>
              {!semestre.atual && (
                <button type="button" onClick={tornarAtual} disabled={ocupado} className={botaoLinha}>
                  Tornar o semestre atual
                </button>
              )}
            </div>

            <hr className="my-4 border-gunmetal-gray/15" />
            <h3 className="font-display text-2xl text-gunmetal-gray">Dias letivos</h3>
            <p className="mt-1 text-sm text-onyx-black">
              {diasLetivos === null
                ? 'Carregando...'
                : diasLetivos === 0
                  ? 'Ainda não há dias letivos. Eles servem para calcular a presença.'
                  : `${diasLetivos} dias com aula (segunda a sexta).`}
            </p>
            <button type="button" onClick={gerarDias} disabled={ocupado || !semestre.inicio || !semestre.fim} className={`${botaoLinha} mt-3`}>
              Gerar dias letivos (segunda a sexta)
            </button>
            {(!semestre.inicio || !semestre.fim) && (
              <p className="mt-2 text-xs text-muted-purple">Salve as datas de início e fim primeiro.</p>
            )}
          </div>
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
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ Atribuições */

type Filtro = 'todos' | 'sem_tutor' | 'sem_mentor'

function SecaoAtribuicoes({
  semestre,
  elegibilidade,
  avisoElegibilidade,
  statusFiltro,
  aoMudarStatus,
}: {
  semestre: Semestre
  elegibilidade: Map<string, Elegibilidade>
  avisoElegibilidade: string | null
  statusFiltro: ValorFiltroStatus
  aoMudarStatus: (v: ValorFiltroStatus) => void
}) {
  const [alunos, setAlunos] = useState<AlunoResumo[]>([])
  const [casas, setCasas] = useState<Casa[]>([])
  const [equipe, setEquipe] = useState<MembroEquipe[]>([])
  const [equipeCasas, setEquipeCasas] = useState<EquipeCasa[]>([])
  const [atribuicoes, setAtribuicoes] = useState<Atribuicao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const [busca, setBusca] = useState('')
  const [casaFiltro, setCasaFiltro] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [lote, setLote] = useState<{ equipeId: string; categoria: CategoriaAvaliacao }>({
    equipeId: '',
    categoria: 'tutoria',
  })

  const carregar = useCallback(async () => {
    setCarregando(true)
    const [a, c, e, ec, at] = await Promise.all([
      db().from('alunos').select('id, nome, nome_exibicao, casa_id, status').order('nome'),
      db().from('casas').select('id, nome').order('nome'),
      db().from('equipe').select('id, nome, email, ativo').eq('ativo', true).order('nome'),
      db().from('equipe_casas').select('equipe_id, casa_id'),
      db()
        .from('aluno_tutores')
        .select('id, aluno_id, semestre_id, equipe_id, categoria')
        .eq('semestre_id', semestre.id),
    ])
    const falha = a.error || c.error || e.error || ec.error || at.error
    if (falha) setMensagem({ tipo: 'erro', texto: `Não foi possível carregar os dados: ${falha.message}` })
    // Funções de cada pessoa (Tutor, Mentor...) para rotular as listas; se a consulta ainda não existe, segue sem.
    const { data: lista } = await supabase.rpc('listar_equipe')
    const papeisPorEmail = new Map(((lista as { email: string; papeis: string[] }[] | null) ?? []).map((m) => [m.email, m.papeis]))
    setAlunos((a.data as AlunoResumo[]) ?? [])
    setCasas((c.data as Casa[]) ?? [])
    setEquipe(((e.data as MembroEquipe[]) ?? []).map((m) => ({ ...m, papeis: papeisPorEmail.get(m.email) })))
    setEquipeCasas((ec.data as EquipeCasa[]) ?? [])
    setAtribuicoes((at.data as Atribuicao[]) ?? [])
    setSelecionados(new Set())
    setCarregando(false)
  }, [semestre.id])

  useEffect(() => {
    carregar()
  }, [carregar])

  const equipePorId = useMemo(() => new Map(equipe.map((m) => [m.id, m])), [equipe])
  const casaPorId = useMemo(() => new Map(casas.map((c) => [c.id, c.nome])), [casas])

  const porAluno = useMemo(() => {
    const mapa = new Map<string, { tutoria: Atribuicao[]; mentoria: Atribuicao[] }>()
    for (const at of atribuicoes) {
      const item = mapa.get(at.aluno_id) ?? { tutoria: [], mentoria: [] }
      item[at.categoria].push(at)
      mapa.set(at.aluno_id, item)
    }
    return mapa
  }, [atribuicoes])

  // Líderes de casa avaliam a Mentoria automaticamente (derivado de equipe_casas): só informativo.
  const lideresDaCasa = useCallback(
    (casaId: number | null) => {
      if (casaId === null) return []
      return equipeCasas
        .filter((ec) => ec.casa_id === casaId)
        .map((ec) => equipePorId.get(ec.equipe_id))
        .filter((m): m is MembroEquipe => !!m)
    },
    [equipeCasas, equipePorId],
  )

  const visiveis = useMemo(() => {
    const termo = busca
      .trim()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
    return alunos.filter((a) => {
      if (termo) {
        const nome = nomeAluno(a).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        if (!nome.includes(termo)) return false
      }
      if (casaFiltro && String(a.casa_id ?? '') !== casaFiltro) return false
      if (!passa(elegibilidade.get(a.id), statusFiltro)) return false
      const item = porAluno.get(a.id)
      if (filtro === 'sem_tutor' && (item?.tutoria.length ?? 0) > 0) return false
      if (filtro === 'sem_mentor' && (item?.mentoria.length ?? 0) > 0) return false
      return true
    })
  }, [alunos, busca, casaFiltro, filtro, porAluno, elegibilidade, statusFiltro])

  const resumo = useMemo(() => {
    const escopo = alunos.filter((a) => passa(elegibilidade.get(a.id), statusFiltro))
    const semTutor = escopo.filter((a) => (porAluno.get(a.id)?.tutoria.length ?? 0) === 0).length
    const semMentor = escopo.filter((a) => (porAluno.get(a.id)?.mentoria.length ?? 0) === 0).length
    return { total: escopo.length, semTutor, semMentor }
  }, [alunos, porAluno, elegibilidade, statusFiltro])

  function alternar(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  const todosMarcados = visiveis.length > 0 && visiveis.every((a) => selecionados.has(a.id))
  function alternarTodos() {
    setSelecionados(todosMarcados ? new Set() : new Set(visiveis.map((a) => a.id)))
  }

  async function atribuir(alunoIds: string[], equipeId: string, categoria: CategoriaAvaliacao) {
    if (alunoIds.length === 0 || !equipeId) return
    setMensagem(null)
    setOcupado(true)
    const linhas = alunoIds.map((aluno_id) => ({ aluno_id, semestre_id: semestre.id, equipe_id: equipeId, categoria }))
    const { error } = await db()
      .from('aluno_tutores')
      .upsert(linhas, { onConflict: 'aluno_id,semestre_id,equipe_id,categoria', ignoreDuplicates: true })
    setOcupado(false)
    if (error) {
      setMensagem({ tipo: 'erro', texto: `Não foi possível atribuir: ${error.message}` })
      return
    }
    const quem = equipePorId.get(equipeId)?.nome ?? 'a pessoa'
    setMensagem({
      tipo: 'ok',
      texto: `${quem} agora avalia a ${rotuloCategoria[categoria]} de ${alunoIds.length} ${alunoIds.length === 1 ? 'aluno' : 'alunos'}.`,
    })
    await carregar()
  }

  async function remover(alunoIds: string[], equipeId: string, categoria: CategoriaAvaliacao) {
    if (alunoIds.length === 0 || !equipeId) return
    setMensagem(null)
    setOcupado(true)
    const { error } = await db()
      .from('aluno_tutores')
      .delete()
      .eq('semestre_id', semestre.id)
      .eq('equipe_id', equipeId)
      .eq('categoria', categoria)
      .in('aluno_id', alunoIds)
    setOcupado(false)
    if (error) {
      setMensagem({ tipo: 'erro', texto: `Não foi possível remover: ${error.message}` })
      return
    }
    setMensagem({ tipo: 'ok', texto: 'Atribuição removida. Avaliações já enviadas continuam guardadas.' })
    await carregar()
  }

  const idsSelecionados = [...selecionados]
  const nomeLote = equipePorId.get(lote.equipeId)?.nome

  if (carregando) return <p className="text-onyx-black">Carregando...</p>

  return (
    <section aria-labelledby="atr-titulo">
      <h2 id="atr-titulo" className="font-display text-3xl text-gunmetal-gray">
        Quem avalia quem — {semestre.codigo}
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-onyx-black">
        <strong>Tutoria:</strong> normalmente 2 tutores por aluno. <strong>Mentoria:</strong> o mentor do aluno; os
        líderes da casa avaliam a Mentoria automaticamente, sem precisar atribuir aqui.
      </p>

      {alunos.length === 0 ? (
        <p className="mt-4 border border-gunmetal-gray/25 p-4 text-sm text-onyx-black">
          Ainda não há alunos cadastrados no sistema. Eles aparecem aqui depois da importação da planilha geral.
        </p>
      ) : (
        <>
          {avisoElegibilidade && (
            <p role="status" className="mt-4 border-l-4 border-mandarin-orange bg-soft-pink/60 p-3 text-sm text-onyx-black">
              {avisoElegibilidade}
            </p>
          )}
          <ul className="mt-4 grid grid-cols-3 gap-3 text-center sm:max-w-xl">
            <li className="bg-gunmetal-gray p-3 text-white">
              <span className="block font-display text-4xl font-bold leading-none">{resumo.total}</span>
              <span className="text-xs font-bold uppercase tracking-wide">Alunos</span>
            </li>
            <li className="border-[3px] border-mandarin-orange p-3 text-onyx-black">
              <span className="block font-display text-4xl font-bold leading-none">{resumo.semTutor}</span>
              <span className="text-xs font-bold uppercase tracking-wide">Sem tutor</span>
            </li>
            <li className="border-[3px] border-mandarin-orange p-3 text-onyx-black">
              <span className="block font-display text-4xl font-bold leading-none">{resumo.semMentor}</span>
              <span className="text-xs font-bold uppercase tracking-wide">Sem mentor</span>
            </li>
          </ul>

          <div className="mt-4 grid grid-cols-2 gap-3 border border-gunmetal-gray/25 p-4 lg:grid-cols-[1.3fr_1fr_1.2fr_1fr]">
            <label className="col-span-2 text-sm font-bold text-gunmetal-gray lg:col-span-1">
              Buscar aluno
              <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome" className={campo} />
            </label>
            <label className="text-sm font-bold text-gunmetal-gray">
              Casa
              <select value={casaFiltro} onChange={(e) => setCasaFiltro(e.target.value)} className={campo}>
                <option value="">Todas</option>
                {casas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
            <FiltroStatus valor={statusFiltro} aoMudar={aoMudarStatus} classeCampo={campo} />
            <label className="text-sm font-bold text-gunmetal-gray">
              Mostrar
              <select value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} className={campo}>
                <option value="todos">Todos</option>
                <option value="sem_tutor">Só quem está sem tutor</option>
                <option value="sem_mentor">Só quem está sem mentor</option>
              </select>
            </label>
          </div>

          <div className="mt-4 border border-gunmetal-gray/25 bg-neutral-tint p-4">
            <h3 className="font-display text-2xl text-gunmetal-gray">Atribuir em lote</h3>
            <p className="text-sm text-onyx-black">
              Marque os alunos na lista (ou “Marcar todos” para os que estão filtrados — por exemplo, uma casa inteira).
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-[1.4fr_1fr_auto_auto] lg:items-end">
              <label className="col-span-2 text-sm font-bold text-gunmetal-gray lg:col-span-1">
                Pessoa
                <select value={lote.equipeId} onChange={(e) => setLote({ ...lote, equipeId: e.target.value })} className={campo}>
                  <option value="">Escolha…</option>
                  <OpcoesEquipe equipe={equipe} categoria={lote.categoria} />
                </select>
              </label>
              <label className="col-span-2 text-sm font-bold text-gunmetal-gray lg:col-span-1">
                Como
                <select
                  value={lote.categoria}
                  onChange={(e) => setLote({ ...lote, categoria: e.target.value as CategoriaAvaliacao })}
                  className={campo}
                >
                  <option value="tutoria">Tutor(a)</option>
                  <option value="mentoria">Mentor(a)</option>
                </select>
              </label>
              <button
                type="button"
                disabled={ocupado || !lote.equipeId || idsSelecionados.length === 0}
                onClick={() => atribuir(idsSelecionados, lote.equipeId, lote.categoria)}
                className={botaoLaranja}
              >
                Atribuir a {idsSelecionados.length} {idsSelecionados.length === 1 ? 'aluno' : 'alunos'}
              </button>
              <button
                type="button"
                disabled={ocupado || !lote.equipeId || idsSelecionados.length === 0}
                onClick={() => {
                  if (confirm(`Remover ${nomeLote} de ${idsSelecionados.length} aluno(s)?`)) {
                    remover(idsSelecionados, lote.equipeId, lote.categoria)
                  }
                }}
                className={botaoLinha}
              >
                Remover dos marcados
              </button>
            </div>
          </div>

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

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-gunmetal-gray">
              <input type="checkbox" checked={todosMarcados} onChange={alternarTodos} className="h-5 w-5 accent-mandarin-orange" />
              Marcar todos os {visiveis.length} da lista
            </label>
            <span className="text-sm text-muted-purple" aria-live="polite">
              {idsSelecionados.length} marcado(s)
            </span>
          </div>

          {visiveis.length === 0 ? (
            <p className="mt-2 border border-gunmetal-gray/25 p-4 text-sm text-onyx-black">Nenhum aluno com esse filtro.</p>
          ) : (
            <ul className="mt-2 divide-y divide-gunmetal-gray/15 border border-gunmetal-gray/25">
              {visiveis.map((a) => {
                const item = porAluno.get(a.id)
                const lideres = lideresDaCasa(a.casa_id)
                return (
                  <li key={a.id} className="grid gap-3 p-3 md:grid-cols-[auto_1.1fr_1fr_1fr] md:items-start">
                    <label className="flex min-h-11 items-center gap-3 md:contents">
                      <input
                        type="checkbox"
                        checked={selecionados.has(a.id)}
                        onChange={() => alternar(a.id)}
                        aria-label={`Marcar ${nomeAluno(a)}`}
                        className="h-5 w-5 shrink-0 accent-mandarin-orange md:mt-3"
                      />
                      <span className="min-w-0 md:pt-2">
                        <span className="block font-bold text-gunmetal-gray">{nomeAluno(a)}</span>
                        <span className="block text-xs text-muted-purple">
                          {a.casa_id !== null ? casaPorId.get(a.casa_id) : 'Sem casa'}
                          {a.status !== 'Ativo' ? ` · ${a.status}` : ''}
                        </span>
                      </span>
                    </label>

                    <Celula
                      titulo="Tutoria"
                      categoria="tutoria"
                      atribuicoes={item?.tutoria ?? []}
                      equipe={equipe}
                      equipePorId={equipePorId}
                      aoAdicionar={(equipeId) => atribuir([a.id], equipeId, 'tutoria')}
                      aoRemover={(equipeId) => remover([a.id], equipeId, 'tutoria')}
                      ocupado={ocupado}
                      alerta={(item?.tutoria.length ?? 0) === 0}
                    />
                    <Celula
                      titulo="Mentoria"
                      categoria="mentoria"
                      atribuicoes={item?.mentoria ?? []}
                      equipe={equipe}
                      equipePorId={equipePorId}
                      aoAdicionar={(equipeId) => atribuir([a.id], equipeId, 'mentoria')}
                      aoRemover={(equipeId) => remover([a.id], equipeId, 'mentoria')}
                      ocupado={ocupado}
                      alerta={(item?.mentoria.length ?? 0) === 0 && lideres.length === 0}
                      extra={
                        lideres.length > 0
                          ? `Líder(es) da casa: ${lideres.map((l) => l.nome).join(', ')}`
                          : undefined
                      }
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

// Lista de pessoas para escolher: quem tem a função certa (Tutor para Tutoria, Mentor para Mentoria) vem primeiro.
function OpcoesEquipe({
  equipe,
  categoria,
  excluir,
}: {
  equipe: MembroEquipe[]
  categoria: CategoriaAvaliacao
  excluir?: Set<string>
}) {
  const funcao = categoria === 'tutoria' ? 'tutor' : 'mentor'
  const lista = equipe.filter((m) => !excluir?.has(m.id))
  const rotulo = (m: MembroEquipe) =>
    m.papeis && m.papeis.length > 0
      ? `${m.nome} (${m.papeis.filter((p) => p in ROTULO_PAPEL && p !== 'emissor').map((p) => ROTULO_PAPEL[p]).join(', ')})`
      : m.nome
  if (!lista.some((m) => m.papeis !== undefined)) {
    return (
      <>
        {lista.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nome}
          </option>
        ))}
      </>
    )
  }
  const certos = lista.filter((m) => m.papeis?.includes(funcao))
  const outros = lista.filter((m) => !m.papeis?.includes(funcao))
  return (
    <>
      {certos.length > 0 && (
        <optgroup label={categoria === 'tutoria' ? 'Tutores' : 'Mentores'}>
          {certos.map((m) => (
            <option key={m.id} value={m.id}>
              {rotulo(m)}
            </option>
          ))}
        </optgroup>
      )}
      {outros.length > 0 && (
        <optgroup label="Outras funções">
          {outros.map((m) => (
            <option key={m.id} value={m.id}>
              {rotulo(m)}
            </option>
          ))}
        </optgroup>
      )}
    </>
  )
}

function Celula({
  titulo,
  categoria,
  atribuicoes,
  equipe,
  equipePorId,
  aoAdicionar,
  aoRemover,
  ocupado,
  alerta,
  extra,
}: {
  titulo: string
  categoria: CategoriaAvaliacao
  atribuicoes: Atribuicao[]
  equipe: MembroEquipe[]
  equipePorId: Map<string, MembroEquipe>
  aoAdicionar: (equipeId: string) => void
  aoRemover: (equipeId: string) => void
  ocupado: boolean
  alerta: boolean
  extra?: string
}) {
  const jaAtribuidos = new Set(atribuicoes.map((at) => at.equipe_id))
  return (
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-purple">{titulo}</p>
      <ul className="mt-1 flex flex-wrap gap-1">
        {atribuicoes.map((at) => {
          const nome = equipePorId.get(at.equipe_id)?.nome ?? 'Pessoa removida da equipe'
          return (
            <li key={at.id} className="flex items-center gap-1 rounded-sm bg-soft-pink pl-2 text-sm text-gunmetal-gray">
              {nome}
              <button
                type="button"
                disabled={ocupado}
                onClick={() => aoRemover(at.equipe_id)}
                aria-label={`Remover ${nome} da ${titulo}`}
                className="flex h-11 w-11 items-center justify-center text-base font-bold hover:text-mandarin-orange-dark"
              >
                ×
              </button>
            </li>
          )
        })}
        {atribuicoes.length === 0 && (
          <li className={`text-sm ${alerta ? 'font-bold text-mandarin-orange-dark' : 'text-muted-purple'}`}>
            {alerta ? 'Falta atribuir' : 'Ninguém atribuído'}
          </li>
        )}
      </ul>
      {extra && <p className="mt-1 text-xs text-muted-purple">{extra}</p>}
      <select
        aria-label={`Adicionar à ${titulo}`}
        value=""
        disabled={ocupado}
        onChange={(e) => {
          if (e.target.value) aoAdicionar(e.target.value)
        }}
        className="mt-1 block min-h-11 w-full min-w-0 rounded-sm border border-gunmetal-gray/40 bg-pure-white px-2 text-sm text-onyx-black"
      >
        <option value="">+ Adicionar…</option>
        <OpcoesEquipe equipe={equipe} categoria={categoria} excluir={jaAtribuidos} />
      </select>
    </div>
  )
}
