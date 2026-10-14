import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { buscarProximosEventos, type EventoCalendario } from '../lib/googleCalendar'
import { usePresencaHoje } from '../lib/presencaHoje'
import { hhmm, horaLocal } from '../lib/datas'
import { ArcosConcentricos } from '../components/marca'
import type {
  Aviso,
  ClassroomLink,
  HeroConfig,
  LinkSection,
  ManualDoAluno,
} from '../types/database'

const botaoLaranja =
  'inline-flex min-h-12 items-center justify-center rounded-sm bg-mandarin-orange px-6 font-display text-2xl font-bold text-onyx-black transition hover:bg-mandarin-orange-dark'
const botaoContorno =
  'inline-flex min-h-12 items-center justify-center rounded-sm border-2 border-gunmetal-gray px-6 font-display text-2xl font-bold text-gunmetal-gray transition hover:bg-pure-white'

const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

function diaMes(iso: string): { dia: string; mes: string } {
  const [, m, d] = iso.slice(0, 10).split('-').map(Number)
  return { dia: String(d).padStart(2, '0'), mes: MESES[m - 1] ?? '' }
}

function dataAviso(iso: string) {
  const { dia, mes } = diaMes(iso)
  return `${dia} ${mes} ${iso.slice(0, 4)}`
}

/* ---------- Hero ---------- */

function MidiaHero({ hero }: { hero: HeroConfig | null }) {
  const [indice, setIndice] = useState(0)
  const imagens = hero?.imagens ?? []

  useEffect(() => {
    if (hero?.modo !== 'carrossel' || imagens.length < 2) return
    const timer = setInterval(
      () => setIndice((i) => (i + 1) % imagens.length),
      (hero.intervalo_segundos ?? 5) * 1000,
    )
    return () => clearInterval(timer)
  }, [hero?.modo, hero?.intervalo_segundos, imagens.length])

  const temVideo = hero?.modo === 'video' && !!hero.video_url
  const temImagens = hero?.modo === 'carrossel' && imagens.length > 0

  if (temVideo) {
    return (
      <video
        src={hero!.video_url!}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
      />
    )
  }

  if (temImagens) {
    return (
      <>
        {imagens.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
              i === indice ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}
      </>
    )
  }

  // Sem mídia configurada no Admin: bloco gunmetal com arcos concêntricos.
  return (
    <div className="absolute inset-0 bg-gunmetal-gray">
      <ArcosConcentricos className="absolute bottom-0 right-0 h-full w-auto" />
    </div>
  )
}

function Hero({ nome, hero }: { nome: string; hero: HeroConfig | null }) {
  const primeiroNome = nome.trim().split(/\s+/)[0]

  return (
    <section className="grid lg:grid-cols-2">
      <div className="bg-soft-pink px-4 py-10 sm:px-8 lg:px-12 lg:py-16">
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-gunmetal-gray">
          Portal do Aluno
        </p>
        <h1 className="mt-3 font-display text-[44px] leading-[1.02] text-gunmetal-gray sm:text-6xl lg:text-[72px]">
          Olá, {primeiroNome}. Universidade e missão, juntas.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-onyx-black">
          Confirme sua presença, acompanhe o calendário e encontre tudo o que você precisa para o
          semestre num só lugar.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/presenca" className={botaoLaranja}>
            Confirmar presença
          </Link>
          <Link to="/manual" className={botaoContorno}>
            Manual do Aluno
          </Link>
        </div>
      </div>

      {/* Grade 2x2: mídia ocupa a coluna esquerda inteira; blocos de cor à direita */}
      <div className="grid min-h-64 grid-cols-2 grid-rows-2 lg:min-h-0">
        <div className="relative row-span-2 overflow-hidden bg-gunmetal-gray">
          <MidiaHero hero={hero} />
        </div>
        <div className="bg-mandarin-orange" aria-hidden="true" />
        <div className="border-b border-r border-gunmetal-gray/20 bg-pure-white" aria-hidden="true" />
      </div>
    </section>
  )
}

/* ---------- Cards ---------- */

function CardPresenca({ perfil }: { perfil: NonNullable<ReturnType<typeof useAuth>['perfil']> }) {
  const { carregando, turma, registro } = usePresencaHoje(perfil)

  return (
    <article className="flex flex-col bg-gunmetal-gray p-6 text-white">
      <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-soft-pink">
        Presença de hoje
      </h2>

      {carregando ? (
        <p className="mt-6 text-white/80">Carregando...</p>
      ) : !turma ? (
        <p className="mt-6 text-base leading-relaxed text-white/90">
          Você não está vinculado a uma turma. Fale com a coordenação se isso estiver errado.
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm text-soft-pink">{turma.nome} · início da aula</p>
          <p className="font-display text-[64px] font-bold leading-none text-white">
            {hhmm(turma.horario_inicio)}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/90">
            Presente até {hhmm(turma.horario_fim_presente)}, atraso até{' '}
            {hhmm(turma.horario_fim_atraso)}.
          </p>

          {registro ? (
            <p className="mt-5 flex items-center gap-2 bg-white/12 px-3 py-3 text-base font-bold">
              <Check size={20} aria-hidden="true" />
              {registro.status === 'presente'
                ? 'Presente'
                : registro.status === 'atraso'
                  ? 'Atraso'
                  : 'Falta'}{' '}
              às {horaLocal(registro.horario_checkin)}
            </p>
          ) : (
            <Link to="/presenca" className={`${botaoLaranja} mt-5`}>
              Confirmar presença
            </Link>
          )}
        </>
      )}

      <Link
        to="/presenca"
        className="mt-auto inline-flex min-h-11 items-center pt-4 text-sm font-bold text-white underline underline-offset-4 hover:text-soft-pink"
      >
        Ver meu histórico
      </Link>
    </article>
  )
}

function CardEventos() {
  const [eventos, setEventos] = useState<EventoCalendario[] | null>(null)
  const [indisponivel, setIndisponivel] = useState(false)

  useEffect(() => {
    buscarProximosEventos(3)
      .then(setEventos)
      .catch(() => setIndisponivel(true))
  }, [])

  return (
    <article className="flex flex-col border border-gunmetal-gray/25 bg-pure-white p-6">
      <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-gunmetal-gray">
        Próximos eventos
      </h2>

      {indisponivel ? (
        <p className="mt-5 text-sm leading-relaxed text-onyx-black">
          Os eventos não estão disponíveis agora. Veja o calendário completo.
        </p>
      ) : eventos === null ? (
        <p className="mt-5 text-sm text-onyx-black">Carregando...</p>
      ) : eventos.length === 0 ? (
        <p className="mt-5 text-sm text-onyx-black">Nenhum evento próximo.</p>
      ) : (
        <ul className="mt-5 space-y-4">
          {eventos.map((ev) => {
            const { dia, mes } = diaMes(ev.inicio)
            const comHora = ev.inicio.includes('T')
            return (
              <li key={ev.id} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-14 w-14 shrink-0 flex-col items-center justify-center bg-soft-pink text-gunmetal-gray"
                >
                  <span className="font-display text-2xl font-bold leading-none">{dia}</span>
                  <span className="text-[11px] font-bold leading-tight">{mes}</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-bold text-gunmetal-gray">
                    {ev.titulo}
                  </span>
                  <span className="block text-sm text-onyx-black">
                    {comHora ? horaLocal(ev.inicio) : 'Dia inteiro'}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <Link
        to="/calendario"
        className="mt-auto inline-flex min-h-11 items-center pt-4 text-sm font-bold text-gunmetal-gray underline underline-offset-4 hover:text-mandarin-orange-dark"
      >
        Calendário completo
      </Link>
    </article>
  )
}

function CardAvisos() {
  const [avisos, setAvisos] = useState<Aviso[] | null>(null)

  useEffect(() => {
    supabase
      .from('avisos')
      .select('*')
      .eq('ativo', true)
      .order('publicado_em', { ascending: false })
      .limit(3)
      // Antes de a migration de avisos ser executada a tabela não existe:
      // cai em lista vazia ("Nenhum aviso") em vez de quebrar a Home.
      .then(({ data, error }) => setAvisos(error ? [] : ((data as Aviso[]) ?? [])))
  }, [])

  return (
    <article className="flex flex-col bg-soft-pink p-6">
      <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-gunmetal-gray">
        Avisos e comunicados
      </h2>

      {avisos === null ? (
        <p className="mt-5 text-sm text-onyx-black">Carregando...</p>
      ) : avisos.length === 0 ? (
        <p className="mt-5 text-sm text-onyx-black">Nenhum aviso no momento.</p>
      ) : (
        <ul className="mt-5 space-y-5">
          {avisos.map((a) => (
            <li key={a.id}>
              <p className="text-xs font-bold uppercase tracking-wide text-gunmetal-gray">
                {dataAviso(a.publicado_em)}
              </p>
              <p className="mt-1 text-[15px] font-bold text-gunmetal-gray">{a.titulo}</p>
              {a.resumo && <p className="mt-1 text-sm leading-relaxed text-onyx-black">{a.resumo}</p>}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

/* ---------- Manual e Acesso rápido ---------- */

function FaixaManual() {
  const [manual, setManual] = useState<ManualDoAluno | null>(null)

  useEffect(() => {
    supabase
      .from('manual_do_aluno')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => setManual((data as ManualDoAluno) ?? null))
  }, [])

  return (
    <section className="border-t-4 border-gunmetal-gray bg-pure-white py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-3xl">
          <h2 className="font-display text-4xl text-gunmetal-gray">Manual do Aluno</h2>
          <p className="mt-2 text-base leading-relaxed text-onyx-black">
            {manual?.resumo ??
              'Normas, calendário e orientações para o seu semestre na UniMissional.'}
          </p>
        </div>
        {manual?.pdf_url ? (
          <a
            href={manual.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-sm bg-gunmetal-gray px-6 text-base font-bold text-white transition hover:bg-gunmetal-gray-dark"
          >
            Abrir PDF
          </a>
        ) : (
          <Link
            to="/manual"
            className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-sm bg-gunmetal-gray px-6 text-base font-bold text-white transition hover:bg-gunmetal-gray-dark"
          >
            Ver o Manual
          </Link>
        )}
      </div>
    </section>
  )
}

function AcessoRapido() {
  const [classroom, setClassroom] = useState<ClassroomLink[]>([])
  const [secoes, setSecoes] = useState<LinkSection[]>([])

  useEffect(() => {
    supabase
      .from('classroom_links')
      .select('*')
      .order('ordem')
      .then(({ data }) => setClassroom((data as ClassroomLink[]) ?? []))
    supabase
      .from('link_sections')
      .select('*')
      .order('ordem')
      .then(({ data }) => setSecoes((data as LinkSection[]) ?? []))
  }, [])

  const cartao =
    'flex min-h-20 flex-col justify-center border border-gunmetal-gray/25 bg-pure-white p-4 transition hover:border-mandarin-orange hover:bg-soft-pink/40'

  if (classroom.length === 0 && secoes.length === 0) return null

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10">
      <h2 className="font-display text-4xl text-gunmetal-gray">Acesso rápido</h2>
      <div className="mt-5 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {classroom.map((c) => (
          <a key={c.id} href={c.url} target="_blank" rel="noopener noreferrer" className={cartao}>
            <span className="text-base font-bold text-gunmetal-gray">{c.nome_turma}</span>
            <span className="text-sm text-onyx-black">Google Classroom</span>
          </a>
        ))}
        {secoes.map((s) => (
          <Link key={s.id} to={`/links/${s.id}`} className={cartao}>
            <span className="text-base font-bold text-gunmetal-gray">{s.titulo}</span>
            <span className="text-sm text-onyx-black">Links úteis</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

/* ---------- Página ---------- */

export default function Home() {
  const { perfil } = useAuth()
  const [hero, setHero] = useState<HeroConfig | null>(null)

  useEffect(() => {
    supabase
      .from('hero_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => setHero((data as HeroConfig) ?? null))
  }, [])

  if (!perfil) return null

  return (
    <div>
      <Hero nome={perfil.nome} hero={hero} />

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-10 lg:grid-cols-3">
        <CardPresenca perfil={perfil} />
        <CardEventos />
        <CardAvisos />
      </section>

      <FaixaManual />
      <AcessoRapido />
    </div>
  )
}
