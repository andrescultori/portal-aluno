// Edge Function: checkin-presenca
// Centraliza a lógica de horário/status de presença no servidor.
// O client nunca escreve direto em attendance_records — só chama esta function.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const TIMEZONE = 'America/Sao_Paulo'
const JANELA_ANTECIPADA_MIN = 5

type Status = 'presente' | 'atraso' | 'falta'

interface Turma {
  id: string
  nome: string
  horario_inicio: string
  horario_fim_presente: string
  horario_fim_atraso: string
  ativo: boolean
}

interface AllowedUser {
  id: string
  nome: string
  email: string
  papel: string
  turma_id: string | null
  ativo: boolean
}

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function agoraNoFuso(): { hhmm: string; dataISO: string; minutos: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())

  const mapa = Object.fromEntries(partes.map((p) => [p.type, p.value]))
  const dataISO = `${mapa.year}-${mapa.month}-${mapa.day}`
  const hhmm = `${mapa.hour}:${mapa.minute}`
  const minutos = Number(mapa.hour) * 60 + Number(mapa.minute)
  return { hhmm, dataISO, minutos }
}

function paraMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

function calcularJanela(turma: Turma, minutosAgora: number) {
  const inicioJanela = paraMinutos(turma.horario_inicio) - JANELA_ANTECIPADA_MIN
  const fimPresente = paraMinutos(turma.horario_fim_presente)
  const fimAtraso = paraMinutos(turma.horario_fim_atraso)

  if (minutosAgora < inicioJanela || minutosAgora > fimAtraso) {
    return { aberta: false as const }
  }

  const status: Status = minutosAgora <= fimPresente ? 'presente' : 'atraso'
  return { aberta: true as const, status }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(origin) })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ mensagem: 'Não autenticado.' }), {
        status: 401,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user?.email) {
      return new Response(JSON.stringify({ mensagem: 'Sessão inválida.' }), {
        status: 401,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      })
    }

    const { data: aluno } = await adminClient
      .from('allowed_users')
      .select('*')
      .eq('email', userData.user.email)
      .eq('ativo', true)
      .maybeSingle<AllowedUser>()

    if (!aluno) {
      return new Response(JSON.stringify({ mensagem: 'Usuário não autorizado.' }), {
        status: 403,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      })
    }

    if (!aluno.turma_id) {
      return new Response(
        JSON.stringify({ janela_aberta: false, mensagem: 'Você não está vinculado a nenhuma turma.' }),
        { headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } },
      )
    }

    const { data: turma } = await adminClient
      .from('turmas')
      .select('*')
      .eq('id', aluno.turma_id)
      .eq('ativo', true)
      .maybeSingle<Turma>()

    if (!turma) {
      return new Response(
        JSON.stringify({ janela_aberta: false, mensagem: 'Turma não encontrada ou inativa.' }),
        { headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } },
      )
    }

    const { dataISO, minutos } = agoraNoFuso()
    const janela = calcularJanela(turma, minutos)

    const { data: registroExistente } = await adminClient
      .from('attendance_records')
      .select('status')
      .eq('aluno_id', aluno.id)
      .eq('turma_id', turma.id)
      .eq('data', dataISO)
      .maybeSingle<{ status: Status }>()

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const acao = body?.acao ?? 'consultar'

    if (registroExistente) {
      return new Response(
        JSON.stringify({
          janela_aberta: janela.aberta,
          turma_nome: turma.nome,
          ja_registrado: true,
          status_atual: registroExistente.status,
        }),
        { headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } },
      )
    }

    if (!janela.aberta) {
      return new Response(
        JSON.stringify({
          janela_aberta: false,
          turma_nome: turma.nome,
          mensagem: 'Não há janela de presença aberta agora para a sua turma.',
        }),
        { headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } },
      )
    }

    if (acao === 'consultar') {
      return new Response(
        JSON.stringify({
          janela_aberta: true,
          turma_nome: turma.nome,
          ja_registrado: false,
        }),
        { headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } },
      )
    }

    const { data: novoRegistro, error: insertError } = await adminClient
      .from('attendance_records')
      .insert({
        aluno_id: aluno.id,
        turma_id: turma.id,
        data: dataISO,
        horario_checkin: new Date().toISOString(),
        status: janela.status,
      })
      .select('status')
      .single<{ status: Status }>()

    if (insertError) {
      return new Response(JSON.stringify({ mensagem: 'Erro ao registrar presença.' }), {
        status: 500,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        janela_aberta: true,
        turma_nome: turma.nome,
        ja_registrado: true,
        status_atual: novoRegistro.status,
      }),
      { headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } },
    )
  } catch {
    return new Response(JSON.stringify({ mensagem: 'Erro interno.' }), {
      status: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }
})
