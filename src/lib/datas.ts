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
