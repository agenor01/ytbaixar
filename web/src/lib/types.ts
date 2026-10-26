export type Source = "youtube" | "music"

export interface VideoInfo {
  id: string
  url: string
  webpage: string
  source: Source
  title: string
  artist: string
  channelUrl: string
  thumbnail: string
  duration: number
  views: number | null
  likes: number | null
  uploaded: string | null
  album: string | null
  heights: number[]
  sizes: Record<string, number | null>
}

export type JobStatus = "iniciando" | "baixando" | "convertendo" | "pronto" | "erro" | "cancelado"

export interface Job {
  id: string
  tmp: string
  info: VideoInfo
  audio: boolean
  quality: string
  status: JobStatus
  percent: number
  part: number
  speed?: string
  eta?: string
  size?: string
  name?: string
  error?: string
  bytes?: number
  created: number
  saved?: boolean
  reported?: boolean
  es?: EventSource
}

export interface HistoryItem {
  vid: string
  url: string
  title: string
  artist: string
  thumb: string
  source: Source
  audio: boolean
  quality: string
  name?: string
  bytes?: number
  at: number
}

export interface Settings {
  name: string
  quality: string
  musicAudio: boolean
  auto: boolean
  sound: boolean
  confetti: boolean
}

export type FeedKind = "yt" | "music" | "sys" | "ok" | "err" | "dl"

export interface FeedItem {
  id: number
  who: string
  av: FeedKind
  icon?: string
  img?: string
  text: string
  time: number
  group?: string
  thread?: boolean
  action?: { label: string; run: () => void }
}

export type Tab = "fila" | "feitos" | "hist"
export type Filter = "youtube" | "music" | "audio" | null

export const ACTIVE: JobStatus[] = ["iniciando", "baixando", "convertendo"]
export const FINISHED: JobStatus[] = ["pronto", "erro", "cancelado"]
