import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  adminGetCompanySettings,
  adminUpdateCompanySettings,
} from "@/server/institutional.functions";

export const Route = createFileRoute("/admin/settings/company")({
  component: AdminCompanyPage,
});

type FieldDef = {
  key: string;
  label: string;
  type?: string;
  placeholder?: string;
  full?: boolean;
  multiline?: boolean;
  boolean?: boolean;
};

const FIELDS: Array<{ section: string; items: Array<FieldDef> }> = [
  {
    section: "Identificação",
    items: [
      { key: "legal_name", label: "Razão social" },
      { key: "trade_name", label: "Nome fantasia" },
      { key: "cnpj", label: "CNPJ", placeholder: "00.000.000/0000-00" },
      { key: "state_registration", label: "Inscrição estadual" },
      { key: "municipal_registration", label: "Inscrição municipal" },
    ],
  },
  {
    section: "Endereço",
    items: [
      { key: "address_zipcode", label: "CEP", placeholder: "00000-000" },
      { key: "address_street", label: "Rua" },
      { key: "address_number", label: "Número" },
      { key: "address_complement", label: "Complemento" },
      { key: "address_neighborhood", label: "Bairro" },
      { key: "address_city", label: "Cidade" },
      { key: "address_state", label: "UF", placeholder: "RJ" },
    ],
  },
  {
    section: "Atendimento",
    items: [
      { key: "support_email", label: "E-mail de atendimento", type: "email" },
      { key: "support_phone", label: "Telefone" },
      { key: "support_whatsapp", label: "WhatsApp" },
      {
        key: "business_hours",
        label: "Horário de atendimento",
        placeholder: "Seg–Sex 9h–18h",
        full: true,
      },
    ],
  },
  {
    section: "Retirada na Loja",
    items: [
      {
        key: "pickup_enabled",
        label: "Habilitar retirada na loja no checkout",
        boolean: true,
        full: true,
      },
      { key: "pickup_store_name", label: "Nome da loja para retirada", full: true },
      {
        key: "pickup_address",
        label: "Endereço completo de retirada",
        full: true,
        multiline: true,
      },
      { key: "pickup_phone", label: "Telefone / WhatsApp da loja" },
      {
        key: "pickup_ready_eta",
        label: "Prazo estimado de liberação",
        placeholder: "Ex.: 1 dia útil",
      },
      {
        key: "pickup_business_hours",
        label: "Horário de retirada",
        placeholder: "Seg–Sex 9h–18h, Sáb 9h–13h",
        full: true,
      },
      {
        key: "pickup_instructions",
        label: "Instruções para retirada",
        full: true,
        multiline: true,
        placeholder: "O que o cliente precisa apresentar, onde estacionar, etc.",
      },
    ],
  },
  {
    section: "Web e redes sociais",
    items: [
      { key: "website_url", label: "Site", type: "url", placeholder: "https://" },
      { key: "instagram_url", label: "Instagram", type: "url", placeholder: "https://" },
      { key: "facebook_url", label: "Facebook", type: "url", placeholder: "https://" },
      { key: "tiktok_url", label: "TikTok", type: "url", placeholder: "https://" },
      { key: "linkedin_url", label: "LinkedIn", type: "url", placeholder: "https://" },
      { key: "logo_url", label: "URL da logo", placeholder: "https://...", full: true },
    ],
  },
];

function AdminCompanyPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-company"],
    queryFn: () => adminGetCompanySettings({ data: undefined as never }),
  });

  const [form, setForm] = useState<Record<string, string | boolean>>({});
  useEffect(() => {
    if (data?.company) {
      const f: Record<string, string | boolean> = {};
      for (const [k, v] of Object.entries(data.company)) {
        if (typeof v === "boolean") f[k] = v;
        else if (typeof v === "string") f[k] = v;
        else if (v == null) f[k] = "";
      }
      setForm(f);
    }
  }, [data?.company]);

  const save = useMutation({
    mutationFn: () => adminUpdateCompanySettings({ data: form as never }),
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["admin-company"] });
      qc.invalidateQueries({ queryKey: ["public-company"] });
      qc.invalidateQueries({ queryKey: ["footer-pages"] });
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao salvar"),
  });

  return (
    <AdminLayout
      title="Configurações da Empresa"
      action={
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Salvar
        </Button>
      }
    >
      {isLoading ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : (
        <div className="space-y-6 max-w-4xl">
          {FIELDS.map((sec) => (
            <Card key={sec.section}>
              <CardContent className="p-6">
                <h2 className="font-semibold mb-4">{sec.section}</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {sec.items.map((it) => {
                    const cls = it.full ? "sm:col-span-2 space-y-1.5" : "space-y-1.5";
                    if (it.boolean) {
                      return (
                        <label
                          key={it.key}
                          className={`${cls} flex items-center gap-2 cursor-pointer`}
                        >
                          <input
                            type="checkbox"
                            id={it.key}
                            checked={Boolean(form[it.key])}
                            onChange={(e) => setForm({ ...form, [it.key]: e.target.checked })}
                            className="rounded border-border"
                          />
                          <span className="text-sm">{it.label}</span>
                        </label>
                      );
                    }
                    return (
                      <div key={it.key} className={cls}>
                        <Label htmlFor={it.key}>{it.label}</Label>
                        {it.multiline ? (
                          <Textarea
                            id={it.key}
                            placeholder={it.placeholder}
                            rows={3}
                            value={(form[it.key] as string) ?? ""}
                            onChange={(e) => setForm({ ...form, [it.key]: e.target.value })}
                          />
                        ) : (
                          <Input
                            id={it.key}
                            type={it.type ?? "text"}
                            placeholder={it.placeholder}
                            value={(form[it.key] as string) ?? ""}
                            onChange={(e) => setForm({ ...form, [it.key]: e.target.value })}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
