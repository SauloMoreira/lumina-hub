import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { buildSeo } from "@/lib/seo";

export const Route = createFileRoute("/conta/dados")({
  head: () => buildSeo({ title: "Meus dados", url: "/conta/dados", noindex: true }),
  component: AccountDataPage,
});

function AccountDataPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("name, phone")
        .eq("id", user.id)
        .maybeSingle();
      if (error) toast.error("Erro ao carregar dados");
      setName((data?.name as string | undefined) ?? "");
      setPhone((data?.phone as string | undefined) ?? "");
      setLoading(false);
    })();
  }, [user?.id]);

  async function save() {
    if (!user) return;
    if (!name.trim()) {
      toast.error("Informe seu nome");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name: name.trim(), phone: phone.trim() || null } as never)
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message || "Erro ao salvar");
      return;
    }
    toast.success("Dados atualizados");
  }

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Button asChild variant="ghost" size="sm">
            <Link to="/conta">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Link>
          </Button>
          <h1 className="font-display font-bold text-2xl">Meus dados</h1>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-primary-tint flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Atualize seu nome e telefone. O e-mail é usado para login e não pode ser alterado aqui.
              </p>
            </div>

            <div>
              <Label>Nome *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <Label>E-mail</Label>
              <Input value={user?.email ?? ""} disabled readOnly />
              <p className="text-xs text-muted-foreground mt-1">
                Para alterar o e-mail, entre em contato com o suporte.
              </p>
            </div>

            <div>
              <Label>Telefone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                disabled={loading}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={save} disabled={saving || loading}>
                {saving ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </StoreLayout>
  );
}
