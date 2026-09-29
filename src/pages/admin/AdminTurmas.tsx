import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabaseClient'
import type { Turma } from '../../types/database'

const vazio = {
  nome: '',
  horario_inicio: '14:00',
  horario_fim_presente: '14:05',
  horario_fim_atraso: '14:15',
}

export default function AdminTurmas() {
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [form, setForm] = useState(vazio)
  const [carregando, setCarregando] = useState(true)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [edicao, setEdicao] = useState(vazio)
  const [qrTurma, setQrTurma] = useState<Turma | null>(null)
  const [qrToken, setQrToken] = useState<string | null>(null)
  const [qrCarregando, setQrCarregando] = useState(false)
  const [qrErro, setQrErro] = useState<string | null>(null)

  async function carregar() {
    setCarregando(true)
    const { data } = await supabase
      .from('turmas')
      .select('id, nome, horario_inicio, horario_fim_presente, horario_fim_atraso, ativo')
      .order('nome')
    setTurmas((data as Turma[]) ?? [])
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('turmas').insert({ ...form, ativo: true })
    setForm(vazio)
    carregar()
  }

  async function alternarAtivo(turma: Turma) {
    await supabase.from('turmas').update({ ativo: !turma.ativo }).eq('id', turma.id)
    carregar()
  }

  async function remover(id: string) {
    await supabase.from('turmas').delete().eq('id', id)
    carregar()
  }

  function iniciarEdicao(turma: Turma) {
    setEditandoId(turma.id)
    setEdicao({
      nome: turma.nome,
      horario_inicio: turma.horario_inicio,
      horario_fim_presente: turma.horario_fim_presente,
      horario_fim_atraso: turma.horario_fim_atraso,
    })
  }

  function cancelarEdicao() {
    setEditandoId(null)
  }

  async function salvarEdicao(id: string) {
    await supabase.from('turmas').update(edicao).eq('id', id)
    setEditandoId(null)
    carregar()
  }

  async function abrirQrCode(turma: Turma) {
    setQrTurma(turma)
    setQrToken(null)
    setQrErro(null)
    setQrCarregando(true)
    const { data, error } = await supabase.rpc('get_turma_qr_token', { p_turma_id: turma.id })
    if (error) {
      setQrErro(`Erro ao carregar QR Code: ${error.message}`)
    } else {
      setQrToken(data as string)
    }
    setQrCarregando(false)
  }

  function fecharQrCode() {
    setQrTurma(null)
    setQrToken(null)
    setQrErro(null)
  }

  async function regenerarQrCode() {
    if (!qrTurma) return
    if (
      !confirm(
        `Gerar um novo QR Code para "${qrTurma.nome}"? O QR Code impresso atualmente deixa de funcionar.`,
      )
    )
      return
    setQrCarregando(true)
    setQrErro(null)
    const { data, error } = await supabase.rpc('regenerate_turma_qr_token', {
      p_turma_id: qrTurma.id,
    })
    if (error) {
      setQrErro(`Erro ao gerar novo QR Code: ${error.message}`)
    } else {
      setQrToken(data as string)
    }
    setQrCarregando(false)
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Turmas</h1>

      <form
        onSubmit={criar}
        className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-5"
      >
        <input
          required
          placeholder="Nome da turma"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
        />
        <label className="text-sm text-slate-500">
          Início
          <input
            type="time"
            value={form.horario_inicio}
            onChange={(e) => setForm({ ...form, horario_inicio: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm text-slate-500">
          Fim (presente)
          <input
            type="time"
            value={form.horario_fim_presente}
            onChange={(e) => setForm({ ...form, horario_fim_presente: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm text-slate-500">
          Fim (atraso)
          <input
            type="time"
            value={form.horario_fim_atraso}
            onChange={(e) => setForm({ ...form, horario_fim_atraso: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-gunmetal-gray px-4 py-2 text-sm font-bold text-white hover:bg-gunmetal-gray-dark md:col-span-5"
        >
          Criar turma
        </button>
      </form>

      {carregando ? (
        <p className="text-slate-500">Carregando...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2">Nome</th>
                <th className="px-4 py-2">Início</th>
                <th className="px-4 py-2">Presente até</th>
                <th className="px-4 py-2">Atraso até</th>
                <th className="px-4 py-2">Ativa</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {turmas.map((t) =>
                editandoId === t.id ? (
                  <tr key={t.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">
                      <input
                        value={edicao.nome}
                        onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="time"
                        value={edicao.horario_inicio}
                        onChange={(e) => setEdicao({ ...edicao, horario_inicio: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="time"
                        value={edicao.horario_fim_presente}
                        onChange={(e) =>
                          setEdicao({ ...edicao, horario_fim_presente: e.target.value })
                        }
                        className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="time"
                        value={edicao.horario_fim_atraso}
                        onChange={(e) =>
                          setEdicao({ ...edicao, horario_fim_atraso: e.target.value })
                        }
                        className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => alternarAtivo(t)}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          t.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {t.ativo ? 'Ativa' : 'Inativa'}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => salvarEdicao(t.id)}
                          className="text-xs font-medium text-gunmetal-gray hover:underline"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={cancelarEdicao}
                          className="text-xs font-medium text-slate-500 hover:underline"
                        >
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={t.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{t.nome}</td>
                    <td className="px-4 py-2">{t.horario_inicio}</td>
                    <td className="px-4 py-2">{t.horario_fim_presente}</td>
                    <td className="px-4 py-2">{t.horario_fim_atraso}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => alternarAtivo(t)}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          t.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {t.ativo ? 'Ativa' : 'Inativa'}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => abrirQrCode(t)}
                          className="text-xs font-medium text-slate-600 hover:underline"
                        >
                          QR Code
                        </button>
                        <button
                          onClick={() => iniciarEdicao(t)}
                          className="text-xs font-medium text-slate-600 hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => remover(t.id)}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {qrTurma && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="font-medium text-slate-900">QR Code — {qrTurma.nome}</h2>
              <p className="mt-1 text-sm text-slate-500">
                Imprima e afixe na sala. Quem escanear precisa estar logado no portal — a
                presença só é confirmada se o QR bater com a turma do aluno.
              </p>
            </div>
            <button
              onClick={fecharQrCode}
              className="shrink-0 text-xs font-medium text-slate-500 hover:underline"
            >
              Fechar
            </button>
          </div>

          {qrErro && <p className="mb-3 text-sm text-red-600">{qrErro}</p>}

          {qrCarregando && !qrToken ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : (
            qrToken && (
              <div>
                <div id="qr-print-area" className="flex flex-col items-center gap-3 py-2">
                  <QRCodeSVG
                    value={`${window.location.origin}/presenca?token=${qrToken}`}
                    size={220}
                  />
                  <p className="text-center font-medium text-slate-900">{qrTurma.nome}</p>
                </div>

                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="rounded-md bg-gunmetal-gray px-4 py-2 text-sm font-bold text-white hover:bg-gunmetal-gray-dark"
                  >
                    Imprimir
                  </button>
                  <button
                    onClick={regenerarQrCode}
                    disabled={qrCarregando}
                    className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60"
                  >
                    Gerar novo QR Code
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #qr-print-area, #qr-print-area * { visibility: visible; }
          #qr-print-area { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        }
      `}</style>
    </div>
  )
}
