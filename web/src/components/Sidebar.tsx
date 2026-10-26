import { Headphones, Music2, Play, Plus, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fetchInfo, setFilter, setTab, useStore } from "@/lib/store"
import { thumbUrl } from "@/lib/format"
import { cn } from "@/lib/utils"

interface Props {
  onNewLink: () => void
  onSettings: () => void
  onRename: () => void
  onNavigate?: () => void
}

export function Sidebar({ onNewLink, onSettings, onRename, onNavigate }: Props) {
  const s = useStore()
  const seen = new Set<string>()
  const recents = s.history.filter((x) => !seen.has(x.vid) && seen.add(x.vid)).slice(0, 6)
  const h = s.history
  const sources = [
    { k: "youtube" as const, label: "YouTube", Icon: Play, cls: "bg-yt text-white", n: h.filter((x) => x.source === "youtube" && !x.audio).length },
    { k: "music" as const, label: "YouTube Music", Icon: Music2, cls: "bg-ytm text-white", n: h.filter((x) => x.source === "music" && !x.audio).length },
    { k: "audio" as const, label: "Só áudio", Icon: Headphones, cls: "bg-tile-green text-ink", n: h.filter((x) => x.audio).length },
  ]
  const go = (fn: () => void) => () => { fn(); onNavigate?.() }

  return (
    <div className="flex h-full flex-col gap-1 px-4 pt-5 pb-4">
      <button onClick={onRename} title="Clique pra mudar seu nome"
        className="-mx-1.5 mb-5 flex items-center gap-2.5 rounded-xl p-1.5 text-left transition hover:bg-white/7">
        <span className="grid size-8 place-items-center rounded-full bg-linear-135 from-tile-yellow to-tile-orange text-sm font-bold text-ink">
          {(s.settings.name || "V").trim()[0]?.toUpperCase()}
        </span>
        <span className="font-semibold">{s.settings.name}</span>
      </button>

      <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>Recentes</span>
        <Button size="icon-xs" variant="secondary" className="rounded-full" onClick={go(onNewLink)} title="Novo link (/)"><Plus /></Button>
      </div>
      <ul className="mb-4 grid gap-0.5">
        {recents.length ? recents.map((x) => (
          <li key={x.vid}>
            <button onClick={go(() => fetchInfo(x.url))} title={x.title}
              className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] transition hover:translate-x-0.5 hover:bg-white/7",
                s.info?.id === x.vid && "bg-white/12")}>
              <img src={thumbUrl(x.thumb)} alt="" className="h-[18px] w-[26px] flex-none rounded-sm bg-white/10 object-cover" />
              <span className="truncate">{x.title}</span>
            </button>
          </li>
        )) : <li className="px-2 py-1 text-xs text-muted-foreground/70">Seus downloads aparecem aqui</li>}
      </ul>

      <div className="mb-2 text-xs font-medium text-muted-foreground">Fontes</div>
      <ul className="mb-2 grid gap-0.5">
        {sources.map(({ k, label, Icon, cls, n }) => (
          <li key={k}>
            <button onClick={go(() => setFilter(s.tab === "hist" && s.filter === k ? null : k))}
              className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] transition hover:translate-x-0.5 hover:bg-white/7",
                s.tab === "hist" && s.filter === k && "bg-white/12")}>
              <span className={cn("grid size-6.5 flex-none place-items-center rounded-full", cls)}><Icon className="size-3.5" /></span>
              <span className="flex-1 truncate">{label}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{n}</span>
            </button>
          </li>
        ))}
      </ul>
      <button onClick={go(() => { setTab("hist"); setFilter(null) })}
        className="self-start px-2 text-xs text-muted-foreground underline underline-offset-3 hover:text-foreground">
        Ver histórico
      </button>

      <button onClick={go(onSettings)}
        className="mt-auto flex items-center gap-2 rounded-lg p-2 text-[13px] text-muted-foreground transition hover:bg-white/7 hover:text-foreground">
        <SlidersHorizontal className="size-4" /> Ajustes
      </button>
    </div>
  )
}
