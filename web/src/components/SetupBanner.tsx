import { useEffect, useState } from "react"
import { AlertCircle, Download, Loader2, Monitor } from "lucide-react"
import { RELEASE_URL, fetchStatus, isHosted, type ServerStatus } from "@/lib/backend"

// Avisos do topo:
// - site publicado sem servidor (Cloudflare): explica e leva pro instalador
// - instalação nova: mostra o ffmpeg sendo baixado até ficar pronto
export function SetupBanner() {
  const [hosted, setHosted] = useState(false)
  const [s, setS] = useState<ServerStatus["ffmpeg"] | null>(null)

  useEffect(() => {
    let stop = false, tries = 0, t: ReturnType<typeof setTimeout>
    isHosted().then((h) => {
      if (stop) return
      if (h) { setHosted(true); return }
      const poll = async () => {
        const d = await fetchStatus()
        if (stop) return
        if (d) { setS(d.ffmpeg); if (d.ffmpeg.state === "ok") return }
        else if (tries++ > 20) return // servidor antigo sem /api/status: não fica perguntando pra sempre
        t = setTimeout(poll, 1500)
      }
      poll()
    })
    return () => { stop = true; clearTimeout(t) }
  }, [])

  if (hosted) {
    return (
      <div className="mb-3 flex animate-in flex-col gap-3 rounded-2xl border border-white/9 bg-black/30 px-4 py-3 text-[13px] fade-in slide-in-from-top-2 sm:flex-row sm:items-center">
        <Monitor className="hidden size-5 flex-none sm:block" />
        <div className="min-w-0 flex-1">
          <b className="font-semibold">Esta é a versão online do ytbaixar</b>
          <span className="block text-xs text-muted-foreground">
            Os downloads rodam no seu PC (yt-dlp + ffmpeg). Instale o app grátis pra Windows e baixe direto dele.
          </span>
        </div>
        <a href={RELEASE_URL} target="_blank" rel="noopener"
          className="inline-flex flex-none items-center justify-center gap-2 rounded-xl bg-yt px-4 py-2 font-semibold text-white transition hover:-translate-y-0.5 active:scale-95">
          <Download className="size-4" /> Baixar o app
        </a>
      </div>
    )
  }

  if (!s || s.state === "ok" || s.state === "checando") return null
  const err = s.state === "erro"
  return (
    <div className="mb-3 flex animate-in items-center gap-3 rounded-2xl border border-white/9 bg-black/30 px-4 py-2.5 text-[13px] fade-in slide-in-from-top-2">
      {err ? <AlertCircle className="size-4 flex-none text-red-300" /> : <Loader2 className="size-4 flex-none animate-spin" />}
      <div className="min-w-0 flex-1">
        <b className="font-semibold">{err ? "Não consegui preparar o ffmpeg" : "Preparando o ytbaixar pela primeira vez"}</b>
        <span className="block truncate text-xs text-muted-foreground">
          {err ? "Confira a internet; ele tenta de novo quando você baixar algo." : `Baixando o ffmpeg (junta vídeo e áudio) · ${s.pct}% — dá pra ir buscando vídeos`}
        </span>
        {!err && (
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-tile-yellow transition-[width] duration-500" style={{ width: s.pct + "%" }} />
          </div>
        )}
      </div>
    </div>
  )
}
