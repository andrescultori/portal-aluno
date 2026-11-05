import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// Lembra a posição de rolagem de cada tela. Ao voltar (botão "voltar" do navegador ou do app),
// devolve a pessoa ao ponto onde estava; ao abrir uma tela nova, começa no topo.
// O React Router (modo BrowserRouter) não faz isso sozinho.
const CHAVE = 'portal:rolagem'

function ler(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE) ?? '{}')
  } catch {
    return {}
  }
}

function gravar(chave: string, y: number) {
  try {
    const todas = ler()
    todas[chave] = y
    const chaves = Object.keys(todas)
    if (chaves.length > 200) delete todas[chaves[0]]
    sessionStorage.setItem(CHAVE, JSON.stringify(todas))
  } catch {
    /* sessionStorage indisponível: segue sem lembrar */
  }
}

export default function RestauraRolagem() {
  const location = useLocation()
  const tipo = useNavigationType()
  const chaveAtual = useRef(location.key)
  const caminhoAnterior = useRef(location.pathname)

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  }, [])

  // Guarda a posição enquanto a pessoa rola (e ao sair da tela).
  useEffect(() => {
    chaveAtual.current = location.key
    let espera: number | undefined
    const aoRolar = () => {
      window.clearTimeout(espera)
      espera = window.setTimeout(() => gravar(location.key, window.scrollY), 120)
    }
    window.addEventListener('scroll', aoRolar, { passive: true })
    return () => {
      window.removeEventListener('scroll', aoRolar)
      window.clearTimeout(espera)
    }
  }, [location.key])

  // Ao chegar numa tela: voltar/avançar restaura; navegar normal vai para o topo (ou para a âncora).
  useLayoutEffect(() => {
    const mudouDeTela = caminhoAnterior.current !== location.pathname
    caminhoAnterior.current = location.pathname
    if (location.hash) return
    if (tipo !== 'POP') {
      // Trocar de aba/filtro dentro da mesma tela (muda só a query) não deve rolar para o topo.
      if (mudouDeTela) window.scrollTo(0, 0)
      return
    }
    const alvo = ler()[location.key]
    if (!alvo) return
    // O conteúdo costuma chegar depois (carrega do banco): tenta por até ~2,5 s até a página ter altura.
    let tentativas = 0
    const id = window.setInterval(() => {
      tentativas += 1
      window.scrollTo(0, alvo)
      const chegou = Math.abs(window.scrollY - alvo) < 4
      if (chegou || tentativas > 25) window.clearInterval(id)
    }, 100)
    return () => window.clearInterval(id)
  }, [location.key, location.pathname, location.hash, tipo])

  return null
}
