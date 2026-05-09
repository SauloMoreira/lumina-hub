import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Search,
  Trash2,
  AlertCircle,
  CheckCircle2,
  PackagePlus,
  Star,
  ExternalLink,
  Eye,
  EyeOff,
  Upload,
  X,
  Sparkles,
} from "lucide-react";
import { AiImageGeneratorDialog } from "@/components/admin/AiImageGeneratorDialog";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatBRL } from "@/lib/domain";
import {
  adminListBundles,
  adminCreateBundle,
  adminUpdateBundle,
  adminDeleteBundle,
  adminGetBundle,
  adminAddBundleItem,
  adminRemoveBundleItem,
  adminUpdateBundleItem,
  adminSearchProductsForBundle,
  adminListBundleImages,
  adminAddBundleImage,
  adminRemoveBundleImage,
  adminSetPrimaryBundleImage,
  adminReorderBundleImages,
  type BundleAdminRow,
  type BundlePublic,
  type BundleAvailability,
} from "@/server/productBundles.functions";

export const Route = createFileRoute("/admin/produtos/combos")({
  component: BundlesAdminPage,
});

const AVAILABILITY_LABEL: Record<BundleAvailability, string> = {
  available: "Disponível",
  partial: "Parcialmente indisponível",
  unavailable: "Indisponível",
  needs_review: "Necessita revisão",
};

const AVAILABILITY_TONE: Record<BundleAvailability, string> = {
  available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  partial: "bg-amber-50 text-amber-700 border-amber-200",
  unavailable: "bg-red-50 text-red-700 border-red-200",
  needs_review: "bg-muted text-muted-foreground border-border",
};

type BundleMetaPatch = {
  name?: string;
  slug?: string;
  description?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
  isFeatured?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
  discountType?: "none" | "fixed_amount" | "percentage";
  discountValue?: number;
};

const BUNDLE_PERCENT_LIMIT = 50;

function BundlesAdminPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const qc = useQueryClient();

  const listQ = useQuery({
    queryKey: ["admin-bundles"],
    queryFn: () => adminListBundles({ data: {} }),
    staleTime: 5_000,
  });

  return (
    <AdminLayout
      title="Kits e Combos"
      action={
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Novo combo
        </Button>
      }
    >
      <div className="mb-4 flex items-center gap-3">
        <Link to="/admin">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" /> Admin
          </Button>
        </Link>
        <p className="text-sm text-muted-foreground">
          Agrupe produtos para compra conjunta. Descontos de combo serão aplicados em uma próxima
          etapa.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-4 min-w-0">
        {/* Listagem */}
        <div className="bg-card border border-border rounded-xl p-3 min-h-[300px]">
          {listQ.isLoading ? (
            <div className="text-xs text-muted-foreground flex items-center gap-2 p-3">
              <Loader2 className="w-3 h-3 animate-spin" /> Carregando…
            </div>
          ) : (listQ.data ?? []).length === 0 ? (
            <EmptyAdminState onCreate={() => setCreateOpen(true)} />
          ) : (
            <ul className="space-y-1">
              {(listQ.data ?? []).map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(b.id)}
                    className={`w-full text-left p-2 rounded-md flex items-center gap-2 border ${
                      selectedId === b.id
                        ? "bg-accent/40 border-border"
                        : "border-transparent hover:bg-accent/30"
                    }`}
                  >
                    <BundleListThumb row={b} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate flex items-center gap-1">
                        {b.is_featured && <Star className="w-3 h-3 text-amber-500 shrink-0" />}
                        {b.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {b.items_count} {b.items_count === 1 ? "item" : "itens"}
                        {" · "}
                        {b.is_active ? "Ativo" : "Inativo"}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Editor */}
        <div className="min-w-0">
          {selectedId ? (
            <BundleEditor
              bundleId={selectedId}
              onDeleted={() => {
                setSelectedId(null);
                qc.invalidateQueries({ queryKey: ["admin-bundles"] });
              }}
            />
          ) : (
            <div className="bg-card border border-border rounded-xl p-10 text-center text-sm text-muted-foreground">
              Selecione um combo na lista para editar, ou clique em <strong>Novo combo</strong>.
            </div>
          )}
        </div>
      </div>

      <CreateBundleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          setSelectedId(id);
          qc.invalidateQueries({ queryKey: ["admin-bundles"] });
        }}
      />
    </AdminLayout>
  );
}

function BundleListThumb({ row }: { row: BundleAdminRow }) {
  return (
    <div className="w-10 h-10 rounded bg-surface flex-shrink-0 overflow-hidden flex items-center justify-center">
      {row.image_url ? (
        <img src={row.image_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <PackagePlus className="w-4 h-4 text-muted-foreground" />
      )}
    </div>
  );
}

function EmptyAdminState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="p-6 text-center space-y-3">
      <PackagePlus className="w-8 h-8 text-muted-foreground mx-auto" />
      <div className="text-sm font-medium">Você ainda não criou kits ou combos.</div>
      <Button size="sm" onClick={onCreate}>
        <Plus className="w-4 h-4 mr-1" /> Criar primeiro combo
      </Button>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Editor
// ----------------------------------------------------------------------------
function BundleEditor({ bundleId, onDeleted }: { bundleId: string; onDeleted: () => void }) {
  const qc = useQueryClient();
  const detailQ = useQuery({
    queryKey: ["admin-bundle", bundleId],
    queryFn: () => adminGetBundle({ data: { id: bundleId } }),
    staleTime: 0,
  });

  const updateMut = useMutation({
    mutationFn: (vars: BundleMetaPatch & { id: string }) => adminUpdateBundle({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-bundle", bundleId] });
      qc.invalidateQueries({ queryKey: ["admin-bundles"] });
    },
    onError: (err: any) => {
      const msg = String(err?.message ?? "");
      if (msg.includes("slug_already_exists")) toast.error("Já existe um combo com esse slug.");
      else if (msg.includes("bundle_has_no_items"))
        toast.error("Adicione produtos antes de ativar o combo.");
      else if (msg.includes("bundle_has_broken_items"))
        toast.error("Há itens obrigatórios sem preço ou inativos. Corrija antes de ativar.");
      else toast.error("Erro ao salvar.");
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => adminDeleteBundle({ data: { id: bundleId } }),
    onSuccess: () => {
      toast.success("Combo removido");
      onDeleted();
    },
    onError: () => toast.error("Erro ao remover combo"),
  });

  if (detailQ.isLoading || !detailQ.data) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-xs text-muted-foreground flex items-center gap-2">
        <Loader2 className="w-3 h-3 animate-spin" /> Carregando combo…
      </div>
    );
  }

  const b = detailQ.data;

  return (
    <div className="space-y-4">
      <BundleMetaForm
        bundle={b}
        onChange={(patch) => updateMut.mutate({ id: bundleId, ...patch })}
        saving={updateMut.isPending}
        onDelete={() => {
          if (confirm(`Remover combo "${b.name}"?`)) deleteMut.mutate();
        }}
      />
      <BundleItemsSection bundle={b} />
      <DiscountFutureNotice />
    </div>
  );
}

function BundleMetaForm({
  bundle,
  onChange,
  saving,
  onDelete,
}: {
  bundle: BundlePublic;
  onChange: (patch: BundleMetaPatch) => void;
  saving: boolean;
  onDelete: () => void;
}) {
  const [name, setName] = useState(bundle.name);
  const [slug, setSlug] = useState(bundle.slug ?? "");
  const [description, setDescription] = useState(bundle.description ?? "");
  

  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-4 overflow-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-lg font-semibold truncate">{bundle.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <AvailabilityBadge availability={bundle.availability} />
            {bundle.slug && (
              <a
                href={`/combo/${bundle.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" /> /combo/{bundle.slug}
              </a>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onDelete} className="self-start">
          <Trash2 className="w-4 h-4 mr-1" /> Excluir
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Nome">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name !== bundle.name && onChange({ name })}
          />
        </Field>
        <Field label="Slug (URL)">
          <Input
            value={slug}
            onChange={(e) =>
              setSlug(
                e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, "-")
                  .replace(/-+/g, "-"),
              )
            }
            onBlur={() => slug && slug !== (bundle.slug ?? "") && onChange({ slug })}
            placeholder="kit-iluminacao-led"
          />
        </Field>
      </div>

      <Field label="Descrição">
        <Textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() =>
            description !== (bundle.description ?? "") &&
            onChange({ description: description || null })
          }
        />
      </Field>

      <BundleImagesGallery bundleId={bundle.id} bundleName={bundle.name} />

      <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-border">
        <ToggleRow
          label="Combo ativo"
          checked={bundle.is_active}
          onChange={(v) => onChange({ isActive: v })}
          icon={bundle.is_active ? Eye : EyeOff}
          help="Quando ativo, aparece na vitrine pública /combos."
        />
        <ToggleRow
          label="Destacar combo"
          checked={bundle.is_featured}
          onChange={(v) => onChange({ isFeatured: v })}
          icon={Star}
          help="Destaque aparece primeiro na listagem pública."
        />
      </div>

      <BundleDiscountSection bundle={bundle} onChange={onChange} />

      {saving && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" /> Salvando…
        </div>
      )}
    </div>
  );
}

function BundleDiscountSection({
  bundle,
  onChange,
}: {
  bundle: BundlePublic;
  onChange: (patch: BundleMetaPatch) => void;
}) {
  const [type, setType] = useState<NonNullable<BundleMetaPatch["discountType"]>>(
    (bundle.discount_type ?? "none") as NonNullable<BundleMetaPatch["discountType"]>,
  );
  const [value, setValue] = useState<string>(String(bundle.discount_value ?? 0));

  const numValue = Number(value) || 0;
  const eligible = bundle.subtotal;
  const estimated =
    type === "fixed_amount"
      ? Math.min(numValue, eligible)
      : type === "percentage"
        ? Math.min(eligible, Math.round(eligible * (Math.min(numValue, 100) / 100) * 100) / 100)
        : 0;
  const totalAfter = Math.max(0, eligible - estimated);
  const overLimit = type === "percentage" && numValue > BUNDLE_PERCENT_LIMIT;
  const invalid =
    type !== "none" && (numValue <= 0 || (type === "fixed_amount" && numValue > eligible));

  function commit(nextType: NonNullable<BundleMetaPatch["discountType"]>, nextValue: number) {
    if (nextType === "none") {
      onChange({ discountType: "none", discountValue: 0 });
      return;
    }
    if (nextValue <= 0) return;
    if (nextType === "percentage" && nextValue > BUNDLE_PERCENT_LIMIT) return;
    onChange({ discountType: nextType, discountValue: nextValue });
  }

  return (
    <div className="space-y-3 pt-3 border-t border-border">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Desconto do combo</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
          backend valida
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Tipo de desconto">
          <select
            value={type}
            onChange={(e) => {
              const t = e.target.value as NonNullable<BundleMetaPatch["discountType"]>;
              setType(t);
              if (t === "none") {
                setValue("0");
                commit("none", 0);
              }
            }}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="none">Sem desconto</option>
            <option value="fixed_amount">Valor fixo (R$)</option>
            <option value="percentage">Percentual (%)</option>
          </select>
        </Field>
        <Field label={type === "percentage" ? "Valor (%)" : "Valor (R$)"}>
          <Input
            type="number"
            min={0}
            step={type === "percentage" ? 1 : 0.01}
            value={value}
            disabled={type === "none"}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => commit(type, Number(value) || 0)}
          />
        </Field>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {type === "fixed_amount" && "Reduz um valor fixo em reais do subtotal do combo. "}
        {type === "percentage" &&
          `Reduz uma porcentagem sobre o subtotal dos itens elegíveis. Limite seguro: ${BUNDLE_PERCENT_LIMIT}%. `}
        {type === "none" && "Combo estrutural, sem desconto comercial. "}
        Descontos de combo não acumulam com preço empresa (B2B) por padrão.
      </p>

      {overLimit && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
          Acima do limite seguro de {BUNDLE_PERCENT_LIMIT}%. Ajuste para salvar.
        </div>
      )}
      {invalid && !overLimit && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          Valor inválido para o tipo selecionado.
        </div>
      )}

      {type !== "none" && bundle.items.length > 0 && (
        <div className="rounded-md border border-border bg-surface/40 p-3 text-xs space-y-1">
          <div className="font-medium text-foreground">Prévia (sem aplicar ainda)</div>
          <div className="flex justify-between">
            <span>Subtotal dos itens</span>
            <span>{formatBRL(eligible)}</span>
          </div>
          <div className="flex justify-between text-emerald-700">
            <span>Desconto estimado</span>
            <span>− {formatBRL(estimated)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1">
            <span>Total estimado do combo</span>
            <span>{formatBRL(totalAfter)}</span>
          </div>
          <div className="text-[10px] text-muted-foreground pt-1">
            Revise a margem dos produtos antes de aplicar desconto. O backend é a fonte da verdade
            no carrinho.
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      {children}
    </label>
  );
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function BundleImagesGallery({ bundleId, bundleName }: { bundleId: string; bundleName: string }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiUploading, setAiUploading] = useState(false);

  const imagesQ = useQuery({
    queryKey: ["admin-bundle-images", bundleId],
    queryFn: () => adminListBundleImages({ data: { bundleId } }),
    staleTime: 0,
  });

  const images = imagesQ.data ?? [];
  const atLimit = images.length >= 4;

  function refresh() {
    qc.invalidateQueries({ queryKey: ["admin-bundle-images", bundleId] });
    qc.invalidateQueries({ queryKey: ["admin-bundle", bundleId] });
    qc.invalidateQueries({ queryKey: ["admin-bundles"] });
  }

  const addMut = useMutation({
    mutationFn: (vars: { url: string; source: "manual_upload" | "manual_url" | "ai_generated" }) =>
      adminAddBundleImage({ data: { bundleId, url: vars.url, source: vars.source } }),
    onSuccess: () => {
      toast.success("Imagem adicionada");
      setManualUrl("");
      refresh();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("bundle_images_limit_reached"))
        toast.error("Limite de 4 imagens por kit atingido.");
      else toast.error("Erro ao adicionar imagem");
    },
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => adminRemoveBundleImage({ data: { id } }),
    onSuccess: () => {
      toast.success("Imagem removida");
      refresh();
    },
    onError: () => toast.error("Erro ao remover"),
  });

  const setPrimaryMut = useMutation({
    mutationFn: (id: string) => adminSetPrimaryBundleImage({ data: { id } }),
    onSuccess: () => {
      toast.success("Capa atualizada");
      refresh();
    },
    onError: () => toast.error("Erro ao definir capa"),
  });

  const reorderMut = useMutation({
    mutationFn: (orderedIds: string[]) =>
      adminReorderBundleImages({ data: { bundleId, orderedIds } }),
    onSuccess: refresh,
    onError: () => toast.error("Erro ao reordenar"),
  });

  function move(idx: number, dir: -1 | 1) {
    const next = [...images];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    reorderMut.mutate(next.map((i) => i.id));
  }

  async function handleFile(file: File) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WebP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Arquivo muito grande. Máx 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const ext =
        (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const unique =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}`;
      const path = `bundles/${Date.now()}-${unique}.${ext}`;
      const { error } = await supabase.storage
        .from("product-images")
        .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      addMut.mutate({ url: data.publicUrl, source: "manual_upload" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function commitManualUrl() {
    const url = manualUrl.trim();
    if (!url) return;
    addMut.mutate({ url, source: "manual_url" });
  }

  return (
    <Field label={`Imagens do kit (${images.length}/4)`}>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Até 4 imagens por kit. A capa aparece na vitrine e como primeira foto na página do
          combo. JPG, PNG ou WebP até 5 MB.
        </p>

        {imagesQ.isLoading ? (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" /> Carregando imagens…
          </div>
        ) : images.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Nenhuma imagem cadastrada ainda.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {images.map((img: (typeof images)[number], idx: number) => (
              <div
                key={img.id}
                className={`relative rounded-md border bg-muted overflow-hidden ${
                  img.is_primary ? "border-accent ring-2 ring-accent/40" : "border-border"
                }`}
              >
                <div className="aspect-[4/3] w-full bg-muted">
                  <img
                    src={img.url}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
                    }}
                  />
                </div>
                {img.is_primary && (
                  <span className="absolute top-1 left-1 bg-accent text-accent-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                    <Star className="w-3 h-3" /> Capa
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Remover esta imagem?")) removeMut.mutate(img.id);
                  }}
                  className="absolute -top-1.5 -right-1.5 bg-background border border-border rounded-full p-1 shadow hover:bg-muted"
                  aria-label="Remover imagem"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="flex items-center justify-between gap-1 p-1.5 bg-card border-t border-border">
                  {!img.is_primary ? (
                    <button
                      type="button"
                      onClick={() => setPrimaryMut.mutate(img.id)}
                      className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      <Star className="w-3 h-3" /> Capa
                    </button>
                  ) : (
                    <span className="text-[10px] text-accent font-medium">Principal</span>
                  )}
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => move(idx, -1)}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 px-1 text-xs"
                      aria-label="Mover para esquerda"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      disabled={idx === images.length - 1}
                      onClick={() => move(idx, 1)}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 px-1 text-xs"
                      aria-label="Mover para direita"
                    >
                      →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-border">
          <Input
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            placeholder="Cole uma URL de imagem…"
            disabled={atLimit}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitManualUrl();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={atLimit || !manualUrl.trim() || addMut.isPending}
            onClick={commitManualUrl}
          >
            <Plus className="w-4 h-4 mr-1" /> Adicionar URL
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={atLimit || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-1" />
            )}
            {uploading ? "Enviando…" : "Enviar arquivo"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={atLimit || aiUploading}
            onClick={() => setAiOpen(true)}
          >
            {aiUploading ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-1" />
            )}
            Gerar com IA
          </Button>
        </div>
        {atLimit && (
          <p className="text-[11px] text-amber-600">
            Limite de 4 imagens atingido. Remova uma para adicionar outra.
          </p>
        )}

        <AiImageGeneratorDialog
          open={aiOpen}
          onOpenChange={setAiOpen}
          kind="bundle"
          name={bundleName}
          onApply={async (dataUrl) => {
            setAiUploading(true);
            try {
              const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
              if (!match) throw new Error("Imagem inválida");
              const contentType = match[1];
              const bin = atob(match[2]);
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              const blob = new Blob([bytes], { type: contentType });
              const ext =
                (contentType.split("/")[1] || "png").replace(/[^a-z0-9]/g, "") || "png";
              const unique =
                typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? crypto.randomUUID()
                  : `${Date.now()}`;
              const path = `bundles/${Date.now()}-${unique}.${ext}`;
              const { error } = await supabase.storage
                .from("product-images")
                .upload(path, blob, {
                  contentType,
                  cacheControl: "31536000",
                  upsert: false,
                });
              if (error) throw new Error(error.message);
              const { data } = supabase.storage.from("product-images").getPublicUrl(path);
              await new Promise<void>((resolve, reject) =>
                addMut.mutate(
                  { url: data.publicUrl, source: "ai_generated" },
                  { onSuccess: () => resolve(), onError: (e) => reject(e) },
                ),
              );
            } finally {
              setAiUploading(false);
            }
          }}
        />
      </div>
    </Field>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  icon: Icon,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: typeof Star;
  help?: string;
}) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-md border border-border bg-surface/40 cursor-pointer">
      <Switch checked={checked} onCheckedChange={onChange} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5" /> {label}
        </div>
        {help && <p className="text-[11px] text-muted-foreground mt-0.5">{help}</p>}
      </div>
    </label>
  );
}

function AvailabilityBadge({ availability }: { availability: BundleAvailability }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${AVAILABILITY_TONE[availability]}`}
    >
      {availability === "available" ? (
        <CheckCircle2 className="w-3 h-3" />
      ) : (
        <AlertCircle className="w-3 h-3" />
      )}
      {AVAILABILITY_LABEL[availability]}
    </span>
  );
}

// ----------------------------------------------------------------------------
// Itens
// ----------------------------------------------------------------------------
function BundleItemsSection({ bundle }: { bundle: BundlePublic }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);

  const searchQ = useQuery({
    queryKey: ["admin-bundle-search", search],
    queryFn: () => adminSearchProductsForBundle({ data: { query: search, limit: 10 } }),
    enabled: search.trim().length >= 2,
    staleTime: 5_000,
  });

  const addMut = useMutation({
    mutationFn: (productId: string) =>
      adminAddBundleItem({
        data: {
          bundleId: bundle.id,
          productId,
          quantity: 1,
          sortOrder: bundle.items.length,
          isRequired: true,
        },
      }),
    onSuccess: (res) => {
      toast.success(res.merged ? "Quantidade somada" : "Produto adicionado");
      setSearch("");
      setShowResults(false);
      qc.invalidateQueries({ queryKey: ["admin-bundle", bundle.id] });
      qc.invalidateQueries({ queryKey: ["admin-bundles"] });
    },
    onError: () => toast.error("Erro ao adicionar produto"),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => adminRemoveBundleItem({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-bundle", bundle.id] });
      qc.invalidateQueries({ queryKey: ["admin-bundles"] });
    },
    onError: () => toast.error("Erro ao remover"),
  });

  const updateItemMut = useMutation({
    mutationFn: (vars: {
      id: string;
      quantity?: number;
      sortOrder?: number;
      isRequired?: boolean;
    }) => adminUpdateBundleItem({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-bundle", bundle.id] });
    },
    onError: () => toast.error("Erro ao atualizar item"),
  });

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div>
        <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
          Produtos do combo
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Subtotal estimado:{" "}
          <strong className="text-foreground">{formatBRL(bundle.subtotal)}</strong> ·{" "}
          {bundle.total_units} {bundle.total_units === 1 ? "unidade" : "unidades"}
        </p>
      </div>

      <div className="relative rounded-lg border border-dashed border-border bg-surface/40 p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto por nome, SKU ou EAN…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            className="pl-8 h-9"
          />
        </div>
        {showResults && search.trim().length >= 2 && (
          <div className="absolute z-20 left-3 right-3 mt-1 rounded-md border border-border bg-popover shadow-lg max-h-72 overflow-auto">
            {searchQ.isLoading && (
              <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Buscando…
              </div>
            )}
            {searchQ.data?.length === 0 && !searchQ.isLoading && (
              <div className="p-3 text-xs text-muted-foreground">Nenhum produto encontrado.</div>
            )}
            {searchQ.data?.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={addMut.isPending}
                onClick={() => addMut.mutate(p.id)}
                className="w-full text-left flex items-center gap-2 p-2 hover:bg-accent/40 border-b border-border last:border-b-0"
              >
                <div className="w-9 h-9 rounded bg-surface overflow-hidden">
                  {p.image && <img src={p.image} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {p.sku ? `SKU ${p.sku}` : ""} {p.brand ? `· ${p.brand}` : ""}
                    {!p.active && " · inativo"}
                  </div>
                </div>
                <Plus className="w-4 h-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>

      {bundle.items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          Adicione ao menos um produto para ativar o combo.
        </div>
      ) : (
        <div className="border border-border rounded-md divide-y divide-border">
          {bundle.items.map((it) => (
            <div key={it.id} className="flex items-center gap-2 p-2">
              <div className="w-10 h-10 rounded bg-surface overflow-hidden flex-shrink-0">
                {it.product.image && (
                  <img src={it.product.image} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{it.product.name}</div>
                <div className="text-[11px] text-muted-foreground truncate flex items-center gap-2">
                  {it.product.sku && <span>SKU {it.product.sku}</span>}
                  <span>{formatBRL(it.product.final_price)}</span>
                  <span>· estoque {it.product.stock_qty}</span>
                  {it.status !== "ok" && (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <AlertCircle className="w-3 h-3" />
                      {it.status === "inactive" && "inativo"}
                      {it.status === "no_price" && "sem preço"}
                      {it.status === "no_stock" && "sem estoque"}
                    </span>
                  )}
                </div>
              </div>
              <input
                type="number"
                min={1}
                value={it.quantity}
                onChange={(e) => {
                  const qty = Math.max(1, Number(e.target.value) || 1);
                  updateItemMut.mutate({ id: it.id, quantity: qty });
                }}
                className="w-16 h-8 text-xs rounded border border-border bg-background px-2"
                title="Quantidade"
              />
              <input
                type="number"
                min={0}
                value={it.sort_order}
                onChange={(e) => {
                  const so = Math.max(0, Number(e.target.value) || 0);
                  updateItemMut.mutate({ id: it.id, sortOrder: so });
                }}
                className="w-14 h-8 text-xs rounded border border-border bg-background px-2"
                title="Ordem"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm("Remover este item do combo?")) removeMut.mutate(it.id);
                }}
                className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DiscountFutureNotice() {
  return (
    <div className="rounded-md border border-dashed border-border bg-surface/40 p-3 text-[11px] text-muted-foreground">
      <strong className="text-foreground">Descontos de combo:</strong> serão aplicados em uma
      próxima etapa. Nesta fase, o combo apenas agrupa produtos para compra conjunta — o carrinho e
      o checkout continuam aplicando o preço normal de cada item (e o preço empresa B2B quando
      aplicável).
    </div>
  );
}

// ----------------------------------------------------------------------------
// Criar combo
// ----------------------------------------------------------------------------
function CreateBundleDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const createMut = useMutation({
    mutationFn: () =>
      adminCreateBundle({
        data: {
          name: name.trim(),
          description: description.trim() || null,
        },
      }),
    onSuccess: (res) => {
      toast.success("Combo criado. Adicione os produtos.");
      onOpenChange(false);
      setName("");
      setDescription("");
      onCreated(res.id);
    },
    onError: (err: any) => {
      if (String(err?.message ?? "").includes("slug_already_exists"))
        toast.error("Já existe um combo com esse nome.");
      else toast.error("Erro ao criar combo");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo combo</DialogTitle>
          <DialogDescription>
            Crie o combo com nome e descrição. Em seguida, adicione os produtos e quantidades.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Nome do combo">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kit iluminação LED para sala"
              maxLength={160}
            />
          </Field>
          <Field label="Descrição (opcional)">
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => createMut.mutate()}
            disabled={name.trim().length < 2 || createMut.isPending}
          >
            {createMut.isPending && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
            Criar combo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
