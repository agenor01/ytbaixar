import { forwardRef, useEffect, useState } from "react"
import { ClipboardPaste, Link2, Loader2, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ShineBorder } from "@/components/ui/shine-border"
import { fetchInfo, useStore } from "@/lib/store"
import { isSupportedLink } from "@/lib/format"

export const SearchBar = forwardRef<HTMLInputElement>(function SearchBar(_, ref) {
  const { loading, info } = useStore()
  const [value, setValue] = useState("")
  // Quando o vídeo muda por outro caminho (recentes, histórico, arrastar), mostra o link dele aqui
  useEffect(() => { if (info?.url) setValue(info.url) }, [info?.url])

  const go = (url = value, auto = false) => { setValue(url); fetchInfo(url, { auto }) }

  async function paste() {
    try {
      const t = (await navigator.clipboard.readText()).trim()
      if (!t) return toast.error("Área de transferência vazia")
      go(t, true)
    } catch {
      toast.error("Use Ctrl+V pra colar")
    }
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); go() }}
      className="relative flex items-center gap-1.5 rounded-2xl border border-white/9 bg-black/22 py-1.5 pr-1.5 pl-4 transition focus-within:border-white/28 focus-within:shadow-[0_0_0_4px_rgba(var(--glow),.18)]"
    >
      {loading && <ShineBorder borderWidth={1.5} duration={4} shineColor={["#f8d65b", "#f05ad2", "#9bd6fa"]} />}
      <Link2 className="size-4 flex-none text-muted-foreground" />
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onPaste={(e) => {
          const t = e.clipboardData.getData("text").trim()
          if (isSupportedLink(t)) { e.preventDefault(); go(t, true) }
        }}
        placeholder="Cole um link do YouTube, YouTube Music ou TikTok…"
        spellCheck={false}
        enterKeyHint="search"
        inputMode="url"
        className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none placeholder:text-muted-foreground/70 sm:text-sm"
      />
      <Button type="button" variant="ghost" size="icon" onClick={paste} title="Colar da área de transferência">
        <ClipboardPaste />
      </Button>
      <Button type="submit" className="h-9 rounded-xl bg-white px-4 font-semibold text-ink hover:bg-white/85">
        {loading ? <Loader2 className="animate-spin" /> : <Search />}
        <span className="hidden sm:inline">Buscar</span>
      </Button>
    </form>
  )
})
