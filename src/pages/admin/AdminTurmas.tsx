import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { Turma } from '../../types/database'

const vazio = {
  nome: '',
  horario_inicio: '14:00',
  horario_fim_presente: '14:05',
  horario_fim_atraso: '14:15',
}

export default function AdminTurmas() {
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [form, setForm] = useState(vazio)
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    setCarregando(true)
    const { data } = await supabase.from('turmas').select('*').order('nome')
    setTurmas((data as Turma[]) ?? [])
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('turmas').insert({ ...form, ativo: true })
    setForm(vazio)
    carregar()
  }

  async function alternarAtivo(turma: Turma) {
    await supabase.from('turmas').update({ ativo: !turma.ativo }).eq('id', turma.id)
    carregar()
  }

  async function remover(id: string) {
    await supabase.from('turmas').delete().eq('id', id)
    carregar()
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Turmas</h1>

      <form
        onSubmit={criar}
        className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-5"
      >
        <input
          required
          placeholder="Nome da turma"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
        />
        <label className="text-sm text-slate-500">
          Início
          <input
            type="time"
            value={form.horario_inicio}
            onChange={(e) => setForm({ ...form, horario_inicio: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm text-slate-500">
          Fim (presente)
          <input
            type="time"
            value={form.horario_fim_presente}
            onChange={(e) => setForm({ ...form, horario_fim_presente: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm text-slate-500">
          Fim (atraso)
          <input
            type="time"
            value={form.horario_fim_atraso}
            onChange={(e) => setForm({ ...form, horario_fim_atraso: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-mandarin-orange px-4 py-2 text-lg font-bold text-onyx-black hover:bg-mandarin-orange-dark md:col-span-5"
        >
          Criar turma
        </button>
      </form>

      {carregando ? (
        <p className="text-slate-500">Carregando...</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2">Nome</th>
                <th className="px-4 py-2">Início</th>
                <th className="px-4 py-2">Presente até</th>
                <th className="px-4 py-2">Atraso até</th>
                <th className="px-4 py-2">Ativa</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {turmas.map((t) => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{t.nome}</td>
                  <td className="px-4 py-2">{t.horario_inicio}</td>
                  <td className="px-4 py-2">{t.horario_fim_presente}</td>
                  <td className="px-4 py-2">{t.horario_fim_atraso}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => alternarAtivo(t)}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        t.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {t.ativo ? 'Ativa' : 'Inativa'}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => remover(t.id)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
