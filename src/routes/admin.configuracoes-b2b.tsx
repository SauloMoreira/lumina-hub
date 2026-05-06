import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Briefcase, Loader2, Save, Ticket, AlertCircle } from "lucide-react";
import { buildSeo } from "@/lib/seo";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { adminGetB2bSettings, adminUpdateB2bSettings } from "@/server/b2bSettings.functions";

export const Route = createFileRoute("/admin/configuracoes-b2b")({
  head: () =>
    buildSeo({ title: "Configurações B2B", url: "/admin/configuracoes-b2b", noindex: true }),
  component: AdminB2bSettingsPage,
});

function AdminB2bSettingsPage() {
  const [allowCoupon, setAllowCoupon] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { settings } = await adminGetB2bSettings();
        setAllowCoupon(settings.allow_coupon_in_b2b);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao carregar configurações.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await adminUpdateB2bSettings({ data: { allow_coupon_in_b2b: allowCoupon } });
      toast.success("Configurações salvas.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout title="Configurações B2B">
      <div className="max-w-3xl mx-auto">
        <Link
          to={"/admin" as never}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao painel
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <Briefcase className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-display font-bold">Configurações B2B / Atacado</h2>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Carregando…
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-6 space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary-tint text-primary flex items-center justify-center shrink-0">
                <Ticket className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="allow-coupon" className="font-semibold cursor-pointer">
                    Permitir cupom em pedidos B2B
                  </Label>
                  <Switch
                    id="allow-coupon"
                    checked={allowCoupon}
                    onCheckedChange={setAllowCoupon}
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Quando <strong>desativado</strong> (padrão), pedidos com pelo menos um item B2B
                  rejeitam cupons aplicados — para evitar acúmulo de desconto sobre o preço empresa.
                  Ative apenas se quiser que cupons valham mesmo no B2B.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning-foreground">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-warning" />
              <span>
                Esta configuração é validada no backend. Tentativas de aplicar cupom em pedidos B2B
                quando bloqueado serão rejeitadas no momento de criar o pedido.
              </span>
            </div>

            <div className="pt-4 border-t border-border flex justify-end">
              <Button onClick={handleSave} disabled={saving} className="h-10">
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando…
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" /> Salvar configurações
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
