import { useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { hojeISO } from '../../lib/datas'
import type { Aviso } from '../../types/database'

interface FormAviso {
  titulo: string
  resumo: string
  publicado_em: string
  ativo: boolean
}

const novoForm = (): FormAviso => ({ titulo: '', resumo: '', publicado_em: hojeISO(), ativo: true })

const campo =
  'mt-1 block min-h-11 w-full rounded-sm border border-gunmetal-gray/40 bg-pure-white px-3 text-sm text-onyx-black'

export default function AdminAvisos() {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [carregando, setCarregando] = useState(true)
  const [form, setForm] = useState<FormAviso>(novoForm())
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [tabelaAusente, setTabelaAusente] = useState(false)

  async function carregar() {
    setCarregando(true)
    const { data, error } = await supabase
      .from('avisos')
      .select('*')
      .order('publicado_em', { ascending: false })
    if (error) {
      // 42P01 = relation does not exist; PGRST205 = não está no schema cache
      setTabelaAusente(error.code === '42P01' || error.code === 'PGRST205')
      if (error.code !== '42P01' && error.code !== 'PGRST205') setErro(error.message)
      setAvisos([])
    } else {
      setTabelaAusente(false)
      setAvisos((data as Aviso[]) ?? [])
    }
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titulo.trim()) return
    setSalvando(true)
    setErro(null)
    const dados = {
      titulo: form.titulo.trim(),
      resumo: form.resumo.trim() || null,
      publicado_em: form.publicado_em,
      ativo: form.ativo,
    }
    const { error } = editandoId
      ? await supabase.from('avisos').update(dados).eq('id', editandoId)
      : await supabase.from('avisos').insert(dados)
    setSalvando(false)
    if (error) {
      setErro(error.message)
      return
    }
    cancelarEdicao()
    carregar()
  }

  function editar(a: Aviso) {
    setEditandoId(a.id)
    setForm({
      titulo: a.titulo,
      resumo: a.resumo ?? '',
      publicado_em: a.publicado_em,
      ativo: a.ativo,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setForm(novoForm())
  }

  async function alternarAtivo(a: Aviso) {
    const { error } = await supabase.from('avisos').update({ ativo: !a.ativo }).eq('id', a.id)
    if (error) setErro(error.message)
    carregar()
  }

  async function remover(a: Aviso) {
    if (!confirm(`Excluir o aviso "${a.titulo}"?`)) return
    const { error } = await supabase.from('avisos').delete().eq('id', a.id)
    if (error) setErro(error.message)
    carregar()
  }

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm font-bold uppercase tracking-[0.12em] text-gunmetal-gray">
        Administração
      </p>
      <h1 className="font-display text-[40px] leading-none text-gunmetal-gray md:text-[48px]">
        Avisos
      </h1>
      <p className="mt-2 text-sm text-onyx-black">
        Os três avisos ativos mais recentes aparecem no card “Avisos e comunicados” da Home.
      </p>

      {tabelaAusente && (
        <p role="alert" className="mt-6 border-l-4 border-mandarin-orange bg-soft-pink p-4 text-sm text-onyx-black">
          A tabela de avisos ainda não existe no banco. Rode uma vez, no SQL Editor do Supabase, o
          arquivo <code className="font-bold">supabase/migrations/20261014140000_avisos.sql</code>{' '}
          e recarregue esta página.
        </p>
      )}

      {!tabelaAusente && (
        <form onSubmit={salvar} className="mt-6 grid gap-3 border border-gunmetal-gray/25 p-4">
          <h2 className="font-display text-2xl text-gunmetal-gray">
            {editandoId ? 'Editar aviso' : 'Novo aviso'}
          </h2>
          <label className="text-sm font-bold text-gunmetal-gray">
            Título
            <input
              required
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              className={campo}
            />
          </label>
          <label className="text-sm font-bold text-gunmetal-gray">
            Resumo
            <textarea
              rows={3}
              value={form.resumo}
              onChange={(e) => setForm({ ...form, resumo: e.target.value })}
              className={`${campo} py-2`}
            />
          </label>
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm font-bold text-gunmetal-gray">
              Data de publicação
              <input
                type="date"
                required
                value={form.publicado_em}
                onChange={(e) => setForm({ ...form, publicado_em: e.target.value })}
                className={campo}
              />
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-gunmetal-gray">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                className="h-5 w-5 accent-gunmetal-gray"
              />
              Ativo (visível para os alunos)
            </label>
          </div>
          {erro && (
            <p role="alert" className="text-sm font-bold text-onyx-black">
              Não foi possível salvar: {erro}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={salvando}
              className="min-h-11 rounded-sm bg-gunmetal-gray px-6 text-sm font-bold text-white transition hover:bg-gunmetal-gray-dark disabled:opacity-60"
            >
              {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Publicar aviso'}
            </button>
            {editandoId && (
              <button
                type="button"
                onClick={cancelarEdicao}
                className="min-h-11 rounded-sm border-2 border-gunmetal-gray px-6 text-sm font-bold text-gunmetal-gray"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {!tabelaAusente && (
        <div className="mt-8">
          <h2 className="font-display text-2xl text-gunmetal-gray">Avisos cadastrados</h2>
          {carregando ? (
            <p className="mt-3 text-sm text-onyx-black">Carregando...</p>
          ) : avisos.length === 0 ? (
            <p className="mt-3 text-sm text-onyx-black">Nenhum aviso cadastrado ainda.</p>
          ) : (
            <ul className="mt-3 border-t border-gunmetal-gray/25">
              {avisos.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-start justify-between gap-3 border-b border-gunmetal-gray/25 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-gunmetal-gray">
                      {new Date(a.publicado_em + 'T00:00:00').toLocaleDateString('pt-BR')} ·{' '}
                      {a.ativo ? 'Ativo' : 'Inativo'}
                    </p>
                    <p className="mt-1 font-bold text-gunmetal-gray">{a.titulo}</p>
                    {a.resumo && <p className="mt-1 text-sm text-onyx-black">{a.resumo}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => alternarAtivo(a)}
                      className="min-h-11 rounded-sm px-3 text-sm font-bold text-gunmetal-gray underline underline-offset-4"
                    >
                      {a.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => editar(a)}
                      aria-label={`Editar ${a.titulo}`}
                      className="flex h-11 w-11 items-center justify-center rounded-sm text-gunmetal-gray hover:bg-soft-pink"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remover(a)}
                      aria-label={`Excluir ${a.titulo}`}
                      className="flex h-11 w-11 items-center justify-center rounded-sm text-gunmetal-gray hover:bg-soft-pink"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
