import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { HeroConfig } from '../types/database'

export default function Home() {
  const [hero, setHero] = useState<HeroConfig | null>(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    supabase
      .from('hero_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => setHero((data as HeroConfig) ?? null))
  }, [])

  const imagens = hero?.imagens ?? []

  useEffect(() => {
    if (hero?.modo !== 'carrossel' || imagens.length < 2) return
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % imagens.length),
      (hero.intervalo_segundos ?? 5) * 1000,
    )
    return () => clearInterval(timer)
  }, [hero?.modo, hero?.intervalo_segundos, imagens.length])

  return (
    <div>
      <section className="relative h-[360px] w-full overflow-hidden bg-gunmetal-gray md:h-[440px]">
        {hero?.modo === 'video' && hero.video_url ? (
          <video
            src={hero.video_url}
            className="h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          imagens.map((src, i) => (
            <img
              key={src}
              src={src}
              alt=""
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
                i === index ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="px-brand-3 text-center">
            <h1 className="text-3xl font-bold text-white md:text-5xl">
              Bem-vindo ao Portal do Aluno
            </h1>
            <p className="mt-2 text-white/90">UniMissional</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-brand-3 py-12">
        <p className="text-center text-slate-600">
          Acesse rapidamente o Manual do Aluno, o Google Classroom, o calendário
          acadêmico e registre sua presença em aula.
        </p>
      </section>
    </div>
  )
}
