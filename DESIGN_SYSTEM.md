# Design System — Portal do Aluno (UniMissional)

Redesign institucional: visual editorial de cantos retos, faixas de cor da
marca e tipografia condensada nos títulos. Os tokens vivem em `src/index.css`
(`@theme`, Tailwind v4); o projeto não usa `tailwind.config.ts`.

## Cores

| Token | Hex | Uso |
|---|---|---|
| `pure-white` | `#FFFFFF` | Fundo de página e superfícies claras |
| `soft-pink` | `#FFE4DC` | Blocos de destaque, cabeçalho de tabela, selo "Atraso" |
| `mandarin-orange` | `#FC6D00` | Botão de destaque, barra de item ativo, faixa tricolor |
| `gunmetal-gray` | `#3B324E` | Títulos, header, sidebar, rodapé, botão padrão |
| `onyx-black` | `#333333` | Texto de corpo |
| `neutral-tint` | `#F7F5F2` | Fundos neutros de apoio (cabeçalhos de calendário, campos) |
| `muted-purple` | `#6B6478` | Texto secundário (contraste ≥ 4.5:1 sobre branco) |
| `chevron-gray` | `#9089A0` | Ícones decorativos, nunca texto |

**Contraste:** sobre `mandarin-orange` use sempre `onyx-black` e texto grande
(`font-display` bold ≥ 24px) — nunca branco, nunca texto pequeno. Sobre
`soft-pink` use `gunmetal-gray` ou `onyx-black`. `mandarin-orange` não é cor
de texto sobre fundo claro (usar `gunmetal-gray` sublinhado).

## Tipografia

- `font-display` — **Barlow Condensed** 600/700 (substitui a Herokid Condensed,
  cujo arquivo não está disponível; trocar só em `--font-display`). Títulos
  `h1–h4`, números grandes, botões de destaque.
- `font-body` — **Merriweather** 400/700 (+ itálico). Texto corrido e interface.

Tamanhos de referência: título da Home 72px (44px no celular); horário da
aula 64px; título de tela 40–48px; números do relatório 56px; botão de
check-in 32px.

## Raios

`rounded-none` em cards e blocos; `rounded-sm` (6px) em campos e botões
pequenos; `md` 12px e `lg` 24px disponíveis. Os raios padrão do Tailwind
foram zerados (`--radius-*: initial`).

## Espaçamento

`brand-1` 4px · `brand-2` 8px · `brand-3` 16px · `brand-4` 32px. Margem lateral
mínima no celular: 16px.

## Foco e toque

`:focus-visible` → `outline: 3px solid mandarin-orange; outline-offset: 2px`.
Alvos de toque ≥ 44px (`min-h-11`).

## Componentes

- **`FaixaTricolor`** (`components/marca.tsx`) — flex 8 gunmetal / 5 laranja / 3
  rosa. 12px no login, 8px no check-in.
- **`MeridianosDecor` / `ArcosConcentricos`** — SVGs decorativos (`aria-hidden`).
- **`Footer`** — assinatura obrigatória em todas as telas: "Desenvolvido por
  André Scultori · © 2026 · GitHub". `variante="aluno"` (rodapé gunmetal com
  slogan) ou `"discreto"` (login e Admin).
- **`Shell`** — escolhe header/rodapé por rota: login (sem header), `/presenca`
  (`HeaderCheckin`), `/admin` (sidebar do `AdminLayout`), demais (`Header`).
- **`Header`** — gunmetal, logo `monocromia-branco` 48px, item ativo com
  sublinhado de 3px laranja; menus "Classroom e links" e "Informações";
  hambúrguer de 44px no celular.
- **`StatusSelo`** — Presente (gunmetal cheio), Atraso (rosa), Falta (branco com
  borda 2px laranja); sempre com texto.
- **Botões** — destaque: laranja + `onyx-black` + `font-display` bold; padrão:
  gunmetal + branco; contorno: borda 2px gunmetal.

## Logos (`public/logo/`)

`logo-roxo.png` sobre fundo claro; `monocromia-branco.png` sobre gunmetal.

## Checklist de acessibilidade

- [x] Texto sobre laranja: nunca branco nem pequeno
- [x] Foco visível em todos os controles
- [x] Alvos de toque ≥ 44px
- [x] Status sempre com texto, nunca só cor
- [x] Decoração (SVGs, chevrons) com `aria-hidden`
