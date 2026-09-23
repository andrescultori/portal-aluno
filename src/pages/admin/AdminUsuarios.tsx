import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { AllowedUser, Papel, Turma } from '../../types/database'

function parseCsv(texto: string): Record<string, string>[] {
  const linhas = texto.trim().split(/\r?\n/)
  if (linhas.length < 2) return []
  const cabecalho = linhas[0].split(',').map((c) => c.trim().toLowerCase())
  return linhas.slice(1).map((linha) => {
    const valores = linha.split(',').map((v) => v.trim())
    const registro: Record<string, string> = {}
    cabecalho.forEach((chave, i) => {
      registro[chave] = valores[i] ?? ''
    })
    return registro
  })
}

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState<AllowedUser[]>([])
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [carregando, setCarregando] = useState(true)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [novo, setNovo] = useState({ nome: '', email: '', papel: 'aluno' as Papel, turma_id: '' })
  const fileRef = useRef<HTMLInputElement>(null)

  async function carregar() {
    setCarregando(true)
    const [{ data: usuariosData }, { data: turmasData }] = await Promise.all([
      supabase.from('allowed_users').select('*').order('nome'),
      supabase.from('turmas').select('*').order('nome'),
    ])
    setUsuarios((usuariosData as AllowedUser[]) ?? [])
    setTurmas((turmasData as Turma[]) ?? [])
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function adicionarUsuario(e: React.FormEvent) {
    e.preventDefault()
    setMensagem(null)
    const { error } = await supabase.from('allowed_users').insert({
      nome: novo.nome,
      email: novo.email.toLowerCase(),
      papel: novo.papel,
      turma_id: novo.turma_id || null,
    })
    if (error) {
      setMensagem(`Erro ao adicionar: ${error.message}`)
      return
    }
    setNovo({ nome: '', email: '', papel: 'aluno', turma_id: '' })
    carregar()
  }

  async function alternarAtivo(usuario: AllowedUser) {
    await supabase.from('allowed_users').update({ ativo: !usuario.ativo }).eq('id', usuario.id)
    carregar()
  }

  async function removerUsuario(id: string) {
    await supabase.from('allowed_users').delete().eq('id', id)
    carregar()
  }

  async function importarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return
    setMensagem(null)

    if (!arquivo.name.toLowerCase().endsWith('.csv')) {
      setMensagem('Formato não suportado. Exporte a planilha do Excel como CSV e envie novamente.')
      if (fileRef.current) fileRef.current.value = ''
      return
    }

    const texto = await arquivo.text()
    const registros = parseCsv(texto)
    if (registros.length === 0) {
      setMensagem('Nenhum registro encontrado no arquivo. Verifique o cabeçalho: nome,email,papel,turma')
      return
    }

    const linhas = registros
      .filter((r) => r.email)
      .map((r) => {
        const turma = turmas.find((t) => t.nome.toLowerCase() === (r.turma ?? '').toLowerCase())
        const papel: Papel = r.papel === 'equipe' ? 'equipe' : 'aluno'
        return {
          nome: r.nome || r.email,
          email: r.email.toLowerCase(),
          papel,
          turma_id: turma?.id ?? null,
          ativo: true,
        }
      })

    const { error } = await supabase
      .from('allowed_users')
      .upsert(linhas, { onConflict: 'email' })

    if (error) {
      setMensagem(`Erro ao importar: ${error.message}`)
    } else {
      setMensagem(`${linhas.length} usuário(s) importado(s) com sucesso.`)
      carregar()
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Usuários autorizados</h1>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-2 font-medium text-slate-900">Importar whitelist (CSV)</h2>
        <p className="mb-3 text-sm text-slate-500">
          Colunas esperadas: <code className="rounded bg-slate-100 px-1">nome,email,papel,turma</code>
          . Papel deve ser <code className="rounded bg-slate-100 px-1">aluno</code> ou{' '}
          <code className="rounded bg-slate-100 px-1">equipe</code>. Se sua planilha estiver em
          Excel, exporte como CSV antes de enviar.
        </p>
        <input ref={fileRef} type="file" accept=".csv" onChange={importarArquivo} />
        {mensagem && <p className="mt-3 text-sm text-slate-700">{mensagem}</p>}
      </div>

      <form
        onSubmit={adicionarUsuario}
        className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-4"
      >
        <input
          required
          placeholder="Nome"
          value={novo.nome}
          onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          required
          type="email"
          placeholder="E-mail"
          value={novo.email}
          onChange={(e) => setNovo({ ...novo, email: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={novo.papel}
          onChange={(e) => setNovo({ ...novo, papel: e.target.value as Papel })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="aluno">Aluno</option>
          <option value="equipe">Equipe</option>
        </select>
        <select
          value={novo.turma_id}
          onChange={(e) => setNovo({ ...novo, turma_id: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Sem turma</option>
          {turmas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white md:col-span-4"
        >
          Adicionar usuário
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
                <th className="px-4 py-2">E-mail</th>
                <th className="px-4 py-2">Papel</th>
                <th className="px-4 py-2">Ativo</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{u.nome}</td>
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2 capitalize">{u.papel}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => alternarAtivo(u)}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => removerUsuario(u.id)}
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
