import type { Job, VideoInfo } from "./types"

export const thumbUrl = (u?: string | null) => (u ? "/api/thumb?u=" + encodeURIComponent(u) : "")

export function fmtDur(s: number) {
  s = Math.round(s || 0)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = String(s % 60).padStart(2, "0")
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`
}

export function fmtBytes(b?: number | null) {
  if (!b) return "—"
  const u = ["B", "KB", "MB", "GB"]
  let i = 0
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++ }
  return (b >= 100 || i === 0 ? Math.round(b) : b.toFixed(1)) + " " + u[i]
}

export const fmtNum = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("pt-BR", { notation: n >= 1e5 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n)

export function fmtDate(ymd?: string | null) {
  if (!ymd) return null
  return new Date(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8))
}

export function ago(t: number) {
  const s = (Date.now() - t) / 1000
  if (s < 45) return "agora"
  if (s < 3600) return Math.round(s / 60) + " min"
  if (s < 86400) return Math.round(s / 3600) + " h"
  return Math.round(s / 86400) + " d"
}

export function yearsAgo(d: Date) {
  const days = (Date.now() - +d) / 864e5
  if (days < 1) return "hoje"
  if (days < 30) return `há ${Math.round(days)} dia${Math.round(days) > 1 ? "s" : ""}`
  if (days < 365) { const m = Math.round(days / 30); return `há ${m} ${m > 1 ? "meses" : "mês"}` }
  const y = Math.floor(days / 365)
  return `há ${y} ano${y > 1 ? "s" : ""}`
}

// "Artista - Música (Clipe)" → parte em negrito + parte em itálico, como no layout
export function splitTitle(t: string): [string, string] {
  t = String(t || "")
  let m = t.match(/^(.{2,60}?)\s+[-–—|:]\s+(.+)$/)
  if (m) return [m[1], m[2]]
  m = t.match(/^(.+?)\s+([([].+)$/)
  if (m) return [m[1], m[2]]
  const w = t.split(/\s+/)
  if (w.length > 4) return [w.slice(0, 2).join(" "), w.slice(2).join(" ")]
  return [t, ""]
}

export function isYtLink(s: string) {
  try {
    const u = new URL(String(s).trim())
    return /(^|\.)youtube(-nocookie)?\.com$|^youtu\.be$/.test(u.hostname)
  } catch { return false }
}

// Progresso geral: mp4 = vídeo (0–50%) + áudio (50–100%); só áudio = 0–100%
export function overall(job: Job) {
  if (job.status === "pronto") return 100
  if (job.audio) return job.percent
  const part = Math.max(1, Math.min(2, job.part || 1))
  return (part - 1) * 50 + job.percent / 2
}

// "best" + alturas da maior pra menor
export function qualityList(info?: VideoInfo | null) {
  return ["best", ...(info?.heights || []).filter((h) => h >= 144).map(String)]
}

export function sizeFor(info: VideoInfo | null, quality: string, audio: boolean) {
  const s = info?.sizes || {}
  if (audio) return s.audio
  if (quality === "best") return s[String(info?.heights?.[0])]
  return s[quality]
}

export function qualityTag(h?: number) {
  return ({ 2160: "4K", 1440: "2K", 1080: "Full HD", 720: "HD" } as Record<number, string>)[h || 0] || "SD"
}
