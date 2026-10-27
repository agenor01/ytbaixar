import { Download, Headphones, Play, Plus, Share } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { BlurFade } from "@/components/ui/blur-fade"
import { ShimmerButton } from "@/components/ui/shimmer-button"
import { copy, startDownload, useStore } from "@/lib/store"
import { SOURCES, splitTitle, thumbUrl } from "@/lib/format"
import { tilt } from "@/lib/hooks"
import { cn } from "@/lib/utils"

export function DownloadButton({ className }: { className?: string }) {
  const { info, audio } = useStore()
  const src = SOURCES[info?.source || "youtube"]
  // A sombra colorida fica num contêiner: "style" no ShimmerButton apagaria as variáveis de cor dele
  return (
    <div className={cn("rounded-2xl transition hover:-translate-y-0.5", className)}
      style={{ boxShadow: info ? `0 10px 30px rgba(${src.glow},.35)` : "none" }}>
      <ShimmerButton
        onClick={startDownload}
        disabled={!info}
        borderRadius="16px"
        background={src.color}
        className="w-full gap-2.5 px-5 py-3.5 text-[15px] font-bold transition active:scale-95 disabled:pointer-events-none disabled:opacity-35"
      >
        {audio ? <Headphones className="size-4" /> : <Download className="size-4" />}
        {audio ? "Baixar áudio" : "Baixar MP4"}
      </ShimmerButton>
    </div>
  )
}

export function Hero() {
  const { info, loading } = useStore()
  const src = info ? SOURCES[info.source] : null
  // Capa no formato do vídeo: quadrada (música), em pé (TikTok/Shorts) ou deitada
  const shape = info?.source === "music" ? "square" : info?.vertical ? "tall" : "wide"
  const [a, b] = info ? splitTitle(info.title) : ["Cole um link", "pra começar"]

  return (
    <section className="my-5 grid items-center gap-5 md:grid-cols-[auto_1fr_auto]">
      <BlurFade key={"c" + (info?.id || "")} duration={0.5} className="justify-self-center md:justify-self-start">
        <div
          {...tilt}
          className={cn(
            "relative overflow-hidden rounded-xl bg-linear-135 from-[#2a2c33] to-[#1a1b20] shadow-[0_18px_40px_rgba(0,0,0,.45)] transition-[width,transform] duration-500",
            shape === "square" && "aspect-square w-40 md:w-37",
            shape === "tall" && "aspect-[9/16] w-36 md:w-28",
            shape === "wide" && "aspect-video w-[min(360px,82vw)] md:w-52",
          )}
        >
          {info?.thumbnail ? (
            <img src={thumbUrl(info.thumbnail)} alt="" className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center text-white/25"><Play className="size-10" /></div>
          )}
          {loading && <div className="shimmer-bg absolute inset-0" />}
        </div>
      </BlurFade>

      <BlurFade key={"t" + (info?.id || "")} delay={0.08} duration={0.5} className="min-w-0 text-center md:text-left">
        <div className="mb-2.5 flex items-center justify-center gap-2 md:justify-start">
          <Button size="icon" variant="secondary" className="rounded-full" title="Adicionar à fila (D)" onClick={startDownload}><Plus /></Button>
          <Button size="icon" variant="secondary" className="rounded-full" title="Copiar link"
            onClick={() => (info ? copy(info.webpage, "Link copiado") : toast.error("Nada pra copiar ainda"))}><Share /></Button>
          {src && (
            <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold text-white", src.chip)}>{src.label}</span>
          )}
        </div>
        <h1 title={info?.title} className={cn("line-clamp-3 text-2xl leading-tight tracking-tight md:text-[30px]", loading && "shimmer-bg rounded-lg text-transparent")}>
          <b className="font-bold">{a}</b>{b && <> <em className="font-light">{b}</em></>}
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          {info && src
            ? [info.artist && `${src.person} ${info.artist}`, info.album && "Álbum " + info.album].filter(Boolean).join(" · ")
            : "Arraste, cole ou digite um link do YouTube ou do TikTok"}
        </p>
        {info && src && (
          <a href={info.webpage} target="_blank" rel="noopener" className="text-[13px] underline underline-offset-3">{src.open}</a>
        )}
      </BlurFade>

      <DownloadButton className="hidden self-end md:flex" />
    </section>
  )
}
