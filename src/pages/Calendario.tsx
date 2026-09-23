import { useEffect, useState } from 'react'

interface EventoCalendario {
  id: string
  titulo: string
  inicio: string
  fim?: string
  descricao?: string
}

const eventosMock: EventoCalendario[] = [
  { id: '1', titulo: 'Início do semestre', inicio: '2026-02-02' },
  { id: '2', titulo: 'Semana de provas', inicio: '2026-04-13', fim: '2026-04-17' },
  { id: '3', titulo: 'Recesso acadêmico', inicio: '2026-07-06', fim: '2026-07-17' },
]

const apiKey = import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY
const calendarId = import.meta.env.VITE_GOOGLE_CALENDAR_ID

function formatarData(data: string) {
  return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export default function Calendario() {
  const [eventos, setEventos] = useState<EventoCalendario[]>(eventosMock)
  const [usandoMock, setUsandoMock] = useState(true)

  useEffect(() => {
    if (!apiKey || !calendarId) return

    const timeMin = new Date().toISOString()
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId,
    )}/events?key=${apiKey}&timeMin=${timeMin}&singleEvents=true&orderBy=startTime&maxResults=20`

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (!data.items) return
        const items: EventoCalendario[] = data.items.map((item: {
          id: string
          summary?: string
          description?: string
          start: { date?: string; dateTime?: string }
          end?: { date?: string; dateTime?: string }
        }) => ({
          id: item.id,
          titulo: item.summary ?? '(sem título)',
          inicio: item.start.date ?? item.start.dateTime ?? '',
          fim: item.end?.date ?? item.end?.dateTime,
          descricao: item.description,
        }))
        setEventos(items)
        setUsandoMock(false)
      })
      .catch(() => setUsandoMock(true))
  }, [])

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">Calendário Acadêmico</h1>
      {usandoMock && (
        <p className="mb-6 text-sm text-amber-600">
          Exibindo dados de exemplo. Configure VITE_GOOGLE_CALENDAR_API_KEY e
          VITE_GOOGLE_CALENDAR_ID para eventos reais.
        </p>
      )}

      <ul className="mb-10 space-y-3">
        {eventos.map((evento) => (
          <li
            key={evento.id}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <p className="font-medium text-slate-900">{evento.titulo}</p>
            <p className="text-sm text-slate-500">
              {formatarData(evento.inicio)}
              {evento.fim && evento.fim !== evento.inicio ? ` até ${formatarData(evento.fim)}` : ''}
            </p>
            {evento.descricao && (
              <p className="mt-1 text-sm text-slate-600">{evento.descricao}</p>
            )}
          </li>
        ))}
      </ul>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-2 text-lg font-medium text-slate-900">
          Como adicionar este calendário no celular
        </h2>
        <ol className="list-inside list-decimal space-y-1 text-sm text-slate-600">
          <li>Abra o app Google Agenda no seu celular.</li>
          <li>Toque no ícone "+" e depois em "Usar URL".</li>
          <li>Cole o link do calendário público da UniMissional.</li>
          <li>Toque em "Adicionar" — os eventos aparecerão automaticamente.</li>
        </ol>
      </div>
    </div>
  )
}
