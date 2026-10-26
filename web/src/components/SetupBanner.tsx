import { useEffect, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"

interface Status { ffmpeg: { state: "checando" | "baixando" | "ok" | "erro"; pct: number; error: string | null } }

// Numa instalação nova o servidor baixa o ffmpeg sozinho; mostra o andamento até ficar pronto
export function SetupBanner() {
  const [s, setS] = useState<Status["ffmpeg"] | null>(null)

  useEffect(() => {
    let stop = false, t: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const d: Status = await fetch("/api/status").then((r) => r.json())
        if (stop) return
        setS(d.ffmpeg)
        if (d.ffmpeg.state === "ok") return
      } catch { /* servidor reiniciando */ }
      t = setTimeout(poll, 1500)
    }
    poll()
    return () => { stop = true; clearTimeout(t) }
  }, [])

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
