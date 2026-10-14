const GITHUB_AUTOR = 'https://github.com/andrescultori'
const GITHUB_REPO = 'https://github.com/andrescultori/portal-aluno'

type Variante = 'aluno' | 'discreto'

function Assinatura({ classeLink }: { classeLink: string }) {
  return (
    <>
      Desenvolvido por{' '}
      <a href={GITHUB_AUTOR} target="_blank" rel="noopener noreferrer" className={classeLink}>
        André Scultori
      </a>{' '}
      · © 2026 ·{' '}
      <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" className={classeLink}>
        GitHub
      </a>
    </>
  )
}

// aluno: dentro do rodapé gunmetal (slogan + assinatura).
// discreto: login e admin, só a assinatura em gunmetal sobre fundo claro.
export default function Footer({ variante = 'aluno' }: { variante?: Variante }) {
  if (variante === 'discreto') {
    return (
      <footer className="mt-auto px-brand-3 py-5 text-center text-[0.85rem] text-gunmetal-gray">
        <Assinatura classeLink="font-bold underline underline-offset-2" />
      </footer>
    )
  }

  return (
    <footer className="mt-auto bg-gunmetal-gray px-brand-3 py-8 text-center">
      <p className="font-body text-base italic text-soft-pink">
        Universidade e Missão - Juntas e ao mesmo tempo.
      </p>
      <p className="mt-3 text-[0.85rem] text-soft-pink">
        <Assinatura classeLink="font-bold text-white underline underline-offset-2" />
      </p>
    </footer>
  )
}
