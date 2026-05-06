import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X, Tag } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ATTRIBUTE_SUGGESTIONS } from "@/lib/productAttributes";
import {
  adminListAttributeLabels,
  adminCreateAttributeLabel,
  adminUpdateAttributeLabel,
  adminDeleteAttributeLabel,
  type AttributeLabelRow,
} from "@/server/productAttributeLabels.functions";

export const Route = createFileRoute("/admin/produtos/atributos-rotulos")({
  component: AttributeLabelsAdmin,
});

type FormState = {
  id: string | null;
  attributeKey: string;
  rawValue: string;
  displayLabel: string;
  helperText: string;
  sortOrder: number;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  id: null,
  attributeKey: "color_temperature",
  rawValue: "",
  displayLabel: "",
  helperText: "",
  sortOrder: 0,
  isActive: true,
};

function attrLabel(key: string): string {
  return ATTRIBUTE_SUGGESTIONS.find((s) => s.key === key)?.label ?? key;
}

function errorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("label_already_exists"))
    return "Já existe um rótulo para esse atributo + valor.";
  if (msg.includes("not_authorized") || msg.includes("not_authenticated"))
    return "Você precisa estar logado como administrador.";
  if (msg.includes("invalid_label")) return "Rótulo inválido.";
  if (msg.includes("invalid_value")) return "Valor técnico inválido.";
  return msg || "Erro ao salvar.";
}

function AttributeLabelsAdmin() {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [open, setOpen] = useState(false);
  const [keyFilter, setKeyFilter] = useState<string>("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-attribute-labels"],
    queryFn: () => adminListAttributeLabels(),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, AttributeLabelRow[]>();
    for (const r of rows) {
      if (keyFilter !== "all" && r.attribute_key !== keyFilter) continue;
      const arr = map.get(r.attribute_key) ?? [];
      arr.push(r);
      map.set(r.attribute_key, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => attrLabel(a).localeCompare(attrLabel(b)));
  }, [rows, keyFilter]);

  const allKeys = useMemo(() => {
    const set = new Set<string>(ATTRIBUTE_SUGGESTIONS.map((s) => s.key));
    for (const r of rows) set.add(r.attribute_key);
    return Array.from(set).sort((a, b) => attrLabel(a).localeCompare(attrLabel(b)));
  }, [rows]);

  const createMut = useMutation({
    mutationFn: () =>
      adminCreateAttributeLabel({
        data: {
          attributeKey: form.attributeKey,
          rawValue: form.rawValue,
          displayLabel: form.displayLabel,
          helperText: form.helperText || null,
          sortOrder: form.sortOrder,
          isActive: form.isActive,
        },
      }),
    onSuccess: () => {
      toast.success("Rótulo criado.");
      qc.invalidateQueries({ queryKey: ["admin-attribute-labels"] });
      qc.invalidateQueries({ queryKey: ["public-attribute-labels"] });
      setOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const updateMut = useMutation({
    mutationFn: () =>
      adminUpdateAttributeLabel({
        data: {
          id: form.id!,
          rawValue: form.rawValue,
          displayLabel: form.displayLabel,
          helperText: form.helperText || null,
          sortOrder: form.sortOrder,
          isActive: form.isActive,
        },
      }),
    onSuccess: () => {
      toast.success("Rótulo atualizado.");
      qc.invalidateQueries({ queryKey: ["admin-attribute-labels"] });
      qc.invalidateQueries({ queryKey: ["public-attribute-labels"] });
      setOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const toggleActiveMut = useMutation({
    mutationFn: (row: AttributeLabelRow) =>
      adminUpdateAttributeLabel({ data: { id: row.id, isActive: !row.is_active } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-attribute-labels"] });
      qc.invalidateQueries({ queryKey: ["public-attribute-labels"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminDeleteAttributeLabel({ data: { id } }),
    onSuccess: () => {
      toast.success("Rótulo removido.");
      qc.invalidateQueries({ queryKey: ["admin-attribute-labels"] });
      qc.invalidateQueries({ queryKey: ["public-attribute-labels"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  function openCreate() {
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(row: AttributeLabelRow) {
    setForm({
      id: row.id,
      attributeKey: row.attribute_key,
      rawValue: row.raw_value,
      displayLabel: row.display_label,
      helperText: row.helper_text ?? "",
      sortOrder: row.sort_order,
      isActive: row.is_active,
    });
    setOpen(true);
  }

  return (
    <AdminLayout title="Rótulos amigáveis">
      <div className="container py-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              <h1 className="font-display text-2xl font-bold">Rótulos amigáveis de atributos</h1>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl mt-1">
              Configure como valores técnicos aparecem na loja. Ex.: <strong>6500K</strong> →{" "}
              <em>Luz fria</em>. Esses rótulos aparecem na ficha técnica do produto e nos filtros do
              catálogo. Sem rótulo, exibimos o valor técnico original.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              <Link to="/admin/produtos" className="underline hover:text-foreground">
                ← Voltar para Produtos
              </Link>
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Novo rótulo
          </Button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Label className="text-sm">Filtrar por atributo:</Label>
          <Select value={keyFilter} onValueChange={setKeyFilter}>
            <SelectTrigger className="w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os atributos</SelectItem>
              {allKeys.map((k) => (
                <SelectItem key={k} value={k}>
                  {attrLabel(k)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : grouped.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum rótulo cadastrado ainda. Crie o primeiro acima.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([key, list]) => (
              <section key={key} className="rounded-lg border bg-card">
                <header className="px-4 py-3 border-b">
                  <h2 className="font-display font-semibold">{attrLabel(key)}</h2>
                  <p className="text-xs text-muted-foreground font-mono">{key}</p>
                </header>
                <div className="divide-y">
                  {list.map((row) => (
                    <div
                      key={row.id}
                      className="px-4 py-3 flex items-center gap-3 flex-wrap sm:flex-nowrap"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="text-xs px-1.5 py-0.5 rounded bg-muted">
                            {row.raw_value}
                          </code>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-medium">{row.display_label}</span>
                          {!row.is_active && (
                            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              inativo
                            </span>
                          )}
                        </div>
                        {row.helper_text && (
                          <p className="text-xs text-muted-foreground mt-1">{row.helper_text}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={row.is_active}
                          onCheckedChange={() => toggleActiveMut.mutate(row)}
                        />
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Remover rótulo "${row.display_label}"?`))
                              deleteMut.mutate(row.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{form.id ? "Editar rótulo" : "Novo rótulo"}</DialogTitle>
              <DialogDescription>
                Define como um valor técnico aparece para o cliente.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Atributo técnico</Label>
                <Select
                  value={form.attributeKey}
                  onValueChange={(v) => setForm((f) => ({ ...f, attributeKey: v }))}
                  disabled={!!form.id}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allKeys.map((k) => (
                      <SelectItem key={k} value={k}>
                        {attrLabel(k)} <span className="text-muted-foreground">({k})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Valor técnico</Label>
                  <Input
                    value={form.rawValue}
                    onChange={(e) => setForm((f) => ({ ...f, rawValue: e.target.value }))}
                    placeholder="Ex.: 6500, IP66, Bivolt"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Mesmo valor salvo no produto (sem unidade, exceto IP/V).
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Ordem</Label>
                  <Input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Rótulo amigável</Label>
                <Input
                  value={form.displayLabel}
                  onChange={(e) => setForm((f) => ({ ...f, displayLabel: e.target.value }))}
                  placeholder="Ex.: Luz fria, Área externa reforçada"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Texto de ajuda (opcional)</Label>
                <Textarea
                  value={form.helperText}
                  rows={2}
                  onChange={(e) => setForm((f) => ({ ...f, helperText: e.target.value }))}
                  placeholder="Aparece como legenda discreta junto ao rótulo."
                />
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Ativo</p>
                  <p className="text-xs text-muted-foreground">
                    Quando desativado, o rótulo não aparece na loja.
                  </p>
                </div>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                <X className="h-4 w-4 mr-1" /> Cancelar
              </Button>
              <Button
                onClick={() => (form.id ? updateMut.mutate() : createMut.mutate())}
                disabled={
                  createMut.isPending ||
                  updateMut.isPending ||
                  !form.rawValue.trim() ||
                  !form.displayLabel.trim()
                }
              >
                {form.id ? "Salvar" : "Criar rótulo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
