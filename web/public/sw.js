// Service worker do ytbaixar: guarda a "casca" do app pra abrir rápido.
// A API (/api/...) nunca passa pelo cache — downloads e buscas vão sempre direto pro servidor.
const CACHE = "ytbaixar-v1"

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/manifest.webmanifest", "/icon.svg"])))
  self.skipWaiting()
})

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))))
  self.clients.claim()
})

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return

  // Páginas: rede primeiro (pega versão nova), cache se o servidor estiver fora
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("/")))
    return
  }
  // Arquivos com hash no nome (/assets/...) e ícones: cache primeiro
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)) }
      return res
    })),
  )
})
