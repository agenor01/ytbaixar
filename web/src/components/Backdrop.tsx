import { useEffect, useState } from "react"

// Capa desfocada ocupando o fundo todo, com troca suave; a cor média vira o brilho (--glow)
export function Backdrop({ src }: { src: string }) {
  const [layers, setLayers] = useState<[string, string]>(["", ""])
  const [front, setFront] = useState(0)

  useEffect(() => {
    if (!src) return
    const img = new Image()
    img.onload = () => {
      setLayers((l) => {
        const next: [string, string] = [...l]
        next[front ^ 1] = src
        return next
      })
      setFront((f) => f ^ 1)
      try {
        const c = document.createElement("canvas")
        c.width = c.height = 24
        const g = c.getContext("2d", { willReadFrequently: true })!
        g.drawImage(img, 0, 0, 24, 24)
        const d = g.getImageData(0, 0, 24, 24).data
        let r = 0, gg = 0, b = 0, n = 0
        for (let i = 0; i < d.length; i += 4) {
          const w = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) + 10 // pesa mais as cores saturadas
          r += d[i] * w; gg += d[i + 1] * w; b += d[i + 2] * w; n += w
        }
        document.documentElement.style.setProperty("--glow", `${Math.round(r / n)}, ${Math.round(gg / n)}, ${Math.round(b / n)}`)
      } catch { /* sem cor */ }
    }
    img.src = src
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden transition-[background] duration-700"
      style={{
        background:
          "radial-gradient(1200px 700px at 20% 10%, rgba(var(--glow), .35), transparent 60%), radial-gradient(900px 600px at 90% 90%, rgba(var(--glow), .2), transparent 60%), #0d0e11",
      }}
    >
      {layers.map((l, i) => (
        <div
          key={i}
          className="absolute -inset-16 scale-110 bg-cover bg-center transition-opacity duration-1000"
          style={{
            backgroundImage: l ? `url("${l}")` : undefined,
            opacity: l && i === front ? 1 : 0,
            filter: "blur(46px) saturate(1.25) brightness(.55)",
          }}
        />
      ))}
      <div className="absolute inset-0 bg-linear-to-b from-black/15 to-black/55" />
    </div>
  )
}
