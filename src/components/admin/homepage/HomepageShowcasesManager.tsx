import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Search,
  AlertTriangle,
  Package,
  Boxes,
  Eye,
  EyeOff,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  adminListHomepageShowcases,
  adminCreateHomepageShowcase,
  adminUpdateHomepageShowcase,
  adminDeleteHomepageShowcase,
  adminListShowcaseItems,
  adminAddShowcaseItem,
  adminUpdateShowcaseItem,
  adminDeleteShowcaseItem,
  type HomepageShowcase,
  type ShowcaseType,
  type ShowcaseMode,
  type ShowcaseVisual,
} from "@/lib/homepageBlocks";
import { computeProductQuality, QUALITY_FEATURED_MIN } from "@/lib/productQuality";

const TYPE_LABEL: Record<ShowcaseType, string> = {
  featured: "Destaques",
  offers: "Ofertas",
  best_sellers: "Mais vendidos",
  new_arrivals: "Novidades",
  category: "Categoria",
  bundles: "Combos",
  custom: "Personalizada",
};

const VISUAL_LABEL: Record<ShowcaseVisual, string> = {
  default: "Padrão",
  premium: "Premium",
  compact: "Compacta",
  highlighted: "Destacada",
};

const NOBLE_TYPES: ShowcaseType[] = ["featured", "offers", "best_sellers", "new_arrivals"];

function isUrlSafe(u: string | null | undefined) {
  if (!u) return true;
  if (u.length > 500) return false;
  if (/<|javascript:|data:/i.test(u)) return false;
  return true;
}

export function HomepageShowcasesManager() {
  const qc = useQueryClient();
  const { data: showcases, isLoading } = useQuery({
    queryKey: ["admin_homepage_showcases"],
    queryFn: adminListHomepageShowcases,
  });
  const { data: categories } = useQuery({
    queryKey: ["admin_categories_list_min"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("categories")
        .select("id, name, slug, active")
        .order("name", { ascending: true });
      return (data ?? []) as Array<{ id: string; name: string; slug: string; active: boolean }>;
    },
  });

  const [editingId, setEditingId] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: async () => {
      const next = (showcases?.length ?? 0) + 1;
      const created = await adminCreateHomepageShowcase({
        title: `Nova vitrine ${next}`,
        showcase_type: "featured",
        mode: "auto",
        product_limit: 8,
        visual_variant: "default",
        is_active: false,
        sort_order: next * 10,
      });
      return created;
    },
    onSuccess: (c) => {
      toast.success("Vitrine criada");
      qc.invalidateQueries({ queryKey: ["admin_homepage_showcases"] });
      setEditingId(c.id);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar vitrine"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminDeleteHomepageShowcase(id),
    onSuccess: () => {
      toast.success("Vitrine excluída");
      qc.invalidateQueries({ queryKey: ["admin_homepage_showcases"] });
      setEditingId(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir"),
  });

  const reorderMut = useMutation({
    mutationFn: async ({ id, sort_order }: { id: string; sort_order: number }) =>
      adminUpdateHomepageShowcase(id, { sort_order }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_homepage_showcases"] }),
  });

  const toggleActiveMut = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) =>
      adminUpdateHomepageShowcase(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_homepage_showcases"] }),
  });

  function move(id: string, dir: -1 | 1) {
    const list = [...(showcases ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    const idx = list.findIndex((s) => s.id === id);
    const swap = list[idx + dir];
    if (!swap) return;
    reorderMut.mutate({ id: list[idx].id, sort_order: swap.sort_order });
    reorderMut.mutate({ id: swap.id, sort_order: list[idx].sort_order });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Vitrines de produtos</h2>
          <p className="text-xs text-muted-foreground max-w-xl">
            Crie vitrines automáticas (por regra) ou manuais (escolhendo produto a produto). Quando
            criar uma vitrine de <b>Ofertas</b> ou <b>Destaques</b>, ela substitui o bloco padrão da
            homepage.
          </p>
        </div>
        <Button size="sm" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
          <Plus className="w-4 h-4 mr-1" /> Nova vitrine
        </Button>
      </div>

      {isLoading && (
        <div className="p-6 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      )}

      <div className="space-y-2">
        {(showcases ?? []).map((s, i, arr) => (
          <Card key={s.id} className="overflow-hidden">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex flex-col gap-0.5">
                <button
                  className="p-1 rounded hover:bg-muted disabled:opacity-30"
                  disabled={i === 0}
                  onClick={() => move(s.id, -1)}
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  className="p-1 rounded hover:bg-muted disabled:opacity-30"
                  disabled={i === arr.length - 1}
                  onClick={() => move(s.id, 1)}
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{s.title}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {TYPE_LABEL[s.showcase_type]}
                  </Badge>
                  <Badge
                    variant={s.mode === "manual" ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {s.mode === "manual" ? "Manual" : "Automática"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {VISUAL_LABEL[s.visual_variant]}
                  </Badge>
                  {!s.is_active && (
                    <Badge variant="destructive" className="text-[10px]">
                      Inativa
                    </Badge>
                  )}
                </div>
                {s.subtitle && (
                  <p className="text-xs text-muted-foreground truncate">{s.subtitle}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={s.is_active}
                  onCheckedChange={(v) => toggleActiveMut.mutate({ id: s.id, is_active: v })}
                />
                <Button variant="outline" size="sm" onClick={() => setEditingId(s.id)}>
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => {
                    if (confirm(`Excluir vitrine "${s.title}"?`)) deleteMut.mutate(s.id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && (showcases?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground border rounded-md p-6 text-center">
            Nenhuma vitrine criada ainda. A homepage continua usando os blocos padrão (Ofertas e
            Destaques).
          </p>
        )}
      </div>

      <ShowcaseEditorDialog
        showcaseId={editingId}
        showcase={showcases?.find((s) => s.id === editingId) ?? null}
        categories={categories ?? []}
        onClose={() => setEditingId(null)}
      />
    </div>
  );
}

// =====================================================================
// Editor Dialog
// =====================================================================

function ShowcaseEditorDialog({
  showcaseId,
  showcase,
  categories,
  onClose,
}: {
  showcaseId: string | null;
  showcase: HomepageShowcase | null;
  categories: Array<{ id: string; name: string; slug: string; active: boolean }>;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<HomepageShowcase>>({});

  useEffect(() => {
    if (showcase) setForm(showcase);
  }, [showcase]);

  const set = <K extends keyof HomepageShowcase>(k: K, v: HomepageShowcase[K] | null) =>
    setForm((f) => ({ ...f, [k]: v as any }));

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!showcaseId) return;
      if (!form.title || form.title.trim().length === 0) throw new Error("Título obrigatório");
      if (form.title.length > 120) throw new Error("Título muito longo (máx 120)");
      if (form.subtitle && form.subtitle.length > 240)
        throw new Error("Subtítulo muito longo (máx 240)");
      if (!isUrlSafe(form.view_all_url ?? null)) throw new Error('URL "Ver todos" inválida');
      if (form.showcase_type === "category" && !form.category_id) {
        throw new Error("Selecione uma categoria para vitrine do tipo Categoria");
      }
      const payload: any = { ...form };
      delete payload.id;
      await adminUpdateHomepageShowcase(showcaseId, payload);
    },
    onSuccess: () => {
      toast.success("Vitrine salva");
      qc.invalidateQueries({ queryKey: ["admin_homepage_showcases"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  if (!showcaseId || !showcase) return null;

  const isManual = form.mode === "manual";
  const isCategory = form.showcase_type === "category";
  const isBundles = form.showcase_type === "bundles";
  const isNoble = form.showcase_type ? NOBLE_TYPES.includes(form.showcase_type) : false;

  return (
    <Dialog open={!!showcaseId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar vitrine</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Título *</Label>
              <Input
                value={form.title ?? ""}
                onChange={(e) => set("title", e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Subtítulo (opcional)</Label>
              <Textarea
                rows={2}
                value={form.subtitle ?? ""}
                onChange={(e) => set("subtitle", e.target.value || null)}
                maxLength={240}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select
                value={form.showcase_type}
                onValueChange={(v) => set("showcase_type", v as ShowcaseType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABEL) as ShowcaseType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Modo</Label>
              <Select value={form.mode} onValueChange={(v) => set("mode", v as ShowcaseMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automático (por regra)</SelectItem>
                  <SelectItem value="manual">Manual (escolher itens)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Variante visual</Label>
              <Select
                value={form.visual_variant}
                onValueChange={(v) => set("visual_variant", v as ShowcaseVisual)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(VISUAL_LABEL) as ShowcaseVisual[]).map((v) => (
                    <SelectItem key={v} value={v}>
                      {VISUAL_LABEL[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Limite de itens (1–24)</Label>
              <Input
                type="number"
                min={1}
                max={24}
                value={form.product_limit ?? 8}
                onChange={(e) =>
                  set("product_limit", Math.min(24, Math.max(1, Number(e.target.value) || 8)))
                }
              />
            </div>

            {isCategory && (
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">Categoria *</Label>
                <Select
                  value={form.category_id ?? ""}
                  onValueChange={(v) => set("category_id", v || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories
                      .filter((c) => c.active)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Ordem de exibição</Label>
              <Input
                type="number"
                value={form.sort_order ?? 0}
                onChange={(e) => set("sort_order", Number(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-1.5 flex items-end gap-2">
              <Switch checked={!!form.is_active} onCheckedChange={(v) => set("is_active", v)} />
              <Label className="text-xs">Vitrine ativa</Label>
            </div>

            <div className="space-y-1.5 md:col-span-2 border-t pt-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={!!form.show_view_all_button}
                  onCheckedChange={(v) => set("show_view_all_button", v)}
                />
                <Label className="text-xs">Exibir botão "Ver todos"</Label>
              </div>
            </div>

            {form.show_view_all_button && (
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">URL do "Ver todos" (opcional)</Label>
                <Input
                  value={form.view_all_url ?? ""}
                  onChange={(e) => set("view_all_url", e.target.value || null)}
                  placeholder="/catalogo?oferta=true"
                />
                <p className="text-[11px] text-muted-foreground">
                  Se vazio, será calculado automaticamente conforme o tipo da vitrine.
                </p>
              </div>
            )}
          </div>

          {isManual && (
            <ManualItemsEditor
              showcaseId={showcaseId}
              isNoble={isNoble}
              acceptCombos={!isCategory}
            />
          )}

          {!isManual && isNoble && (
            <p className="text-xs text-muted-foreground border-l-2 border-amber-500 pl-3">
              Vitrines nobres ({TYPE_LABEL[form.showcase_type as ShowcaseType]}) ocultam
              automaticamente produtos com qualidade insuficiente para destaque (score &lt;{" "}
              {QUALITY_FEATURED_MIN}).
            </p>
          )}
          {!isManual && isBundles && (
            <p className="text-xs text-muted-foreground border-l-2 border-blue-500 pl-3">
              Modo automático de combos: lista combos ativos dentro da validade.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <Save className="w-4 h-4 mr-1" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================================
// Editor de itens manuais
// =====================================================================

interface ResolvedManualItem {
  itemId: string;
  itemType: "product" | "combo";
  sortOrder: number;
  isActive: boolean;
  product?: any;
  combo?: any;
  qualityScore?: number;
  warnings: string[];
}

function ManualItemsEditor({
  showcaseId,
  isNoble,
  acceptCombos,
}: {
  showcaseId: string;
  isNoble: boolean;
  acceptCombos: boolean;
}) {
  const qc = useQueryClient();
  const [searchOpen, setSearchOpen] = useState<"product" | "combo" | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ["admin_showcase_items", showcaseId],
    queryFn: () => adminListShowcaseItems(showcaseId),
  });

  // Resolve todos os produtos e combos referenciados
  const productIds = (items ?? []).filter((i) => i.product_id).map((i) => i.product_id!);
  const comboIds = (items ?? []).filter((i) => i.combo_id).map((i) => i.combo_id!);

  const { data: products } = useQuery({
    queryKey: ["admin_showcase_products", productIds.sort().join(",")],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("products")
        .select(
          "id, name, slug, active, price, sale_price, images, description, ncm, weight_kg, height_cm, width_cm, length_cm, cost_price, category_id, seo_title, seo_description, seo_keywords",
        )
        .in("id", productIds);
      return (data ?? []) as any[];
    },
  });

  const { data: combos } = useQuery({
    queryKey: ["admin_showcase_combos", comboIds.sort().join(",")],
    enabled: comboIds.length > 0,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("product_bundles")
        .select("id, name, slug, image_url, is_active, start_date, end_date")
        .in("id", comboIds);
      return (data ?? []) as any[];
    },
  });

  const resolved: ResolvedManualItem[] = useMemo(() => {
    return (items ?? [])
      .map((it) => {
        const warnings: string[] = [];
        let product: any | undefined;
        let combo: any | undefined;
        let qualityScore: number | undefined;

        if (it.item_type === "product" && it.product_id) {
          product = (products ?? []).find((p) => p.id === it.product_id);
          if (!product) warnings.push("Produto não encontrado");
          else {
            if (!product.active) warnings.push("Produto inativo — não aparecerá");
            const price = product.sale_price ?? product.price;
            if (!price || price <= 0) warnings.push("Sem preço — não aparecerá");
            const q = computeProductQuality(product);
            qualityScore = q.score;
            if (isNoble && q.score < QUALITY_FEATURED_MIN) {
              warnings.push(
                `Qualidade ${q.score} < ${QUALITY_FEATURED_MIN} — não aparecerá em vitrine nobre`,
              );
            }
          }
        } else if (it.item_type === "combo" && it.combo_id) {
          combo = (combos ?? []).find((c) => c.id === it.combo_id);
          if (!combo) warnings.push("Combo não encontrado");
          else {
            if (!combo.is_active) warnings.push("Combo inativo — não aparecerá");
            const now = Date.now();
            if (combo.start_date && new Date(combo.start_date).getTime() > now)
              warnings.push("Combo ainda não começou");
            if (combo.end_date && new Date(combo.end_date).getTime() < now)
              warnings.push("Combo expirado");
          }
        }

        return {
          itemId: it.id,
          itemType: it.item_type,
          sortOrder: it.sort_order,
          isActive: it.is_active,
          product,
          combo,
          qualityScore,
          warnings,
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [items, products, combos, isNoble]);

  const addMut = useMutation({
    mutationFn: async ({ type, id }: { type: "product" | "combo"; id: string }) => {
      const next = (items?.length ?? 0) + 1;
      await adminAddShowcaseItem({
        showcase_id: showcaseId,
        item_type: type,
        product_id: type === "product" ? id : null,
        combo_id: type === "combo" ? id : null,
        sort_order: next * 10,
      });
    },
    onSuccess: () => {
      toast.success("Item adicionado");
      qc.invalidateQueries({ queryKey: ["admin_showcase_items", showcaseId] });
      setSearchOpen(null);
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? "");
      if (msg.includes("duplicate") || msg.includes("uq_homepage_showcase_items")) {
        toast.error("Este item já está nessa vitrine");
      } else {
        toast.error(msg || "Erro ao adicionar");
      }
    },
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => adminDeleteShowcaseItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_showcase_items", showcaseId] }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      adminUpdateShowcaseItem(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_showcase_items", showcaseId] }),
  });

  const reorderMut = useMutation({
    mutationFn: ({ id, sort_order }: { id: string; sort_order: number }) =>
      adminUpdateShowcaseItem(id, { sort_order }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_showcase_items", showcaseId] }),
  });

  function move(itemId: string, dir: -1 | 1) {
    const idx = resolved.findIndex((r) => r.itemId === itemId);
    const swap = resolved[idx + dir];
    if (!swap) return;
    reorderMut.mutate({ id: resolved[idx].itemId, sort_order: swap.sortOrder });
    reorderMut.mutate({ id: swap.itemId, sort_order: resolved[idx].sortOrder });
  }

  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Itens manuais</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setSearchOpen("product")}>
            <Package className="w-4 h-4 mr-1" /> Adicionar produto
          </Button>
          {acceptCombos && (
            <Button size="sm" variant="outline" onClick={() => setSearchOpen("combo")}>
              <Boxes className="w-4 h-4 mr-1" /> Adicionar combo
            </Button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="p-4 flex justify-center text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      )}

      <div className="space-y-2">
        {resolved.map((r, i) => {
          const data = r.product ?? r.combo;
          const name = data?.name ?? "(item removido)";
          const image = r.product
            ? Array.isArray(r.product.images) && r.product.images[0]
            : r.combo?.image_url;
          return (
            <div
              key={r.itemId}
              className={`flex items-center gap-3 p-2 border rounded-md ${r.warnings.length > 0 ? "border-amber-500/50 bg-amber-500/5" : ""}`}
            >
              <div className="flex flex-col gap-0.5">
                <button
                  className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                  disabled={i === 0}
                  onClick={() => move(r.itemId, -1)}
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                  disabled={i === resolved.length - 1}
                  onClick={() => move(r.itemId, 1)}
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>

              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                {image ? (
                  <img src={image} alt="" className="w-full h-full object-cover" />
                ) : r.itemType === "combo" ? (
                  <Boxes className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <Package className="w-5 h-5 text-muted-foreground" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">{name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {r.itemType === "combo" ? "Combo" : "Produto"}
                  </Badge>
                  {r.qualityScore !== undefined && (
                    <Badge
                      variant={r.qualityScore >= QUALITY_FEATURED_MIN ? "secondary" : "destructive"}
                      className="text-[10px]"
                    >
                      Qualidade {r.qualityScore}
                    </Badge>
                  )}
                </div>
                {r.warnings.length > 0 && (
                  <div className="flex items-start gap-1 mt-0.5">
                    <AlertTriangle className="w-3 h-3 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-amber-700">{r.warnings.join(" • ")}</p>
                  </div>
                )}
              </div>

              <Switch
                checked={r.isActive}
                onCheckedChange={(v) => toggleMut.mutate({ id: r.itemId, is_active: v })}
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => removeMut.mutate(r.itemId)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          );
        })}
        {!isLoading && resolved.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhum item ainda. Adicione produtos ou combos.
          </p>
        )}
      </div>

      {searchOpen && (
        <ItemSearchDialog
          type={searchOpen}
          isNoble={isNoble}
          existingProductIds={productIds}
          existingComboIds={comboIds}
          onSelect={(id) => addMut.mutate({ type: searchOpen, id })}
          onClose={() => setSearchOpen(null)}
        />
      )}
    </div>
  );
}

// =====================================================================
// Search Dialog
// =====================================================================

function ItemSearchDialog({
  type,
  isNoble,
  existingProductIds,
  existingComboIds,
  onSelect,
  onClose,
}: {
  type: "product" | "combo";
  isNoble: boolean;
  existingProductIds: string[];
  existingComboIds: string[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const { data, isFetching } = useQuery({
    queryKey: ["admin_showcase_search", type, q],
    queryFn: async () => {
      if (type === "product") {
        const query = (supabase as any)
          .from("products")
          .select(
            "id, name, slug, active, price, sale_price, images, description, ncm, weight_kg, height_cm, width_cm, length_cm, cost_price, category_id, seo_title, seo_description, seo_keywords",
          )
          .order("created_at", { ascending: false })
          .limit(20);
        if (q.trim().length > 0) query.ilike("name", `%${q.trim()}%`);
        const { data: rows } = await query;
        return (rows ?? []) as any[];
      } else {
        const query = (supabase as any)
          .from("product_bundles")
          .select("id, name, slug, is_active, image_url, start_date, end_date")
          .order("created_at", { ascending: false })
          .limit(20);
        if (q.trim().length > 0) query.ilike("name", `%${q.trim()}%`);
        const { data: rows } = await query;
        return (rows ?? []) as any[];
      }
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Adicionar {type === "product" ? "produto" : "combo"} à vitrine</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome..."
            className="pl-8"
          />
        </div>
        <div className="max-h-96 overflow-y-auto space-y-1 mt-2">
          {isFetching && <Loader2 className="w-4 h-4 animate-spin mx-auto my-4" />}
          {(data ?? []).map((row: any) => {
            const already =
              type === "product"
                ? existingProductIds.includes(row.id)
                : existingComboIds.includes(row.id);
            const image =
              type === "product" ? Array.isArray(row.images) && row.images[0] : row.image_url;
            const isActive = type === "product" ? row.active : row.is_active;
            const price = type === "product" ? (row.sale_price ?? row.price) : null;
            const qualityScore = type === "product" ? computeProductQuality(row).score : undefined;
            const blockedByQuality =
              type === "product" && isNoble && (qualityScore ?? 0) < QUALITY_FEATURED_MIN;

            return (
              <button
                key={row.id}
                disabled={already || blockedByQuality}
                onClick={() => onSelect(row.id)}
                className="w-full flex items-center gap-3 p-2 border rounded-md text-left hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 rounded bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
                  {image ? (
                    <img src={image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{row.name}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    {!isActive && (
                      <Badge variant="destructive" className="text-[10px]">
                        Inativo
                      </Badge>
                    )}
                    {price !== null && (
                      <span className="text-[11px] text-muted-foreground">
                        R$ {Number(price).toFixed(2)}
                      </span>
                    )}
                    {qualityScore !== undefined && (
                      <Badge
                        variant={qualityScore >= QUALITY_FEATURED_MIN ? "secondary" : "destructive"}
                        className="text-[10px]"
                      >
                        Q {qualityScore}
                      </Badge>
                    )}
                    {already && (
                      <Badge variant="outline" className="text-[10px]">
                        Já adicionado
                      </Badge>
                    )}
                    {blockedByQuality && (
                      <span className="text-[10px] text-destructive">
                        Qualidade insuficiente para vitrine nobre — corrija imagem, descrição, SEO,
                        custo, fiscal ou logística antes
                      </span>
                    )}
                  </div>
                </div>
                {!already && !blockedByQuality && (
                  <Plus className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            );
          })}
          {!isFetching && (data?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum resultado.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-1" /> Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
