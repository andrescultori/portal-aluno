import { useEffect, useState } from 'react'
import { Trash2, X } from 'lucide-react'
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

function FormFeedback({ erro, salvo }: { erro: string | null; salvo: boolean }) {
  if (erro) return <p className="text-sm text-red-600">{erro}</p>
  if (salvo) return <p className="text-sm text-green-600">Salvo com sucesso.</p>
  return null
}

function HeroForm() {
  const [config, setConfig] = useState<HeroConfig | null>(null)
  const [imagensTexto, setImagensTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)

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
    setErro(null)
    setSalvo(false)
    const imagens = imagensTexto.split('\n').map((l) => l.trim()).filter(Boolean)
    const { error } = await supabase.from('hero_config').upsert({ ...config, id: 1, imagens })
    if (error) {
      setErro(`Erro ao salvar: ${error.message}`)
      return
    }
    setSalvo(true)
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

      <FormFeedback erro={erro} salvo={salvo} />

      <button type="submit" className="rounded-md bg-gunmetal-gray px-4 py-2 text-sm font-bold text-white hover:bg-gunmetal-gray-dark">
        Salvar
      </button>
    </form>
  )
}

function ManualForm() {
  const [manual, setManual] = useState<ManualDoAluno | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)

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
    setErro(null)
    setSalvo(false)
    const { error } = await supabase.from('manual_do_aluno').upsert({ ...manual, id: 1 })
    if (error) {
      setErro(`Erro ao salvar: ${error.message}`)
      return
    }
    setSalvo(true)
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

      <FormFeedback erro={erro} salvo={salvo} />

      <button type="submit" className="rounded-md bg-gunmetal-gray px-4 py-2 text-sm font-bold text-white hover:bg-gunmetal-gray-dark">
        Salvar
      </button>
    </form>
  )
}

function ClassroomForm() {
  const [links, setLinks] = useState<ClassroomLink[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [salvoId, setSalvoId] = useState<string | null>(null)

  async function carregar() {
    const { data } = await supabase.from('classroom_links').select('*').order('ordem')
    setLinks((data as ClassroomLink[]) ?? [])
  }

  useEffect(() => {
    carregar()
  }, [])

  async function salvar(link: ClassroomLink) {
    setErro(null)
    setSalvoId(null)
    const { error } = await supabase.from('classroom_links').upsert(link)
    if (error) {
      setErro(`Erro ao salvar: ${error.message}`)
      return
    }
    setSalvoId(link.id)
    carregar()
  }

  return (
    <div className="max-w-xl space-y-4">
      {erro && <p className="text-sm text-red-600">{erro}</p>}
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
          {salvoId === link.id && <p className="text-sm text-green-600">Salvo com sucesso.</p>}
          <button
            onClick={() => salvar(link)}
            className="rounded-md bg-gunmetal-gray px-4 py-2 text-sm font-bold text-white hover:bg-gunmetal-gray-dark"
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
  const [novoItem, setNovoItem] = useState<
    Record<string, { nome: string; url: string; descricao: string }>
  >({})
  const [erro, setErro] = useState<string | null>(null)
  const [secaoSalva, setSecaoSalva] = useState<string | null>(null)

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

  function renomearSecao(secao: LinkSection, titulo: string) {
    setSections((prev) => prev.map((s) => (s.id === secao.id ? { ...s, titulo } : s)))
  }

  async function salvarSecao(secao: LinkSection) {
    setErro(null)
    setSecaoSalva(null)
    const { error } = await supabase
      .from('link_sections')
      .update({ titulo: secao.titulo })
      .eq('id', secao.id)
    if (error) {
      setErro(`Erro ao salvar título: ${error.message}`)
      return
    }
    setSecaoSalva(secao.id)
    setTimeout(() => setSecaoSalva((atual) => (atual === secao.id ? null : atual)), 2000)
  }

  async function adicionarItem(sectionId: string) {
    const dados = novoItem[sectionId]
    if (!dados?.nome || !dados?.url) return
    setErro(null)
    const { error } = await supabase.from('link_section_items').insert({
      section_id: sectionId,
      nome: dados.nome,
      url: dados.url,
      descricao: dados.descricao || null,
      ordem: items.filter((i) => i.section_id === sectionId).length + 1,
    })
    if (error) {
      setErro(`Erro ao adicionar link: ${error.message}`)
      return
    }
    setNovoItem((prev) => ({ ...prev, [sectionId]: { nome: '', url: '', descricao: '' } }))
    carregar()
  }

  async function removerItem(id: string) {
    setErro(null)
    const { error } = await supabase.from('link_section_items').delete().eq('id', id)
    if (error) {
      setErro(`Erro ao remover: ${error.message}`)
      return
    }
    carregar()
  }

  async function removerSecao(secao: LinkSection) {
    if (!confirm(`Excluir a seção "${secao.titulo}" e todos os links dela?`)) return
    setErro(null)
    const { error } = await supabase.from('link_sections').delete().eq('id', secao.id)
    if (error) {
      setErro(`Erro ao excluir seção: ${error.message}`)
      return
    }
    carregar()
  }

  return (
    <div className="space-y-6">
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {sections.map((secao) => (
        <div key={secao.id} className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-1 flex flex-wrap gap-2">
            <input
              value={secao.titulo}
              onChange={(e) => renomearSecao(secao, e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium"
            />
            <button
              onClick={() => salvarSecao(secao)}
              className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700"
            >
              Salvar título
            </button>
            <button
              onClick={() => removerSecao(secao)}
              aria-label={`Excluir seção ${secao.titulo}`}
              className="shrink-0 rounded-lg p-2 text-red-600 hover:bg-red-50"
            >
              <Trash2 size={16} />
            </button>
          </div>
          {secaoSalva === secao.id && (
            <p className="mb-2 text-xs text-green-600">Título salvo.</p>
          )}

          <ul className="mb-3 space-y-2">
            {items
              .filter((i) => i.section_id === secao.id)
              .map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gunmetal-gray">{item.nome}</p>
                    {item.descricao && (
                      <p className="truncate text-xs text-slate-400">{item.descricao}</p>
                    )}
                    <p className="truncate text-xs text-slate-400">{item.url}</p>
                  </div>
                  <button
                    onClick={() => removerItem(item.id)}
                    aria-label={`Remover ${item.nome}`}
                    className="shrink-0 rounded-md p-1.5 text-red-600 hover:bg-red-50"
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
          </ul>

          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                placeholder="Nome do link"
                value={novoItem[secao.id]?.nome ?? ''}
                onChange={(e) =>
                  setNovoItem((prev) => ({
                    ...prev,
                    [secao.id]: { nome: e.target.value, url: prev[secao.id]?.url ?? '', descricao: prev[secao.id]?.descricao ?? '' },
                  }))
                }
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="URL"
                value={novoItem[secao.id]?.url ?? ''}
                onChange={(e) =>
                  setNovoItem((prev) => ({
                    ...prev,
                    [secao.id]: { nome: prev[secao.id]?.nome ?? '', url: e.target.value, descricao: prev[secao.id]?.descricao ?? '' },
                  }))
                }
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                placeholder="Descrição (opcional)"
                value={novoItem[secao.id]?.descricao ?? ''}
                onChange={(e) =>
                  setNovoItem((prev) => ({
                    ...prev,
                    [secao.id]: { nome: prev[secao.id]?.nome ?? '', url: prev[secao.id]?.url ?? '', descricao: e.target.value },
                  }))
                }
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                onClick={() => adicionarItem(secao.id)}
                className="shrink-0 rounded-md bg-gunmetal-gray px-3 py-2 text-sm font-bold text-white hover:bg-gunmetal-gray-dark"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function PaginasForm() {
  const [paginas, setPaginas] = useState<InfoPage[]>([])
  const [nova, setNova] = useState({ titulo: '', slug: '', conteudo: '' })
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    const { data } = await supabase.from('info_pages').select('*').order('ordem')
    setPaginas((data as InfoPage[]) ?? [])
  }

  useEffect(() => {
    carregar()
  }, [])

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    const { error } = await supabase.from('info_pages').insert({ ...nova, ordem: paginas.length + 1 })
    if (error) {
      setErro(`Erro ao criar página: ${error.message}`)
      return
    }
    setNova({ titulo: '', slug: '', conteudo: '' })
    carregar()
  }

  async function remover(id: string) {
    setErro(null)
    const { error } = await supabase.from('info_pages').delete().eq('id', id)
    if (error) {
      setErro(`Erro ao remover: ${error.message}`)
      return
    }
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
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button type="submit" className="rounded-md bg-gunmetal-gray px-4 py-2 text-sm font-bold text-white hover:bg-gunmetal-gray-dark">
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
