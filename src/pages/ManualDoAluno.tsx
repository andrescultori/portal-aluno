import { mockManual } from '../data/mock'

export default function ManualDoAluno() {
  const manual = mockManual

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Manual do Aluno</h1>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-2 text-lg font-medium text-slate-900">Baixar PDF completo</h2>
          <p className="mb-4 text-sm text-slate-500">
            Documento oficial com todas as normas acadêmicas e disciplinares.
          </p>
          {manual.pdf_url ? (
            <a
              href={manual.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-lg bg-mandarin-orange px-4 py-2 text-lg font-bold text-onyx-black hover:bg-mandarin-orange-dark"
            >
              Download do Manual (PDF)
            </a>
          ) : (
            <p className="text-sm text-slate-400">PDF ainda não configurado pela equipe.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-2 text-lg font-medium text-slate-900">Resumo</h2>
          <p className="whitespace-pre-line text-sm text-slate-600">
            {manual.resumo ?? 'Resumo ainda não configurado.'}
          </p>
        </div>
      </div>
    </div>
  )
}
