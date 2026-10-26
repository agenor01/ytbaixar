import { ExternalLink, Film, HardDrive, Headphones, RefreshCw, Share, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { MagicCard } from "@/components/ui/magic-card"
import { NumberTicker } from "@/components/ui/number-ticker"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cancelJob, copy, fetchInfo, focusJob, lastDownloadText, redo, setFilter, setTab, useStore } from "@/lib/store"
import { ago, fmtBytes, overall, thumbUrl } from "@/lib/format"
import { useTick } from "@/lib/hooks"
import { ACTIVE, FINISHED, type Tab } from "@/lib/types"
import { cn } from "@/lib/utils"

const qualityLabel = (audio: boolean, q: string) =>
  audio ? <><Headphones className="size-3" /> M4A</> : <><Film className="size-3" /> {q === "best" ? "máx" : q + "p"}</>

export function Board() {
  useTick(30000)
  const s = useStore()
  const active = s.jobs.filter((j) => ACTIVE.includes(j.status))
  const done = s.jobs.filter((j) => FINISHED.includes(j.status))
  const total = s.history.reduce((n, x) => n + (x.bytes || 0), 0)
  const totalMb = total / 1048576

  const links = s.tab === "hist" ? s.history.map((x) => x.url) : s.jobs.map((j) => j.info.url)
  const exportLinks = () => {
    const uniq = [...new Set(links)]
    if (!uniq.length) return toast.error("Lista vazia")
    copy(uniq.join("\n"), `${uniq.length} link(s) copiados`)
  }

  let rows: React.ReactNode
  if (s.tab !== "hist") {
    const list = (s.tab === "fila" ? active : done).slice().sort((a, b) => b.created - a.created)
    rows = list.length ? list.map((j) => {
      const pct = overall(j)
      const st = {
        iniciando: "preparando…", baixando: `${Math.floor(pct)}%${j.speed ? " · " + j.speed : ""}`, convertendo: "finalizando…",
        pronto: <><span className="text-tile-green">salvo</span> · {fmtBytes(j.bytes)}</>,
        erro: <span className="text-red-300">erro</span>, cancelado: "cancelado",
      }[j.status]
      return (
        <li key={j.tmp} className={cn("grid animate-in grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-1.5 py-2.5 fade-in slide-in-from-bottom-1 hover:bg-white/7", s.focus === j.id && "bg-white/7")}>
          <img src={thumbUrl(j.info.thumbnail)} alt="" onClick={() => focusJob(j.id)} className="aspect-video w-16 cursor-pointer rounded-md bg-white/10 object-cover" />
          <div className="min-w-0">
            <div onClick={() => focusJob(j.id)} className="cursor-pointer truncate font-medium">{j.info.title}</div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{qualityLabel(j.audio, j.quality)} · {st}</div>
            {s.tab === "fila" && (
              <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-tile-yellow transition-[width] duration-300" style={{ width: pct + "%" }} />
              </div>
            )}
          </div>
          {s.tab === "fila"
            ? <Button size="icon-sm" variant="ghost" title="Cancelar" onClick={() => cancelJob(j.id)}><X /></Button>
            : <Button size="icon-sm" variant="ghost" title="Baixar de novo" onClick={() => redo(j)}><RefreshCw /></Button>}
        </li>
      )
    }) : (
      <li className="py-7 text-center text-[13px] text-muted-foreground/80">
        {s.tab === "fila" ? <>Nada baixando agora. Aperte <b>Baixar</b> ou a tecla D.</> : "Nenhum download concluído nesta sessão."}
      </li>
    )
  } else {
    const f = s.filter
    const list = s.history.filter((x) => !f || (f === "audio" ? x.audio : x.source === f && !x.audio)).slice(0, 60)
    rows = list.length ? list.map((x) => (
      <li key={x.at} className="grid animate-in grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-1.5 py-2.5 fade-in hover:bg-white/7">
        <img src={thumbUrl(x.thumb)} alt="" onClick={() => fetchInfo(x.url)} className="aspect-video w-16 cursor-pointer rounded-md bg-white/10 object-cover" />
        <div className="min-w-0">
          <div onClick={() => fetchInfo(x.url)} className="cursor-pointer truncate font-medium">{x.title}</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{qualityLabel(x.audio, x.quality)} · {fmtBytes(x.bytes)} · {ago(x.at)}</div>
        </div>
        <div className="flex gap-1">
          <Button size="icon-sm" variant="ghost" title="Abrir aqui" onClick={() => fetchInfo(x.url)}><RefreshCw /></Button>
          <Button size="icon-sm" variant="ghost" title="Abrir no YouTube" onClick={() => window.open(x.url, "_blank", "noopener")}><ExternalLink /></Button>
        </div>
      </li>
    )) : (
      <li className="py-7 text-center text-[13px] text-muted-foreground/80">
        {f ? <>Nada nesse filtro. <button className="underline" onClick={() => setFilter(null)}>Mostrar tudo</button></> : "O histórico aparece aqui depois do primeiro download."}
      </li>
    )
  }

  return (
    <section id="downloads" className="mt-6 scroll-mt-4">
      <div className="mb-2.5 grid grid-cols-[1fr_auto] items-center gap-2.5 md:grid-cols-[1fr_auto_1fr]">
        <h2 className="text-sm font-semibold">Downloads</h2>
        <Tabs value={s.tab} onValueChange={(v) => setTab(v as Tab)} className="col-span-full row-start-2 md:col-span-1 md:row-start-1 md:col-start-2">
          <TabsList className="rounded-xl border border-white/9 bg-black/25">
            <TabsTrigger value="fila" className="px-3.5">
              Fila {active.length > 0 && <span className="rounded-full bg-yt px-1.5 text-[10px] text-white">{active.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="feitos" className="px-3.5">Concluídos</TabsTrigger>
            <TabsTrigger value="hist" className="px-3.5">Histórico</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button size="icon-sm" variant="secondary" className="justify-self-end rounded-full" title="Copiar links da lista" onClick={exportLinks}><Share /></Button>
      </div>

      <MagicCard className="rounded-[18px]" gradientColor="rgba(var(--glow), .18)" gradientFrom="#f8d65b" gradientTo="#f05ad2">
        <div className="p-4">
          <div className="flex flex-col justify-between gap-4 border-b border-white/9 pb-3.5 sm:flex-row">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-linear-135 from-tile-yellow to-tile-orange text-lg font-bold text-ink">
                {(s.settings.name || "V").trim()[0]?.toUpperCase()}
              </span>
              <div>
                <strong className="block text-xl font-semibold tracking-tight">
                  <NumberTicker value={s.history.length} className="tracking-tight" /> arquivo{s.history.length === 1 ? "" : "s"}
                </strong>
                <span className="text-xs text-muted-foreground">{lastDownloadText()}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 sm:flex-row-reverse sm:text-right">
              <HardDrive className="size-6.5 text-muted-foreground" />
              <div>
                <strong className="block text-xl font-semibold tracking-tight">
                  {totalMb >= 1024
                    ? <><NumberTicker value={totalMb / 1024} decimalPlaces={1} className="tracking-tight" /> GB</>
                    : totalMb >= 1 || !total
                      ? <><NumberTicker value={Math.round(totalMb)} className="tracking-tight" /> MB</>
                      : <><NumberTicker value={Math.round(total / 1024)} className="tracking-tight" /> KB</>}
                </strong>
                <span className="text-xs text-muted-foreground">baixados no total</span>
              </div>
            </div>
          </div>
          <ul>{rows}</ul>
        </div>
      </MagicCard>
    </section>
  )
}
