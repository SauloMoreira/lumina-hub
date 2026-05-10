import { useState } from "react";
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  Copy,
  X,
  Wand2,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  generateMarketingCampaign,
  markMarketingGeneration,
  type CampaignSuggestion,
  type CampaignBrief,
} from "@/server/marketingCopy.functions";

export type AiCampaignReference = {
  products: { id: string; name: string; price?: number | null; stock?: number | null; category?: string | null }[];
  combos: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  coupons: { id: string; code: string; description?: string | null; discount?: string | null; active?: boolean | null }[];
};

export type AiApplyPatch = {
  campaign?: {
    name?: string;
    description?: string;
    objective?: string;
    audience?: string;
    channel?: string;
    starts_at?: string;
    ends_at?: string;
    notes?: string;
    status?: string;
  };
  utm?: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
    base_url?: string;
  };
  links?: {
    product_ids?: string[];
    combo_ids?: string[];
    category_ids?: string[];
    coupon_id?: string;
  };
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  references: AiCampaignReference;
  onApply: (patch: AiApplyPatch, suggestion: CampaignSuggestion, generationId: string | null) => void;
}

const TONES = ["Profissional", "Próximo / Conversa", "Promocional", "Urgência", "Educativo"];
const CHANNELS = ["instagram", "facebook", "whatsapp", "email", "google_ads", "site", "b2b", "tiktok"];
const OBJECTIVES = [
  "vender produto",
  "vender kit",
  "captar lead",
  "recuperar carrinho",
  "divulgar promocao",
  "lancamento",
  "aumentar recompra",
  "campanha b2b",
];
const CREATIVE_TYPES = ["Banner home", "Post quadrado", "Story", "Carrossel", "Vídeo curto", "E-mail HTML"];

const emptyBrief: CampaignBrief = {
  objective: "vender produto",
  channel: "instagram",
  audience: "",
  focus_kind: "livre",
  focus_id: null,
  focus_label: null,
  starts_at: "",
  ends_at: "",
  tone: "Profissional",
  creative_type: "Post quadrado",
  market: "varejo",
  notes: "",
};

export function MarketingCampaignAiDialog({ open, onOpenChange, references, onApply }: Props) {
  const [brief, setBrief] = useState<CampaignBrief>(emptyBrief);
  const [loading, setLoading] = useState(false);
  const [s, setS] = useState<CampaignSuggestion | null>(null);
  const [genId, setGenId] = useState<string | null>(null);

  function reset() {
    setS(null);
    setGenId(null);
  }

  function handleClose(v: boolean) {
    if (!v) {
      // Marca como descartado se não foi aplicado
      if (genId && s) {
        markMarketingGeneration({
          data: { generation_id: genId, status: "discarded" },
        }).catch(() => {});
      }
      reset();
    }
    onOpenChange(v);
  }

  async function generate() {
    if (!brief.objective || !brief.channel) {
      toast.error("Informe pelo menos objetivo e canal.");
      return;
    }
    setLoading(true);
    setS(null);
    try {
      const r = await generateMarketingCampaign({
        data: { brief, references },
      });
      if (!r.ok) {
        toast.error(r.error);
      } else {
        setS(r.suggestion);
        setGenId(r.generationId ?? null);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar");
    } finally {
      setLoading(false);
    }
  }

  function buildPatch(parts: { campaign?: boolean; utm?: boolean; links?: boolean }): AiApplyPatch {
    if (!s) return {};
    const patch: AiApplyPatch = {};
    if (parts.campaign) {
      patch.campaign = {
        name: s.estrategia.nome_campanha,
        description: s.estrategia.descricao_curta,
        objective: brief.objective,
        audience: s.estrategia.publico_alvo,
        channel: brief.channel,
        starts_at: brief.starts_at ?? "",
        ends_at: brief.ends_at ?? "",
        notes:
          `Gerada pelo Assistente de Marketing IA.\n\n` +
          `Estratégia:\n${s.estrategia.descricao_longa}\n\n` +
          `Meta sugerida: ${s.estrategia.meta_sugerida}\n` +
          `Período sugerido: ${s.estrategia.periodo_sugerido}\n\n` +
          `--- Textos sugeridos ---\n` +
          `Título: ${s.textos.titulo}\nCTA: ${s.textos.cta}\n\n` +
          `Instagram (feed):\n${s.textos.instagram_feed}\n\n` +
          `Instagram (story):\n${s.textos.instagram_story}\n\n` +
          `WhatsApp:\n${s.textos.whatsapp}\n\n` +
          `E-mail (assunto): ${s.textos.email_assunto}\n` +
          `E-mail (preheader): ${s.textos.email_preheader}\n` +
          `E-mail (corpo):\n${s.textos.email_corpo}\n` +
          (s.textos.b2b ? `\nB2B:\n${s.textos.b2b}\n` : "") +
          `\n--- Criativos (prompts) ---\n` +
          `Banner home: ${s.criativos.prompt_banner_home}\n` +
          `Post quadrado: ${s.criativos.prompt_post_quadrado}\n` +
          `Story: ${s.criativos.prompt_story}\n` +
          `Produto/Kit: ${s.criativos.prompt_produto_kit}\n` +
          (s.pontos_de_atencao.length
            ? `\n--- Pontos de atenção ---\n- ${s.pontos_de_atencao.join("\n- ")}\n`
            : ""),
        status: "draft",
      };
    }
    if (parts.utm) {
      patch.utm = {
        utm_source: s.utm.utm_source,
        utm_medium: s.utm.utm_medium,
        utm_campaign: s.utm.utm_campaign,
        utm_content: s.utm.utm_content ?? "",
        utm_term: s.utm.utm_term ?? "",
        base_url: s.utm.base_url_sugerida ?? "",
      };
    }
    if (parts.links) {
      const validIds = new Set(references.products.map((p) => p.id));
      const validCombos = new Set(references.combos.map((c) => c.id));
      const validCats = new Set(references.categories.map((c) => c.id));
      const validCoupons = new Set(references.coupons.map((c) => c.id));
      patch.links = {
        product_ids: s.vinculos_sugeridos.product_ids.filter((id) => validIds.has(id)),
        combo_ids: s.vinculos_sugeridos.combo_ids.filter((id) => validCombos.has(id)),
        category_ids: s.vinculos_sugeridos.category_ids.filter((id) => validCats.has(id)),
        coupon_id: s.vinculos_sugeridos.coupon_ids.find((id) => validCoupons.has(id)),
      };
    }
    return patch;
  }

  function applyAll() {
    const patch = buildPatch({ campaign: true, utm: true, links: true });
    if (genId && s) {
      markMarketingGeneration({
        data: {
          generation_id: genId,
          status: "applied",
          applied_payload: patch as never,
        },
      }).catch(() => {});
    }
    onApply(patch, s!, genId);
    onOpenChange(false);
    reset();
  }

  function applyPartial(parts: { campaign?: boolean; utm?: boolean; links?: boolean }) {
    const patch = buildPatch(parts);
    onApply(patch, s!, genId);
    toast.success("Conteúdo aplicado ao formulário");
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Assistente de Marketing IA
          </DialogTitle>
          <DialogDescription>
            Gera um rascunho completo de campanha para revisão. Nada é disparado automaticamente.
          </DialogDescription>
        </DialogHeader>

        {!s && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Objetivo *</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={brief.objective}
                  onChange={(e) => setBrief({ ...brief, objective: e.target.value })}
                >
                  {OBJECTIVES.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Canal principal *</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={brief.channel}
                  onChange={(e) => setBrief({ ...brief, channel: e.target.value })}
                >
                  {CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label>Público-alvo</Label>
                <Input
                  value={brief.audience ?? ""}
                  onChange={(e) => setBrief({ ...brief, audience: e.target.value })}
                  placeholder="Ex.: clientes de Maricá interessados em LED"
                />
              </div>
              <div>
                <Label>Foco</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={brief.focus_kind}
                  onChange={(e) =>
                    setBrief({
                      ...brief,
                      focus_kind: e.target.value as CampaignBrief["focus_kind"],
                      focus_id: null,
                      focus_label: null,
                    })
                  }
                >
                  <option value="livre">Livre</option>
                  <option value="produto">Produto</option>
                  <option value="kit">Kit / Combo</option>
                  <option value="categoria">Categoria</option>
                  <option value="cupom">Cupom</option>
                </select>
              </div>
              <div>
                <Label>Item em foco</Label>
                {brief.focus_kind === "produto" ? (
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={brief.focus_id ?? ""}
                    onChange={(e) => {
                      const p = references.products.find((x) => x.id === e.target.value);
                      setBrief({ ...brief, focus_id: e.target.value, focus_label: p?.name ?? null });
                    }}
                  >
                    <option value="">— escolher —</option>
                    {references.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                ) : brief.focus_kind === "kit" ? (
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={brief.focus_id ?? ""}
                    onChange={(e) => {
                      const c = references.combos.find((x) => x.id === e.target.value);
                      setBrief({ ...brief, focus_id: e.target.value, focus_label: c?.name ?? null });
                    }}
                  >
                    <option value="">— escolher —</option>
                    {references.combos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : brief.focus_kind === "categoria" ? (
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={brief.focus_id ?? ""}
                    onChange={(e) => {
                      const c = references.categories.find((x) => x.id === e.target.value);
                      setBrief({ ...brief, focus_id: e.target.value, focus_label: c?.name ?? null });
                    }}
                  >
                    <option value="">— escolher —</option>
                    {references.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : brief.focus_kind === "cupom" ? (
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={brief.focus_id ?? ""}
                    onChange={(e) => {
                      const c = references.coupons.find((x) => x.id === e.target.value);
                      setBrief({ ...brief, focus_id: e.target.value, focus_label: c?.code ?? null });
                    }}
                  >
                    <option value="">— escolher —</option>
                    {references.coupons.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input value="—" disabled />
                )}
              </div>
              <div>
                <Label>Início</Label>
                <Input
                  type="date"
                  value={brief.starts_at ?? ""}
                  onChange={(e) => setBrief({ ...brief, starts_at: e.target.value })}
                />
              </div>
              <div>
                <Label>Término</Label>
                <Input
                  type="date"
                  value={brief.ends_at ?? ""}
                  onChange={(e) => setBrief({ ...brief, ends_at: e.target.value })}
                />
              </div>
              <div>
                <Label>Tom da comunicação</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={brief.tone ?? ""}
                  onChange={(e) => setBrief({ ...brief, tone: e.target.value })}
                >
                  {TONES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Tipo de criativo</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={brief.creative_type ?? ""}
                  onChange={(e) => setBrief({ ...brief, creative_type: e.target.value })}
                >
                  {CREATIVE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label>Mercado</Label>
                <div className="mt-1 flex gap-2">
                  {(["varejo", "b2b", "ambos"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setBrief({ ...brief, market: m })}
                      className={`rounded border px-3 py-1 text-sm ${brief.market === m ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label>Observações para a IA</Label>
                <Textarea
                  rows={3}
                  value={brief.notes ?? ""}
                  onChange={(e) => setBrief({ ...brief, notes: e.target.value })}
                  placeholder="Ex.: foco em economia, ticket médio R$ 200, evitar termos técnicos"
                />
              </div>
            </div>
            <Button onClick={generate} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando rascunho…
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Gerar rascunho de campanha
                </>
              )}
            </Button>
          </div>
        )}

        {s && (
          <div className="space-y-4 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Confiança:</span>
                <Badge
                  variant={s.confianca === "alta" ? "default" : s.confianca === "media" ? "secondary" : "destructive"}
                >
                  {s.confianca}
                </Badge>
              </div>
              <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                Gerar de novo
              </Button>
            </div>

            {s.pontos_de_atencao.length > 0 && (
              <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 dark:bg-amber-950/30">
                <div className="mb-1 flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                  Pontos de atenção
                </div>
                <ul className="list-disc space-y-0.5 pl-5 text-sm text-amber-900 dark:text-amber-100">
                  {s.pontos_de_atencao.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}

            <Tabs defaultValue="estrategia">
              <TabsList className="flex w-full flex-wrap">
                <TabsTrigger value="estrategia">Estratégia</TabsTrigger>
                <TabsTrigger value="textos">Textos</TabsTrigger>
                <TabsTrigger value="redes">Redes</TabsTrigger>
                <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
                <TabsTrigger value="email">E-mail</TabsTrigger>
                <TabsTrigger value="imagens">Imagens</TabsTrigger>
                <TabsTrigger value="utm">UTMs</TabsTrigger>
                <TabsTrigger value="calendario">Calendário</TabsTrigger>
                <TabsTrigger value="vinculos">Vínculos</TabsTrigger>
              </TabsList>

              <TabsContent value="estrategia" className="space-y-3 pt-3">
                <Block title="Nome sugerido">{s.estrategia.nome_campanha}</Block>
                <Block title="Descrição curta">{s.estrategia.descricao_curta}</Block>
                <Block title="Descrição longa">{s.estrategia.descricao_longa}</Block>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Block title="Objetivo">{s.estrategia.objetivo}</Block>
                  <Block title="Público-alvo">{s.estrategia.publico_alvo}</Block>
                  <Block title="Período sugerido">{s.estrategia.periodo_sugerido}</Block>
                  <Block title="Meta sugerida">{s.estrategia.meta_sugerida}</Block>
                </div>
                <Block title="Canais recomendados">{s.estrategia.canais_recomendados.join(", ")}</Block>
              </TabsContent>

              <TabsContent value="textos" className="space-y-3 pt-3">
                <Block title="Título" copy={() => copyText(s.textos.titulo, "Título")}>
                  {s.textos.titulo}
                </Block>
                <Block title="CTA" copy={() => copyText(s.textos.cta, "CTA")}>
                  {s.textos.cta}
                </Block>
                <Block title="Chamadas para banner">
                  <ul className="list-disc pl-5">
                    {s.textos.chamadas_banner.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </Block>
                {s.textos.b2b && (
                  <Block title="Texto B2B" copy={() => copyText(s.textos.b2b ?? "", "Texto B2B")}>
                    {s.textos.b2b}
                  </Block>
                )}
              </TabsContent>

              <TabsContent value="redes" className="space-y-3 pt-3">
                <Block title="Instagram — Feed" copy={() => copyText(s.textos.instagram_feed, "Texto do feed")}>
                  <pre className="whitespace-pre-wrap font-sans text-sm">{s.textos.instagram_feed}</pre>
                </Block>
                <Block title="Instagram — Story" copy={() => copyText(s.textos.instagram_story, "Texto do story")}>
                  <pre className="whitespace-pre-wrap font-sans text-sm">{s.textos.instagram_story}</pre>
                </Block>
              </TabsContent>

              <TabsContent value="whatsapp" className="space-y-3 pt-3">
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                  Mensagem pronta para envio manual. Disparos em massa exigem opt-in/LGPD e ficam para fase futura.
                </div>
                <Block title="Mensagem WhatsApp" copy={() => copyText(s.textos.whatsapp, "WhatsApp")}>
                  <pre className="whitespace-pre-wrap font-sans text-sm">{s.textos.whatsapp}</pre>
                </Block>
              </TabsContent>

              <TabsContent value="email" className="space-y-3 pt-3">
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                  Rascunho de e-mail de marketing. Não dispara automaticamente. Validar opt-in antes do envio.
                </div>
                <Block title="Assunto" copy={() => copyText(s.textos.email_assunto, "Assunto")}>
                  {s.textos.email_assunto}
                </Block>
                <Block title="Pré-header" copy={() => copyText(s.textos.email_preheader, "Pré-header")}>
                  {s.textos.email_preheader}
                </Block>
                <Block title="Corpo" copy={() => copyText(s.textos.email_corpo, "Corpo")}>
                  <pre className="whitespace-pre-wrap font-sans text-sm">{s.textos.email_corpo}</pre>
                </Block>
              </TabsContent>

              <TabsContent value="imagens" className="space-y-3 pt-3">
                <p className="text-xs text-muted-foreground">
                  Prompts para geração de imagem em ferramenta externa. Use a aba Imagens do produto/banner para gerar.
                </p>
                <Block title="Banner home" copy={() => copyText(s.criativos.prompt_banner_home, "Prompt banner")}>
                  <pre className="whitespace-pre-wrap font-sans text-xs">{s.criativos.prompt_banner_home}</pre>
                </Block>
                <Block title="Post quadrado" copy={() => copyText(s.criativos.prompt_post_quadrado, "Prompt post")}>
                  <pre className="whitespace-pre-wrap font-sans text-xs">{s.criativos.prompt_post_quadrado}</pre>
                </Block>
                <Block title="Story" copy={() => copyText(s.criativos.prompt_story, "Prompt story")}>
                  <pre className="whitespace-pre-wrap font-sans text-xs">{s.criativos.prompt_story}</pre>
                </Block>
                <Block title="Produto/Kit" copy={() => copyText(s.criativos.prompt_produto_kit, "Prompt produto")}>
                  <pre className="whitespace-pre-wrap font-sans text-xs">{s.criativos.prompt_produto_kit}</pre>
                </Block>
                <Block title="Diretrizes visuais">
                  <ul className="list-disc pl-5 text-sm">
                    {s.criativos.diretrizes_visuais.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </Block>
              </TabsContent>

              <TabsContent value="utm" className="space-y-3 pt-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Block title="utm_source">{s.utm.utm_source}</Block>
                  <Block title="utm_medium">{s.utm.utm_medium}</Block>
                  <Block title="utm_campaign">{s.utm.utm_campaign}</Block>
                  <Block title="utm_content">{s.utm.utm_content ?? "—"}</Block>
                  <Block title="utm_term">{s.utm.utm_term ?? "—"}</Block>
                  <Block title="URL base sugerida">{s.utm.base_url_sugerida ?? "—"}</Block>
                </div>
                <Button size="sm" variant="outline" onClick={() => applyPartial({ utm: true })}>
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Aplicar somente UTM
                </Button>
              </TabsContent>

              <TabsContent value="calendario" className="space-y-2 pt-3">
                {s.calendario.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem plano de publicação sugerido.</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-2 text-left">Data</th>
                          <th className="p-2 text-left">Canal</th>
                          <th className="p-2 text-left">Conteúdo</th>
                          <th className="p-2 text-left">CTA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.calendario.map((c, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-2 align-top">{c.data}</td>
                            <td className="p-2 align-top">{c.canal}</td>
                            <td className="p-2 align-top">{c.conteudo}</td>
                            <td className="p-2 align-top">{c.cta ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="vinculos" className="space-y-3 pt-3">
                <SuggestionList
                  title="Produtos"
                  ids={s.vinculos_sugeridos.product_ids}
                  resolve={(id) => references.products.find((x) => x.id === id)?.name ?? null}
                />
                <SuggestionList
                  title="Kits / Combos"
                  ids={s.vinculos_sugeridos.combo_ids}
                  resolve={(id) => references.combos.find((x) => x.id === id)?.name ?? null}
                />
                <SuggestionList
                  title="Categorias"
                  ids={s.vinculos_sugeridos.category_ids}
                  resolve={(id) => references.categories.find((x) => x.id === id)?.name ?? null}
                />
                <SuggestionList
                  title="Cupons"
                  ids={s.vinculos_sugeridos.coupon_ids}
                  resolve={(id) => references.coupons.find((x) => x.id === id)?.code ?? null}
                />
                {s.vinculos_sugeridos.justificativa && (
                  <p className="text-xs text-muted-foreground">{s.vinculos_sugeridos.justificativa}</p>
                )}
                <Button size="sm" variant="outline" onClick={() => applyPartial({ links: true })}>
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Aplicar somente vínculos
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => handleClose(false)}>
            <X className="mr-1 h-4 w-4" /> {s ? "Descartar" : "Fechar"}
          </Button>
          {s && (
            <>
              <Button variant="outline" onClick={() => applyPartial({ campaign: true })}>
                <Copy className="mr-1 h-4 w-4" /> Aplicar somente textos
              </Button>
              <Button onClick={applyAll}>
                <CheckCircle2 className="mr-1 h-4 w-4" /> Aplicar tudo (rascunho)
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Block({
  title,
  children,
  copy,
}: {
  title: string;
  children: React.ReactNode;
  copy?: () => void;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="mb-1 flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">{title}</Label>
        {copy && (
          <Button type="button" size="sm" variant="ghost" onClick={copy}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function SuggestionList({
  title,
  ids,
  resolve,
}: {
  title: string;
  ids: string[];
  resolve: (id: string) => string | null;
}) {
  const valid = ids.map((id) => ({ id, name: resolve(id) })).filter((x) => x.name);
  if (valid.length === 0)
    return (
      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">{title}</Label>
        <p className="text-sm text-muted-foreground">Nenhuma sugestão.</p>
      </div>
    );
  return (
    <div>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{title}</Label>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {valid.map((x) => (
          <Badge key={x.id} variant="secondary">
            {x.name}
          </Badge>
        ))}
      </div>
    </div>
  );
}
