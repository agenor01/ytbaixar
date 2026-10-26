# ytbaixar

Baixe vídeos do **YouTube** e do **YouTube Music** em **MP4** (ou só o áudio em M4A), direto do seu PC.
Roda localmente com [yt-dlp](https://github.com/yt-dlp/yt-dlp) + [ffmpeg](https://ffmpeg.org/) e tem três jeitos de usar:

| Jeito | Como abrir |
| --- | --- |
| **Site** no navegador | `iniciar.cmd` → abre `http://localhost:8787` |
| **App de PC** (janela própria, ícone na Área de Trabalho) | `app\instalar-atalho.cmd` uma vez, depois o atalho **ytbaixar** |
| **Celular** (mesmo Wi-Fi) | Ajustes → *Usar no celular* → apontar a câmera pro QR code |

O app também é um **PWA**: no Edge/Chrome do PC dá pra usar *Instalar app* (ou Ajustes → *Instalar como app*).

## Requisitos

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) (`npm i -g pnpm`)
- ffmpeg no PATH (`winget install Gyan.FFmpeg`)
- O yt-dlp é baixado sozinho na primeira vez para `bin/`

## Começando

```bash
pnpm install
pnpm build
pnpm start
```

Abra http://localhost:8787.

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | Interface em modo desenvolvimento (Vite em :5173, com proxy pro servidor) |
| `pnpm start` | Servidor + interface compilada em :8787 |
| `pnpm app` | Abre como app de PC e desliga sozinho quando a janela fecha |
| `pnpm atalho` | Cria os atalhos na Área de Trabalho e no Menu Iniciar |
| `pnpm icons` | Regera os ícones (PWA e `.ico`) a partir de `web/public/icon.svg` |

## O que tem

- Capa desfocada no fundo, com a cor de destaque tirada da própria capa
- Blocos interativos: progresso (com as etapas vídeo → áudio → pronto), duração, qualidade (slider, setas, rodinha do mouse), formato MP4/M4A e detalhes
- Fila com vários downloads ao mesmo tempo, cancelar, baixar de novo e histórico com filtros
- Feed de atividade ao vivo, confete e som quando termina
- Colar com Ctrl+V em qualquer lugar, arrastar o link pra janela, e atalhos de teclado (`/` busca · `D` baixa · `F` formato · `↑↓` qualidade · `Esc` cancela)
- Layout de celular com barra de navegação embaixo, menu lateral e gavetas

## Como é feito

```
server.js          servidor Node sem dependências: API, yt-dlp, rede local, modo app
web/               interface em React + Vite + Tailwind v4 + shadcn/ui
  src/components/  telas (Hero, Tiles, Board, Feed, Settings…)
  src/components/ui/  componentes shadcn/ui e efeitos Magic UI
  src/lib/store.ts estado e lógica de download
  public/          manifest, service worker e ícones do PWA
app/               atalho do app de PC (ytbaixar.vbs) e instalador do atalho
```

Componentes do [shadcn/ui](https://ui.shadcn.com) (tabs, dialog, drawer, sheet, slider, switch, tooltip, sonner…) e efeitos do
[Magic UI](https://magicui.design) via registro do shadcn: `number-ticker`, `border-beam`, `shimmer-button`, `magic-card`,
`blur-fade`, `shine-border`, `animated-list` e `confetti`.

O `.mcp.json` liga o [servidor MCP do shadcn](https://ui.shadcn.com/docs/mcp) pro Claude Code: dá pra pedir componentes novos em linguagem natural.

## Celular e segurança

Por padrão o servidor só escuta em `127.0.0.1`. Ao ligar *Usar no celular*, ele abre a porta **8788** na rede local, e ela só
aceita quem tiver a chave secreta que vem no link/QR code (guardada em `data/config.json`). Na primeira vez o Windows pergunta se
libera o Node no firewall: escolha **Redes privadas**.

Pelo celular o site funciona normal, mas não vira PWA instalável (o navegador exige HTTPS fora do `localhost`). Dá pra usar
*Adicionar à tela inicial* como atalho.

## Problemas

- **Parou de baixar**: quase sempre o YouTube mudou algo. Atualize o yt-dlp: `bin\yt-dlp.exe -U`
- **Vídeo em 4K não abre**: acima de 1080p o YouTube costuma oferecer só VP9/AV1; o MP4 sai certo, mas players antigos podem não tocar.

Use só para conteúdo que você tem direito de baixar.
