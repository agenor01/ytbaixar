import { Download, Headphones, Play, Plus, Share } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { BlurFade } from "@/components/ui/blur-fade"
import { ShimmerButton } from "@/components/ui/shimmer-button"
import { copy, startDownload, useStore } from "@/lib/store"
import { splitTitle, thumbUrl } from "@/lib/format"
import { tilt } from "@/lib/hooks"
import { cn } from "@/lib/utils"

export function DownloadButton({ className }: { className?: string }) {
  const { info, audio } = useStore()
  const music = info?.source === "music"
  return (
    <ShimmerButton
      onClick={startDownload}
      disabled={!info}
      borderRadius="16px"
      background={music ? "#f05ad2" : "#ff4545"}
      className={cn("gap-2.5 px-5 py-3.5 text-[15px] font-bold shadow-[0_10px_30px_rgba(255,69,69,.35)] transition hover:-translate-y-0.5 active:scale-95 disabled:pointer-events-none disabled:opacity-35 disabled:shadow-none",
        music && "shadow-[0_10px_30px_rgba(240,90,210,.35)]", className)}
    >
      {audio ? <Headphones className="size-4" /> : <Download className="size-4" />}
      {audio ? "Baixar áudio" : "Baixar MP4"}
    </ShimmerButton>
  )
}

export function Hero() {
  const { info, loading } = useStore()
  const music = info?.source === "music"
  const [a, b] = info ? splitTitle(info.title) : ["Cole um link", "pra começar"]

  return (
    <section className="my-5 grid items-center gap-5 md:grid-cols-[auto_1fr_auto]">
      <BlurFade key={"c" + (info?.id || "")} duration={0.5} className="justify-self-center md:justify-self-start">
        <div
          {...tilt}
          className={cn(
            "relative overflow-hidden rounded-xl bg-linear-135 from-[#2a2c33] to-[#1a1b20] shadow-[0_18px_40px_rgba(0,0,0,.45)] transition-[width,transform] duration-500",
            music ? "aspect-square w-40 md:w-37" : "aspect-video w-[min(360px,82vw)] md:w-52",
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
          {info && (
            <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold text-white", music ? "bg-ytm" : "bg-yt")}>
              {music ? "YouTube Music" : "YouTube"}
            </span>
          )}
        </div>
        <h1 title={info?.title} className={cn("line-clamp-3 text-2xl leading-tight tracking-tight md:text-[30px]", loading && "shimmer-bg rounded-lg text-transparent")}>
          <b className="font-bold">{a}</b>{b && <> <em className="font-light">{b}</em></>}
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          {info
            ? [info.artist && (music ? "Artista " : "Canal ") + info.artist, info.album && "Álbum " + info.album].filter(Boolean).join(" · ")
            : "Arraste, cole ou digite um endereço do YouTube"}
        </p>
        {info && (
          <a href={info.webpage} target="_blank" rel="noopener" className="text-[13px] underline underline-offset-3">
            {music ? "Abrir no YouTube Music" : "Abrir no YouTube"}
          </a>
        )}
      </BlurFade>

      <DownloadButton className="hidden self-end md:flex" />
    </section>
  )
}
