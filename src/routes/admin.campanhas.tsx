import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  ExternalLink,
  BarChart3,
  Info,
  Tag,
  Image as ImageIcon,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/campanhas")({ component: CampanhasPage });

const STATUSES = [
  { value: "draft", label: "Rascunho" },
  { value: "active", label: "Ativa" },
  { value: "paused", label: "Pausada" },
  { value: "ended", label: "Encerrada" },
  { value: "expired", label: "Vencida" },
];
const CHANNELS = [
  "Site",
  "WhatsApp",
  "Instagram",
  "Facebook",
  "Google",
  "TikTok",
  "E-mail",
  "B2B",
  "Loja física",
  "Outro",
];
const OBJECTIVES = [
  "vender produto",
  "captar lead",
  "divulgar promoção",
  "recuperar carrinho",
  "divulgar atacado",
  "aumentar recompra",
  "divulgar categoria",
  "liquidar estoque",
  "lançamento",
];

type Campaign = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  channel?: string | null;
  objective?: string | null;
  audience?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  base_url?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  final_url?: string | null;
  budget_planned?: number | null;
  budget_spent?: number | null;
  notes?: string | null;
  coupon_id?: string | null;
  banner_id?: string | null;
  product_ids?: string[] | null;
  category_ids?: string[] | null;
  created_at: string;
  updated_at?: string | null;
};

const emptyForm = {
  name: "",
  description: "",
  status: "draft",
  channel: "Site",
  objective: "vender produto",
  audience: "",
  starts_at: "",
  ends_at: "",
  base_url: "",
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  utm_term: "",
  utm_content: "",
  budget_planned: "",
  budget_spent: "",
  notes: "",
  coupon_id: "",
  banner_id: "",
  product_ids: [] as string[],
  category_ids: [] as string[],
};

function normalizeUtm(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

function buildFinalUrl(form: typeof emptyForm): string {
  if (!form.base_url) return "";
  try {
    const url = new URL(form.base_url);
    const pairs: [string, string][] = [
      ["utm_source", form.utm_source],
      ["utm_medium", form.utm_medium],
      ["utm_campaign", form.utm_campaign],
      ["utm_term", form.utm_term],
      ["utm_content", form.utm_content],
    ];
    pairs.forEach(([k, v]) => {
      if (v && v.trim()) url.searchParams.set(k, v.trim());
    });
    return url.toString();
  } catch {
    return "";
  }
}

function CampanhasPage() {
  const [list, setList] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [coupons, setCoupons] = useState<Array<{ id: string; code: string }>>([]);
  const [banners, setBanners] = useState<Array<{ id: string; title: string }>>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);

  const finalUrl = useMemo(() => buildFinalUrl(form), [form]);

  const load = async () => {
    setLoading(true);
    const [c, cup, ban, prod, cat] = await Promise.all([
      supabase.from("marketing_campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("coupons").select("id, code").order("code"),
      supabase.from("home_banners").select("id, title").order("sort_order"),
      supabase.from("products").select("id, name").order("name").limit(500),
      supabase.from("categories").select("id, name").order("name"),
    ]);
    setList((c.data as any) ?? []);
    setCoupons((cup.data as any) ?? []);
    setBanners((ban.data as any) ?? []);
    setProducts((prod.data as any) ?? []);
    setCategories((cat.data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (c: Campaign) => {
    setEditing(c);
    setForm({
      name: c.name ?? "",
      description: c.description ?? "",
      status: c.status ?? "draft",
      channel: c.channel ?? "Site",
      objective: c.objective ?? "vender produto",
      audience: c.audience ?? "",
      starts_at: c.starts_at ? c.starts_at.slice(0, 16) : "",
      ends_at: c.ends_at ? c.ends_at.slice(0, 16) : "",
      base_url: c.base_url ?? "",
      utm_source: c.utm_source ?? "",
      utm_medium: c.utm_medium ?? "",
      utm_campaign: c.utm_campaign ?? "",
      utm_term: c.utm_term ?? "",
      utm_content: c.utm_content ?? "",
      budget_planned: c.budget_planned != null ? String(c.budget_planned) : "",
      budget_spent: c.budget_spent != null ? String(c.budget_spent) : "",
      notes: c.notes ?? "",
      coupon_id: c.coupon_id ?? "",
      banner_id: c.banner_id ?? "",
      product_ids: c.product_ids ?? [],
      category_ids: c.category_ids ?? [],
    });
    setOpen(true);
  };

  // Sugere utm_campaign a partir do nome
  useEffect(() => {
    if (!editing && form.name && !form.utm_campaign) {
      setForm((f) => ({ ...f, utm_campaign: normalizeUtm(form.name) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.name]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Informe o nome da campanha");

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description || null,
      status: form.status,
      channel: form.channel || null,
      objective: form.objective || null,
      audience: form.audience || null,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      base_url: form.base_url || null,
      utm_source: form.utm_source ? normalizeUtm(form.utm_source) : null,
      utm_medium: form.utm_medium ? normalizeUtm(form.utm_medium) : null,
      utm_campaign: form.utm_campaign ? normalizeUtm(form.utm_campaign) : null,
      utm_term: form.utm_term ? normalizeUtm(form.utm_term) : null,
      utm_content: form.utm_content ? normalizeUtm(form.utm_content) : null,
      final_url: finalUrl || null,
      budget_planned: form.budget_planned ? Number(form.budget_planned) : null,
      budget_spent: form.budget_spent ? Number(form.budget_spent) : null,
      notes: form.notes || null,
      coupon_id: form.coupon_id || null,
      banner_id: form.banner_id || null,
      product_ids: form.product_ids,
      category_ids: form.category_ids,
    };

    const res = editing
      ? await supabase
          .from("marketing_campaigns")
          .update(payload as never)
          .eq("id", editing.id)
      : await supabase.from("marketing_campaigns").insert(payload as never);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Campanha atualizada" : "Campanha criada");
    setOpen(false);
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Excluir campanha?")) return;
    const { error } = await supabase.from("marketing_campaigns").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluída");
    load();
  };

  const copyUrl = async () => {
    if (!finalUrl) return toast.error("Preencha a URL base e as UTMs");
    try {
      await navigator.clipboard.writeText(finalUrl);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const filtered = list.filter((c) => filterStatus === "all" || c.status === filterStatus);

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      draft: "bg-muted text-muted-foreground",
      active: "bg-green-500/15 text-green-700 dark:text-green-400",
      paused: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
      ended: "bg-muted text-muted-foreground",
      expired: "bg-red-500/15 text-red-700 dark:text-red-400",
    };
    const label = STATUSES.find((x) => x.value === s)?.label ?? s;
    return (
      <span
        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${map[s] ?? "bg-muted"}`}
      >
        {label}
      </span>
    );
  };

  const isExpired = (c: Campaign) =>
    c.status === "active" && c.ends_at && new Date(c.ends_at) < new Date();

  return (
    <AdminLayout title="Campanhas de Marketing">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Campanhas de Marketing</h1>
            <p className="text-sm text-muted-foreground">
              Crie campanhas, gere links com UTM e acompanhe quais ações geram leads e vendas.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/admin/campanhas-performance">
                <BarChart3 className="mr-2 h-4 w-4" /> Performance
              </Link>
            </Button>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> Nova campanha
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterStatus("all")}
              className={`rounded px-3 py-1 text-sm ${filterStatus === "all" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
            >
              Todas ({list.length})
            </button>
            {STATUSES.map((s) => {
              const n = list.filter((c) => c.status === s.value).length;
              return (
                <button
                  key={s.value}
                  onClick={() => setFilterStatus(s.value)}
                  className={`rounded px-3 py-1 text-sm ${filterStatus === s.value ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
                >
                  {s.label} ({n})
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          {loading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma campanha por aqui ainda.</p>
              <Button onClick={openNew} className="mt-4">
                <Plus className="mr-2 h-4 w-4" /> Criar primeira campanha
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{c.name}</h3>
                      {statusBadge(c.status)}
                      {c.channel && <Badge variant="outline">{c.channel}</Badge>}
                      {isExpired(c) && <Badge variant="destructive">Vencida ainda ativa</Badge>}
                    </div>
                    {c.description && (
                      <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                        {c.description}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {c.utm_campaign && (
                        <span>
                          utm: <code className="font-mono">{c.utm_campaign}</code>
                        </span>
                      )}
                      {c.starts_at && (
                        <span>Início: {new Date(c.starts_at).toLocaleDateString("pt-BR")}</span>
                      )}
                      {c.ends_at && (
                        <span>Fim: {new Date(c.ends_at).toLocaleDateString("pt-BR")}</span>
                      )}
                      {c.coupon_id && (
                        <span>
                          <Tag className="mr-1 inline h-3 w-3" />
                          Cupom vinculado
                        </span>
                      )}
                      {c.banner_id && (
                        <span>
                          <ImageIcon className="mr-1 inline h-3 w-3" />
                          Banner vinculado
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {c.final_url && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(c.final_url!);
                            toast.success("Link copiado");
                          } catch {}
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => del(c.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar campanha" : "Nova campanha"}</DialogTitle>
            <DialogDescription>
              Use UTMs para identificar de onde vem cada visitante e medir suas campanhas.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={save} className="space-y-4">
            <Tabs defaultValue="basico" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basico">Básico</TabsTrigger>
                <TabsTrigger value="utm">UTM Builder</TabsTrigger>
                <TabsTrigger value="vinculos">Vínculos</TabsTrigger>
                <TabsTrigger value="extra">Extras</TabsTrigger>
              </TabsList>

              <TabsContent value="basico" className="space-y-3 pt-3">
                <div>
                  <Label>Nome da campanha *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex.: Semana do LED"
                    required
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <Label>Status</Label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                    >
                      {STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Canal</Label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={form.channel}
                      onChange={(e) => setForm({ ...form, channel: e.target.value })}
                    >
                      {CHANNELS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Objetivo</Label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={form.objective}
                      onChange={(e) => setForm({ ...form, objective: e.target.value })}
                    >
                      {OBJECTIVES.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Início</Label>
                    <Input
                      type="datetime-local"
                      value={form.starts_at}
                      onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Término</Label>
                    <Input
                      type="datetime-local"
                      value={form.ends_at}
                      onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Público-alvo</Label>
                  <Input
                    value={form.audience}
                    onChange={(e) => setForm({ ...form, audience: e.target.value })}
                    placeholder="Ex.: clientes de Maricá interessados em LED"
                  />
                </div>
              </TabsContent>

              <TabsContent value="utm" className="space-y-3 pt-3">
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                  <Info className="mr-1 inline h-3 w-3" />
                  UTM é uma identificação no link que ajuda você a saber de onde veio o cliente.
                  Preencha a URL base e as UTMs — o link final é gerado automaticamente.
                </div>
                <div>
                  <Label>URL base *</Label>
                  <Input
                    value={form.base_url}
                    onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                    placeholder="https://maricalightworks.com.br/produtos/refletor-led"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label>utm_source</Label>
                    <Input
                      value={form.utm_source}
                      onChange={(e) => setForm({ ...form, utm_source: e.target.value })}
                      placeholder="instagram"
                    />
                  </div>
                  <div>
                    <Label>utm_medium</Label>
                    <Input
                      value={form.utm_medium}
                      onChange={(e) => setForm({ ...form, utm_medium: e.target.value })}
                      placeholder="social"
                    />
                  </div>
                  <div>
                    <Label>utm_campaign</Label>
                    <Input
                      value={form.utm_campaign}
                      onChange={(e) => setForm({ ...form, utm_campaign: e.target.value })}
                      placeholder="semana_do_led"
                    />
                  </div>
                  <div>
                    <Label>utm_content (opcional)</Label>
                    <Input
                      value={form.utm_content}
                      onChange={(e) => setForm({ ...form, utm_content: e.target.value })}
                      placeholder="stories"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>utm_term (opcional)</Label>
                    <Input
                      value={form.utm_term}
                      onChange={(e) => setForm({ ...form, utm_term: e.target.value })}
                      placeholder="led_50w"
                    />
                  </div>
                </div>
                <div className="rounded-md border bg-muted/30 p-3">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Link final gerado
                  </Label>
                  <p className="mt-1 break-all font-mono text-xs">
                    {finalUrl || "— preencha a URL base —"}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={copyUrl}
                      disabled={!finalUrl}
                    >
                      <Copy className="mr-1 h-3 w-3" /> Copiar
                    </Button>
                    {finalUrl && (
                      <Button type="button" size="sm" variant="outline" asChild>
                        <a href={finalUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1 h-3 w-3" /> Abrir
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="vinculos" className="space-y-3 pt-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Cupom vinculado</Label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={form.coupon_id}
                      onChange={(e) => setForm({ ...form, coupon_id: e.target.value })}
                    >
                      <option value="">— nenhum —</option>
                      {coupons.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Banner vinculado</Label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={form.banner_id}
                      onChange={(e) => setForm({ ...form, banner_id: e.target.value })}
                    >
                      <option value="">— nenhum —</option>
                      {banners.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <Label>Categorias relacionadas</Label>
                  <div className="mt-1 max-h-40 overflow-y-auto rounded-md border p-2">
                    {categories.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 py-1 text-sm">
                        <input
                          type="checkbox"
                          checked={form.category_ids.includes(c.id)}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...form.category_ids, c.id]
                              : form.category_ids.filter((x) => x !== c.id);
                            setForm({ ...form, category_ids: next });
                          }}
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Produtos relacionados ({form.product_ids.length} selecionados)</Label>
                  <div className="mt-1 max-h-48 overflow-y-auto rounded-md border p-2">
                    {products.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 py-1 text-sm">
                        <input
                          type="checkbox"
                          checked={form.product_ids.includes(p.id)}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...form.product_ids, p.id]
                              : form.product_ids.filter((x) => x !== p.id);
                            setForm({ ...form, product_ids: next });
                          }}
                        />
                        {p.name}
                      </label>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="extra" className="space-y-3 pt-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Investimento previsto (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.budget_planned}
                      onChange={(e) => setForm({ ...form, budget_planned: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Investimento realizado (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.budget_spent}
                      onChange={(e) => setForm({ ...form, budget_spent: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={3}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">{editing ? "Salvar alterações" : "Criar campanha"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
