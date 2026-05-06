import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2, Copy, MessageSquareText } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  TEMPLATE_VARIABLES,
  TEMPLATE_VARIABLE_LABELS,
  TEMPLATE_CATEGORIES,
  extractVariables,
  renderTemplate,
  type WhatsappTemplate,
} from "@/lib/whatsappTemplates";

export const Route = createFileRoute("/admin/whatsapp-templates")({
  component: WhatsappTemplatesPage,
});

type Form = {
  id?: string;
  name: string;
  category: string;
  body: string;
  active: boolean;
  sort_order: number;
};

const EMPTY: Form = { name: "", category: "geral", body: "", active: true, sort_order: 0 };

function WhatsappTemplatesPage() {
  const [list, setList] = useState<WhatsappTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [previewOpen, setPreviewOpen] = useState<WhatsappTemplate | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_templates")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setList((data ?? []) as WhatsappTemplate[]);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setForm(EMPTY);
    setOpen(true);
  };
  const openEdit = (t: WhatsappTemplate) => {
    setForm({
      id: t.id,
      name: t.name,
      category: t.category,
      body: t.body,
      active: t.active,
      sort_order: t.sort_order,
    });
    setOpen(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.body.trim()) {
      toast.error("Preencha nome e mensagem.");
      return;
    }
    const variables = extractVariables(form.body);
    const payload = {
      name: form.name.trim(),
      category: form.category,
      body: form.body,
      active: form.active,
      sort_order: form.sort_order,
      variables,
    };
    const res = form.id
      ? await supabase.from("whatsapp_templates").update(payload).eq("id", form.id)
      : await supabase.from("whatsapp_templates").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Modelo salvo");
    setOpen(false);
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Excluir modelo?")) return;
    const { error } = await supabase.from("whatsapp_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Modelo excluído");
    load();
  };

  const toggleActive = async (t: WhatsappTemplate) => {
    const { error } = await supabase
      .from("whatsapp_templates")
      .update({ active: !t.active })
      .eq("id", t.id);
    if (error) return toast.error(error.message);
    setList((prev) => prev.map((x) => (x.id === t.id ? { ...x, active: !t.active } : x)));
  };

  const insertVariable = (v: string) => {
    setForm((p) => ({ ...p, body: `${p.body}{{${v}}}` }));
  };

  const detectedVars = useMemo(() => extractVariables(form.body), [form.body]);

  return (
    <AdminLayout
      title="Modelos de WhatsApp"
      action={
        <Button size="sm" onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" /> Novo modelo
        </Button>
      }
    >
      <div className="bg-card border border-border rounded-xl">
        <div className="p-4 border-b border-border">
          <p className="text-sm text-muted-foreground">
            Mensagens prontas para usar no WhatsApp. Use variáveis como
            <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-xs">{`{{nome_cliente}}`}</code>
            que serão substituídas automaticamente quando o modelo for usado em um lead, pedido ou
            carrinho.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground bg-muted/40">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Variáveis</th>
                <th className="px-4 py-3 font-medium">Ativo</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              )}
              {!loading && list.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum modelo cadastrado.
                  </td>
                </tr>
              )}
              {!loading &&
                list.map((t) => (
                  <tr key={t.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {t.category}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(t.variables ?? []).slice(0, 4).map((v) => (
                          <span
                            key={v}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                          >{`{{${v}}}`}</span>
                        ))}
                        {(t.variables ?? []).length > 4 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{(t.variables ?? []).length - 4}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Switch checked={t.active} onCheckedChange={() => toggleActive(t)} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Pré-visualizar"
                        onClick={() => setPreviewOpen(t)}
                      >
                        <MessageSquareText className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(t)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => del(t.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar modelo" : "Novo modelo"}</DialogTitle>
            <DialogDescription>
              Crie modelos com variáveis para enviar mensagens consistentes pelo WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <Label>Nome</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Categoria</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {TEMPLATE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <Label>Mensagem</Label>
              <Textarea
                rows={6}
                required
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Olá, {{nome_cliente}}! ..."
              />
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-1">Inserir variável:</p>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_VARIABLES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(v)}
                      className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted transition-colors"
                      title={TEMPLATE_VARIABLE_LABELS[v]}
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
                {detectedVars.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Variáveis detectadas: {detectedVars.map((v) => `{{${v}}}`).join(", ")}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.active}
                onCheckedChange={(c) => setForm({ ...form, active: c })}
              />
              <Label className="cursor-pointer">Ativo</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewOpen} onOpenChange={(o) => !o && setPreviewOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pré-visualização</DialogTitle>
            <DialogDescription>
              Exemplo com valores fictícios — substitua pelos dados reais ao enviar.
            </DialogDescription>
          </DialogHeader>
          {previewOpen && (
            <div className="space-y-3">
              <div className="rounded-md bg-emerald-500/5 border border-emerald-500/20 p-3 text-sm whitespace-pre-wrap">
                {renderTemplate(previewOpen.body, {
                  nome_cliente: "Maria",
                  nome_empresa: "Acme Ltda",
                  cnpj: "12.345.678/0001-90",
                  produto: "Painel LED 60x60",
                  valor_carrinho: "890,00",
                  link_carrinho: "https://loja.com/carrinho",
                  numero_pedido: "1234",
                  status_pedido: "aprovado",
                  nome_loja: "Led Maricá",
                  whatsapp_loja: "21 98212-6467",
                })}
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  navigator.clipboard.writeText(previewOpen.body);
                  toast.success("Mensagem copiada");
                }}
              >
                <Copy className="w-4 h-4 mr-1" /> Copiar mensagem
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
