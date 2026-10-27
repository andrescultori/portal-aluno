import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabaseClient'
import { hhmm } from '../../lib/datas'
import type { Turma } from '../../types/database'

const campoHora =
  'mt-1 block min-h-11 w-full min-w-0 rounded-sm border border-gunmetal-gray/25 bg-pure-white px-2 text-sm font-normal text-onyx-black'

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
  const [erroLista, setErroLista] = useState<string | null>(null)

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

  async function remover(turma: Turma) {
    if (!confirm(`Remover a turma "${turma.nome}"?`)) return
    setErroLista(null)
    const { data, error } = await supabase.from('turmas').delete().eq('id', turma.id).select('id')
    if (error) {
      // 23503 = violação de chave estrangeira: ainda há alunos ou presenças ligados à turma.
      setErroLista(
        error.code === '23503'
          ? `Não dá para remover "${turma.nome}": ainda há alunos vinculados a ela ou registros de presença. Desative a turma (botão "Ativa") ou mova os alunos para outra turma antes.`
          : `Não foi possível remover "${turma.nome}": ${error.message}`,
      )
    } else if (!data || data.length === 0) {
      setErroLista(`Não foi possível remover "${turma.nome}": a exclusão não foi permitida.`)
    }
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
      <h1 className="mb-6 font-display text-[40px] leading-none text-gunmetal-gray">Turmas</h1>

      <form
        onSubmit={criar}
        className="mb-6 grid grid-cols-3 gap-3 rounded-none border border-gunmetal-gray/25 bg-white p-4 md:grid-cols-5 md:p-5"
      >
        <input
          required
          placeholder="Nome da turma"
          aria-label="Nome da turma"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          className="col-span-3 min-h-11 min-w-0 rounded-sm border border-gunmetal-gray/25 px-3 text-sm md:col-span-2"
        />
        <label className="min-w-0 text-sm font-bold text-gunmetal-gray">
          Início
          <input
            type="time"
            value={form.horario_inicio}
            onChange={(e) => setForm({ ...form, horario_inicio: e.target.value })}
            className={campoHora}
          />
        </label>
        <label className="min-w-0 text-sm font-bold text-gunmetal-gray">
          Presente até
          <input
            type="time"
            value={form.horario_fim_presente}
            onChange={(e) => setForm({ ...form, horario_fim_presente: e.target.value })}
            className={campoHora}
          />
        </label>
        <label className="min-w-0 text-sm font-bold text-gunmetal-gray">
          Atraso até
          <input
            type="time"
            value={form.horario_fim_atraso}
            onChange={(e) => setForm({ ...form, horario_fim_atraso: e.target.value })}
            className={campoHora}
          />
        </label>
        <button
          type="submit"
          className="col-span-3 min-h-11 rounded-sm bg-gunmetal-gray px-4 text-sm font-bold text-white hover:bg-gunmetal-gray-dark md:col-span-5"
        >
          Criar turma
        </button>
      </form>

      {erroLista && (
        <p
          role="alert"
          className="mb-4 border-l-4 border-mandarin-orange bg-soft-pink p-4 text-sm text-onyx-black"
        >
          {erroLista}
        </p>
      )}

      {carregando ? (
        <p className="text-onyx-black">Carregando...</p>
      ) : (
        <div className="hidden overflow-x-auto rounded-none border border-gunmetal-gray/25 bg-white md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-tint text-onyx-black">
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
                  <tr key={t.id} className="border-t border-gunmetal-gray/25">
                    <td className="px-4 py-2">
                      <input
                        value={edicao.nome}
                        onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })}
                        className="w-full rounded-sm border border-gunmetal-gray/25 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="time"
                        value={edicao.horario_inicio}
                        onChange={(e) => setEdicao({ ...edicao, horario_inicio: e.target.value })}
                        className="w-full rounded-sm border border-gunmetal-gray/25 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="time"
                        value={edicao.horario_fim_presente}
                        onChange={(e) =>
                          setEdicao({ ...edicao, horario_fim_presente: e.target.value })
                        }
                        className="w-full rounded-sm border border-gunmetal-gray/25 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="time"
                        value={edicao.horario_fim_atraso}
                        onChange={(e) =>
                          setEdicao({ ...edicao, horario_fim_atraso: e.target.value })
                        }
                        className="w-full rounded-sm border border-gunmetal-gray/25 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => alternarAtivo(t)}
                        className={`rounded-sm px-2 py-0.5 text-xs font-medium ${
                          t.ativo ? 'bg-green-100 text-green-700' : 'bg-neutral-tint text-onyx-black'
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
                          className="text-xs font-medium text-onyx-black hover:underline"
                        >
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={t.id} className="border-t border-gunmetal-gray/25">
                    <td className="px-4 py-2">{t.nome}</td>
                    <td className="px-4 py-2">{hhmm(t.horario_inicio)}</td>
                    <td className="px-4 py-2">{hhmm(t.horario_fim_presente)}</td>
                    <td className="px-4 py-2">{hhmm(t.horario_fim_atraso)}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => alternarAtivo(t)}
                        className={`rounded-sm px-2 py-0.5 text-xs font-medium ${
                          t.ativo ? 'bg-green-100 text-green-700' : 'bg-neutral-tint text-onyx-black'
                        }`}
                      >
                        {t.ativo ? 'Ativa' : 'Inativa'}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => abrirQrCode(t)}
                          className="text-xs font-medium text-onyx-black hover:underline"
                        >
                          QR Code
                        </button>
                        <button
                          onClick={() => iniciarEdicao(t)}
                          className="text-xs font-medium text-onyx-black hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => remover(t)}
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

      {/* Celular: um cartão por turma */}
      {!carregando && (
        <ul className="space-y-3 md:hidden">
          {turmas.map((t) => (
            <li key={t.id} className="border border-gunmetal-gray/25 bg-white p-4">
              {editandoId === t.id ? (
                <div className="grid grid-cols-3 gap-3">
                  <input
                    aria-label="Nome da turma"
                    value={edicao.nome}
                    onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })}
                    className="col-span-3 min-h-11 min-w-0 rounded-sm border border-gunmetal-gray/25 px-3 text-sm"
                  />
                  <label className="min-w-0 text-xs font-bold text-gunmetal-gray">
                    Início
                    <input
                      type="time"
                      value={edicao.horario_inicio}
                      onChange={(e) => setEdicao({ ...edicao, horario_inicio: e.target.value })}
                      className={campoHora}
                    />
                  </label>
                  <label className="min-w-0 text-xs font-bold text-gunmetal-gray">
                    Presente até
                    <input
                      type="time"
                      value={edicao.horario_fim_presente}
                      onChange={(e) =>
                        setEdicao({ ...edicao, horario_fim_presente: e.target.value })
                      }
                      className={campoHora}
                    />
                  </label>
                  <label className="min-w-0 text-xs font-bold text-gunmetal-gray">
                    Atraso até
                    <input
                      type="time"
                      value={edicao.horario_fim_atraso}
                      onChange={(e) =>
                        setEdicao({ ...edicao, horario_fim_atraso: e.target.value })
                      }
                      className={campoHora}
                    />
                  </label>
                  <div className="col-span-3 flex gap-2">
                    <button
                      onClick={() => salvarEdicao(t.id)}
                      className="min-h-11 flex-1 rounded-sm bg-gunmetal-gray text-sm font-bold text-white"
                    >
                      Salvar
                    </button>
                    <button
                      onClick={cancelarEdicao}
                      className="min-h-11 flex-1 rounded-sm border-2 border-gunmetal-gray text-sm font-bold text-gunmetal-gray"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words font-bold text-gunmetal-gray">{t.nome}</p>
                    <button
                      onClick={() => alternarAtivo(t)}
                      className={`shrink-0 rounded-sm px-2 py-0.5 text-xs font-bold ${
                        t.ativo ? 'bg-gunmetal-gray text-white' : 'bg-neutral-tint text-onyx-black'
                      }`}
                    >
                      {t.ativo ? 'Ativa' : 'Inativa'}
                    </button>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-sm text-onyx-black">
                    <div>
                      <dt className="text-xs font-bold text-gunmetal-gray">Início</dt>
                      <dd>{hhmm(t.horario_inicio)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-gunmetal-gray">Presente até</dt>
                      <dd>{hhmm(t.horario_fim_presente)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-gunmetal-gray">Atraso até</dt>
                      <dd>{hhmm(t.horario_fim_atraso)}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-gunmetal-gray/15 pt-3">
                    <button
                      onClick={() => abrirQrCode(t)}
                      className="min-h-11 rounded-sm border-2 border-gunmetal-gray px-4 text-sm font-bold text-gunmetal-gray"
                    >
                      QR Code
                    </button>
                    <button
                      onClick={() => iniciarEdicao(t)}
                      className="min-h-11 rounded-sm px-3 text-sm font-bold text-gunmetal-gray underline underline-offset-4"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => remover(t)}
                      className="min-h-11 rounded-sm px-3 text-sm font-bold text-red-700 underline underline-offset-4"
                    >
                      Remover
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {qrTurma && (
        <div className="mt-6 rounded-none border border-gunmetal-gray/25 bg-white p-6">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="font-medium text-gunmetal-gray">QR Code — {qrTurma.nome}</h2>
              <p className="mt-1 text-sm text-onyx-black">
                Imprima e afixe na sala. Quem escanear precisa estar logado no portal — a
                presença só é confirmada se o QR bater com a turma do aluno.
              </p>
            </div>
            <button
              onClick={fecharQrCode}
              className="shrink-0 text-xs font-medium text-onyx-black hover:underline"
            >
              Fechar
            </button>
          </div>

          {qrErro && <p className="mb-3 text-sm text-red-600">{qrErro}</p>}

          {qrCarregando && !qrToken ? (
            <p className="text-sm text-onyx-black">Carregando...</p>
          ) : (
            qrToken && (
              <div>
                <div id="qr-print-area" className="flex flex-col items-center gap-3 py-2">
                  <QRCodeSVG
                    value={`${window.location.origin}/presenca?token=${qrToken}`}
                    size={220}
                  />
                  <p className="text-center font-medium text-gunmetal-gray">{qrTurma.nome}</p>
                </div>

                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="rounded-sm bg-gunmetal-gray px-4 py-2 text-sm font-bold text-white hover:bg-gunmetal-gray-dark"
                  >
                    Imprimir
                  </button>
                  <button
                    onClick={regenerarQrCode}
                    disabled={qrCarregando}
                    className="rounded-sm bg-neutral-tint px-4 py-2 text-sm font-medium text-onyx-black hover:bg-soft-pink disabled:opacity-60"
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
