# Design System — Portal do Aluno (UniMissional)

Baseado no brand book oficial da UniMissional, com uma adaptação deliberada:
cantos arredondados e cards flutuantes (estilo mais suave/moderno), em vez do
estilo "Bold Editorial Grid" de cantos retos do brand book original. Essa
adaptação foi aprovada para telas de produto/app — o material institucional
(site, materiais impressos) continua seguindo o brand book original à risca.

## Cores

| Token | Hex | Uso |
|---|---|---|
| `pure-white` | `#FFFFFF` | Fundo padrão de página e superfícies claras |
| `soft-pink` | `#FFE4DC` | Superfície suave de destaque — cards, realces, fundo de ícone |
| `mandarin-orange` | `#FC6D00` | Cor de destaque principal — CTAs, ícones, links, estados ativos |
| `gunmetal-gray` | `#3B324E` | Títulos, texto de marca, botões escuros, uma das cores do gradiente |
| `onyx-black` | `#333333` | Texto de corpo sobre `pure-white` e `soft-pink` |
| `neutral-tint` | `#F7F5F2` | Fundo de linhas/itens de lista (não está no brand book original — tom neutro claro criado para diferenciar linhas de módulo do `soft-pink`) |
| `muted-purple` | `#6B6478` | Texto secundário/legendas sobre `neutral-tint` — mais escuro que cinza puro para manter a identidade roxo-acinzentada da marca |
| `chevron-gray` | `#9089A0` | Ícones decorativos (setas, indicadores), não usado para texto |

⚠️ **Regra de contraste herdada do brand book:** nunca usar `mandarin-orange`
como fundo com texto branco ou texto pequeno corrido — o contraste fica
abaixo do mínimo recomendado. Quando `mandarin-orange` aparecer em fundos
grandes (como o gradiente do header), aplicar um **scrim escuro** por cima
(ver "Gradiente de header" abaixo) antes de colocar texto branco.

## Gradiente de header

Padrão para cabeçalhos de destaque (topo de tela, hero):

```css
background:
  linear-gradient(rgba(20,15,10,0.30), rgba(20,15,10,0.30)),
  linear-gradient(135deg, #FC6D00 0%, #3B324E 100%);
```

O scrim escuro (30% preto) por cima do gradiente laranja→cinza-azulado é
obrigatório sempre que houver texto branco sobreposto — sem ele, o texto
sobre a parte laranja do gradiente fica com contraste insuficiente.

## Tipografia

- **Títulos e destaques (serif):** `Merriweather` (Google Fonts), peso 700 —
  usado em `<h1>`/`<h2>` de tela e em valores monetários de destaque
- **Texto de interface (sans-serif):** stack do sistema —
  `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif` — usado em
  labels, corpo de texto, botões, badges

> Nota: o brand book original define `Herokid Condensed` como fonte primária
> de título, mas os arquivos da fonte não foram fornecidos. Até que sejam
> adicionados, `Merriweather` é usada como substituta para títulos — ela é a
> fonte secundária oficial da marca (texto corrido) e já está disponível via
> Google Fonts, garantindo consistência visual mesmo sem os arquivos da
> fonte principal.

## Raio de borda (cantos arredondados)

Escala usada nas telas de produto — diferente do `radius-none` do brand book
editorial:

| Token | Valor | Uso |
|---|---|---|
| `radius-sm` | `6px` | Não usado nas telas atuais |
| `radius-md` | `12px` | Ícones de módulo, botões |
| `radius-lg` | `16px` | Linhas/itens de lista (cards de módulo) |
| `radius-xl` | `24px` | Cards principais (módulos, destaque financeiro) |
| `radius-header` | `0 0 36px 36px` | Header — reto no topo, arredondado só embaixo |

## Espaçamento

Escala base do brand book, mantida:

| Token | Valor |
|---|---|
| `space-1` | `4px` |
| `space-2` | `8px` |
| `space-3` | `16px` |
| `space-4` | `32px` |

Padding padrão de card: `20–26px`. Gap entre elementos de uma linha: `12–14px`.

## Componentes

### Header com saudação
Gradiente (ver acima), avatar circular com iniciais, badge/chip com ícone +
texto em maiúsculas (`background: rgba(255,255,255,0.20)`, `border-radius:
999px`), título serif 28-30px, subtítulo sans-serif 13-14px em branco 85-90%
de opacidade.

### Card de módulo (linha de lista)
```
background: #F7F5F2
border-radius: 16px (radius-lg)
padding: 13-14px 15px
display: flex, align-items: center, gap: 14px
```
Ícone: quadrado `40x40px`, `border-radius: 12px`, fundo `#FFE4DC`
(`soft-pink`), ícone em traço fino (estilo Lucide/Feather) na cor
`mandarin-orange`. Título em sans-serif 600/14.5px cor `gunmetal-gray`;
subtítulo sans-serif 12px cor `muted-purple`. Seta (chevron) à direita,
`chevron-gray`, decorativa.

### Card de destaque (ex: financeiro)
```
background: soft-pink (#FFE4DC)
border-radius: 24px (radius-xl)
padding: 20-22px
```
Label em maiúsculas, sans-serif bold 11.5px, cor `gunmetal-gray` (não usar
`mandarin-orange` aqui — baixo contraste sobre `soft-pink`). Valor de
destaque em serif bold 24-26px, cor `gunmetal-gray`. Botão de ação:
fundo `gunmetal-gray`, texto branco, `border-radius: 12px`, padding
`12px 24px`, sans-serif bold 13.5px.

### Cards principais (overlapping o header)
Fundo branco, `border-radius: 24px`, `box-shadow: 0 14px 34px
rgba(59,50,78,0.14)`, margem negativa no topo (`-56px`) para sobrepor o
header — cria o efeito de profundidade entre o header colorido e o
conteúdo abaixo.

## Iconografia

Ícones de traço fino (stroke), estilo Lucide/Feather — `stroke-width: 2`,
sem preenchimento, cantos arredondados (`stroke-linecap: round`,
`stroke-linejoin: round`). Cor varia por contexto: `mandarin-orange` dentro
de círculos de destaque, branco sobre o header, `chevron-gray` para
indicadores decorativos.

## Acessibilidade — checklist

- [ ] Texto sobre `mandarin-orange` puro: nunca branco, nunca pequeno/corrido
- [ ] Gradiente de header: sempre com scrim escuro por trás de texto branco
- [ ] Texto sobre `soft-pink`: usar `gunmetal-gray` ou `onyx-black`, nunca
  `mandarin-orange`
- [ ] Elementos decorativos (chevrons, ícones de apoio) não substituem texto
  com contraste adequado onde a informação for essencial
