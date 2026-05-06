import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PackagePlus, ArrowRight } from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { listPublicBundles, type BundleAvailability } from "@/server/productBundles.functions";
import { formatBRL } from "@/lib/domain";

export const Route = createFileRoute("/combos")({
  component: CombosListPage,
  head: () => ({
    meta: [
      { title: "Kits e Combos — Led Maricá" },
      {
        name: "description",
        content: "Conjuntos de produtos selecionados para facilitar sua compra.",
      },
    ],
  }),
});

const TONE: Record<BundleAvailability, string> = {
  available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  partial: "bg-amber-50 text-amber-700 border-amber-200",
  unavailable: "bg-red-50 text-red-700 border-red-200",
  needs_review: "bg-muted text-muted-foreground border-border",
};

const LABEL: Record<BundleAvailability, string> = {
  available: "Disponível",
  partial: "Parcialmente disponível",
  unavailable: "Indisponível",
  needs_review: "Em revisão",
};

function CombosListPage() {
  const q = useQuery({
    queryKey: ["public-bundles"],
    queryFn: () => listPublicBundles({ data: {} }),
    staleTime: 30_000,
  });

  const bundles = q.data ?? [];

  return (
    <StoreLayout>
      <div className="container max-w-6xl py-10 px-4">
        <header className="mb-8 space-y-2">
          <h1 className="font-display text-3xl font-bold">Kits e Combos</h1>
          <p className="text-sm text-muted-foreground">
            Conjuntos prontos de produtos para facilitar sua compra. Adicione todos os itens ao
            carrinho com um clique.
          </p>
        </header>

        {q.isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : bundles.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <PackagePlus className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Ainda não há kits disponíveis. Volte em breve!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bundles.map((b) => (
              <Link
                key={b.id}
                to="/combo/$slug"
                params={{ slug: b.slug ?? b.id }}
                className="group bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="aspect-[4/3] bg-surface overflow-hidden">
                  {b.image_url ? (
                    <img
                      src={b.image_url}
                      alt={b.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <PackagePlus className="w-10 h-10 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${TONE[b.availability]}`}
                    >
                      {LABEL[b.availability]}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {b.items_count} {b.items_count === 1 ? "item" : "itens"}
                    </span>
                  </div>
                  <h2 className="font-display font-semibold text-base line-clamp-2">{b.name}</h2>
                  {b.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{b.description}</p>
                  )}
                  <div className="mt-auto pt-2 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-muted-foreground">Subtotal estimado</div>
                      <div className="font-display font-bold text-primary">
                        {formatBRL(b.subtotal)}
                      </div>
                    </div>
                    <span className="text-xs text-primary inline-flex items-center gap-1">
                      Ver combo <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </StoreLayout>
  );
}
