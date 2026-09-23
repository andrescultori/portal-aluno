import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import type { AttendanceRecord, AttendanceStatus } from '../types/database'

interface JanelaResposta {
  janela_aberta: boolean
  turma_nome?: string
  status_atual?: AttendanceStatus | null
  ja_registrado?: boolean
  mensagem?: string
}

const statusLabel: Record<AttendanceStatus, string> = {
  presente: 'Presente',
  atraso: 'Atraso',
  falta: 'Falta',
}

const statusColor: Record<AttendanceStatus, string> = {
  presente: 'bg-green-100 text-green-700',
  atraso: 'bg-amber-100 text-amber-700',
  falta: 'bg-red-100 text-red-700',
}

export default function Presenca() {
  const { perfil } = useAuth()
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
        { body: { acao: 'checkin' } },
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

  return (
    <div className="mx-auto max-w-2xl px-brand-3 py-brand-4">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Registro de Presença</h1>

      <div className="rounded-none border border-slate-200 bg-white p-6">
        {consultando && <p className="text-slate-500">Verificando janela de presença...</p>}

        {!consultando && erro && <p className="text-sm text-red-600">{erro}</p>}

        {!consultando && !erro && janela && !janela.janela_aberta && (
          <p className="text-slate-600">
            {janela.mensagem ?? 'Não há janela de presença aberta agora para a sua turma.'}
          </p>
        )}

        {!consultando && !erro && janela?.janela_aberta && (
          <div>
            <p className="mb-1 text-sm text-slate-500">Turma</p>
            <p className="mb-4 font-medium text-slate-900">{janela.turma_nome}</p>

            {janela.ja_registrado && janela.status_atual ? (
              <div>
                <p className="mb-2 text-sm text-slate-500">Sua presença hoje já foi registrada:</p>
                <span
                  className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${statusColor[janela.status_atual]}`}
                >
                  {statusLabel[janela.status_atual]}
                </span>
              </div>
            ) : (
              <button
                onClick={confirmarPresenca}
                disabled={confirmando}
                className="w-full rounded-lg bg-mandarin-orange px-4 py-2.5 text-lg font-bold text-onyx-black transition hover:bg-mandarin-orange-dark disabled:opacity-60"
              >
                {confirmando ? 'Confirmando...' : 'Confirmar minha presença'}
              </button>
            )}
          </div>
        )}
      </div>

      <h2 className="mb-3 mt-10 text-lg font-medium text-slate-900">Meu histórico</h2>
      <div className="space-y-2">
        {historico.length === 0 && (
          <p className="text-sm text-slate-400">Nenhum registro encontrado ainda.</p>
        )}
        {historico.map((registro) => (
          <div
            key={registro.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5"
          >
            <span className="text-sm text-slate-700">
              {new Date(registro.data + 'T00:00:00').toLocaleDateString('pt-BR')}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${statusColor[registro.status]}`}
            >
              {statusLabel[registro.status]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
