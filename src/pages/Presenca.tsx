import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Check } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { usePresencaHoje } from '../lib/presencaHoje'
import {
  JANELA_ANTECIPADA_MIN,
  dataPorExtenso,
  hhmm,
  hojeISO,
  horaLocal,
  somarMinutos,
} from '../lib/datas'
import StatusSelo, { statusRotulo } from '../components/StatusSelo'
import type { AttendanceRecord, AttendanceStatus } from '../types/database'

interface JanelaResposta {
  janela_aberta: boolean
  turma_nome?: string
  status_atual?: AttendanceStatus | null
  ja_registrado?: boolean
  qr_invalido?: boolean
  mensagem?: string
}

export default function Presenca() {
  const { perfil } = useAuth()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [consultando, setConsultando] = useState(true)
  const [confirmando, setConfirmando] = useState(false)
  const [janela, setJanela] = useState<JanelaResposta | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [historico, setHistorico] = useState<AttendanceRecord[]>([])

  async function consultarJanela() {
    setConsultando(true)
    setErro(null)
    try {
      const { data, error } = await supabase.functions.invoke<JanelaResposta>(
        'checkin-presenca',
        { body: { acao: 'consultar' } },
      )
      if (error) throw error
      setJanela(data ?? null)
    } catch {
      setErro(
        'Não foi possível consultar a janela de presença agora. Verifique a configuração do Supabase.',
      )
    } finally {
      setConsultando(false)
    }
  }

  async function carregarHistorico() {
    if (!perfil) return
    const { data } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('aluno_id', perfil.id)
      .order('data', { ascending: false })
      .limit(20)
    setHistorico((data as AttendanceRecord[]) ?? [])
  }

  useEffect(() => {
    consultarJanela()
    carregarHistorico()
  }, [])

  async function confirmarPresenca() {
    setConfirmando(true)
    setErro(null)
    try {
      const { data, error } = await supabase.functions.invoke<JanelaResposta>(
        'checkin-presenca',
        { body: { acao: 'checkin', token } },
      )
      if (error) throw error
      setJanela(data ?? null)
      await carregarHistorico()
    } catch {
      setErro('Não foi possível registrar sua presença. Tente novamente.')
    } finally {
      setConfirmando(false)
    }
  }

  const { turma } = usePresencaHoje(perfil)
  const extenso = dataPorExtenso()
  const hoje = extenso.charAt(0).toUpperCase() + extenso.slice(1)
  const registroHoje = historico.find((r) => r.data === hojeISO())

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6">
      <p className="text-sm font-bold text-gunmetal-gray">{hoje}</p>
      <h1 className="mt-1 font-display text-[40px] leading-none text-gunmetal-gray">
        Presença de hoje
      </h1>

      {turma && (
        <section className="mt-5 bg-soft-pink p-5" aria-label="Horário da aula">
          <p className="text-sm text-onyx-black">{turma.nome} · início da aula</p>
          <p className="font-display text-[56px] font-bold leading-none text-gunmetal-gray">
            {hhmm(turma.horario_inicio)}
          </p>
          <table className="mt-4 w-full border-collapse text-left text-sm">
            <caption className="sr-only">Janelas de presença</caption>
            <thead>
              <tr className="border-b border-gunmetal-gray/30 text-xs uppercase tracking-wide text-gunmetal-gray">
                <th scope="col" className="py-2 pr-2 font-bold">
                  Situação
                </th>
                <th scope="col" className="py-2 font-bold">
                  Horário
                </th>
              </tr>
            </thead>
            <tbody className="text-onyx-black">
              <tr className="border-b border-gunmetal-gray/15">
                <th scope="row" className="py-2 pr-2 font-bold">
                  Presente
                </th>
                <td className="py-2">
                  {somarMinutos(hhmm(turma.horario_inicio), -JANELA_ANTECIPADA_MIN)} até{' '}
                  {hhmm(turma.horario_fim_presente)}
                </td>
              </tr>
              <tr className="border-b border-gunmetal-gray/15">
                <th scope="row" className="py-2 pr-2 font-bold">
                  Atraso
                </th>
                <td className="py-2">
                  {hhmm(turma.horario_fim_presente)} até {hhmm(turma.horario_fim_atraso)}
                </td>
              </tr>
              <tr>
                <th scope="row" className="py-2 pr-2 font-bold">
                  Falta
                </th>
                <td className="py-2">Depois de {hhmm(turma.horario_fim_atraso)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      <div className="mt-5" aria-live="polite">
        {consultando && <p className="text-onyx-black">Verificando janela de presença...</p>}

        {!consultando && erro && (
          <p role="alert" className="border-l-4 border-mandarin-orange bg-soft-pink px-3 py-2 text-sm">
            {erro}
          </p>
        )}

        {!consultando && !erro && janela && !janela.janela_aberta && (
          <p className="border border-gunmetal-gray/25 p-4 text-base text-onyx-black">
            {janela.mensagem ?? 'Não há janela de presença aberta agora para a sua turma.'}
          </p>
        )}

        {!consultando && !erro && janela?.janela_aberta && (
          <div>
            {janela.ja_registrado && janela.status_atual ? (
              <div className="bg-gunmetal-gray p-6 text-white">
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 items-center justify-center rounded-sm bg-mandarin-orange text-onyx-black"
                >
                  <Check size={30} strokeWidth={3} />
                </span>
                <p className="mt-3 font-display text-[40px] font-bold leading-none">
                  {statusRotulo(janela.status_atual)}
                </p>
                <p className="mt-2 text-base">
                  {registroHoje
                    ? `Registrado às ${horaLocal(registroHoje.horario_checkin)}`
                    : 'Sua presença de hoje já foi registrada.'}
                </p>
              </div>
            ) : token ? (
              <div>
                {janela.qr_invalido && (
                  <p
                    role="alert"
                    className="mb-3 border-l-4 border-mandarin-orange bg-soft-pink px-3 py-2 text-sm text-onyx-black"
                  >
                    {janela.mensagem}
                  </p>
                )}
                <button
                  onClick={confirmarPresenca}
                  disabled={confirmando}
                  className="h-[72px] w-full rounded-sm bg-mandarin-orange font-display text-[32px] font-bold text-onyx-black transition hover:bg-mandarin-orange-dark disabled:opacity-60"
                >
                  {confirmando ? 'Confirmando...' : 'Confirmar presença'}
                </button>
                <p className="mt-3 text-center text-sm text-onyx-black">
                  Ao confirmar, o horário é registrado pelo servidor.
                </p>
              </div>
            ) : (
              <p className="border-l-4 border-mandarin-orange bg-soft-pink px-3 py-3 text-base text-onyx-black">
                Para confirmar sua presença, escaneie o QR Code afixado na sala de aula da sua
                turma.
              </p>
            )}
          </div>
        )}
      </div>

      <h2 className="mb-3 mt-10 font-display text-[32px] leading-none text-gunmetal-gray">
        Meu histórico
      </h2>
      <div className="border-t border-gunmetal-gray/25">
        {historico.length === 0 && (
          <p className="py-3 text-sm text-onyx-black">Nenhum registro encontrado ainda.</p>
        )}
        {historico.map((registro) => (
          <div
            key={registro.id}
            className="flex items-center justify-between border-b border-gunmetal-gray/25 py-3"
          >
            <span className="text-sm text-onyx-black">
              {new Date(registro.data + 'T00:00:00').toLocaleDateString('pt-BR')}
            </span>
            <StatusSelo status={registro.status} />
          </div>
        ))}
      </div>
    </div>
  )
}
