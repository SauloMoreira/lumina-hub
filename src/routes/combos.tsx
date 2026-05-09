import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PackagePlus } from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { listPublicBundles, type BundlePublic } from "@/server/productBundles.functions";
import { KitCard } from "@/components/store/KitCard";

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

type Group = {
  key: string;
  title: string;
  subtitle?: string;
  bundles: BundlePublic[];
};

function CombosListPage() {
  const q = useQuery({
    queryKey: ["public-bundles"],
    queryFn: () => listPublicBundles({ data: {} }),
    staleTime: 30_000,
  });

  const bundles = q.data ?? [];

  const groups: Group[] = [
    {
      key: "promocional",
      title: "Kits promocionais",
      subtitle: "Pacotes com preço fechado para você economizar.",
      bundles: bundles.filter((b) => b.kit.kit_type === "promocional"),
    },
    {
      key: "combinado",
      title: "Compre junto",
      subtitle: "Produtos que se complementam para facilitar sua instalação.",
      bundles: bundles.filter((b) => b.kit.kit_type === "combinado"),
    },
    {
      key: "b2b",
      title: "Kits especiais para empresas",
      subtitle: "Condições diferenciadas para compras em volume.",
      bundles: bundles.filter((b) => b.kit.kit_type === "b2b" || b.kit.available_b2b),
    },
    {
      key: "estrutural",
      title: "Soluções prontas",
      bundles: bundles.filter((b) => b.kit.kit_type === "estrutural"),
    },
  ].filter((g) => g.bundles.length > 0);

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
          <div className="space-y-12">
            {groups.map((g) => (
              <section key={g.key} aria-label={g.title}>
                <header className="mb-4">
                  <h2 className="font-display text-xl md:text-2xl font-bold">{g.title}</h2>
                  {g.subtitle && (
                    <p className="text-sm text-muted-foreground mt-1">{g.subtitle}</p>
                  )}
                </header>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {g.bundles.map((b) => (
                    <KitCard
                      key={b.id}
                      bundle={b}
                      mode={g.key === "b2b" ? "b2b" : "retail"}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mt-12 text-xs text-muted-foreground">
          Não encontrou o que procura?{" "}
          <Link to="/catalogo" className="text-primary underline">
            Ver catálogo completo
          </Link>
          .
        </div>
      </div>
    </StoreLayout>
  );
}
