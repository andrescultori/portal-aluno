import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { ManualDoAluno as ManualDoAlunoType } from '../types/database'

export default function ManualDoAluno() {
  const [manual, setManual] = useState<ManualDoAlunoType | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    supabase
      .from('manual_do_aluno')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        setManual((data as ManualDoAlunoType) ?? { id: 1, pdf_url: null, resumo: null })
        setCarregando(false)
      })
  }, [])

  return (
    <div className="mx-auto max-w-4xl px-brand-3 py-brand-4">
      <h1 className="mb-6 font-display text-[40px] leading-none text-gunmetal-gray">Manual do Aluno</h1>

      {carregando ? (
        <p className="text-onyx-black">Carregando...</p>
      ) : (
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-none border border-gunmetal-gray/25 bg-white p-6">
            <h2 className="mb-2 font-display text-2xl text-gunmetal-gray">Baixar PDF completo</h2>
            <p className="mb-4 text-sm text-onyx-black">
              Documento oficial com todas as normas acadêmicas e disciplinares.
            </p>
            {manual?.pdf_url ? (
              <a
                href={manual.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-sm bg-gunmetal-gray px-4 py-2 text-sm font-bold text-white hover:bg-gunmetal-gray-dark"
              >
                Download do Manual (PDF)
              </a>
            ) : (
              <p className="text-sm text-muted-purple">PDF ainda não configurado pela equipe.</p>
            )}
          </div>

          <div className="rounded-none border border-gunmetal-gray/25 bg-white p-6">
            <h2 className="mb-2 font-display text-2xl text-gunmetal-gray">Resumo</h2>
            <p className="whitespace-pre-line text-sm text-onyx-black">
              {manual?.resumo ?? 'Resumo ainda não configurado.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
