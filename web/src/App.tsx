import { useEffect, useRef, useState } from "react"
import { Activity, Download, House, Menu, SlidersHorizontal } from "lucide-react"
import { toast } from "sonner"
import { Backdrop } from "@/components/Backdrop"
import { Board } from "@/components/Board"
import { Feed } from "@/components/Feed"
import { DownloadButton, Hero } from "@/components/Hero"
import { SearchBar } from "@/components/SearchBar"
import { SettingsPanel } from "@/components/Settings"
import { SetupBanner } from "@/components/SetupBanner"
import { Sidebar } from "@/components/Sidebar"
import { Tiles } from "@/components/Tiles"
import { Button } from "@/components/ui/button"
import { Confetti, type ConfettiRef } from "@/components/ui/confetti"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Kbd } from "@/components/ui/kbd"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  addFeed, cancelJob, fetchInfo, getState, onDone, saveSettings, startDownload, stepQuality, toggleFormat, useStore,
} from "@/lib/store"
import { isYtLink, thumbUrl } from "@/lib/format"
import { ACTIVE } from "@/lib/types"
import { cn } from "@/lib/utils"

let started = false // o StrictMode roda os efeitos duas vezes no dev

export default function App() {
  const s = useStore()
  const urlRef = useRef<HTMLInputElement>(null)
  const confetti = useRef<ConfettiRef>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [feedOpen, setFeedOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const activeCount = s.jobs.filter((j) => ACTIVE.includes(j.status)).length

  const focusSearch = () => { urlRef.current?.select(); urlRef.current?.focus() }
  const rename = () => {
    const n = prompt("Como quer ser chamado?", s.settings.name)
    if (n?.trim()) { saveSettings({ name: n.trim().slice(0, 24) }); toast.success(`Oi, ${n.trim()}!`) }
  }

  // Confete quando um download termina
  useEffect(() => onDone(() => {
    if (!getState().settings.confetti) return
    const fire = (x: number) => confetti.current?.fire({ particleCount: 70, spread: 70, startVelocity: 45, origin: { x, y: 0.75 },
      colors: ["#f8d65b", "#f8934d", "#c7a6f6", "#b8ee6b", "#9bd6fa"] })
    fire(0.25); setTimeout(() => fire(0.75), 150)
  }), [])

  // Primeira mensagem + link vindo pela URL (?url= / compartilhar pro app)
  useEffect(() => {
    if (started) return
    started = true
    addFeed({ who: "ytbaixar", av: "sys", icon: "sparkle",
      text: "Cole um link (Ctrl+V), arraste da barra de endereço ou digite. Atalhos: / busca · D baixa · F troca formato · ↑↓ qualidade." })
    const q = new URLSearchParams(location.search)
    const shared = [q.get("url"), q.get("text"), q.get("title")].map((v) => v?.match(/https?:\/\/\S+/)?.[0]).find((v) => v && isYtLink(v))
    if (shared) fetchInfo(shared, { auto: true })
    else if (q.has("paste")) setTimeout(focusSearch, 300) // atalho "Colar link e baixar" do app instalado
    if (location.search) history.replaceState(null, "", location.pathname)
  }, [])

  // Ctrl+V em qualquer lugar, arrastar e soltar, atalhos de teclado
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest("input, textarea, [role=dialog]")) return
      const t = e.clipboardData?.getData("text").trim() || ""
      if (isYtLink(t)) { e.preventDefault(); fetchInfo(t, { auto: true }) }
    }
    let depth = 0
    const enter = (e: DragEvent) => { e.preventDefault(); depth++; setDragging(true) }
    const leave = () => { if (--depth <= 0) { depth = 0; setDragging(false) } }
    const over = (e: DragEvent) => e.preventDefault()
    const drop = (e: DragEvent) => {
      e.preventDefault(); depth = 0; setDragging(false)
      const dt = e.dataTransfer
      const t = (dt?.getData("text/uri-list") || dt?.getData("text/plain") || "").split(/\r?\n/).find((l) => l && !l.startsWith("#"))
      if (t) fetchInfo(t, { auto: true }); else toast.error("Solte um link do YouTube")
    }
    const key = (e: KeyboardEvent) => {
      const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || "") || document.querySelector("[role=dialog]")
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return
      const st = getState()
      const k = e.key.toLowerCase()
      if (k === "/") { e.preventDefault(); focusSearch() }
      else if (k === "d") startDownload()
      else if (k === "f") toggleFormat()
      else if ((k === "arrowup" || k === "arrowright") && st.info) { e.preventDefault(); stepQuality(1) }
      else if ((k === "arrowdown" || k === "arrowleft") && st.info) { e.preventDefault(); stepQuality(-1) }
      else if (k === "escape" && st.focus) cancelJob(st.focus)
    }
    window.addEventListener("paste", onPaste)
    window.addEventListener("dragenter", enter)
    window.addEventListener("dragleave", leave)
    window.addEventListener("dragover", over)
    window.addEventListener("drop", drop)
    window.addEventListener("keydown", key)
    return () => {
      window.removeEventListener("paste", onPaste)
      window.removeEventListener("dragenter", enter)
      window.removeEventListener("dragleave", leave)
      window.removeEventListener("dragover", over)
      window.removeEventListener("drop", drop)
      window.removeEventListener("keydown", key)
    }
  }, [])

  // Avisa o servidor que a janela está aberta (o app de PC desliga sozinho quando fecha)
  useEffect(() => {
    const ping = () => fetch("/api/ping", { method: "POST" }).catch(() => {})
    ping()
    const t = setInterval(ping, 20000)
    return () => clearInterval(t)
  }, [])

  const backdrop = thumbUrl(s.info?.thumbnail || s.history[0]?.thumb)
  const sidebarProps = { onNewLink: focusSearch, onSettings: () => setSettingsOpen(true), onRename: rename }

  return (
    <TooltipProvider>
      <Backdrop src={backdrop} />

      {/* Barra do topo no celular */}
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-white/8 px-4 py-2.5 glass-bar md:hidden" style={{ paddingTop: "max(10px, env(safe-area-inset-top))" }}>
        <Button size="icon" variant="ghost" onClick={() => setMenuOpen(true)} aria-label="Menu"><Menu /></Button>
        <span className="font-bold">yt<span className="text-yt">baixar</span></span>
        {activeCount > 0 && <span className="ml-auto rounded-full bg-tile-yellow px-2 py-0.5 text-xs font-semibold text-ink">{activeCount} baixando</span>}
      </header>

      <div className="mx-auto grid max-w-[1320px] md:my-6 md:h-[calc(100dvh-48px)] md:grid-cols-[200px_minmax(0,1fr)] md:overflow-hidden md:rounded-[22px] md:border md:border-white/9 md:shadow-[0_30px_80px_rgba(0,0,0,.45)] md:glass lg:grid-cols-[220px_minmax(0,1fr)_310px]">
        <aside className="thin-scroll hidden overflow-y-auto border-r border-white/9 bg-black/25 md:block">
          <Sidebar {...sidebarProps} />
        </aside>

        <main className="thin-scroll min-w-0 px-4 pt-4 pb-32 md:overflow-y-auto md:px-7 md:pt-5 md:pb-7">
          <SetupBanner />
          <SearchBar ref={urlRef} />
          <Hero />
          <Tiles />
          <Board />
          <Feed className="mt-6 hidden md:block lg:hidden" />
          <p className="mt-6 hidden flex-wrap items-center gap-1.5 text-xs text-muted-foreground md:flex">
            Atalhos: <Kbd>/</Kbd> busca <Kbd>D</Kbd> baixa <Kbd>F</Kbd> formato <Kbd>↑</Kbd><Kbd>↓</Kbd> qualidade <Kbd>Esc</Kbd> cancela
          </p>
        </main>

        <aside className="thin-scroll hidden overflow-y-auto border-l border-white/9 px-4 pt-5 pb-4 lg:block">
          <Feed />
        </aside>
      </div>

      {/* Celular: botão de baixar flutuante + barra de navegação embaixo */}
      {s.info && (
        <div className="fixed inset-x-4 bottom-[76px] z-30 flex animate-in justify-center fade-in slide-in-from-bottom-4 md:hidden" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
          <DownloadButton className="w-full max-w-sm" />
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-white/8 glass-bar md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {[
          { label: "Início", Icon: House, run: () => window.scrollTo({ top: 0, behavior: "smooth" }), badge: 0 },
          { label: "Downloads", Icon: Download, run: () => document.getElementById("downloads")?.scrollIntoView({ behavior: "smooth" }), badge: activeCount },
          { label: "Atividade", Icon: Activity, run: () => setFeedOpen(true), badge: 0 },
          { label: "Ajustes", Icon: SlidersHorizontal, run: () => setSettingsOpen(true), badge: 0 },
        ].map(({ label, Icon, run, badge }) => (
          <button key={label} onClick={run} className="relative flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground active:scale-95 active:text-foreground">
            <Icon className="size-5" />
            {label}
            {badge > 0 && <span className="absolute top-1.5 left-1/2 ml-2 rounded-full bg-yt px-1.5 text-[10px] font-semibold text-white">{badge}</span>}
          </button>
        ))}
      </nav>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Sidebar {...sidebarProps} onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <Drawer open={feedOpen} onOpenChange={setFeedOpen} showSwipeHandle>
        <DrawerContent>
          <DrawerHeader className="sr-only"><DrawerTitle>Atividade</DrawerTitle></DrawerHeader>
          <div className="thin-scroll overflow-y-auto px-4 pb-6"><Feed /></div>
        </DrawerContent>
      </Drawer>

      <SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* Soltar link */}
      <div className={cn("pointer-events-none fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm transition-opacity", dragging ? "opacity-100" : "opacity-0")}>
        <div className="rounded-3xl border-2 border-dashed border-white/40 px-14 py-10 text-center text-lg font-semibold">
          <Download className="mx-auto mb-2 size-10" /> Solte o link aqui
        </div>
      </div>

      <Confetti ref={confetti} manualstart className="pointer-events-none fixed inset-0 z-[60] size-full" />
      <Toaster position="bottom-center" theme="dark" offset={{ bottom: 24 }} mobileOffset={{ bottom: 140 }} />
    </TooltipProvider>
  )
}
