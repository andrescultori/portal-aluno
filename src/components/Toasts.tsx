import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

// Avisos rápidos no canto da tela (sucesso some sozinho; erro fica mais tempo). Quem lê com leitor de tela
// ouve o aviso na hora (role "status" para sucesso, "alert" para erro). O texto pode ter um link.
type Tipo = 'ok' | 'erro'
interface Aviso {
  id: number
  tipo: Tipo
  texto: ReactNode
}
interface Contexto {
  avisar: (tipo: Tipo, texto: ReactNode) => void
}

const ToastContext = createContext<Contexto>({ avisar: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const proximo = useRef(1)

  const fechar = useCallback((id: number) => setAvisos((a) => a.filter((x) => x.id !== id)), [])
  const avisar = useCallback(
    (tipo: Tipo, texto: ReactNode) => {
      const id = proximo.current++
      setAvisos((a) => [...a.slice(-3), { id, tipo, texto }])
      window.setTimeout(() => fechar(id), tipo === 'ok' ? 6000 : 12000)
    },
    [fechar],
  )
  const valor = useMemo(() => ({ avisar }), [avisar])

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4 sm:w-[24rem]">
        {avisos.map((a) => (
          <div
            key={a.id}
            role={a.tipo === 'erro' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full items-start gap-2 border-l-4 bg-white p-3 text-sm text-onyx-black shadow-[0_8px_24px_rgba(59,50,78,0.25)] ${
              a.tipo === 'erro' ? 'border-mandarin-orange' : 'border-gunmetal-gray'
            }`}
          >
            <div className="min-w-0 flex-1 pt-2">{a.texto}</div>
            <button
              type="button"
              onClick={() => fechar(a.id)}
              aria-label="Fechar aviso"
              className="flex h-11 w-11 shrink-0 items-center justify-center text-gunmetal-gray hover:bg-neutral-tint"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
