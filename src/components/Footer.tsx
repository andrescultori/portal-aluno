export default function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white py-6 text-center text-sm text-slate-500">
      Desenvolvido por{' '}
      <a
        href="https://github.com/andrescultori"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-[var(--color-brand)] hover:underline"
      >
        André Scultori
      </a>{' '}
      · © 2026 ·{' '}
      <a
        href="https://github.com/andrescultori/portal-aluno"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-[var(--color-brand)] hover:underline"
      >
        GitHub
      </a>
    </footer>
  )
}
