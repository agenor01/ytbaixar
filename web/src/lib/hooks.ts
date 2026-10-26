import { useEffect, useState, type PointerEvent } from "react"

export function useMediaQuery(q: string) {
  const [match, setMatch] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setMatch(m.matches)
    m.addEventListener("change", on)
    return () => m.removeEventListener("change", on)
  }, [q])
  return match
}

// Inclinação 3D leve seguindo o mouse (desliga no toque)
export const tilt = {
  onPointerMove(e: PointerEvent<HTMLElement>) {
    if (e.pointerType !== "mouse") return
    const el = e.currentTarget, r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5
    el.style.transform = `perspective(700px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg) translateY(-2px)`
  },
  onPointerLeave(e: PointerEvent<HTMLElement>) { e.currentTarget.style.transform = "" },
}

// Re-renderiza de tempos em tempos (pra "há 2 min" andar sozinho)
export function useTick(ms: number) {
  const [, setN] = useState(0)
  useEffect(() => { const t = setInterval(() => setN((n) => n + 1), ms); return () => clearInterval(t) }, [ms])
}
