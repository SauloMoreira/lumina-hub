import { useEffect, useState } from "react";
import {
  Loader2,
  Wand2,
  RefreshCw,
  CheckCircle2,
  Trash2,
  Star,
  Download,
  ImageOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  generateCampaignCreatives,
  listCampaignCreatives,
  updateCampaignCreative,
  deleteCampaignCreative,
  type CampaignCreative,
  type CreativeType,
} from "@/server/marketingCreatives.functions";
import type { AiCampaignReference } from "@/components/admin/MarketingCampaignAiDialog";
import type { CampaignSuggestion } from "@/server/marketingCopy.functions";

const TYPES: { id: CreativeType; label: string; ratio: string }[] = [
  { id: "banner_home", label: "Banner Home", ratio: "horizontal 1920×720" },
  { id: "post_square", label: "Post Quadrado", ratio: "1:1 — 1080×1080" },
  { id: "story", label: "Story", ratio: "9:16 — 1080×1920" },
  { id: "product_kit", label: "Produto / Kit", ratio: "1:1 — promocional" },
];

const STYLE_OPTS = [
  { id: "promocional", label: "Promocional" },
  { id: "premium", label: "Premium" },
  { id: "institucional", label: "Institucional" },
  { id: "tecnico", label: "Técnico" },
  { id: "varejo_popular", label: "Varejo popular" },
  { id: "b2b", label: "B2B / Profissional" },
];
const FOCUS_OPTS = [
  { id: "produto", label: "Produto" },
  { id: "kit", label: "Kit / Combo" },
  { id: "campanha", label: "Campanha" },
  { id: "desconto", label: "Desconto" },
  { id: "trafego", label: "Tráfego" },
  { id: "conversao", label: "Conversão" },
];
const TONE_OPTS = [
  { id: "comercial", label: "Comercial" },
  { id: "elegante", label: "Elegante" },
  { id: "objetivo", label: "Objetivo" },
  { id: "moderno", label: "Moderno" },
  { id: "profissional", label: "Profissional" },
];

interface Props {
  generationId: string | null;
  references: AiCampaignReference;
  suggestion: CampaignSuggestion | null;
}

export function CreativeStudio({ generationId, references, suggestion }: Props) {
  const [items, setItems] = useState<CampaignCreative[]>([]);
  const [loadingType, setLoadingType] = useState<CreativeType | null>(null);
  const [style, setStyle] = useState("promocional");
  const [focus, setFocus] = useState("campanha");
  const [tone, setTone] = useState("comercial");
  const [variations, setVariations] = useState(1);

  useEffect(() => {
    if (!generationId) return;
    listCampaignCreatives({ data: { generation_id: generationId } })
      .then((r) => setItems(r.creatives as CampaignCreative[]))
      .catch(() => {});
  }, [generationId]);

  function buildContext() {
    const validProducts = new Set(references.products.map((p) => p.id));
    const validCombos = new Set(references.combos.map((c) => c.id));
    const validCats = new Set(references.categories.map((c) => c.id));
    const productIds = suggestion?.vinculos_sugeridos.product_ids.filter((id) => validProducts.has(id)) ?? [];
    const comboIds = suggestion?.vinculos_sugeridos.combo_ids.filter((id) => validCombos.has(id)) ?? [];
    const catIds = suggestion?.vinculos_sugeridos.category_ids.filter((id) => validCats.has(id)) ?? [];
    const products = productIds
      .map((id) => references.products.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((p) => ({ name: p.name, price: p.price ?? null, category: p.category ?? null, image_url: null }));
    const combos = comboIds
      .map((id) => references.combos.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map((c) => ({ name: c.name, item_count: null }));
    const categories = catIds
      .map((id) => references.categories.find((c) => c.id === id)?.name)
      .filter((n): n is string => !!n);
    const couponId = suggestion?.vinculos_sugeridos.coupon_ids?.[0];
    const coupon = couponId ? references.coupons.find((c) => c.id === couponId)?.code ?? null : null;

    return {
      campaign_name: suggestion?.estrategia.nome_campanha ?? null,
      description: suggestion?.estrategia.descricao_curta ?? null,
      objective: suggestion?.estrategia.objetivo ?? null,
      audience: suggestion?.estrategia.publico_alvo ?? null,
      channel: suggestion?.estrategia.canais_recomendados?.[0] ?? null,
      titulo: suggestion?.textos.titulo ?? null,
      cta: suggestion?.textos.cta ?? null,
      coupon_code: coupon,
      products,
      combos,
      categories,
    };
  }

  async function generate(type: CreativeType) {
    if (!generationId) {
      toast.error("Gere primeiro o rascunho da campanha (botão acima).");
      return;
    }
    setLoadingType(type);
    try {
      const r = await generateCampaignCreatives({
        data: {
          creative_type: type,
          variations,
          style,
          focus,
          tone,
          generation_id: generationId,
          context: buildContext(),
        },
      });
      setItems((prev) => [...(r.creatives as CampaignCreative[]), ...prev]);
      toast.success(`${variations} criativo(s) gerado(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar imagens");
    } finally {
      setLoadingType(null);
    }
  }

  async function setStatus(id: string, status: "approved" | "discarded" | "draft") {
    try {
      const r = await updateCampaignCreative({ data: { id, status } });
      setItems((prev) => prev.map((it) => (it.id === id ? (r.creative as CampaignCreative) : it)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar");
    }
  }
  async function setPrincipal(id: string) {
    try {
      await updateCampaignCreative({ data: { id, is_principal: true } });
      setItems((prev) =>
        prev.map((it) => {
          if (it.id === id) return { ...it, is_principal: true };
          if (
            it.creative_type ===
            (prev.find((x) => x.id === id)?.creative_type as CreativeType)
          )
            return { ...it, is_principal: false };
          return it;
        }),
      );
      toast.success("Definido como principal");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }
  async function remove(id: string) {
    if (!confirm("Excluir este criativo?")) return;
    try {
      await deleteCampaignCreative({ data: { id } });
      setItems((prev) => prev.filter((it) => it.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <div className="space-y-4">
      {/* Controles globais */}
      <div className="rounded-md border bg-muted/30 p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div>
            <Label className="text-xs">Estilo</Label>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              {STYLE_OPTS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Foco</Label>
            <select
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              {FOCUS_OPTS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Tom</Label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              {TONE_OPTS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Variações</Label>
            <select
              value={variations}
              onChange={(e) => setVariations(Number(e.target.value))}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              {[1, 2, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Cards por tipo */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TYPES.map((t) => {
          const ofType = items.filter((i) => i.creative_type === t.id);
          const isLoading = loadingType === t.id;
          return (
            <div key={t.id} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{t.label}</div>
                  <div className="text-[11px] text-muted-foreground">{t.ratio}</div>
                </div>
                <Button size="sm" onClick={() => generate(t.id)} disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Gerando…
                    </>
                  ) : ofType.length > 0 ? (
                    <>
                      <RefreshCw className="mr-1 h-3.5 w-3.5" /> Gerar mais
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-1 h-3.5 w-3.5" /> Gerar com IA
                    </>
                  )}
                </Button>
              </div>

              {ofType.length === 0 ? (
                <div className="flex h-32 items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
                  {isLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> IA gerando…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <ImageOff className="h-4 w-4" /> Nenhum criativo ainda
                    </span>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {ofType.map((it) => (
                    <CreativeTile
                      key={it.id}
                      item={it}
                      onApprove={() => setStatus(it.id, "approved")}
                      onDiscard={() => setStatus(it.id, "discarded")}
                      onPrincipal={() => setPrincipal(it.id)}
                      onDelete={() => remove(it.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CreativeTile({
  item,
  onApprove,
  onDiscard,
  onPrincipal,
  onDelete,
}: {
  item: CampaignCreative;
  onApprove: () => void;
  onDiscard: () => void;
  onPrincipal: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`relative rounded border bg-background overflow-hidden ${
        item.status === "discarded" ? "opacity-50" : ""
      }`}
    >
      <div className="absolute left-1 top-1 z-10 flex gap-1">
        <Badge variant="secondary" className="px-1 py-0 text-[10px]">
          v{item.variation_index}
        </Badge>
        {item.is_principal && (
          <Badge className="px-1 py-0 text-[10px]">
            <Star className="mr-0.5 h-2.5 w-2.5" /> Principal
          </Badge>
        )}
        {item.status === "approved" && (
          <Badge variant="default" className="px-1 py-0 text-[10px]">
            Aprovada
          </Badge>
        )}
      </div>
      <a href={item.public_url} target="_blank" rel="noreferrer" className="block">
        <img
          src={item.public_url}
          alt={`Criativo ${item.creative_type} v${item.variation_index}`}
          className="block aspect-square w-full object-cover"
        />
      </a>
      <div className="flex flex-wrap gap-1 p-1.5">
        <Button size="sm" variant="ghost" className="h-7 px-1.5" onClick={onApprove} title="Aprovar">
          <CheckCircle2 className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-1.5" onClick={onPrincipal} title="Definir principal">
          <Star className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-1.5" asChild title="Baixar">
          <a href={item.public_url} download target="_blank" rel="noreferrer">
            <Download className="h-3.5 w-3.5" />
          </a>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-7 px-1.5 text-muted-foreground"
          onClick={onDiscard}
          title="Descartar"
        >
          <ImageOff className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-1.5 text-destructive"
          onClick={onDelete}
          title="Excluir"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
