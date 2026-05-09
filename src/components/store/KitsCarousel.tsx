import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, PackagePlus } from "lucide-react";
import { listPublicBundles, type BundlePublic } from "@/server/productBundles.functions";
import { KitCard } from "./KitCard";

type Mode = "retail" | "b2b";

type Props = {
  title: string;
  subtitle?: string;
  mode?: Mode;
  /** Categoria preferida (filtra kits cujos itens contenham essa categoria). */
  preferCategorySlug?: string;
  /** Quantidade máxima de kits a exibir. */
  limit?: number;
  /** Mostrar link “Ver todos” para /combos. */
  showSeeAll?: boolean;
  className?: string;
};

export function KitsCarousel({
  title,
  subtitle,
  mode = "retail",
  preferCategorySlug,
  limit = 6,
  showSeeAll = true,
  className,
}: Props) {
  const containerRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  // Lazy-mount: só dispara o fetch quando o bloco entra perto da viewport.
  useEffect(() => {
    if (visible) return;
    const el = containerRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            obs.disconnect();
            break;
          }
        }
      },
      { rootMargin: "300px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible]);

  const queryKey = ["public-bundles-carousel", mode] as const;
  const q = useQuery({
    queryKey,
    queryFn: () =>
      listPublicBundles({
        data: mode === "b2b" ? { b2bOnly: true, limit: 24 } : { retailOnly: true, limit: 24 },
      }),
    enabled: visible,
    staleTime: 60_000,
  });

  const bundles = useMemo(() => {
    const all = q.data ?? [];
    if (all.length === 0) return [];
    // Ordena: featured primeiro (já vem assim), depois preferCategorySlug.
    let scored = all.map((b) => ({ b, score: scoreBundle(b, preferCategorySlug) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.b).slice(0, limit);
  }, [q.data, preferCategorySlug, limit]);

  // Reserva altura para evitar CLS — só renderiza nada quando temos certeza
  // que não há kits.
  const showSection = !q.isFetched || bundles.length > 0;
  if (!showSection) return null;

  return (
    <section
      ref={containerRef}
      className={"container mx-auto px-4 py-8 " + (className ?? "")}
      aria-label={title}
    >
      <header className="flex items-end justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="font-display text-xl md:text-2xl font-bold text-foreground">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {showSeeAll && (
          <Link
            to="/combos"
            className="text-xs sm:text-sm text-primary inline-flex items-center gap-1 whitespace-nowrap"
          >
            Ver todos <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </header>

      {/* Reserva altura aproximada para CLS: card ~360px alto */}
      <div className="min-h-[320px]">
        {!visible || (q.isLoading && bundles.length === 0) ? (
          <SkeletonRow />
        ) : bundles.length === 0 ? null : (
          <div
            className="
              grid grid-flow-col auto-cols-[80%] sm:auto-cols-[42%] md:grid-flow-row md:auto-cols-auto
              md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4
              overflow-x-auto md:overflow-visible snap-x snap-mandatory pb-2
              [scrollbar-width:thin]
            "
          >
            {bundles.map((b) => (
              <div key={b.id} className="snap-start">
                <KitCard bundle={b} mode={mode} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SkeletonRow() {
  return (
    <div className="grid grid-flow-col auto-cols-[80%] sm:auto-cols-[42%] md:grid-flow-row md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 overflow-hidden">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card overflow-hidden flex flex-col"
        >
          <div className="aspect-[4/3] bg-muted animate-pulse flex items-center justify-center">
            <PackagePlus className="w-8 h-8 text-muted-foreground/30" />
          </div>
          <div className="p-3 sm:p-4 flex-1 flex flex-col gap-2">
            <div className="h-3 w-20 bg-muted rounded animate-pulse" />
            <div className="h-4 w-full bg-muted rounded animate-pulse" />
            <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
            <div className="mt-auto h-6 w-24 bg-muted rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function scoreBundle(b: BundlePublic, preferCategorySlug?: string | null): number {
  let s = 0;
  if (b.is_featured) s += 100;
  if (preferCategorySlug) {
    const hit = b.items.some((it) => {
      const slug = (it as any).product?.category_slug ?? (it as any).category_slug;
      return typeof slug === "string" && slug === preferCategorySlug;
    });
    if (hit) s += 50;
  }
  if (b.kit.kit_type === "promocional") s += 10;
  return s;
}
