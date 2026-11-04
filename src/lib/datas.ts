const FUSO = 'America/Sao_Paulo'

// Espelha JANELA_ANTECIPADA_MIN da Edge Function checkin-presenca. Só serve
// pra exibir o início da janela na tela; quem decide é sempre o servidor.
export const JANELA_ANTECIPADA_MIN = 5

export function hojeISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

// '14:00:00' -> '14:00'
export function hhmm(hora: string): string {
  return hora.slice(0, 5)
}

export function somarMinutos(hora: string, delta: number): string {
  const [h, m] = hora.split(':').map(Number)
  const total = (((h * 60 + m + delta) % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function dataPorExtenso(data: Date = new Date()): string {
  return data.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: FUSO,
  })
}

export function horaLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: FUSO,
  })
}

// '2026-11-30T14:00:00Z' -> '30/11, 11:00' (fuso de São Paulo)
export function dataHoraLocal(iso: string): string {
  const d = new Date(iso)
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: FUSO })
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO })
  return `${dia}, ${hora}`
}

// <input type="datetime-local"> <-> instante UTC, sempre no horário de São Paulo
// (o Brasil não tem horário de verão desde 2019: o fuso é fixo, -03:00).
export function isoParaInput(iso: string | null): string {
  if (!iso) return ''
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const m = Object.fromEntries(partes.map((p) => [p.type, p.value]))
  return `${m.year}-${m.month}-${m.day}T${m.hour}:${m.minute}`
}

export function inputParaIso(valor: string): string | null {
  if (!valor) return null
  const d = new Date(`${valor}:00-03:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
