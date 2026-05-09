import { Link } from "@tanstack/react-router";
import { ArrowRight, Building2, PackagePlus, Sparkles, Lock } from "lucide-react";
import { KIT_TYPE_BADGES } from "@/lib/kitPricing";
import { formatBRL } from "@/lib/domain";
import type { BundlePublic } from "@/server/productBundles.functions";

type Props = {
  bundle: BundlePublic;
  /** Modo de exibição — afeta CTA e visibilidade do preço B2B. */
  mode?: "retail" | "b2b";
  className?: string;
};

export function KitCard({ bundle, mode = "retail", className }: Props) {
  const b = bundle;
  const p = b.pricing;
  const isB2bOnly = b.kit.available_b2b && !b.kit.available_retail;
  const requiresB2bApproval = isB2bOnly && !b.is_b2b_approved;
  const showStrike =
    !requiresB2bApproval && p.savings > 0 && p.appliedPrice < p.retailSum;
  const ctaLabel = requiresB2bApproval ? "Solicite acesso B2B" : "Ver kit";

  return (
    <Link
      to="/combo/$slug"
      params={{ slug: b.slug ?? b.id }}
      className={
        "group bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full " +
        (className ?? "")
      }
    >
      <div className="aspect-[4/3] bg-surface overflow-hidden relative">
        {b.image_url ? (
          <img
            src={b.image_url}
            alt={b.name}
            width={400}
            height={300}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <PackagePlus className="w-10 h-10 text-muted-foreground/50" />
          </div>
        )}
        {requiresB2bApproval && (
          <div className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-600 text-white">
            <Lock className="w-3 h-3" /> Exclusivo B2B
          </div>
        )}
      </div>
      <div className="p-3 sm:p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <KitTypeBadge bundle={b} mode={mode} />
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            {b.items_count} {b.items_count === 1 ? "item" : "itens"}
          </span>
        </div>
        <h3 className="font-display font-semibold text-sm sm:text-base line-clamp-2">
          {b.name}
        </h3>
        <div className="mt-auto pt-2 flex items-end justify-between gap-2">
          <KitPriceBlock bundle={b} hidePrice={requiresB2bApproval} showStrike={showStrike} />
          <span className="text-xs text-primary inline-flex items-center gap-1 whitespace-nowrap">
            {ctaLabel} <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function KitTypeBadge({ bundle, mode }: { bundle: BundlePublic; mode: "retail" | "b2b" }) {
  const t = bundle.kit.kit_type;
  const isB2bSource = bundle.pricing.source === "b2b" || mode === "b2b";
  const label = isB2bSource ? "Preço empresa" : KIT_TYPE_BADGES[t];
  const tone =
    isB2bSource || t === "b2b"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : t === "promocional"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-emerald-50 text-emerald-700 border-emerald-200";
  const Icon = isB2bSource || t === "b2b" ? Building2 : Sparkles;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${tone}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function KitPriceBlock({
  bundle,
  hidePrice,
  showStrike,
}: {
  bundle: BundlePublic;
  hidePrice: boolean;
  showStrike: boolean;
}) {
  const p = bundle.pricing;
  if (hidePrice) {
    return (
      <div>
        <div className="text-[10px] text-muted-foreground">Disponível para empresas</div>
        <div className="font-display font-semibold text-blue-700 text-sm">B2B</div>
      </div>
    );
  }
  return (
    <div>
      <div className="text-[10px] text-muted-foreground">
        {p.source === "b2b" ? "Preço empresa" : "Preço do kit"}
      </div>
      {showStrike && (
        <div className="text-[11px] text-muted-foreground line-through">
          {formatBRL(p.retailSum)}
        </div>
      )}
      <div className="font-display font-bold text-primary text-base">
        {formatBRL(p.appliedPrice)}
      </div>
      {p.savings > 0 && (
        <div className="text-[10px] text-emerald-700 font-medium">
          Economia {formatBRL(p.savings)}
        </div>
      )}
      {p.unitApprox != null && (
        <div className="text-[10px] text-muted-foreground">
          ≈ {formatBRL(p.unitApprox)} / un
        </div>
      )}
    </div>
  );
}
