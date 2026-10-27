import type { ReactNode } from "react"
import {
  Calendar, Check, ChevronLeft, ChevronRight, Clapperboard, Clock, Copy, Download, Eye, Film, Headphones, Heart, Link2, Music2, Play, User, X,
} from "lucide-react"
import { BorderBeam } from "@/components/ui/border-beam"
import { NumberTicker } from "@/components/ui/number-ticker"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cancelJob, copy, setAudio, setQuality, stepQuality, toggleFormat, useStore } from "@/lib/store"
import { SOURCES, fmtBytes, fmtDate, fmtDur, fmtNum, overall, qualityList, qualityTag, singleStream, sizeFor, yearsAgo } from "@/lib/format"
import { tilt } from "@/lib/hooks"
import { ACTIVE } from "@/lib/types"
import { cn } from "@/lib/utils"

function Tile({ className, label, action, children, ...rest }: {
  className?: string; label: string; action?: ReactNode; children: ReactNode
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <article
      {...tilt}
      {...rest}
      className={cn(
        "relative min-h-[150px] rounded-[18px] p-4 pt-3.5 text-ink transition-[transform,box-shadow] duration-200 select-none will-change-transform hover:shadow-[0_16px_34px_rgba(0,0,0,.35)]",
        className,
      )}
    >
      <header className="mb-2 flex h-7 items-center justify-between text-[11px] font-bold tracking-wider uppercase">
        <span>{label}</span>
        {action}
      </header>
      {children}
    </article>
  )
}

function TileButton({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button title={title} aria-label={title} onClick={(e) => { e.stopPropagation(); onClick() }}
      className="grid size-7 place-items-center rounded-lg bg-white/55 transition hover:bg-white/85 active:scale-90 [&_svg]:size-3.5">
      {children}
    </button>
  )
}

/* ---------- Progresso ---------- */
function ProgressTile() {
  const { jobs, focus, info, audio, quality } = useStore()
  const job = jobs.find((j) => j.id === focus)
  const active = !!job && ACTIVE.includes(job.status)
  const pct = job ? overall(job) : 0
  const isAudio = job ? job.audio : audio
  // Arquivo único (só áudio, ou TikTok que já vem com som) não tem a etapa "parte 2: áudio"
  const single = job ? singleStream(job) : audio || info?.source === "tiktok"
  const indet = job && (job.status === "iniciando" || (job.status === "convertendo" && job.percent >= 100 && (single || job.part >= 2)))
  const site = SOURCES[job?.info.source || info?.source || "youtube"].label

  const [note, sub] = !job
    ? [info ? "Pronto pra baixar" : "Nenhum download ainda", info ? `${audio ? "M4A" : "MP4"} · ≈ ${fmtBytes(sizeFor(info, quality, audio))}` : "escolha qualidade e formato"]
    : ({
        iniciando: ["Preparando…", "falando com o " + site],
        baixando: [
          (job.audio ? "Baixando áudio" : single ? "Baixando vídeo" : job.part >= 2 ? "Parte 2 de 2 · áudio" : "Parte 1 de 2 · vídeo") + (job.size ? ` de ${job.size}` : ""),
          [job.speed, job.eta && "faltam " + job.eta].filter(Boolean).join(" · ") || "…",
        ],
        convertendo: ["Finalizando…", job.audio ? "convertendo pra M4A" : single ? "preparando o MP4" : "juntando vídeo e áudio"],
        pronto: ["Concluído!", `${job.name || ""} · ${fmtBytes(job.bytes)}`],
        erro: ["Deu erro", job.error || ""],
        cancelado: ["Cancelado", "o download foi interrompido"],
      } as const)[job.status]

  const videoDone = !!job && (job.part >= 2 || pct >= 50)
  const markers = (single
    ? [{ left: 0, Icon: isAudio ? Music2 : Film, done: pct >= 100, now: pct < 100 }]
    : [
        { left: 0, Icon: Film, done: videoDone, now: !job || !videoDone },
        { left: 50, Icon: Music2, done: pct >= 100, now: !!job && videoDone && pct < 100 },
      ]
  ).concat({ left: 100, Icon: Check, done: job?.status === "pronto", now: false })

  return (
    <Tile label="Progresso" className="col-span-full bg-tile-yellow md:col-span-4"
      action={active && <TileButton title="Cancelar (Esc)" onClick={() => cancelJob(job!.id)}><X /></TileButton>}>
      {active && <BorderBeam size={90} duration={5} borderWidth={2} colorFrom="#1c1c20" colorTo="#ffffff" />}
      <div className="flex items-center gap-2.5">
        <Download className="size-5.5" />
        <strong className="text-[34px] leading-none font-semibold tracking-tight">
          <NumberTicker value={Math.floor(pct)} className="tracking-tight text-ink dark:text-ink" />
          <small className="text-xl font-medium">%</small>
        </strong>
        <div className="ml-1 min-w-0 text-xs leading-snug">
          <span className="block truncate">{note}</span>
          <b className="block truncate">{sub}</b>
        </div>
      </div>
      <div className="relative mx-2 mt-6 mb-1.5 h-1.5 overflow-hidden rounded-full bg-black/14">
        {indet ? <div className="indet-bar bg-ink" /> : <div className="h-full rounded-full bg-ink transition-[width] duration-300" style={{ width: pct + "%" }} />}
      </div>
      <div className="relative mx-2 -mt-[15px] h-0">
        {markers.map(({ left, Icon, done, now }, i) => (
          <span key={i} style={{ left: left + "%" }}
            className={cn("absolute -top-[13px] -ml-[13px] grid size-[26px] place-items-center rounded-full border-2 border-tile-yellow bg-white shadow transition-all duration-300 [&_svg]:size-3",
              done && "bg-ink text-tile-yellow", now && "scale-115 ring-4 ring-black/12")}>
            <Icon />
          </span>
        ))}
      </div>
    </Tile>
  )
}

/* ---------- Duração ---------- */
function TimeTile() {
  const { info } = useStore()
  const d = fmtDate(info?.uploaded)
  return (
    <Tile label="Duração" className="col-span-1 bg-tile-orange md:col-span-2"
      action={info && <TileButton title="Copiar duração" onClick={() => copy(fmtDur(info.duration), "Duração copiada")}><Copy /></TileButton>}>
      <div className="flex items-center gap-2.5">
        <Clock className="size-5.5" />
        <strong key={info?.id} className="animate-in fade-in zoom-in-95 text-[34px] leading-none font-semibold tracking-tight tabular-nums">
          {fmtDur(info?.duration || 0)}
        </strong>
      </div>
      <p className="mt-2 text-xs">{d ? `Publicado em ${d.toLocaleDateString("pt-BR")}` : "Publicado em —"}</p>
      <b className="block text-xs">{d ? yearsAgo(d) : " "}</b>
    </Tile>
  )
}

/* ---------- Qualidade ---------- */
function QualityTile() {
  const { info, quality, audio } = useStore()
  const list = qualityList(info)            // best, maior … menor
  const steps = list.slice(1).reverse()     // menor … maior (pro slider)
  const off = !info || audio
  const effective = quality === "best" ? info?.heights[0] : +quality
  const idx = Math.max(0, steps.indexOf(String(effective)))

  return (
    <Tile label="Qualidade" className={cn("col-span-1 bg-tile-purple md:col-span-2", off && "opacity-70")}
      onWheel={(e) => { if (!off) stepQuality(e.deltaY < 0 ? 1 : -1) }}
      action={!off && <TileButton title="Qualidade maior (↑)" onClick={() => stepQuality(1)}><ChevronRight /></TileButton>}>
      <div className="flex items-center gap-2.5">
        {!off && (
          <button onClick={() => stepQuality(-1)} title="Qualidade menor (↓)"
            className="grid size-6.5 place-items-center rounded-full bg-white/45 hover:bg-white/80 [&_svg]:size-3.5"><ChevronLeft /></button>
        )}
        <strong className="text-[34px] leading-none font-semibold tracking-tight">
          {!info ? "—" : audio ? "Áudio" : <>{effective ?? "Máx"}<small className="text-xl font-medium">p</small></>}
        </strong>
      </div>
      <p className="mt-2 text-xs leading-snug">
        {!info ? "Busque um vídeo pra ver as opções"
          : audio ? <>Melhor áudio disponível<b className="block">≈ {fmtBytes(info.sizes?.audio)}</b></>
          : <>{quality === "best" ? "A melhor que tiver · " : ""}{qualityTag(effective)}<b className="block">≈ {fmtBytes(sizeFor(info, quality, false))}</b></>}
      </p>
      {!off && steps.length > 1 && (
        <Slider
          className="mt-3 **:data-[slot=slider-range]:bg-ink **:data-[slot=slider-thumb]:size-4 **:data-[slot=slider-thumb]:border-ink **:data-[slot=slider-track]:bg-black/15"
          min={0} max={steps.length - 1} step={1} value={[idx]}
          onValueChange={(v) => {
            const i = Array.isArray(v) ? v[0] : (v as number)
            setQuality(i === steps.length - 1 ? "best" : steps[i])
          }}
          aria-label="Qualidade"
        />
      )}
    </Tile>
  )
}

/* ---------- Formato ---------- */
function FormatTile() {
  const { audio } = useStore()
  return (
    <Tile label="Formato" role="switch" aria-checked={audio} tabIndex={0}
      className="col-span-1 cursor-pointer bg-tile-green outline-none focus-visible:ring-3 focus-visible:ring-white md:col-span-2"
      onClick={toggleFormat}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleFormat() } }}
      action={
        <span onClick={(e) => e.stopPropagation()}>
          <Switch checked={audio} onCheckedChange={setAudio} aria-label="Só áudio"
            className="data-checked:bg-ink data-unchecked:bg-black/20 dark:data-unchecked:bg-black/20 **:data-[slot=switch-thumb]:bg-white dark:**:data-[slot=switch-thumb]:bg-white" />
        </span>
      }>
      <div key={String(audio)} className="flex animate-in items-center gap-2.5 zoom-in-90 fade-in">
        {audio ? <Headphones className="size-5.5" /> : <Film className="size-5.5" />}
        <strong className="text-[34px] leading-none font-semibold tracking-tight">{audio ? "M4A" : "MP4"}</strong>
      </div>
      <p className="mt-2 text-xs">{audio ? "Só o áudio, AAC" : "Vídeo + áudio, H.264"}</p>
      <b className="block text-xs">toque pra trocar</b>
    </Tile>
  )
}

/* ---------- Detalhes ---------- */
function DetailsTile() {
  const { info } = useStore()
  const d = fmtDate(info?.uploaded)
  const items = [
    { Icon: Eye, tip: info?.views != null ? `${fmtNum(info.views)} visualizações` : null },
    { Icon: Heart, tip: info?.likes != null ? `${fmtNum(info.likes)} curtidas` : null },
    { Icon: Calendar, tip: d ? d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) : null },
    { Icon: info?.source === "music" ? Music2 : info?.source === "tiktok" ? Clapperboard : Play, tip: info ? "Veio do " + SOURCES[info.source].label : null },
    { Icon: User, tip: info?.artist || null, run: () => info?.channelUrl && window.open(info.channelUrl, "_blank", "noopener") },
    { Icon: Link2, tip: info ? "Copiar link do vídeo" : null, run: () => info && copy(info.webpage, "Link copiado") },
  ]
  return (
    <Tile label="Detalhes" className="col-span-full bg-tile-blue sm:col-span-1 md:col-span-2"
      action={info && <TileButton title="Copiar detalhes" onClick={() => copy(
        [info.title, info.artist, fmtDur(info.duration), d?.toLocaleDateString("pt-BR"), info.views != null && fmtNum(info.views) + " visualizações", info.webpage]
          .filter(Boolean).join("\n"), "Detalhes copiados")}><Copy /></TileButton>}>
      <div className="mt-1.5 grid grid-cols-3 justify-items-center gap-x-1.5 gap-y-2.5">
        {items.map(({ Icon, tip, run }, i) => (
          <Tooltip key={i}>
            <TooltipTrigger
              disabled={!tip}
              onClick={() => (run ? run() : tip && copy(tip, "Copiado: " + tip))}
              className="grid size-9 place-items-center rounded-[10px] transition hover:-translate-y-0.5 hover:bg-white/60 disabled:opacity-30 [&_svg]:size-4.5"
            >
              <Icon />
            </TooltipTrigger>
            {tip && <TooltipContent>{tip}</TooltipContent>}
          </Tooltip>
        ))}
      </div>
      <p className="mt-2 text-center text-xs font-semibold">{info ? "toque nos ícones" : "—"}</p>
    </Tile>
  )
}

export function Tiles() {
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-6">
      <ProgressTile />
      <TimeTile />
      <QualityTile />
      <FormatTile />
      <DetailsTile />
    </section>
  )
}
