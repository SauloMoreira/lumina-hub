import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Eye, Save, Send, Variable, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getEmailTemplate,
  updateEmailTemplate,
  previewEmailTemplate,
  sendTestEmailTemplate,
} from "@/server/emailTemplates.functions";

export const Route = createFileRoute("/admin/comunicacao/emails/$type")({
  component: EmailTemplateEditorPage,
});

interface FormState {
  display_name: string;
  subject: string;
  preheader: string;
  headline: string;
  intro_html: string;
  cta_label: string;
  cta_url: string;
  secondary_cta_label: string;
  secondary_cta_url: string;
  is_active: boolean;
  auto_send: boolean;
  allow_manual_resend: boolean;
}

const EMPTY: FormState = {
  display_name: "",
  subject: "",
  preheader: "",
  headline: "",
  intro_html: "",
  cta_label: "",
  cta_url: "",
  secondary_cta_label: "",
  secondary_cta_url: "",
  is_active: true,
  auto_send: true,
  allow_manual_resend: true,
};

function EmailTemplateEditorPage() {
  const { type } = Route.useParams();
  const fetchOne = useServerFn(getEmailTemplate);
  const updateFn = useServerFn(updateEmailTemplate);
  const previewFn = useServerFn(previewEmailTemplate);
  const testFn = useServerFn(sendTestEmailTemplate);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [vars, setVars] = useState<{ key: string; label: string; description: string }[]>([]);
  const [defaults, setDefaults] = useState<{ subject?: string }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmUnknown, setConfirmUnknown] = useState<string[] | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const subjectRef = useRef<HTMLInputElement | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const r = await fetchOne({ data: { type: type as any } });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const t = r.template as any;
      setForm({
        display_name: t.display_name ?? "",
        subject: t.subject ?? "",
        preheader: t.preheader ?? "",
        headline: t.headline ?? "",
        intro_html: t.intro_html ?? "",
        cta_label: t.cta_label ?? "",
        cta_url: t.cta_url ?? "",
        secondary_cta_label: t.secondary_cta_label ?? "",
        secondary_cta_url: t.secondary_cta_url ?? "",
        is_active: !!t.is_active,
        auto_send: !!t.auto_send,
        allow_manual_resend: !!t.allow_manual_resend,
      });
      setVars(r.variables);
      setDefaults(r.defaults ?? {});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const refreshPreview = async () => {
    setPreviewLoading(true);
    try {
      const r = await previewFn({ data: { type: type as any, orderId: null } });
      if (r.ok) {
        setPreviewHtml(r.html);
        setPreviewSubject(r.subject);
      } else {
        toast.error(r.error);
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const submit = async (confirm = false) => {
    setSaving(true);
    try {
      const r = await updateFn({
        data: {
          type: type as any,
          confirmUnknownVars: confirm,
          fields: {
            display_name: form.display_name,
            subject: form.subject || null,
            preheader: form.preheader || null,
            headline: form.headline || null,
            intro_html: form.intro_html || null,
            cta_label: form.cta_label || null,
            cta_url: form.cta_url || null,
            secondary_cta_label: form.secondary_cta_label || null,
            secondary_cta_url: form.secondary_cta_url || null,
            is_active: form.is_active,
            auto_send: form.auto_send,
            allow_manual_resend: form.allow_manual_resend,
          },
        },
      });
      if (!r.ok && "unknownVars" in r && r.unknownVars) {
        setConfirmUnknown(r.unknownVars);
        return;
      }
      if (!r.ok) {
        toast.error(("error" in r && r.error) || "Erro ao salvar");
        return;
      }
      toast.success("Modelo salvo");
      setConfirmUnknown(null);
      await reload();
      void refreshPreview();
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!testEmail) {
      toast.error("Informe um e-mail para o teste");
      return;
    }
    setTestSending(true);
    try {
      const r = await testFn({
        data: { type: type as any, orderId: null, recipientEmail: testEmail },
      });
      if (r.ok) toast.success(`Teste enviado para ${testEmail}`);
      else toast.error(r.error ?? "Falha ao enviar teste");
    } finally {
      setTestSending(false);
    }
  };

  const insertVar = (key: string) => {
    const token = `{{${key}}}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(token).catch(() => {});
    }
    toast.success(`Copiado: ${token}`);
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <AdminLayout title={`Modelo: ${form.display_name || type}`}>
      <p className="text-sm text-muted-foreground mb-4">
        Campos vazios voltam ao texto padrão do código. O HTML/layout não é editável aqui.
      </p>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link to={"/admin/comunicacao/emails" as any}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar para a lista
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Carregando…</div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Conteúdo</h3>
                <Badge variant="outline" className="font-mono text-xs">{type}</Badge>
              </div>

              <div className="space-y-1.5">
                <Label>Nome exibido (interno)</Label>
                <Input value={form.display_name} onChange={(e) => set("display_name", e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Assunto do e-mail</Label>
                <Input
                  ref={subjectRef}
                  value={form.subject}
                  placeholder={defaults.subject ?? "(usar padrão do código)"}
                  onChange={(e) => set("subject", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Vazio = usa o assunto padrão do código.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Pré-header (texto curto que aparece no inbox)</Label>
                <Input value={form.preheader} onChange={(e) => set("preheader", e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Headline (título dentro do e-mail)</Label>
                <Input value={form.headline} onChange={(e) => set("headline", e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Corpo (intro)</Label>
                <Textarea
                  rows={8}
                  value={form.intro_html}
                  onChange={(e) => set("intro_html", e.target.value)}
                  placeholder="Texto do corpo. Suporta <br/> e <strong>. Use {{variaveis}}."
                />
                <p className="text-xs text-muted-foreground">
                  Os blocos visuais (itens, totais, retirada, frete local) são montados automaticamente.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Texto do botão principal</Label>
                  <Input value={form.cta_label} onChange={(e) => set("cta_label", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>URL do botão principal</Label>
                  <Input value={form.cta_url} onChange={(e) => set("cta_url", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Texto do botão secundário</Label>
                  <Input
                    value={form.secondary_cta_label}
                    onChange={(e) => set("secondary_cta_label", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>URL do botão secundário</Label>
                  <Input
                    value={form.secondary_cta_url}
                    onChange={(e) => set("secondary_cta_url", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <h3 className="font-semibold">Comportamento</h3>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Modelo ativo</Label>
                  <p className="text-xs text-muted-foreground">
                    Se desativado, nem envio automático nem reenvio manual disparam.
                  </p>
                </div>
                <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Envio automático</Label>
                  <p className="text-xs text-muted-foreground">
                    Dispara sozinho quando o gatilho ocorre (mudança de status, pagamento, etc.).
                  </p>
                </div>
                <Switch checked={form.auto_send} onCheckedChange={(v) => set("auto_send", v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Permitir reenvio manual</Label>
                  <p className="text-xs text-muted-foreground">
                    Controla o botão "Reenviar" na tela do pedido.
                  </p>
                </div>
                <Switch
                  checked={form.allow_manual_resend}
                  onCheckedChange={(v) => set("allow_manual_resend", v)}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => submit(false)} disabled={saving}>
                <Save className="w-4 h-4 mr-1" /> {saving ? "Salvando…" : "Salvar"}
              </Button>
              <Button variant="outline" onClick={refreshPreview} disabled={previewLoading}>
                <RefreshCw className={`w-4 h-4 mr-1 ${previewLoading ? "animate-spin" : ""}`} />
                Atualizar preview
              </Button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <Variable className="w-4 h-4" /> Variáveis disponíveis
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Clique para copiar e cole no campo desejado.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {vars.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    title={v.description}
                    onClick={() => insertVar(v.key)}
                    className="px-2 py-1 rounded-md border border-border bg-muted/40 hover:bg-muted text-xs font-mono"
                  >
                    {`{{${v.key}}}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Eye className="w-4 h-4" /> Pré-visualização
              </h3>
              {previewSubject && (
                <div className="text-xs">
                  <span className="text-muted-foreground">Assunto:</span>{" "}
                  <strong>{previewSubject}</strong>
                </div>
              )}
              {previewHtml ? (
                <iframe
                  title="Pré-visualização"
                  sandbox=""
                  srcDoc={previewHtml}
                  className="w-full h-96 rounded-md border border-border bg-white"
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Clique em "Atualizar preview" para renderizar com um pedido real recente.
                </p>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Send className="w-4 h-4" /> Enviar teste
              </h3>
              <p className="text-xs text-muted-foreground">
                Envia o template renderizado (com pedido real recente) para o e-mail informado. O assunto leva o prefixo <code>[TESTE]</code>.
              </p>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
              <Button onClick={sendTest} disabled={testSending} className="w-full">
                {testSending ? "Enviando…" : "Enviar teste"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog
        open={!!confirmUnknown}
        onOpenChange={(o) => !o && setConfirmUnknown(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Variáveis desconhecidas</AlertDialogTitle>
            <AlertDialogDescription>
              O texto contém variáveis que o sistema não reconhece e que ficarão literais no e-mail:
              <br />
              <code className="text-xs">
                {(confirmUnknown ?? []).map((v) => `{{${v}}}`).join(", ")}
              </code>
              <br />
              Deseja salvar mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => submit(true)}>Salvar mesmo assim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
