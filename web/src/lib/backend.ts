// Descobre se tem o servidor do ytbaixar por trás da página.
// No app de PC/localhost tem; no site publicado (Cloudflare) não — lá só a interface está no ar.
export const RELEASE_URL = "https://github.com/agenor01/ytbaixar/releases/latest"

export interface ServerStatus {
  ffmpeg: { state: "checando" | "baixando" | "ok" | "erro"; pct: number; error: string | null }
}

const isJson = (r: Response) => !!r.headers.get("content-type")?.includes("json")

// null = sem resposta útil (servidor ainda subindo, ou versão antiga sem /api/status)
export async function fetchStatus(): Promise<ServerStatus | null> {
  try {
    const r = await fetch("/api/status", { cache: "no-store" })
    return r.ok && isJson(r) ? await r.json() : null
  } catch {
    return null
  }
}

let first: Promise<boolean> | null = null
// true = site publicado sem servidor. O servidor do ytbaixar sempre responde JSON (até nos erros);
// sem ele, o Cloudflare devolve o index.html (SPA) pra qualquer caminho.
export function isHosted() {
  if (!first) {
    first = fetch("/api/status", { cache: "no-store" })
      .then((r) => !isJson(r))
      .catch(() => false) // rede caiu: melhor não afirmar que é o site online
  }
  return first
}
