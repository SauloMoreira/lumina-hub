import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, Loader2, Box, FolderTree } from "lucide-react";
import { Input } from "@/components/ui/input";
import { autocompleteSearch } from "@/server/productSearch.functions";
import { trackSearch } from "@/lib/tracking";
import { formatBRL } from "@/lib/domain";

interface Suggestion {
  kind: "product" | "category";
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  image: string | null;
  price: number | null;
  sale_price: number | null;
}

interface SearchAutocompleteProps {
  className?: string;
  placeholder?: string;
}

export function SearchAutocomplete({ className, placeholder }: SearchAutocompleteProps) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);
  const reqIdRef = useRef(0);

  // Debounced fetch
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const term = q.trim();
    if (term.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = window.setTimeout(async () => {
      const reqId = ++reqIdRef.current;
      try {
        const res = await autocompleteSearch({ data: { q: term } });
        if (reqId !== reqIdRef.current) return;
        setSuggestions(res.suggestions as Suggestion[]);
      } catch (e) {
        if (reqId === reqIdRef.current) setSuggestions([]);
      } finally {
        if (reqId === reqIdRef.current) setLoading(false);
      }
    }, 220);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [q]);

  // Click outside fecha
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const goToSearch = (term: string) => {
    if (!term.trim()) return;
    trackSearch(term);
    setOpen(false);
    navigate({ to: "/catalogo", search: { q: term } as any });
  };

  const goToSuggestion = (s: Suggestion) => {
    setOpen(false);
    setQ("");
    if (s.kind === "product") {
      navigate({ to: "/produto/$slug", params: { slug: s.slug } });
    } else {
      navigate({ to: "/catalogo", search: { cat: s.slug } as any });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    const max = suggestions.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, max - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && suggestions[activeIdx]) {
        goToSuggestion(suggestions[activeIdx]);
      } else {
        goToSearch(q);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showPanel = open && q.trim().length >= 2;

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          goToSearch(q);
        }}
        role="search"
      >
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-faint pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              setActiveIdx(-1);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder ?? "Busque por lâmpadas, disjuntores, fios…"}
            className="pl-11 pr-10 rounded-pill bg-surface border-border h-10"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showPanel}
            aria-haspopup="listbox"
            aria-label="Campo de busca de produtos"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-faint animate-spin" />
          )}
        </div>
      </form>

      {showPanel && (
        <div className="absolute left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden max-h-[70vh] overflow-y-auto">
          {suggestions.length === 0 && !loading && (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">
              Pressione Enter para buscar por <strong className="text-foreground">"{q}"</strong>
            </div>
          )}
          {suggestions.map((s, i) => {
            const active = i === activeIdx;
            const finalPrice = s.sale_price ?? s.price;
            return (
              <button
                key={`${s.kind}-${s.id}`}
                type="button"
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => goToSuggestion(s)}
                className={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors ${active ? "bg-primary-tint" : "hover:bg-surface"}`}
              >
                {s.kind === "product" ? (
                  s.image ? (
                    <img
                      src={s.image}
                      alt=""
                      className="w-10 h-10 object-cover rounded border border-border shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted shrink-0 flex items-center justify-center text-muted-foreground">
                      <Box className="w-4 h-4" />
                    </div>
                  )
                ) : (
                  <div className="w-10 h-10 rounded bg-primary-tint text-primary shrink-0 flex items-center justify-center">
                    <FolderTree className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {s.kind === "product"
                      ? (s.brand ? `${s.brand} · ` : "") +
                        (finalPrice != null ? formatBRL(finalPrice) : "")
                      : "Categoria"}
                  </p>
                </div>
              </button>
            );
          })}
          {suggestions.length > 0 && (
            <button
              type="button"
              onClick={() => goToSearch(q)}
              className="w-full text-left px-4 py-2.5 border-t border-border text-sm text-primary hover:bg-primary-tint transition-colors"
            >
              Ver todos os resultados para "{q}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}
