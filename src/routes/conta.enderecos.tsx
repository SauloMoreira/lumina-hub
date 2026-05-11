import { createFileRoute, Link, useServerFn } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, MapPin, Plus, Pencil, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { lookupCep } from "@/server/checkout.functions";
import { buildSeo } from "@/lib/seo";

export const Route = createFileRoute("/conta/enderecos")({
  head: () => buildSeo({ title: "Meus endereços", url: "/conta/enderecos", noindex: true }),
  component: AddressesPage,
});

type Address = {
  id: string;
  label: string | null;
  recipient: string;
  zip_code: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  is_default: boolean | null;
};

type FormState = Omit<Address, "id" | "is_default"> & { is_default: boolean };

const EMPTY: FormState = {
  label: "Casa",
  recipient: "",
  zip_code: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  is_default: false,
};

function AddressesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const cep = useServerFn(lookupCep);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("addresses")
      .select("*")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar endereços");
    setItems((data ?? []) as Address[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  function startNew() {
    setForm(EMPTY);
    setEditing("new");
  }
  function startEdit(a: Address) {
    setForm({
      label: a.label ?? "Casa",
      recipient: a.recipient,
      zip_code: a.zip_code,
      street: a.street,
      number: a.number,
      complement: a.complement ?? "",
      neighborhood: a.neighborhood ?? "",
      city: a.city,
      state: a.state,
      is_default: !!a.is_default,
    });
    setEditing(a.id);
  }
  function cancel() {
    setEditing(null);
    setForm(EMPTY);
  }

  async function handleCep(value: string) {
    const clean = value.replace(/\D/g, "");
    setForm((f) => ({ ...f, zip_code: clean }));
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const r = await cep({ data: { cep: clean } });
      if (r.ok) {
        setForm((f) => ({
          ...f,
          street: r.street || f.street,
          neighborhood: r.neighborhood || f.neighborhood,
          city: r.city || f.city,
          state: r.state || f.state,
        }));
      } else {
        toast.error(r.error);
      }
    } finally {
      setCepLoading(false);
    }
  }

  async function save() {
    if (!user) return;
    if (!form.recipient || !form.zip_code || !form.street || !form.number || !form.city || !form.state) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        label: form.label || "Casa",
        recipient: form.recipient,
        zip_code: form.zip_code,
        street: form.street,
        number: form.number,
        complement: form.complement || null,
        neighborhood: form.neighborhood || null,
        city: form.city,
        state: form.state.toUpperCase().slice(0, 2),
        is_default: form.is_default,
      };
      // Se marcado como padrão, desmarca os outros
      if (form.is_default) {
        await supabase
          .from("addresses")
          .update({ is_default: false } as never)
          .eq("user_id", user.id);
      }
      if (editing === "new") {
        const { error } = await supabase.from("addresses").insert(payload as never);
        if (error) throw error;
        toast.success("Endereço cadastrado");
      } else if (editing) {
        const { error } = await supabase
          .from("addresses")
          .update(payload as never)
          .eq("id", editing);
        if (error) throw error;
        toast.success("Endereço atualizado");
      }
      cancel();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar endereço");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remover este endereço?")) return;
    const { error } = await supabase.from("addresses").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover");
      return;
    }
    toast.success("Endereço removido");
    load();
  }

  async function setDefault(id: string) {
    if (!user) return;
    await supabase
      .from("addresses")
      .update({ is_default: false } as never)
      .eq("user_id", user.id);
    const { error } = await supabase
      .from("addresses")
      .update({ is_default: true } as never)
      .eq("id", id);
    if (error) {
      toast.error("Erro ao definir padrão");
      return;
    }
    toast.success("Endereço padrão atualizado");
    load();
  }

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/conta">
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Link>
            </Button>
            <h1 className="font-display font-bold text-2xl">Meus endereços</h1>
          </div>
          {!editing && (
            <Button onClick={startNew}>
              <Plus className="w-4 h-4 mr-1" /> Novo endereço
            </Button>
          )}
        </div>

        {editing && (
          <Card className="mb-6">
            <CardContent className="p-6 space-y-4">
              <h2 className="font-display font-semibold">
                {editing === "new" ? "Novo endereço" : "Editar endereço"}
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Identificação</Label>
                  <Input
                    value={form.label ?? ""}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    placeholder="Casa, Trabalho..."
                  />
                </div>
                <div>
                  <Label>Destinatário *</Label>
                  <Input
                    value={form.recipient}
                    onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                  />
                </div>
                <div>
                  <Label>CEP *</Label>
                  <Input
                    value={form.zip_code}
                    onChange={(e) => handleCep(e.target.value)}
                    maxLength={9}
                    placeholder="00000-000"
                  />
                  {cepLoading && (
                    <p className="text-xs text-muted-foreground mt-1">Buscando CEP...</p>
                  )}
                </div>
                <div>
                  <Label>Rua *</Label>
                  <Input
                    value={form.street}
                    onChange={(e) => setForm({ ...form, street: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Número *</Label>
                  <Input
                    value={form.number}
                    onChange={(e) => setForm({ ...form, number: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Complemento</Label>
                  <Input
                    value={form.complement ?? ""}
                    onChange={(e) => setForm({ ...form, complement: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input
                    value={form.neighborhood ?? ""}
                    onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Cidade *</Label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div>
                  <Label>UF *</Label>
                  <Input
                    value={form.state}
                    onChange={(e) =>
                      setForm({ ...form, state: e.target.value.toUpperCase().slice(0, 2) })
                    }
                    maxLength={2}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="default"
                  checked={form.is_default}
                  onCheckedChange={(v) => setForm({ ...form, is_default: !!v })}
                />
                <Label htmlFor="default" className="cursor-pointer">
                  Definir como endereço padrão
                </Label>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" onClick={cancel} disabled={saving}>
                  Cancelar
                </Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : items.length === 0 && !editing ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium mb-1">Nenhum endereço cadastrado</p>
              <p className="text-sm text-muted-foreground mb-4">
                Adicione um endereço para agilizar suas compras.
              </p>
              <Button onClick={startNew}>
                <Plus className="w-4 h-4 mr-1" /> Cadastrar endereço
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((a) => (
              <Card key={a.id}>
                <CardContent className="p-5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{a.label || "Endereço"}</span>
                      {a.is_default && (
                        <span className="text-[10px] uppercase tracking-wide bg-primary-tint text-primary px-2 py-0.5 rounded-full font-semibold">
                          Padrão
                        </span>
                      )}
                    </div>
                    <p className="text-sm">{a.recipient}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.street}, {a.number}
                      {a.complement ? ` — ${a.complement}` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {a.neighborhood ? `${a.neighborhood}, ` : ""}
                      {a.city}/{a.state} — CEP {a.zip_code}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-1 shrink-0">
                    {!a.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDefault(a.id)}
                        title="Definir como padrão"
                      >
                        <Star className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => startEdit(a)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(a.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </StoreLayout>
  );
}
