// "Instalar como app" (PWA): guarda o evento do navegador pra disparar quando o usuário quiser
import { useSyncExternalStore } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

let deferred: BeforeInstallPromptEvent | null = null
let installed = window.matchMedia("(display-mode: standalone)").matches
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as BeforeInstallPromptEvent; emit() })
window.addEventListener("appinstalled", () => { installed = true; deferred = null; emit() })

let snap = { canInstall: false, installed }
function getSnap() {
  if (snap.canInstall !== !!deferred || snap.installed !== installed) snap = { canInstall: !!deferred, installed }
  return snap
}

export function useInstall() {
  const s = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, getSnap)
  return {
    ...s,
    async install() {
      if (!deferred) return
      await deferred.prompt()
      await deferred.userChoice
      deferred = null
      emit()
    },
  }
}
