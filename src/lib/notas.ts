// Leitura de notas digitadas à mão (aceita vírgula ou ponto) com as mesmas regras das colunas do banco.

export type LeituraNota = { ok: true; valor: number | null } | { ok: false; erro: string }

// "" = sem nota (null). Fora do intervalo ou com casas decimais demais = erro (nunca arredonda em silêncio).
export function lerNota(texto: string, min: number, max: number, casas: number): LeituraNota {
  const t = texto.trim().replace(',', '.')
  if (t === '') return { ok: true, valor: null }
  if (!/^\d+(\.\d+)?$/.test(t)) return { ok: false, erro: 'Digite só números (ex.: 8,5).' }
  const decimais = t.includes('.') ? t.split('.')[1].length : 0
  if (decimais > casas) return { ok: false, erro: casas === 1 ? 'No máximo 1 casa decimal.' : `No máximo ${casas} casas decimais.` }
  const n = Number(t)
  if (n < min || n > max) return { ok: false, erro: `Use um valor de ${fmtNota(min)} a ${fmtNota(max)}.` }
  return { ok: true, valor: n }
}

export function fmtNota(n: number | null | undefined, casasMax = 2): string {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casasMax })
}

// Valor do banco -> texto do campo (vírgula decimal, sem zeros sobrando).
export function textoDoCampo(n: number | null | undefined): string {
  return n === null || n === undefined ? '' : String(n).replace('.', ',')
}

// "Trabalho escrito" -> "trabalho_escrito" (código de um componente novo do projeto).
export function codigoDeNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}
