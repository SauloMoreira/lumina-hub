import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Settings } from "lucide-react";
import { buildSeo } from "@/lib/seo";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getFinanceSettings,
  updateFinanceSettings,
  type FinanceSettings,
} from "@/server/finance.functions";

export const Route = createFileRoute("/admin/financeiro/configuracoes")({
  head: () =>
    buildSeo({
      title: "Configurações financeiras",
      url: "/admin/financeiro/configuracoes",
      noindex: true,
    }),
  component: FinanceSettingsPage,
});

function FinanceSettingsPage() {
  const [s, setS] = useState<FinanceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getFinanceSettings()
      .then(setS)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof FinanceSettings>(k: K, v: FinanceSettings[K]) {
    setS((prev) => (prev ? { ...prev, [k]: v } : prev));
  }

  async function save() {
    if (!s) return;
    setSaving(true);
    try {
      const r = await updateFinanceSettings({
        data: {
          default_min_margin_percent: Number(s.default_min_margin_percent),
          consider_shipping_in_margin: s.consider_shipping_in_margin,
          consider_coupon_in_margin: s.consider_coupon_in_margin,
          consider_b2b_discount_in_margin: s.consider_b2b_discount_in_margin,
          critical_margin_alert_enabled: s.critical_margin_alert_enabled,
          critical_margin_threshold_percent: Number(s.critical_margin_threshold_percent),
          mp_fee_pix_percent: Number(s.mp_fee_pix_percent),
          mp_fee_pix_fixed: Number(s.mp_fee_pix_fixed),
          mp_fee_credit_percent: Number(s.mp_fee_credit_percent),
          mp_fee_credit_fixed: Number(s.mp_fee_credit_fixed),
          mp_fee_boleto_percent: Number(s.mp_fee_boleto_percent),
          mp_fee_boleto_fixed: Number(s.mp_fee_boleto_fixed),
          mp_fee_default_percent: Number(s.mp_fee_default_percent),
        },
      });
      setS(r);
      toast.success("Configurações salvas.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !s) {
    return (
      <AdminLayout title="Configurações financeiras">
        <div className="py-12 text-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Carregando…
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Configurações financeiras">
      <div className="max-w-3xl mx-auto">
        <Link
          to={"/admin" as never}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao painel
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-display font-bold">Configurações financeiras</h2>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-6">
          <section className="space-y-4">
            <h3 className="font-semibold">Margem</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Margem mínima padrão (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={s.default_min_margin_percent}
                  onChange={(e) => update("default_min_margin_percent", Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Margem crítica abaixo de (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={s.critical_margin_threshold_percent}
                  onChange={(e) =>
                    update("critical_margin_threshold_percent", Number(e.target.value))
                  }
                />
              </div>
            </div>
            <div className="space-y-3">
              {(
                [
                  [
                    "critical_margin_alert_enabled",
                    "Mostrar alerta de margem crítica no Painel do Dia",
                  ],
                  ["consider_shipping_in_margin", "Considerar frete cobrado na margem"],
                  ["consider_coupon_in_margin", "Considerar cupom na margem"],
                  ["consider_b2b_discount_in_margin", "Considerar desconto B2B na margem"],
                ] as Array<[keyof FinanceSettings, string]>
              ).map(([k, lbl]) => (
                <div key={k} className="flex items-center justify-between gap-4">
                  <Label htmlFor={k}>{lbl}</Label>
                  <Switch
                    id={k}
                    checked={s[k] as boolean}
                    onCheckedChange={(v) => update(k, v as never)}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4 pt-4 border-t border-border">
            <h3 className="font-semibold">Taxas estimadas — Mercado Pago</h3>
            <p className="text-xs text-muted-foreground">
              Usadas para estimar o líquido. Quando o webhook do Mercado Pago retornar a taxa real,
              ela tem prioridade.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Pix — % por venda</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={s.mp_fee_pix_percent}
                  onChange={(e) => update("mp_fee_pix_percent", Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Pix — taxa fixa (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={s.mp_fee_pix_fixed}
                  onChange={(e) => update("mp_fee_pix_fixed", Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Cartão — % por venda</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={s.mp_fee_credit_percent}
                  onChange={(e) => update("mp_fee_credit_percent", Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Cartão — taxa fixa (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={s.mp_fee_credit_fixed}
                  onChange={(e) => update("mp_fee_credit_fixed", Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Boleto — % por venda</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={s.mp_fee_boleto_percent}
                  onChange={(e) => update("mp_fee_boleto_percent", Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Boleto — taxa fixa (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={s.mp_fee_boleto_fixed}
                  onChange={(e) => update("mp_fee_boleto_fixed", Number(e.target.value))}
                />
              </div>
              <div className="col-span-2">
                <Label>Padrão — % por venda</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={s.mp_fee_default_percent}
                  onChange={(e) => update("mp_fee_default_percent", Number(e.target.value))}
                />
              </div>
            </div>
          </section>

          <div className="flex justify-end pt-2">
            <Button onClick={save} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar configurações
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
