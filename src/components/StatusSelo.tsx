import type { AttendanceStatus } from '../types/database'

const rotulo: Record<AttendanceStatus, string> = {
  presente: 'Presente',
  atraso: 'Atraso',
  falta: 'Falta',
}

// Presente = gunmetal cheio; Atraso = rosa; Falta = branco com borda laranja.
// Sempre com texto, nunca só cor.
const estilo: Record<AttendanceStatus, string> = {
  presente: 'bg-gunmetal-gray text-white border-gunmetal-gray',
  atraso: 'bg-soft-pink text-gunmetal-gray border-soft-pink',
  falta: 'bg-pure-white text-onyx-black border-mandarin-orange',
}

export function statusRotulo(status: AttendanceStatus) {
  return rotulo[status]
}

export default function StatusSelo({ status }: { status: AttendanceStatus }) {
  return (
    <span
      className={`inline-block rounded-sm border-2 px-3 py-0.5 text-xs font-bold uppercase tracking-wide ${estilo[status]}`}
    >
      {rotulo[status]}
    </span>
  )
}
