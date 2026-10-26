import { useEffect, useState, type ReactNode } from "react"
import QRCode from "qrcode"
import { Monitor, Smartphone, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { clearHistory, copy, saveSettings, useStore } from "@/lib/store"
import { useMediaQuery } from "@/lib/hooks"
import { useInstall } from "@/lib/install"

interface Net { local: boolean; lan: { enabled: boolean; urls: string[] } }

const QUALITIES = [
  ["best", "Melhor"], ["2160", "4K"], ["1440", "1440p"], ["1080", "1080p"], ["720", "720p"], ["480", "480p"], ["360", "360p"],
]

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1">
      <span>
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

function PhoneSection() {
  const [net, setNet] = useState<Net | null>(null)
  const [qr, setQr] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => { fetch("/api/net").then((r) => r.json()).then(setNet).catch(() => {}) }, [])
  const url = net?.lan.urls[0]
  useEffect(() => {
    if (!url) { setQr(""); return }
    QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: "#1c1c20", light: "#ffffff" } }).then(setQr)
  }, [url])

  // No celular a seção não faz sentido (só o PC liga/desliga o acesso pela rede)
  if (!net?.local) return null

  async function toggle(enabled: boolean) {
    setBusy(true)
    try {
      const r = await fetch("/api/lan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setNet(d)
      toast.success(enabled ? "Celular liberado na rede Wi-Fi" : "Acesso pela rede desligado")
    } catch (e) {
      toast.error((e as Error).message || "Não deu pra mudar")
    } finally { setBusy(false) }
  }

  return (
    <div className="grid gap-3">
      <Row label="Usar no celular" hint="Libera o ytbaixar na sua rede Wi-Fi, com uma chave secreta no link">
        <Switch checked={!!net?.lan.enabled} disabled={busy} onCheckedChange={toggle} />
      </Row>
      {net?.lan.enabled && url && (
        <div className="flex animate-in items-center gap-4 rounded-xl bg-white/6 p-3 fade-in zoom-in-95">
          {qr && <img src={qr} alt="QR code do link" className="size-28 rounded-lg" />}
          <div className="min-w-0 text-xs text-muted-foreground">
            <Smartphone className="mb-1.5 size-4 text-foreground" />
            Aponte a câmera do celular (mesmo Wi-Fi) pro código.
            <button onClick={() => copy(url, "Link copiado")} className="mt-1.5 block w-full truncate text-left font-mono text-[11px] text-foreground underline">
              {url.replace(/\?.*/, "")}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Body() {
  const { settings } = useStore()
  const { canInstall, installed, install } = useInstall()
  const [name, setName] = useState(settings.name)

  return (
    <div className="grid gap-4 px-4 pb-6 md:px-0 md:pb-0">
      <label className="grid gap-1.5 text-sm">
        Seu nome
        <Input value={name} maxLength={24} onChange={(e) => setName(e.target.value)}
          onBlur={() => saveSettings({ name: name.trim() || "Você" })} />
      </label>

      <div className="grid gap-1.5 text-sm">
        Qualidade padrão
        <div className="flex flex-wrap gap-1.5">
          {QUALITIES.map(([v, l]) => (
            <button key={v} onClick={() => saveSettings({ quality: v })}
              className={"rounded-lg border px-2.5 py-1 text-xs transition " + (settings.quality === v ? "border-tile-purple bg-tile-purple font-semibold text-ink" : "border-white/10 hover:bg-white/8")}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-1">
        <Row label="YouTube Music começa em só áudio"><Switch checked={settings.musicAudio} onCheckedChange={(v) => saveSettings({ musicAudio: v })} /></Row>
        <Row label="Baixar sozinho ao colar um link"><Switch checked={settings.auto} onCheckedChange={(v) => saveSettings({ auto: v })} /></Row>
        <Row label="Som quando terminar"><Switch checked={settings.sound} onCheckedChange={(v) => saveSettings({ sound: v })} /></Row>
        <Row label="Confete quando terminar"><Switch checked={settings.confetti} onCheckedChange={(v) => saveSettings({ confetti: v })} /></Row>
      </div>

      <Separator />
      <PhoneSection />

      {(canInstall || installed) && (
        <Row label="Instalar como app" hint={installed ? "Já está instalado neste aparelho" : "Abre numa janela própria, sem a barra do navegador"}>
          <Button size="sm" variant="secondary" disabled={installed} onClick={install}>
            <Monitor /> {installed ? "Instalado" : "Instalar"}
          </Button>
        </Row>
      )}

      <Separator />
      <Button variant="destructive" className="justify-self-start"
        onClick={() => { if (confirm("Apagar o histórico de downloads? Os arquivos já salvos continuam no aparelho.")) clearHistory() }}>
        <Trash2 /> Limpar histórico
      </Button>
    </div>
  )
}

export function SettingsPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const desktop = useMediaQuery("(min-width: 768px)")
  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustes</DialogTitle>
            <DialogDescription>Fica salvo neste navegador.</DialogDescription>
          </DialogHeader>
          <Body />
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Ajustes</DrawerTitle>
          <DrawerDescription>Fica salvo neste aparelho.</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto"><Body /></div>
      </DrawerContent>
    </Drawer>
  )
}
