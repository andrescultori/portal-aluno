import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { AttendanceStatus, Turma } from '../../types/database'

interface LinhaRelatorio {
  id: string
  data: string
  status: AttendanceStatus
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

export default function AdminRelatorio() {
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [turmaId, setTurmaId] = useState('')
  const [inicio, setInicio] = useState(trintaDiasAtras())
  const [fim, setFim] = useState(hoje())
  const [linhas, setLinhas] = useState<LinhaRelatorio[]>([])
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    supabase
      .from('turmas')
      .select('*')
      .order('nome')
      .then(({ data }) => setTurmas((data as Turma[]) ?? []))
  }, [])

  async function buscar() {
    setCarregando(true)
    let query = supabase
      .from('attendance_records')
      .select('id, data, status, allowed_users(nome), turmas(nome)')
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
        allowed_users: { nome: string } | null
        turmas: { nome: string } | null
      }
      return {
        id: r.id,
        data: r.data,
        status: r.status,
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

  const contagem = linhas.reduce(
    (acc, l) => ({ ...acc, [l.status]: (acc[l.status] ?? 0) + 1 }),
    {} as Record<AttendanceStatus, number>,
  )

  function exportarCsv() {
    const cabecalho = 'data,aluno,turma,status\n'
    const corpo = linhas
      .map((l) => `${l.data},"${l.aluno_nome}","${l.turma_nome}",${l.status}`)
      .join('\n')
    const blob = new Blob([cabecalho + corpo], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-presenca-${inicio}-a-${fim}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Relatório de presença</h1>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="text-sm text-slate-500">
          Turma
          <select
            value={turmaId}
            onChange={(e) => setTurmaId(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-500">
          De
          <input
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm text-slate-500">
          Até
          <input
            type="date"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          onClick={buscar}
          className="rounded-md bg-gunmetal-gray px-4 py-2 text-sm font-bold text-white hover:bg-gunmetal-gray-dark"
        >
          Filtrar
        </button>
        <button
          onClick={exportarCsv}
          disabled={linhas.length === 0}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
        >
          Exportar CSV
        </button>
      </div>

      <div className="mb-4 flex gap-4 text-sm">
        <span className="rounded-full bg-green-100 px-3 py-1 text-green-700">
          Presente: {contagem.presente ?? 0}
        </span>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
          Atraso: {contagem.atraso ?? 0}
        </span>
        <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">
          Falta: {contagem.falta ?? 0}
        </span>
      </div>

      {carregando ? (
        <p className="text-slate-500">Carregando...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2">Data</th>
                <th className="px-4 py-2">Aluno</th>
                <th className="px-4 py-2">Turma</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{new Date(l.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-2">{l.aluno_nome}</td>
                  <td className="px-4 py-2">{l.turma_nome}</td>
                  <td className="px-4 py-2 capitalize">{l.status}</td>
                </tr>
              ))}
              {linhas.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-slate-400" colSpan={4}>
                    Nenhum registro no período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
