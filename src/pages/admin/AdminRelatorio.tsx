import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import Modal from '../../components/Modal'
import { useToast } from '../../components/Toasts'
import { horaLocal } from '../../lib/datas'
import StatusSelo, { statusRotulo } from '../../components/StatusSelo'
import type { AttendanceStatus, Turma } from '../../types/database'
import CabecalhoAdmin from './CabecalhoAdmin'

interface LinhaRelatorio {
  id: string
  data: string
  status: AttendanceStatus
  horario_checkin: string | null
  aluno_nome: string
  turma_nome: string
}

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

function trintaDiasAtras() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

function formatarData(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR')
}

function semAcento(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function celulaCsv(valor: string) {
  return `"${valor.replace(/"/g, '""')}"`
}

function traduzirErro(msg: string) {
  if (msg.includes('A reason is required')) return 'Informe o motivo.'
  if (msg.includes('No change')) return 'Escolha um status diferente do atual.'
  if (msg.includes('not allowed')) return 'Você não tem permissão para isto.'
  if (msg.includes('record not found') || msg.includes('check-in not found')) return 'Este check-in não existe mais (talvez já tenha sido excluído). A lista foi atualizada.'
  if (msg.includes('corrigir_presenca')) return 'A correção de presenças ainda não foi instalada no banco (migração 17).'
  if (msg.includes('excluir_checkin')) return 'A exclusão de check-ins ainda não está instalada no banco.'
  return msg
}

const botaoLaranja =
  'min-h-11 rounded-sm bg-mandarin-orange px-4 text-sm font-bold text-onyx-black transition hover:bg-mandarin-orange-dark disabled:opacity-50'
const botaoLinha =
  'min-h-11 rounded-sm border-2 border-gunmetal-gray px-4 text-sm font-bold text-gunmetal-gray transition hover:bg-soft-pink/50 disabled:opacity-50'

const campo =
  'mt-1 block min-h-11 w-full min-w-0 max-w-full rounded-sm border border-gunmetal-gray/40 bg-pure-white px-2 text-sm font-normal text-onyx-black'

export default function AdminRelatorio() {
  const [turmas, setTurmas] = useState<Turma[]>([])
  // Os filtros podem vir da URL (?turma=&de=&ate=), por exemplo do aviso "esta turma tem check-ins registrados".
  const [params] = useSearchParams()
  const [turmaId, setTurmaId] = useState(params.get('turma') ?? '')
  const [inicio, setInicio] = useState(params.get('de') ?? trintaDiasAtras())
  const [fim, setFim] = useState(params.get('ate') ?? hoje())
  const [busca, setBusca] = useState('')
  const [linhas, setLinhas] = useState<LinhaRelatorio[]>([])
  const [carregando, setCarregando] = useState(false)
  const { temPapel } = useAuth()
  const { avisar } = useToast()
  // Quem corrige o status: coordenação, secretaria, administração. Quem exclui um check-in: administração,
  // coordenação e tutor (a regra de verdade é do banco, na função excluir_checkin; aqui só escondemos o botão).
  const podeCorrigir = temPapel('admin', 'coordenacao', 'secretaria')
  const podeApagar = temPapel('admin', 'coordenacao', 'tutor')
  const [acao, setAcao] = useState<null | { tipo: 'editar' | 'apagar'; linha: LinhaRelatorio; status: AttendanceStatus; motivo: string }>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    supabase
      .from('turmas')
      .select('id, nome, horario_inicio, horario_fim_presente, horario_fim_atraso, ativo')
      .order('nome')
      .then(({ data }) => setTurmas((data as Turma[]) ?? []))
  }, [])

  async function buscar() {
    setCarregando(true)
    let query = supabase
      .from('attendance_records')
      .select('id, data, status, horario_checkin, allowed_users(nome), turmas(nome)')
      .gte('data', inicio)
      .lte('data', fim)
      .order('data', { ascending: false })

    if (turmaId) query = query.eq('turma_id', turmaId)

    const { data } = await query
    const linhasFormatadas: LinhaRelatorio[] = (data ?? []).map((registro) => {
      const r = registro as unknown as {
        id: string
        data: string
        status: AttendanceStatus
        horario_checkin: string | null
        allowed_users: { nome: string } | null
        turmas: { nome: string } | null
      }
      return {
        id: r.id,
        data: r.data,
        status: r.status,
        horario_checkin: r.horario_checkin,
        aluno_nome: r.allowed_users?.nome ?? '-',
        turma_nome: r.turmas?.nome ?? '-',
      }
    })
    setLinhas(linhasFormatadas)
    setCarregando(false)
  }

  useEffect(() => {
    buscar()
  }, [])

  async function confirmarAcao(e: React.FormEvent) {
    e.preventDefault()
    if (!acao) return
    setOcupado(true)
    const { error } =
      acao.tipo === 'editar'
        ? await supabase.rpc('corrigir_presenca', { p_registro: acao.linha.id, p_status: acao.status, p_motivo: acao.motivo })
        : await supabase.rpc('excluir_checkin', { p_id: acao.linha.id, p_motivo: acao.motivo })
    setOcupado(false)
    if (error) {
      avisar('erro', traduzirErro(error.message))
      // se o registro já não existe, a lista está desatualizada: atualiza
      if (error.message.includes('not found')) {
        setAcao(null)
        await buscar()
      }
      return
    }
    avisar(
      'ok',
      acao.tipo === 'editar'
        ? `Presença de ${acao.linha.aluno_nome} em ${formatarData(acao.linha.data)} corrigida para ${statusRotulo(acao.status)}. Fica registrada na auditoria, com o motivo.`
        : `Check-in de ${acao.linha.aluno_nome} em ${formatarData(acao.linha.data)} excluído. Uma cópia fica guardada na auditoria, com o motivo.`,
    )
    setAcao(null)
    await buscar()
  }

  const temAcoes = podeCorrigir || podeApagar
  const acoes = (l: LinhaRelatorio) =>
    temAcoes ? (
      <div className="flex flex-wrap justify-end gap-2">
        {podeCorrigir && (
          <button
            type="button"
            onClick={() => setAcao({ tipo: 'editar', linha: l, status: l.status, motivo: '' })}
            className="min-h-11 px-2 text-sm font-bold text-gunmetal-gray underline underline-offset-4"
          >
            Editar
          </button>
        )}
        {podeApagar && (
          <button
            type="button"
            onClick={() => setAcao({ tipo: 'apagar', linha: l, status: l.status, motivo: '' })}
            className="min-h-11 px-2 text-sm font-bold text-red-700 underline underline-offset-4"
          >
            Excluir check-in
          </button>
        )}
      </div>
    ) : null

  // "Buscar aluno" filtra no navegador, sobre o período já carregado.
  const visiveis = useMemo(() => {
    const termo = semAcento(busca.trim())
    return termo ? linhas.filter((l) => semAcento(l.aluno_nome).includes(termo)) : linhas
  }, [linhas, busca])

  const contagem = visiveis.reduce(
    (acc, l) => ({ ...acc, [l.status]: (acc[l.status] ?? 0) + 1 }),
    {} as Record<AttendanceStatus, number>,
  )

  const registro = (l: LinhaRelatorio) => (l.horario_checkin ? horaLocal(l.horario_checkin) : '—')

  // CSV para Excel em português: separador ";" e BOM UTF-8 (acentos corretos).
  function exportarExcel() {
    const cabecalho = ['aluno', 'turma', 'data', 'registro', 'status'].join(';')
    const corpo = visiveis
      .map((l) =>
        [
          celulaCsv(l.aluno_nome),
          celulaCsv(l.turma_nome),
          formatarData(l.data),
          l.horario_checkin ? horaLocal(l.horario_checkin) : '',
          statusRotulo(l.status),
        ].join(';'),
      )
      .join('\n')
    const blob = new Blob(['﻿' + cabecalho + '\n' + corpo], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-presenca-${inicio}-a-${fim}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <CabecalhoAdmin titulo="Relatório de presença" trilha={[{ rotulo: 'Alunos' }, { rotulo: 'Presença' }]} />
        <button
          onClick={exportarExcel}
          disabled={visiveis.length === 0}
          className="min-h-12 rounded-sm bg-mandarin-orange px-6 font-display text-2xl font-bold text-onyx-black transition hover:bg-mandarin-orange-dark disabled:opacity-50"
        >
          Exportar Excel
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          buscar()
        }}
        className="mt-6 grid grid-cols-2 gap-3 border border-gunmetal-gray/25 p-4 lg:grid-cols-[1fr_9.5rem_9.5rem_1.2fr_auto] lg:items-end"
      >
        <label className="col-span-2 min-w-0 text-sm font-bold text-gunmetal-gray lg:col-span-1">
          Turma
          <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)} className={campo}>
            <option value="">Todas</option>
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 text-sm font-bold text-gunmetal-gray">
          De
          <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={campo} />
        </label>
        <label className="min-w-0 text-sm font-bold text-gunmetal-gray">
          Até
          <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className={campo} />
        </label>
        <label className="col-span-2 min-w-0 text-sm font-bold text-gunmetal-gray lg:col-span-1">
          Buscar aluno
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome do aluno"
            className={campo}
          />
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-sm bg-gunmetal-gray px-6 text-sm font-bold text-white transition hover:bg-gunmetal-gray-dark col-span-2 lg:col-span-1"
        >
          Filtrar
        </button>
      </form>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="bg-gunmetal-gray p-5 text-white">
          <p className="text-sm font-bold uppercase tracking-wide">Presentes</p>
          <p className="font-display text-[56px] font-bold leading-none">{contagem.presente ?? 0}</p>
        </div>
        <div className="bg-soft-pink p-5 text-gunmetal-gray">
          <p className="text-sm font-bold uppercase tracking-wide">Atrasos</p>
          <p className="font-display text-[56px] font-bold leading-none">{contagem.atraso ?? 0}</p>
        </div>
        <div className="border-[3px] border-mandarin-orange p-5 text-onyx-black">
          <p className="text-sm font-bold uppercase tracking-wide">Faltas</p>
          <p className="font-display text-[56px] font-bold leading-none">{contagem.falta ?? 0}</p>
        </div>
      </div>

      <Modal
        aberto={acao !== null}
        aoFechar={() => setAcao(null)}
        titulo={acao?.tipo === 'apagar' ? 'Excluir check-in' : 'Corrigir presença'}
      >
        {acao && (
          <form onSubmit={confirmarAcao} className="mt-4 space-y-4">
            <p className="text-sm text-onyx-black">
              <strong>{acao.linha.aluno_nome}</strong> · {acao.linha.turma_nome} · {formatarData(acao.linha.data)} · registro às{' '}
              {acao.linha.horario_checkin ? horaLocal(acao.linha.horario_checkin) : '—'} · hoje: <strong>{statusRotulo(acao.linha.status)}</strong>
            </p>
            {acao.tipo === 'editar' && (
              <label className="block text-sm font-bold text-gunmetal-gray">
                Novo status
                <select value={acao.status} onChange={(e) => setAcao({ ...acao, status: e.target.value as AttendanceStatus })} className={campo}>
                  {(['presente', 'atraso', 'falta'] as AttendanceStatus[]).map((st) => (
                    <option key={st} value={st}>
                      {statusRotulo(st)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block text-sm font-bold text-gunmetal-gray">
              Motivo (obrigatório)
              <input
                required
                value={acao.motivo}
                onChange={(e) => setAcao({ ...acao, motivo: e.target.value })}
                placeholder={acao.tipo === 'editar' ? 'Ex.: o QR Code falhou, mas estava em aula' : 'Ex.: registro duplicado'}
                className={campo}
              />
            </label>
            {acao.tipo === 'apagar' && (
              <p className="border-l-4 border-mandarin-orange bg-soft-pink/60 p-3 text-sm text-onyx-black">
                O check-in sai da lista e das contas de presença. Uma cópia completa fica guardada na auditoria, com o seu nome e o motivo.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={ocupado || !acao.motivo.trim() || (acao.tipo === 'editar' && acao.status === acao.linha.status)}
                className={botaoLaranja}
              >
                {acao.tipo === 'apagar' ? 'Excluir check-in' : 'Salvar correção'}
              </button>
              <button type="button" onClick={() => setAcao(null)} className={botaoLinha}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </Modal>

      <div className="mt-6" aria-live="polite">
        {carregando ? (
          <p className="text-onyx-black">Carregando...</p>
        ) : visiveis.length === 0 ? (
          <p className="border border-gunmetal-gray/25 p-4 text-sm text-onyx-black">
            Nenhum registro no período selecionado.
          </p>
        ) : (
          <>
            {/* Tela larga: tabela */}
            <div className="hidden overflow-x-auto border border-gunmetal-gray/25 md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-soft-pink text-xs uppercase tracking-wide text-gunmetal-gray">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-bold">Aluno</th>
                    <th scope="col" className="px-4 py-3 font-bold">Turma</th>
                    <th scope="col" className="px-4 py-3 font-bold">Data</th>
                    <th scope="col" className="px-4 py-3 font-bold">Registro</th>
                    <th scope="col" className="px-4 py-3 font-bold">Status</th>
                    {temAcoes && (
                      <th scope="col" className="px-4 py-3 text-right font-bold">
                        Ações
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="text-onyx-black">
                  {visiveis.map((l) => (
                    <tr key={l.id} className="border-b border-gunmetal-gray/15">
                      <td className="px-4 py-3 font-bold text-gunmetal-gray">{l.aluno_nome}</td>
                      <td className="px-4 py-3">{l.turma_nome}</td>
                      <td className="px-4 py-3">{formatarData(l.data)}</td>
                      <td className="px-4 py-3">{registro(l)}</td>
                      <td className="px-4 py-3">
                        <StatusSelo status={l.status} />
                      </td>
                      {temAcoes && <td className="px-4 py-1">{acoes(l)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Celular: um cartão por linha */}
            <ul className="space-y-3 md:hidden">
              {visiveis.map((l) => (
                <li key={l.id} className="border border-gunmetal-gray/25 p-4">
                  <p className="font-bold text-gunmetal-gray">{l.aluno_nome}</p>
                  <p className="mt-1 text-sm text-onyx-black">
                    {l.turma_nome} · {formatarData(l.data)} · {registro(l)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <StatusSelo status={l.status} />
                    {acoes(l)}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
