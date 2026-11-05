// Lógica pura (sem rede nem tela) para sugerir "dias sem aula" a partir de eventos do Google Agenda:
// feriados nacionais, eventos da agenda da UniMissional e "emendas" (ponte) de feriados na terça ou na quinta.

export interface EventoAgenda {
  titulo: string
  inicio: string // AAAA-MM-DD ou data-hora ISO
  fim?: string // AAAA-MM-DD inclusivo (já corrigido para eventos de dia inteiro)
  descricao?: string
}

export type OrigemSugestao = 'feriado' | 'escola' | 'comemorativa' | 'emenda'

export interface Sugestao {
  data: string // AAAA-MM-DD
  titulo: string
  origem: OrigemSugestao
  marcado: boolean // já vem marcada na tela
}

const UM_DIA = 24 * 60 * 60 * 1000

function paraUtc(iso: string): number {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(a, m - 1, d)
}
function deUtc(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function somarDias(iso: string, n: number): string {
  return deUtc(paraUtc(iso) + n * UM_DIA)
}

// 0 = domingo ... 6 = sábado
export function diaDaSemana(iso: string): number {
  return new Date(paraUtc(iso)).getUTCDay()
}
export const ehDiaUtil = (iso: string) => {
  const d = diaDaSemana(iso)
  return d >= 1 && d <= 5
}

export const NOMES_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

// Todos os dias do evento (inclusive), limitados a [de, ate].
export function diasDoEvento(e: EventoAgenda, de: string, ate: string): string[] {
  const ini = e.inicio.slice(0, 10)
  const fim = (e.fim ?? ini).slice(0, 10)
  const dias: string[] = []
  for (let ms = paraUtc(ini); ms <= paraUtc(fim) && dias.length < 120; ms += UM_DIA) {
    const iso = deUtc(ms)
    if (iso >= de && iso <= ate) dias.push(iso)
  }
  return dias
}

// Eventos da agenda da escola que, pelo nome, indicam que não há aula.
const PALAVRAS_SEM_AULA = /(feriado|recesso|sem aula|n[aã]o haver[aá] aula|ponto facultativo|emenda)/i

// A agenda de feriados do Google mistura feriados de verdade e datas comemorativas (Dia dos Pais...).
// Pela descrição ("Feriado nacional"/"Feriado" vs "Observância"), só os feriados já vêm marcados.
export function ehFeriadoDeVerdade(e: EventoAgenda): boolean {
  const desc = e.descricao ?? ''
  if (/observ[aâ]ncia/i.test(desc)) return false
  return /feriado|holiday/i.test(desc) || /(^|\W)(natal|ano novo|tiradentes|independ[eê]ncia|proclama[cç][aã]o|aparecida|finados|trabalho|sexta-feira santa|corpus christi|carnaval)(\W|$)/i.test(e.titulo)
}

export function montarSugestoes(args: {
  feriados: EventoAgenda[]
  escola: EventoAgenda[]
  inicio: string
  fim: string
  // datas que já estão marcadas como sem aula (não sugerir de novo)
  jaSemAula: Set<string>
}): Sugestao[] {
  const { feriados, escola, inicio, fim, jaSemAula } = args
  const mapa = new Map<string, Sugestao>()
  const por = { feriado: 0, escola: 1, comemorativa: 2, emenda: 3 }
  const por_data = (s: Sugestao) => {
    const atual = mapa.get(s.data)
    // se a mesma data aparece em mais de uma origem, vale a mais "forte"
    if (!atual || por[s.origem] < por[atual.origem]) mapa.set(s.data, s)
  }

  const feriadosReais: string[] = []
  for (const e of feriados) {
    const real = ehFeriadoDeVerdade(e)
    for (const data of diasDoEvento(e, inicio, fim)) {
      if (!ehDiaUtil(data)) continue
      if (real) feriadosReais.push(data)
      por_data({ data, titulo: e.titulo, origem: real ? 'feriado' : 'comemorativa', marcado: real })
    }
  }
  for (const e of escola) {
    const indica = PALAVRAS_SEM_AULA.test(e.titulo)
    for (const data of diasDoEvento(e, inicio, fim)) {
      if (!ehDiaUtil(data)) continue
      por_data({ data, titulo: e.titulo, origem: 'escola', marcado: indica })
    }
  }
  // Emenda: feriado na terça -> segunda; na quinta -> sexta. Só sugerida (nunca marcada sozinha).
  for (const data of feriadosReais) {
    const dow = diaDaSemana(data)
    const ponte = dow === 2 ? somarDias(data, -1) : dow === 4 ? somarDias(data, 1) : null
    if (ponte && ponte >= inicio && ponte <= fim && !mapa.has(ponte)) {
      por_data({ data: ponte, titulo: `Emenda do feriado de ${data.slice(8, 10)}/${data.slice(5, 7)}`, origem: 'emenda', marcado: false })
    }
  }

  return [...mapa.values()].filter((s) => !jaSemAula.has(s.data)).sort((a, b) => a.data.localeCompare(b.data))
}
