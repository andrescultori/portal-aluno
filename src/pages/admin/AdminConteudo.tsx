import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type {
  ClassroomLink,
  HeroConfig,
  InfoPage,
  LinkSection,
  LinkSectionItem,
  ManualDoAluno,
} from '../../types/database'

type Aba = 'hero' | 'manual' | 'classroom' | 'links' | 'paginas'

const abas: { id: Aba; label: string }[] = [
  { id: 'hero', label: 'Hero (início)' },
  { id: 'manual', label: 'Manual do Aluno' },
  { id: 'classroom', label: 'Google Classroom' },
  { id: 'links', label: 'Seções de links' },
  { id: 'paginas', label: 'Páginas gerais' },
]

export default function AdminConteudo() {
  const [aba, setAba] = useState<Aba>('hero')

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Conteúdo do site</h1>

      <div className="mb-6 flex gap-2 overflow-x-auto border-b border-slate-200">
        {abas.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`whitespace-nowrap px-3 py-2 text-sm font-medium ${
              aba === a.id
                ? 'border-b-2 border-mandarin-orange text-onyx-black'
                : 'text-slate-500'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {aba === 'hero' && <HeroForm />}
      {aba === 'manual' && <ManualForm />}
      {aba === 'classroom' && <ClassroomForm />}
      {aba === 'links' && <LinksForm />}
      {aba === 'paginas' && <PaginasForm />}
    </div>
  )
}

function HeroForm() {
  const [config, setConfig] = useState<HeroConfig | null>(null)
  const [imagensTexto, setImagensTexto] = useState('')

  useEffect(() => {
    supabase
      .from('hero_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        const cfg = data as HeroConfig | null
        setConfig(cfg ?? { id: 1, modo: 'carrossel', video_url: null, imagens: [], intervalo_segundos: 5 })
        setImagensTexto((cfg?.imagens ?? []).join('\n'))
      })
  }, [])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!config) return
    const imagens = imagensTexto.split('\n').map((l) => l.trim()).filter(Boolean)
    await supabase.from('hero_config').upsert({ ...config, id: 1, imagens })
  }

  if (!config) return <p className="text-slate-500">Carregando...</p>

  return (
    <form onSubmit={salvar} className="max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <label className="block text-sm font-medium text-slate-700">
        Modo
        <select
          value={config.modo}
          onChange={(e) => setConfig({ ...config, modo: e.target.value as HeroConfig['modo'] })}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="carrossel">Carrossel de imagens</option>
          <option value="video">Vídeo</option>
        </select>
      </label>

      {config.modo === 'video' ? (
        <label className="block text-sm font-medium text-slate-700">
          URL do vídeo
          <input
            value={config.video_url ?? ''}
            onChange={(e) => setConfig({ ...config, video_url: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      ) : (
        <>
          <label className="block text-sm font-medium text-slate-700">
            URLs das imagens (uma por linha)
            <textarea
              value={imagensTexto}
              onChange={(e) => setImagensTexto(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Intervalo entre imagens (segundos)
            <input
              type="number"
              min={2}
              value={config.intervalo_segundos}
              onChange={(e) => setConfig({ ...config, intervalo_segundos: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </>
      )}

      <button type="submit" className="rounded-lg bg-mandarin-orange px-4 py-2 text-lg font-bold text-onyx-black hover:bg-mandarin-orange-dark">
        Salvar
      </button>
    </form>
  )
}

function ManualForm() {
  const [manual, setManual] = useState<ManualDoAluno | null>(null)

  useEffect(() => {
    supabase
      .from('manual_do_aluno')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => setManual((data as ManualDoAluno) ?? { id: 1, pdf_url: null, resumo: '' }))
  }, [])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!manual) return
    await supabase.from('manual_do_aluno').upsert({ ...manual, id: 1 })
  }

  if (!manual) return <p className="text-slate-500">Carregando...</p>

  return (
    <form onSubmit={salvar} className="max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <label className="block text-sm font-medium text-slate-700">
        URL do PDF
        <input
          value={manual.pdf_url ?? ''}
          onChange={(e) => setManual({ ...manual, pdf_url: e.target.value })}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="https://.../manual.pdf"
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Resumo
        <textarea
          value={manual.resumo ?? ''}
          onChange={(e) => setManual({ ...manual, resumo: e.target.value })}
          rows={6}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <button type="submit" className="rounded-lg bg-mandarin-orange px-4 py-2 text-lg font-bold text-onyx-black hover:bg-mandarin-orange-dark">
        Salvar
      </button>
    </form>
  )
}

function ClassroomForm() {
  const [links, setLinks] = useState<ClassroomLink[]>([])

  async function carregar() {
    const { data } = await supabase.from('classroom_links').select('*').order('ordem')
    setLinks((data as ClassroomLink[]) ?? [])
  }

  useEffect(() => {
    carregar()
  }, [])

  async function salvar(link: ClassroomLink) {
    await supabase.from('classroom_links').upsert(link)
    carregar()
  }

  return (
    <div className="max-w-xl space-y-4">
      {links.map((link, i) => (
        <div key={link.id} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <p className="text-sm font-medium text-slate-700">Turma {i + 1}</p>
          <input
            value={link.nome_turma}
            onChange={(e) =>
              setLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, nome_turma: e.target.value } : l)))
            }
            placeholder="Nome da turma"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={link.url}
            onChange={(e) =>
              setLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, url: e.target.value } : l)))
            }
            placeholder="URL do Classroom"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={() => salvar(link)}
            className="rounded-lg bg-mandarin-orange px-4 py-2 text-lg font-bold text-onyx-black hover:bg-mandarin-orange-dark"
          >
            Salvar
          </button>
        </div>
      ))}
    </div>
  )
}

function LinksForm() {
  const [sections, setSections] = useState<LinkSection[]>([])
  const [items, setItems] = useState<LinkSectionItem[]>([])
  const [novoItem, setNovoItem] = useState<Record<string, { nome: string; url: string }>>({})

  async function carregar() {
    const [{ data: s }, { data: i }] = await Promise.all([
      supabase.from('link_sections').select('*').order('ordem'),
      supabase.from('link_section_items').select('*').order('ordem'),
    ])
    setSections((s as LinkSection[]) ?? [])
    setItems((i as LinkSectionItem[]) ?? [])
  }

  useEffect(() => {
    carregar()
  }, [])

  async function renomearSecao(secao: LinkSection, titulo: string) {
    setSections((prev) => prev.map((s) => (s.id === secao.id ? { ...s, titulo } : s)))
  }

  async function salvarSecao(secao: LinkSection) {
    await supabase.from('link_sections').update({ titulo: secao.titulo }).eq('id', secao.id)
  }

  async function adicionarItem(sectionId: string) {
    const dados = novoItem[sectionId]
    if (!dados?.nome || !dados?.url) return
    await supabase.from('link_section_items').insert({
      section_id: sectionId,
      nome: dados.nome,
      url: dados.url,
      ordem: items.filter((i) => i.section_id === sectionId).length + 1,
    })
    setNovoItem((prev) => ({ ...prev, [sectionId]: { nome: '', url: '' } }))
    carregar()
  }

  async function removerItem(id: string) {
    await supabase.from('link_section_items').delete().eq('id', id)
    carregar()
  }

  return (
    <div className="space-y-6">
      {sections.map((secao) => (
        <div key={secao.id} className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex gap-2">
            <input
              value={secao.titulo}
              onChange={(e) => renomearSecao(secao, e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium"
            />
            <button
              onClick={() => salvarSecao(secao)}
              className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700"
            >
              Salvar título
            </button>
          </div>

          <ul className="mb-3 space-y-1">
            {items
              .filter((i) => i.section_id === secao.id)
              .map((item) => (
                <li key={item.id} className="flex items-center justify-between text-sm">
                  <span>
                    {item.nome} — <span className="text-slate-400">{item.url}</span>
                  </span>
                  <button onClick={() => removerItem(item.id)} className="text-red-600 hover:underline">
                    remover
                  </button>
                </li>
              ))}
          </ul>

          <div className="flex gap-2">
            <input
              placeholder="Nome do link"
              value={novoItem[secao.id]?.nome ?? ''}
              onChange={(e) =>
                setNovoItem((prev) => ({ ...prev, [secao.id]: { ...prev[secao.id], nome: e.target.value, url: prev[secao.id]?.url ?? '' } }))
              }
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="URL"
              value={novoItem[secao.id]?.url ?? ''}
              onChange={(e) =>
                setNovoItem((prev) => ({ ...prev, [secao.id]: { ...prev[secao.id], url: e.target.value, nome: prev[secao.id]?.nome ?? '' } }))
              }
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              onClick={() => adicionarItem(secao.id)}
              className="rounded-lg bg-mandarin-orange px-3 py-2 text-lg font-bold text-onyx-black hover:bg-mandarin-orange-dark"
            >
              Adicionar
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function PaginasForm() {
  const [paginas, setPaginas] = useState<InfoPage[]>([])
  const [nova, setNova] = useState({ titulo: '', slug: '', conteudo: '' })

  async function carregar() {
    const { data } = await supabase.from('info_pages').select('*').order('ordem')
    setPaginas((data as InfoPage[]) ?? [])
  }

  useEffect(() => {
    carregar()
  }, [])

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('info_pages').insert({ ...nova, ordem: paginas.length + 1 })
    setNova({ titulo: '', slug: '', conteudo: '' })
    carregar()
  }

  async function remover(id: string) {
    await supabase.from('info_pages').delete().eq('id', id)
    carregar()
  }

  return (
    <div className="space-y-6">
      <form onSubmit={criar} className="max-w-xl space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <input
          required
          placeholder="Título"
          value={nova.titulo}
          onChange={(e) => setNova({ ...nova, titulo: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          required
          placeholder="slug (ex: sobre)"
          value={nova.slug}
          onChange={(e) => setNova({ ...nova, slug: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <textarea
          placeholder="Conteúdo"
          value={nova.conteudo}
          onChange={(e) => setNova({ ...nova, conteudo: e.target.value })}
          rows={4}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg bg-mandarin-orange px-4 py-2 text-lg font-bold text-onyx-black hover:bg-mandarin-orange-dark">
          Criar página
        </button>
      </form>

      <ul className="space-y-2">
        {paginas.map((p) => (
          <li key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm">
            <span>
              {p.titulo} — <span className="text-slate-400">/paginas/{p.slug}</span>
            </span>
            <button onClick={() => remover(p.id)} className="text-red-600 hover:underline">
              remover
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
