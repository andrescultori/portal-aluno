// Acesso ao Google Calendar (API pública, somente leitura) compartilhado entre
// a página de Calendário e os "Próximos eventos" da Home.

export interface EventoCalendario {
  id: string
  titulo: string
  inicio: string
  fim?: string
  descricao?: string
  link?: string
}

export interface ItemGoogleCalendar {
  id: string
  summary?: string
  description?: string
  htmlLink?: string
  start: { date?: string; dateTime?: string }
  end?: { date?: string; dateTime?: string }
}

export const calendarApiKey = import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY
export const calendarId = import.meta.env.VITE_GOOGLE_CALENDAR_ID

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function diaAnterior(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split('-').map(Number)
  const d = new Date(ano, mes - 1, dia)
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function mapearEvento(item: ItemGoogleCalendar): EventoCalendario {
  const inicio = item.start.date ?? item.start.dateTime ?? ''
  let fim = item.end?.date ?? item.end?.dateTime

  if (item.start.date && item.end?.date) {
    // Eventos de dia inteiro: o "end.date" do Google é exclusivo (o dia
    // seguinte ao último dia real do evento) — corrige pra inclusivo.
    const fimCorrigido = diaAnterior(item.end.date)
    fim = fimCorrigido === inicio ? undefined : fimCorrigido
  }

  return {
    id: item.id,
    titulo: item.summary ?? '(sem título)',
    inicio,
    fim,
    descricao: item.description,
    link: item.htmlLink,
  }
}

// Próximos eventos a partir de agora. Lança erro se a API não estiver
// configurada ou responder com falha; quem chama decide como mostrar.
export async function buscarProximosEventos(limite = 3): Promise<EventoCalendario[]> {
  if (!calendarApiKey || !calendarId) throw new Error('Google Calendar não configurado.')

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
    calendarId,
  )}/events?key=${calendarApiKey}&timeMin=${encodeURIComponent(
    new Date().toISOString(),
  )}&singleEvents=true&orderBy=startTime&maxResults=${limite}`

  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Erro ${res.status} ao consultar o Google Calendar.`)
  }
  return ((data.items ?? []) as ItemGoogleCalendar[]).map(mapearEvento)
}

// Agenda pública de feriados do Brasil mantida pelo próprio Google (leitura com a mesma chave de API).
export const AGENDA_FERIADOS_BR = 'pt-br.brazilian#holiday@group.v.calendar.google.com'

// Eventos de uma agenda entre duas datas (AAAA-MM-DD, inclusivas), no horário de Brasília.
// Lança erro com mensagem legível se a API não estiver configurada ou falhar.
export async function buscarEventosPeriodo(agendaId: string, de: string, ate: string): Promise<EventoCalendario[]> {
  if (!calendarApiKey) throw new Error('Google Agenda não configurado (falta a chave de API).')
  const ateExclusivo = diaSeguinte(ate)
  const url =
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(agendaId)}/events` +
    `?key=${calendarApiKey}&singleEvents=true&orderBy=startTime&maxResults=250` +
    `&timeMin=${encodeURIComponent(`${de}T00:00:00-03:00`)}&timeMax=${encodeURIComponent(`${ateExclusivo}T00:00:00-03:00`)}`
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? `Erro ${res.status} ao consultar o Google Agenda.`)
  return ((data.items ?? []) as ItemGoogleCalendar[]).map(mapearEvento)
}

function diaSeguinte(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split('-').map(Number)
  const d = new Date(Date.UTC(ano, mes - 1, dia + 1))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
