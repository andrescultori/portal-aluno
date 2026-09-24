import { useEffect, useMemo, useState } from 'react'

interface EventoCalendario {
  id: string
  titulo: string
  inicio: string
  fim?: string
  descricao?: string
  link?: string
}

interface ItemGoogleCalendar {
  id: string
  summary?: string
  description?: string
  htmlLink?: string
  start: { date?: string; dateTime?: string }
  end?: { date?: string; dateTime?: string }
}

const eventosMock: EventoCalendario[] = [
  { id: '1', titulo: 'Início do semestre', inicio: '2026-02-02' },
  { id: '2', titulo: 'Semana de provas', inicio: '2026-04-13', fim: '2026-04-17' },
  { id: '3', titulo: 'Recesso acadêmico', inicio: '2026-07-06', fim: '2026-07-17' },
]

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const apiKey = import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY
const calendarId = import.meta.env.VITE_GOOGLE_CALENDAR_ID

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// Data em meia-noite local, ignorando qualquer horário presente na string.
function paraDiaLocal(iso: string): Date {
  const semHora = iso.includes('T') ? iso.slice(0, 10) : iso
  const [ano, mes, dia] = semHora.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

function diaAnterior(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split('-').map(Number)
  const d = new Date(ano, mes - 1, dia)
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function mesmoDia(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function eventoNoDia(evento: EventoCalendario, dia: Date) {
  const inicio = paraDiaLocal(evento.inicio)
  const fim = evento.fim ? paraDiaLocal(evento.fim) : inicio
  const t = dia.getTime()
  return t >= inicio.getTime() && t <= fim.getTime()
}

function mapearEvento(item: ItemGoogleCalendar): EventoCalendario {
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

function formatarData(data: string) {
  const comHora = data.includes('T')
  const date = comHora ? new Date(data) : new Date(data + 'T00:00:00')

  const dataFormatada = date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  if (!comHora) return dataFormatada

  const horaFormatada = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${dataFormatada} às ${horaFormatada}`
}

function formatarMesAno(data: Date) {
  const texto = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export default function Calendario() {
  const [mesAtual, setMesAtual] = useState(() => {
    const hoje = new Date()
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  })
  const [eventos, setEventos] = useState<EventoCalendario[]>(eventosMock)
  const [carregando, setCarregando] = useState(false)
  const [usandoMock, setUsandoMock] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!apiKey || !calendarId) return

    setCarregando(true)
    const proximoMes = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 1)
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId,
    )}/events?key=${apiKey}&timeMin=${mesAtual.toISOString()}&timeMax=${proximoMes.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=250`

    fetch(url)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error?.message ?? `Erro ${res.status} ao consultar o Google Calendar.`)
        }
        return data
      })
      .then((data) => {
        setEventos((data.items ?? []).map(mapearEvento))
        setUsandoMock(false)
        setErro(null)
      })
      .catch((err) => {
        setUsandoMock(true)
        setErro(err instanceof Error ? err.message : 'Falha desconhecida ao consultar o Google Calendar.')
      })
      .finally(() => setCarregando(false))
  }, [mesAtual])

  const celulas = useMemo(() => {
    const ano = mesAtual.getFullYear()
    const mes = mesAtual.getMonth()
    const diasNoMes = new Date(ano, mes + 1, 0).getDate()
    const diaSemanaInicio = new Date(ano, mes, 1).getDay()
    const totalCelulas = Math.ceil((diaSemanaInicio + diasNoMes) / 7) * 7

    return Array.from({ length: totalCelulas }, (_, i) => {
      const numeroDia = i - diaSemanaInicio + 1
      return numeroDia < 1 || numeroDia > diasNoMes ? null : new Date(ano, mes, numeroDia)
    })
  }, [mesAtual])

  function mesAnterior() {
    setMesAtual((atual) => new Date(atual.getFullYear(), atual.getMonth() - 1, 1))
  }

  function proximoMes() {
    setMesAtual((atual) => new Date(atual.getFullYear(), atual.getMonth() + 1, 1))
  }

  function irParaHoje() {
    const hoje = new Date()
    setMesAtual(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  }

  return (
    <div className="mx-auto max-w-5xl px-brand-3 py-brand-4">
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">Calendário Acadêmico</h1>
      {erro && (
        <p className="mb-4 text-sm text-red-600">Erro ao carregar o calendário real: {erro}</p>
      )}
      {usandoMock && !erro && (!apiKey || !calendarId) && (
        <p className="mb-4 text-sm text-amber-600">
          Exibindo dados de exemplo. Configure VITE_GOOGLE_CALENDAR_API_KEY e
          VITE_GOOGLE_CALENDAR_ID para eventos reais.
        </p>
      )}
      {usandoMock && erro && (
        <p className="mb-4 text-sm text-amber-600">Exibindo dados de exemplo enquanto isso.</p>
      )}

      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={mesAnterior}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-mandarin-orange"
        >
          ← Anterior
        </button>
        <div className="text-center">
          <p className="font-medium text-slate-900">{formatarMesAno(mesAtual)}</p>
          <button onClick={irParaHoje} className="text-xs text-mandarin-orange hover:underline">
            Hoje
          </button>
        </div>
        <button
          onClick={proximoMes}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-mandarin-orange"
        >
          Próximo →
        </button>
      </div>

      {carregando && <p className="mb-4 text-sm text-slate-400">Carregando eventos...</p>}

      {/* Grade — telas médias/grandes */}
      <div className="mb-10 hidden md:block">
        <div className="grid grid-cols-7 border-l border-t border-slate-200">
          {DIAS_SEMANA.map((dia) => (
            <div
              key={dia}
              className="border-b border-r border-slate-200 bg-slate-50 p-2 text-center text-xs font-medium text-slate-500"
            >
              {dia}
            </div>
          ))}
          {celulas.map((dia, i) => {
            const eventosDoDia = dia ? eventos.filter((ev) => eventoNoDia(ev, dia)) : []
            const visiveis = eventosDoDia.slice(0, 3)
            const restantes = eventosDoDia.length - visiveis.length

            return (
              <div
                key={i}
                className={`min-h-28 border-b border-r border-slate-200 p-2 ${!dia ? 'bg-slate-50' : ''}`}
              >
                {dia && (
                  <>
                    <p
                      className={`mb-1 inline-flex h-5 w-5 items-center justify-center text-xs font-medium ${
                        mesmoDia(dia, new Date())
                          ? 'rounded-full bg-mandarin-orange text-onyx-black'
                          : 'text-slate-500'
                      }`}
                    >
                      {dia.getDate()}
                    </p>
                    <div className="space-y-1">
                      {visiveis.map((ev) =>
                        ev.link ? (
                          <a
                            key={ev.id}
                            href={ev.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block truncate bg-soft-pink px-1 py-0.5 text-xs text-onyx-black hover:bg-mandarin-orange"
                          >
                            {ev.titulo}
                          </a>
                        ) : (
                          <p key={ev.id} className="truncate bg-soft-pink px-1 py-0.5 text-xs text-onyx-black">
                            {ev.titulo}
                          </p>
                        ),
                      )}
                      {restantes > 0 && <p className="text-xs text-slate-400">+{restantes} mais</p>}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Lista — telas pequenas */}
      <ul className="mb-10 space-y-3 md:hidden">
        {eventos.length === 0 && !carregando && (
          <p className="text-sm text-slate-400">Nenhum evento neste mês.</p>
        )}
        {eventos.map((evento) => {
          const conteudo = (
            <>
              <p className="font-medium text-slate-900">{evento.titulo}</p>
              <p className="text-sm text-slate-500">
                {formatarData(evento.inicio)}
                {evento.fim && evento.fim !== evento.inicio ? ` até ${formatarData(evento.fim)}` : ''}
              </p>
              {evento.descricao && <p className="mt-1 text-sm text-slate-600">{evento.descricao}</p>}
            </>
          )

          return (
            <li key={evento.id}>
              {evento.link ? (
                <a
                  href={evento.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-none border border-slate-200 bg-white p-4 transition hover:border-mandarin-orange"
                >
                  {conteudo}
                  <span className="mt-1 inline-block text-sm text-mandarin-orange">
                    Ver no Google Agenda →
                  </span>
                </a>
              ) : (
                <div className="rounded-none border border-slate-200 bg-white p-4">{conteudo}</div>
              )}
            </li>
          )
        })}
      </ul>

      <div className="rounded-none border border-slate-200 bg-white p-6">
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
