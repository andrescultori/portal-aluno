import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { AGENDA_FERIADOS_BR, buscarEventosPeriodo, calendarId } from '../../lib/googleCalendar'
import { montarSugestoes, NOMES_DIA, diaDaSemana, ehDiaUtil, type EventoAgenda, type OrigemSugestao, type Sugestao } from '../../lib/diasSemAula'
import type { Semestre } from '../../types/alunos'

const db = () => supabase.schema('alunos')

interface DiaSemAula {
  data: string
  motivo: string | null
}

const campo =
  'mt-1 block min-h-11 w-full min-w-0 rounded-sm border border-gunmetal-gray/40 bg-pure-white px-2 text-sm font-normal text-onyx-black'
const botaoLaranja =
  'min-h-11 rounded-sm bg-mandarin-orange px-4 text-sm font-bold text-onyx-black transition hover:bg-mandarin-orange-dark disabled:opacity-50'
const botaoLinha =
  'min-h-11 rounded-sm border-2 border-gunmetal-gray px-4 text-sm font-bold text-gunmetal-gray transition hover:bg-soft-pink/50 disabled:opacity-50'

const rotuloOrigem: Record<OrigemSugestao, string> = {
  feriado: 'Feriado nacional',
  escola: 'Agenda UniMissional',
  comemorativa: 'Data comemorativa',
  emenda: 'Emenda sugerida',
}

function formatar(iso: string) {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a} (${NOMES_DIA[diaDaSemana(iso)]})`
}

// Dias sem aula do semestre: lista, volta a ter aula, adiciona na mão e sugere a partir do Google Agenda
// (feriados nacionais, agenda da UniMissional e emendas). A presença só conta os dias com aula.
export default function DiasSemAula({ semestre, aoAlterar }: { semestre: Semestre; aoAlterar: () => void }) {
  const [dias, setDias] = useState<DiaSemAula[]>([])
  const [carregando, setCarregando] = useState(true)
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [sugestoes, setSugestoes] = useState<Sugestao[] | null>(null)
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [avisosFonte, setAvisosFonte] = useState<string[]>([])
  const [manual, setManual] = useState({ data: '', motivo: '' })

  const carregar = useCallback(async () => {
    const { data, error } = await db()
      .from('dias_letivos')
      .select('data, motivo')
      .eq('semestre_id', semestre.id)
      .eq('aula', false)
      .order('data')
    if (error) setMensagem({ tipo: 'erro', texto: `Não foi possível carregar os dias sem aula: ${error.message}` })
    setDias((data as DiaSemAula[]) ?? [])
    setCarregando(false)
  }, [semestre.id])

  useEffect(() => {
    setSugestoes(null)
    setMensagem(null)
    carregar()
  }, [carregar])

  const datasSemAula = useMemo(() => new Set(dias.map((d) => d.data)), [dias])
  const temDatas = !!semestre.inicio && !!semestre.fim

  async function gravar(linhas: { data: string; motivo: string }[], texto: string) {
    setOcupado(true)
    setMensagem(null)
    const { error } = await db()
      .from('dias_letivos')
      .upsert(
        linhas.map((l) => ({ semestre_id: semestre.id, data: l.data, aula: false, motivo: l.motivo || null })),
        { onConflict: 'semestre_id,data' },
      )
    setOcupado(false)
    if (error) {
      setMensagem({ tipo: 'erro', texto: `Não foi possível salvar: ${error.message}` })
      return false
    }
    setMensagem({ tipo: 'ok', texto })
    await carregar()
    aoAlterar()
    return true
  }

  async function buscarNoGoogle() {
    if (!semestre.inicio || !semestre.fim) return
    setOcupado(true)
    setMensagem(null)
    setAvisosFonte([])
    const [fer, esc] = await Promise.allSettled([
      buscarEventosPeriodo(AGENDA_FERIADOS_BR, semestre.inicio, semestre.fim),
      calendarId ? buscarEventosPeriodo(calendarId, semestre.inicio, semestre.fim) : Promise.resolve([]),
    ])
    setOcupado(false)
    const avisos: string[] = []
    if (fer.status === 'rejected') avisos.push(`Feriados nacionais: ${fer.reason instanceof Error ? fer.reason.message : 'falha ao consultar'}`)
    if (esc.status === 'rejected') avisos.push(`Agenda da UniMissional: ${esc.reason instanceof Error ? esc.reason.message : 'falha ao consultar'}`)
    setAvisosFonte(avisos)
    if (fer.status === 'rejected' && esc.status === 'rejected') {
      setSugestoes(null)
      return
    }
    const aEvento = (e: { titulo: string; inicio: string; fim?: string; descricao?: string }): EventoAgenda => e
    const lista = montarSugestoes({
      feriados: fer.status === 'fulfilled' ? fer.value.map(aEvento) : [],
      escola: esc.status === 'fulfilled' ? esc.value.map(aEvento) : [],
      inicio: semestre.inicio,
      fim: semestre.fim,
      jaSemAula: datasSemAula,
    })
    setSugestoes(lista)
    setMarcadas(new Set(lista.filter((s) => s.marcado).map((s) => s.data)))
  }

  function alternar(data: string) {
    setMarcadas((atual) => {
      const novo = new Set(atual)
      if (novo.has(data)) novo.delete(data)
      else novo.add(data)
      return novo
    })
  }

  async function aplicarSugestoes() {
    if (!sugestoes) return
    const linhas = sugestoes.filter((s) => marcadas.has(s.data)).map((s) => ({ data: s.data, motivo: s.titulo }))
    if (linhas.length === 0) return
    if (await gravar(linhas, `${linhas.length} ${linhas.length === 1 ? 'dia marcado' : 'dias marcados'} como sem aula.`)) setSugestoes(null)
  }

  async function voltarAAula(data: string) {
    setOcupado(true)
    setMensagem(null)
    const { error } = await db().from('dias_letivos').update({ aula: true, motivo: null }).eq('semestre_id', semestre.id).eq('data', data)
    setOcupado(false)
    if (error) {
      setMensagem({ tipo: 'erro', texto: `Não foi possível desfazer: ${error.message}` })
      return
    }
    setMensagem({ tipo: 'ok', texto: `${formatar(data)} voltou a ter aula.` })
    await carregar()
    aoAlterar()
  }

  async function adicionarManual(e: React.FormEvent) {
    e.preventDefault()
    if (!manual.data) return
    if (manual.data < (semestre.inicio ?? '') || manual.data > (semestre.fim ?? '')) {
      setMensagem({ tipo: 'erro', texto: 'A data precisa estar dentro do semestre.' })
      return
    }
    if (await gravar([{ data: manual.data, motivo: manual.motivo.trim() }], `${formatar(manual.data)} marcado como sem aula.`)) {
      setManual({ data: '', motivo: '' })
    }
  }

  return (
    <section className="mt-6" aria-labelledby="dias-sem-aula">
      <h3 id="dias-sem-aula" className="font-display text-2xl text-gunmetal-gray">
        Dias sem aula
      </h3>
      <p className="mt-1 text-sm text-onyx-black">
        Feriados, recessos e emendas. A presença só conta os dias com aula, então marque aqui o que não vai ter aula.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={buscarNoGoogle} disabled={ocupado || !temDatas} className={botaoLaranja}>
          Buscar no Google Agenda
        </button>
      </div>
      {!temDatas && <p className="mt-2 text-xs text-muted-purple">Salve as datas de início e fim do semestre primeiro.</p>}

      {avisosFonte.length > 0 && (
        <ul role="status" className="mt-3 space-y-1 border-l-4 border-mandarin-orange bg-soft-pink/60 p-3 text-sm text-onyx-black">
          {avisosFonte.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}

      {sugestoes && (
        <div className="mt-3 border border-gunmetal-gray/25 p-3">
          {sugestoes.length === 0 ? (
            <p className="text-sm text-onyx-black">Nenhuma data nova para sugerir neste semestre.</p>
          ) : (
            <>
              <p className="text-sm text-onyx-black">
                Marque o que não terá aula. Feriados nacionais já vêm marcados; datas comemorativas e emendas ficam por sua conta.
              </p>
              <ul className="mt-2 divide-y divide-gunmetal-gray/15">
                {sugestoes.map((s) => (
                  <li key={s.data}>
                    <label className="flex min-h-11 items-center gap-3 py-1 text-sm text-onyx-black">
                      <input
                        type="checkbox"
                        checked={marcadas.has(s.data)}
                        onChange={() => alternar(s.data)}
                        className="h-5 w-5 shrink-0 accent-mandarin-orange"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-bold text-gunmetal-gray">{formatar(s.data)}</span> · {s.titulo}
                        <span className="ml-2 rounded-sm border border-gunmetal-gray/30 px-1.5 py-0.5 text-xs text-muted-purple">{rotuloOrigem[s.origem]}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {sugestoes.length > 0 && (
              <button type="button" onClick={aplicarSugestoes} disabled={ocupado || marcadas.size === 0} className={botaoLaranja}>
                Marcar {marcadas.size} {marcadas.size === 1 ? 'dia' : 'dias'} como sem aula
              </button>
            )}
            <button type="button" onClick={() => setSugestoes(null)} className={botaoLinha}>
              Fechar
            </button>
          </div>
        </div>
      )}

      <form onSubmit={adicionarManual} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
        <label className="text-sm font-bold text-gunmetal-gray">
          Data
          <input
            type="date"
            required
            value={manual.data}
            min={semestre.inicio ?? undefined}
            max={semestre.fim ?? undefined}
            onChange={(e) => setManual({ ...manual, data: e.target.value })}
            className={campo}
          />
        </label>
        <label className="col-span-2 text-sm font-bold text-gunmetal-gray sm:col-span-1">
          Motivo
          <input value={manual.motivo} onChange={(e) => setManual({ ...manual, motivo: e.target.value })} placeholder="Ex.: Semana de oração" className={campo} />
        </label>
        <button type="submit" disabled={ocupado || !manual.data || !temDatas} className={`${botaoLinha} col-span-2 sm:col-span-1`}>
          Adicionar dia
        </button>
      </form>
      {manual.data && !ehDiaUtil(manual.data) && (
        <p className="mt-1 text-xs text-muted-purple">Sábados e domingos já não contam como dias de aula.</p>
      )}

      <div aria-live="polite" className="mt-3">
        {mensagem && (
          <p
            role={mensagem.tipo === 'erro' ? 'alert' : 'status'}
            className={`border-l-4 p-3 text-sm text-onyx-black ${
              mensagem.tipo === 'erro' ? 'border-mandarin-orange bg-soft-pink/60' : 'border-gunmetal-gray bg-neutral-tint'
            }`}
          >
            {mensagem.texto}
          </p>
        )}
      </div>

      {carregando ? (
        <p className="mt-3 text-sm text-onyx-black">Carregando...</p>
      ) : dias.length === 0 ? (
        <p className="mt-3 border border-gunmetal-gray/25 p-3 text-sm text-onyx-black">Nenhum dia sem aula marcado neste semestre.</p>
      ) : (
        <ul className="mt-3 divide-y divide-gunmetal-gray/15 border border-gunmetal-gray/25">
          {dias.map((d) => (
            <li key={d.data} className="flex items-center justify-between gap-3 px-3 py-1 text-sm">
              <span className="min-w-0">
                <span className="font-bold text-gunmetal-gray">{formatar(d.data)}</span>
                {d.motivo && <span className="text-onyx-black"> · {d.motivo}</span>}
              </span>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => voltarAAula(d.data)}
                className="min-h-11 shrink-0 px-2 text-sm font-bold text-gunmetal-gray underline underline-offset-4"
              >
                Voltar a ter aula
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
