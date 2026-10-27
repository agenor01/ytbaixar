import { AnimatePresence } from "motion/react"
import { AlertCircle, Check, Download, Music2, Sparkles, Trash2, X } from "lucide-react"
import { AnimatedListItem } from "@/components/ui/animated-list"
import { Button } from "@/components/ui/button"
import { clearFeed, useStore } from "@/lib/store"
import { ago } from "@/lib/format"
import { useTick } from "@/lib/hooks"
import type { FeedKind } from "@/lib/types"
import { cn } from "@/lib/utils"

const ICONS = { alert: AlertCircle, check: Check, download: Download, music: Music2, sparkle: Sparkles, x: X }
const AV: Record<FeedKind, string> = {
  yt: "bg-yt text-white", music: "bg-ytm text-white", tt: "bg-tt text-white", sys: "bg-[#4b4d57] text-white",
  ok: "bg-[#2f9e5b] text-white", err: "bg-[#c94242] text-white", dl: "bg-tile-yellow text-ink",
}

export function Feed({ className }: { className?: string }) {
  useTick(30000)
  const { feed } = useStore()
  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Atividade</h2>
        <Button size="icon-sm" variant="ghost" title="Limpar" onClick={clearFeed}><Trash2 /></Button>
      </div>
      {!feed.length && <p className="px-1 py-2 text-[13px] text-muted-foreground/80">Nada por aqui ainda. Cole um link pra começar.</p>}
      <div className="grid gap-2">
        <AnimatePresence initial={false}>
          {feed.map((f) => {
            const Icon = ICONS[(f.icon as keyof typeof ICONS) || "sparkle"] || Sparkles
            return (
              <AnimatedListItem key={f.id}>
                <div className={cn("relative grid grid-cols-[34px_1fr] gap-2.5 rounded-2xl border border-white/5 bg-white/7 p-3", f.thread && "ml-5")}>
                  {f.thread && (
                    <span className="absolute -top-2.5 -left-3.5 h-8.5 w-2.5 rounded-bl-lg border-b-[1.5px] border-l-[1.5px] border-white/20" />
                  )}
                  <span className={cn("grid size-[34px] place-items-center overflow-hidden rounded-full [&_svg]:size-4", AV[f.av])}>
                    {f.img ? <img src={f.img} alt="" className="size-full object-cover" /> : <Icon />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex justify-between gap-2 text-[13px] font-semibold">
                      <span className="truncate">{f.who}</span>
                      <time className="flex-none text-[11px] font-normal text-muted-foreground/80">{ago(f.time)}</time>
                    </div>
                    <p className="mt-0.5 text-[13px] break-words text-white/85">{f.text}</p>
                    {f.action && (
                      <button onClick={f.action.run} className="mt-1.5 text-xs font-semibold hover:underline">{f.action.label}</button>
                    )}
                  </div>
                </div>
              </AnimatedListItem>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
