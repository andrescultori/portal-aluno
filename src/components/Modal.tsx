import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

// Janela de diálogo sobre a tela, usando o <dialog> nativo (foco preso dentro, Esc fecha, leitores de tela entendem).
export default function Modal({
  aberto,
  aoFechar,
  titulo,
  children,
}: {
  aberto: boolean
  aoFechar: () => void
  titulo: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aberto && !d.open) d.showModal()
    if (!aberto && d.open) d.close()
  }, [aberto])

  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      onClick={(e) => {
        // Clique no fundo escurecido (fora da caixa) fecha.
        if (e.target === ref.current) aoFechar()
      }}
      aria-labelledby="modal-titulo"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] max-w-none border border-gunmetal-gray/40 bg-white p-0 text-onyx-black backdrop:bg-gunmetal-gray/60"
    >
      {aberto && (
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 id="modal-titulo" className="font-display text-3xl text-gunmetal-gray">
              {titulo}
            </h2>
            <button
              type="button"
              onClick={aoFechar}
              aria-label="Fechar"
              className="flex h-11 w-11 shrink-0 items-center justify-center text-gunmetal-gray hover:bg-neutral-tint"
            >
              <X size={22} aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}
