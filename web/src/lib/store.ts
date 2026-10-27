// Estado do app fora do React (downloads continuam mesmo trocando de tela) + hook pra ler.
import { useSyncExternalStore } from "react"
import { toast } from "sonner"
import { RELEASE_URL, isHosted } from "./backend"
import { SOURCES, ago, fmtDur, isSupportedLink, overall, qualityList, singleStream, thumbUrl } from "./format"
import { ACTIVE, FINISHED, type FeedItem, type Filter, type HistoryItem, type Job, type Settings, type Tab, type VideoInfo } from "./types"

export interface State {
  info: VideoInfo | null
  loading: boolean
  quality: string
  audio: boolean
  jobs: Job[]
  focus: string | null
  tab: Tab
  filter: Filter
  history: HistoryItem[]
  settings: Settings
  feed: FeedItem[]
}

const saved = {
  get<T>(k: string, d: T): T {
    try { const v = localStorage.getItem("ytbaixar." + k); return v ? JSON.parse(v) : d } catch { return d }
  },
  set(k: string, v: unknown) {
    try { localStorage.setItem("ytbaixar." + k, JSON.stringify(v)) } catch { /* modo privado */ }
  },
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error || "Erro " + r.status)
  return d
}

let state: State = {
  info: null,
  loading: false,
  quality: "best",
  audio: false,
  jobs: [],
  focus: null,
  tab: "fila",
  filter: null,
  history: saved.get<HistoryItem[]>("history", []),
  settings: { name: "Você", quality: "1080", musicAudio: false, auto: false, sound: true, confetti: true, ...saved.get<Partial<Settings>>("settings", {}) },
  feed: [],
}

const listeners = new Set<() => void>()
const doneListeners = new Set<(j: Job) => void>()

function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
// Jobs são mutados no lugar; isso força um novo array pro React perceber
const bumpJobs = () => set({ jobs: [...state.jobs] })

export function useStore() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => state)
}
export const getState = () => state
export function onDone(fn: (j: Job) => void) { doneListeners.add(fn); return () => { doneListeners.delete(fn) } }

/* ---------- Atividade ---------- */
let feedId = 0
export function addFeed(entry: Omit<FeedItem, "id" | "time" | "thread">) {
  const prev = state.feed[0]
  const item: FeedItem = { ...entry, id: ++feedId, time: Date.now(), thread: !!(prev && entry.group && prev.group === entry.group) }
  set({ feed: [item, ...state.feed].slice(0, 40) })
}
export const clearFeed = () => set({ feed: [] })

export async function copy(text: string, label = "Copiado") {
  try { await navigator.clipboard.writeText(text); toast.success(label) }
  catch { toast.error("Não deu pra copiar") }
}

/* ---------- Site publicado sem servidor ---------- */
function needsApp() {
  toast("Os downloads rodam no app de PC", {
    description: "Esta é a versão online. Instale o ytbaixar pra Windows (grátis) e cole o link lá.",
    action: { label: "Baixar o app", onClick: () => window.open(RELEASE_URL, "_blank", "noopener") },
    duration: 8000,
  })
}

/* ---------- Busca ---------- */
let ticket = 0
export async function fetchInfo(url: string, opts: { auto?: boolean } = {}) {
  url = String(url || "").trim()
  if (!url) return
  if (!isSupportedLink(url)) { toast.error("Isso não parece um link do YouTube ou do TikTok"); return }
  if (await isHosted()) { needsApp(); return }
  const my = ++ticket
  set({ loading: true })
  try {
    const info = await post<VideoInfo>("/api/info", { url })
    if (my !== ticket) return
    const s = state.settings
    let quality = "best"
    if (s.quality !== "best" && info.heights.length) {
      const h = info.heights.find((h) => h <= +s.quality)
      quality = h ? String(h) : "best"
    }
    set({ info, quality, audio: info.source === "music" && s.musicAudio, focus: latestJobFor(info.id)?.id || null, loading: false })
    const src = SOURCES[info.source] || SOURCES.youtube
    addFeed({
      who: src.label, av: src.feed, img: thumbUrl(info.thumbnail), group: info.id,
      text: `Encontrei "${info.title}"${info.artist ? " de " + info.artist : ""} · ${fmtDur(info.duration)}`,
    })
    if (opts.auto && s.auto) startDownload()
  } catch (e) {
    if (my !== ticket) return
    set({ loading: false })
    const msg = (e as Error).message
    toast.error(msg)
    addFeed({ who: "ytbaixar", av: "err", icon: "alert", text: msg, action: { label: "Tentar de novo", run: () => fetchInfo(url) } })
  }
}

/* ---------- Qualidade e formato ---------- */
export function setQuality(q: string) { set({ quality: q }) }
export function stepQuality(dir: 1 | -1) {
  if (!state.info || state.audio) return
  const list = qualityList(state.info) // best, maior … menor
  let i = list.indexOf(state.quality)
  i = Math.max(0, Math.min(list.length - 1, i - dir))
  set({ quality: list[i] })
}
export function setAudio(audio: boolean) { set({ audio }) }
export const toggleFormat = () => set({ audio: !state.audio })

/* ---------- Downloads ---------- */
function latestJobFor(videoId: string) {
  return state.jobs.filter((j) => j.info.id === videoId).sort((a, b) => b.created - a.created)[0]
}

export async function startDownload() {
  const info = state.info
  if (!info) { toast.error("Busque um vídeo primeiro"); return }
  const active = state.jobs.find((j) => j.info.id === info.id && j.audio === state.audio && ACTIVE.includes(j.status))
  if (active) { toast("Esse já está baixando"); set({ focus: active.id }); return }
  const tmp = Math.random().toString(36).slice(2)
  const job: Job = {
    id: tmp, tmp, info, audio: state.audio, quality: state.audio ? "audio" : state.quality,
    status: "iniciando", percent: 0, part: 0, created: Date.now(),
  }
  set({ jobs: [...state.jobs, job], focus: tmp })
  addFeed({ who: state.settings.name || "Você", av: "dl", icon: "download", group: info.id,
    text: `Pediu ${job.audio ? "o áudio" : "o MP4 em " + (job.quality === "best" ? "melhor qualidade" : job.quality + "p")}` })
  try {
    const { id } = await post<{ id: string }>("/api/start", { url: info.url, quality: job.quality })
    job.id = id
    if (state.focus === tmp) set({ focus: id })
    if (job.status === "cancelado") { post("/api/cancel/" + id).catch(() => {}); return }
    follow(job)
  } catch (e) {
    job.status = "erro"; job.error = (e as Error).message
    onJobUpdate(job)
  }
}

function follow(job: Job) {
  const es = new EventSource("/api/progress/" + job.id)
  job.es = es
  es.onmessage = (ev) => {
    const d = JSON.parse(ev.data)
    if (job.status === "cancelado") { es.close(); return }
    const wasPart = job.part
    Object.assign(job, { status: d.status, percent: d.percent, speed: d.speed, eta: d.eta, size: d.size, part: d.part || job.part, name: d.name, error: d.error })
    if (!singleStream(job) && d.part === 2 && wasPart === 1) {
      addFeed({ who: "ytbaixar", av: "sys", icon: "music", group: job.info.id, text: "Vídeo baixado, agora o áudio…" })
    }
    if (FINISHED.includes(d.status)) es.close()
    onJobUpdate(job)
  }
  es.onerror = () => {
    es.close()
    if (!FINISHED.includes(job.status)) { job.status = "erro"; job.error = "Conexão com o servidor caiu"; onJobUpdate(job) }
  }
}

function onJobUpdate(job: Job) {
  if (job.status === "pronto" && !job.saved) {
    job.saved = true
    // Puxa o arquivo pro aparelho (o servidor apaga a cópia temporária depois)
    fetch("/api/file/" + job.id)
      .then((r) => { job.bytes = +(r.headers.get("content-length") || 0); return r.blob() })
      .then((blob) => {
        const a = document.createElement("a")
        a.href = URL.createObjectURL(blob)
        a.download = job.name || "video.mp4"
        document.body.appendChild(a); a.click(); a.remove()
        setTimeout(() => URL.revokeObjectURL(a.href), 60000)
        job.bytes = job.bytes || blob.size
        saveHistory(job)
        bumpJobs()
      })
      .catch((e) => toast.error("Falhou ao salvar: " + e.message))
    if (state.settings.sound) chime()
    toast.success(`Pronto: ${job.info.title}`)
    doneListeners.forEach((fn) => fn(job))
    addFeed({ who: "ytbaixar", av: "ok", icon: "check", group: job.info.id, text: `Pronto! "${job.info.title}" foi salvo nos seus downloads.`,
      action: { label: "Baixar de novo", run: () => redo(job) } })
  } else if (job.status === "erro" && !job.reported) {
    job.reported = true
    toast.error(job.error || "Erro no download")
    addFeed({ who: "ytbaixar", av: "err", icon: "alert", group: job.info.id, text: job.error || "Erro no download",
      action: { label: "Tentar de novo", run: () => redo(job) } })
  }
  bumpJobs()
  updateDocTitle()
}

export function cancelJob(id: string) {
  const job = state.jobs.find((j) => j.id === id)
  if (!job || !ACTIVE.includes(job.status)) return
  job.status = "cancelado"
  job.es?.close()
  if (job.id !== job.tmp) post("/api/cancel/" + job.id).catch(() => {})
  addFeed({ who: state.settings.name || "Você", av: "dl", icon: "x", group: job.info.id, text: `Cancelou "${job.info.title}"` })
  onJobUpdate(job)
}

export function redo(job: Job) {
  set({ info: job.info, audio: job.audio, quality: job.audio ? state.quality : job.quality })
  startDownload()
}

export function focusJob(id: string) {
  const job = state.jobs.find((j) => j.id === id)
  if (!job) return
  set({ focus: id, info: job.info, audio: job.audio, quality: job.audio ? state.quality : job.quality })
}

function updateDocTitle() {
  const act = state.jobs.filter((j) => ACTIVE.includes(j.status))
  if (!act.length) { document.title = "ytbaixar"; return }
  const avg = act.reduce((s, j) => s + overall(j), 0) / act.length
  document.title = `${Math.floor(avg)}% · ytbaixar`
}

function chime() {
  try {
    const ac = new AudioContext()
    ;[660, 880, 1320].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * 0.09
      o.type = "sine"; o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.4)
    })
  } catch { /* sem áudio */ }
}

/* ---------- Histórico, abas e ajustes ---------- */
function saveHistory(job: Job) {
  const i = job.info
  const history = [{
    vid: i.id, url: i.url, title: i.title, artist: i.artist, thumb: i.thumbnail, source: i.source,
    audio: job.audio, quality: job.quality, name: job.name, bytes: job.bytes, at: Date.now(),
  }, ...state.history].slice(0, 200)
  saved.set("history", history)
  set({ history })
}
export function clearHistory() { saved.set("history", []); set({ history: [] }); toast.success("Histórico limpo") }

export const setTab = (tab: Tab) => set({ tab, filter: tab === "hist" ? state.filter : null })
export const setFilter = (filter: Filter) => set({ filter, tab: "hist" })

export function saveSettings(patch: Partial<Settings>) {
  const settings = { ...state.settings, ...patch }
  saved.set("settings", settings)
  set({ settings })
}

export const lastDownloadText = () => {
  const h = state.history[0]
  if (!h) return "nenhum download ainda"
  const a = ago(h.at)
  return a === "agora" ? "último agora mesmo" : `último há ${a}`
}
