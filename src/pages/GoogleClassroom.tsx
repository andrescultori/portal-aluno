import { mockClassroomLinks } from '../data/mock'

export default function GoogleClassroom() {
  const links = [...mockClassroomLinks].sort((a, b) => a.ordem - b.ordem)

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Google Classroom</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {links.map((link) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm transition hover:border-mandarin-orange hover:shadow-md"
          >
            <h2 className="text-xl font-medium text-slate-900">{link.nome_turma}</h2>
            <p className="mt-2 text-sm text-slate-500">Acessar turma no Classroom →</p>
          </a>
        ))}
      </div>
    </div>
  )
}
