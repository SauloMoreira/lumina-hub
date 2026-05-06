import { Link } from "@tanstack/react-router";
import { ArrowRight, Boxes, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/store/ProductCard";
import type {
  ResolvedShowcase,
  ResolvedShowcaseProduct,
  ResolvedShowcaseCombo,
} from "@/lib/homepageBlocks";
import type { Product } from "@/lib/domain";

function isUrlSafe(u: string | null | undefined) {
  if (!u) return false;
  if (u.length > 500) return false;
  if (/<|javascript:|data:/i.test(u)) return false;
  return true;
}

function fallbackViewAllUrl(s: ResolvedShowcase): string {
  switch (s.showcase_type) {
    case "offers":
      return "/catalogo?oferta=true";
    case "new_arrivals":
      return "/catalogo?sort=novidades";
    case "bundles":
      return "/combos";
    case "category":
      return "/catalogo";
    default:
      return "/catalogo";
  }
}

function toProduct(p: ResolvedShowcaseProduct): Product {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    sale_price: p.sale_price ?? undefined,
    images: p.images ?? [],
    brand: p.brand ?? undefined,
    tags: [],
    stock_qty: p.stock_qty ?? 0,
    featured: !!p.featured,
    category_id: p.category_id ?? undefined,
    b2b_enabled: p.b2b_enabled ?? undefined,
    b2b_price: p.b2b_price ?? undefined,
    b2b_min_qty: p.b2b_min_qty ?? undefined,
  } as unknown as Product;
}

function ComboCard({ combo }: { combo: ResolvedShowcaseCombo }) {
  return (
    <Link
      to={combo.slug ? (`/combo/${combo.slug}` as any) : "/combos"}
      className="group flex flex-col bg-card border border-border rounded-xl overflow-hidden hover:border-primary hover:shadow-elevated transition-all"
    >
      <div className="aspect-square bg-muted overflow-hidden flex items-center justify-center">
        {combo.image_url ? (
          <img
            src={combo.image_url}
            alt={combo.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <Boxes className="w-10 h-10 text-muted-foreground" />
        )}
      </div>
      <div className="p-3 space-y-1">
        <div className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
          <Boxes className="w-3 h-3" /> Combo
        </div>
        <h3 className="font-semibold text-sm line-clamp-2 leading-snug">{combo.name}</h3>
        {combo.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{combo.description}</p>
        )}
        <p className="text-[11px] text-muted-foreground">
          {combo.items_count} {combo.items_count === 1 ? "item" : "itens"}
        </p>
      </div>
    </Link>
  );
}

export function HomepageShowcaseSection({ showcase }: { showcase: ResolvedShowcase }) {
  const items = showcase.items ?? [];
  if (items.length === 0) return null;

  const viewAllUrl = showcase.show_view_all_button
    ? isUrlSafe(showcase.view_all_url)
      ? showcase.view_all_url!
      : fallbackViewAllUrl(showcase)
    : null;

  const isPremium =
    showcase.visual_variant === "premium" || showcase.visual_variant === "highlighted";
  const py = showcase.visual_variant === "compact" ? "py-6" : isPremium ? "py-12" : "py-8";

  return (
    <section className={`container mx-auto px-4 ${py}`}>
      <div className="flex items-end justify-between mb-6 gap-4">
        <div className="min-w-0">
          <div className="label-meta mb-2 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" />
            <span>Vitrine</span>
          </div>
          <h2 className="font-display font-bold text-2xl tracking-tight">{showcase.title}</h2>
          {showcase.subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{showcase.subtitle}</p>
          )}
        </div>
        {viewAllUrl && (
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex flex-shrink-0">
            <Link to={viewAllUrl as any}>
              Ver todos <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((it, i) => {
          if (it.kind === "combo") return <ComboCard key={`c-${it.id}`} combo={it} />;
          return <ProductCard key={`p-${it.id}`} product={toProduct(it)} index={i} />;
        })}
      </div>

      {viewAllUrl && (
        <div className="mt-6 text-center sm:hidden">
          <Button asChild variant="outline" size="sm">
            <Link to={viewAllUrl as any}>
              Ver todos <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}
