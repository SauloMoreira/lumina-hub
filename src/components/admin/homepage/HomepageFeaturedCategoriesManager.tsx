import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconPicker } from "@/components/admin/IconPicker";
import { supabase } from "@/integrations/supabase/client";
import {
  adminListHomepageFeaturedCategories,
  type HomepageFeaturedCategory,
} from "@/lib/homepageBlocks";

interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  active: boolean;
}

export function HomepageFeaturedCategoriesManager() {
  const qc = useQueryClient();
  const queryKey = ["admin-homepage-featured-categories"];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: adminListHomepageFeaturedCategories,
  });

  const { data: allCategories } = useQuery({
    queryKey: ["admin-categories-list"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("categories")
        .select("id, name, slug, active")
        .order("name");
      if (error) throw error;
      return (data ?? []) as CategoryOption[];
    },
  });

  const [draft, setDraft] = useState<HomepageFeaturedCategory[]>([]);
  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const usedIds = useMemo(() => new Set(draft.map((d) => d.category_id)), [draft]);
  const available = useMemo(
    () => (allCategories ?? []).filter((c) => c.active && !usedIds.has(c.id)),
    [allCategories, usedIds],
  );

  const update = (id: string, patch: Partial<HomepageFeaturedCategory>) => {
    setDraft((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const move = (id: string, dir: -1 | 1) => {
    setDraft((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx < 0) return prev;
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[j]] = [copy[j], copy[idx]];
      return copy.map((c, i) => ({ ...c, sort_order: i }));
    });
  };

  const [adding, setAdding] = useState<string>("");
  const addMut = useMutation({
    mutationFn: async (categoryId: string) => {
      const { data: row, error } = await (supabase as any)
        .from("homepage_featured_categories")
        .insert({
          category_id: categoryId,
          sort_order: draft.length,
          is_active: true,
        })
        .select(
          "id, category_id, custom_title, custom_description, custom_image_url, icon, sort_order, is_active, category:categories(id, name, slug, icon, active)",
        )
        .single();
      if (error) throw error;
      return row as HomepageFeaturedCategory;
    },
    onSuccess: (row) => {
      setDraft((p) => [...p, row]);
      setAdding("");
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["homepage-featured-categories"] });
      toast.success("Categoria adicionada à home");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao adicionar"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("homepage_featured_categories")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["homepage-featured-categories"] });
      toast.success("Categoria removida da home");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const updates = draft.map((c, i) =>
        (supabase as any)
          .from("homepage_featured_categories")
          .update({
            custom_title: c.custom_title?.trim() || null,
            custom_description: c.custom_description?.trim() || null,
            custom_image_url: c.custom_image_url?.trim() || null,
            icon: c.icon || null,
            sort_order: i,
            is_active: c.is_active,
          })
          .eq("id", c.id),
      );
      const results = await Promise.all(updates);
      const firstErr = results.find((r: any) => r.error)?.error;
      if (firstErr) throw firstErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["homepage-featured-categories"] });
      toast.success("Categorias atualizadas");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Categorias em destaque</h2>
          <p className="text-xs text-muted-foreground">
            Escolha quais categorias ativas aparecem na seção “Encontre por departamento”.
          </p>
        </div>
        <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
          {saveMut.isPending ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-1" />
          )}
          Salvar
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2 border rounded-lg p-3 bg-muted/30">
        <div className="flex-1 min-w-[200px] space-y-1.5">
          <Label className="text-xs">Adicionar categoria</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
          >
            <option value="">Selecione…</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          size="sm"
          onClick={() => adding && addMut.mutate(adding)}
          disabled={!adding || addMut.isPending}
        >
          <Plus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
      </div>

      {draft.length === 0 && (
        <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
          Nenhuma categoria destacada. Use o seletor acima para adicionar.
        </div>
      )}

      <div className="space-y-3">
        {draft.map((c, i) => {
          const stale = !c.category || c.category.active === false;
          return (
            <Card key={c.id} className={c.is_active ? "" : "opacity-60"}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {c.category?.name ?? "Categoria removida"}
                    </Badge>
                    {!c.is_active && (
                      <Badge variant="outline" className="text-[10px]">
                        Inativa
                      </Badge>
                    )}
                    {stale && (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <AlertTriangle className="w-3 h-3" /> Categoria inativa/removida
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => move(c.id, -1)}
                      disabled={i === 0}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => move(c.id, 1)}
                      disabled={i === draft.length - 1}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center gap-2 px-2">
                      <Label className="text-xs">Ativa</Label>
                      <Switch
                        checked={c.is_active}
                        onCheckedChange={(v) => update(c.id, { is_active: v })}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (!confirm("Remover esta categoria da home?")) return;
                        setDraft((p) => p.filter((x) => x.id !== c.id));
                        deleteMut.mutate(c.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Título customizado (opcional)</Label>
                    <Input
                      value={c.custom_title ?? ""}
                      onChange={(e) => update(c.id, { custom_title: e.target.value })}
                      placeholder={c.category?.name ?? ""}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Ícone (Lucide)</Label>
                    <IconPicker value={c.icon} onChange={(v) => update(c.id, { icon: v })} />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs">Descrição customizada (opcional)</Label>
                    <Textarea
                      rows={2}
                      value={c.custom_description ?? ""}
                      onChange={(e) => update(c.id, { custom_description: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs">URL de imagem (opcional)</Label>
                    <Input
                      value={c.custom_image_url ?? ""}
                      onChange={(e) => update(c.id, { custom_image_url: e.target.value })}
                      placeholder="https://…"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
