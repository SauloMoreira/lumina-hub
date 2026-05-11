import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/integrations/supabase/admin-middleware";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const BUCKET = "marketing-creatives";

export const CREATIVE_TYPES = ["banner_home", "post_square", "story", "product_kit"] as const;
export type CreativeType = (typeof CREATIVE_TYPES)[number];

const FORMAT_HINT: Record<CreativeType, string> = {
  banner_home:
    "Formato horizontal widescreen 1920x720 (banner principal de e-commerce). Composição cinematográfica, espaço amplo para título à esquerda ou direita.",
  post_square:
    "Formato quadrado 1080x1080 (post de feed Instagram/Facebook). Composição equilibrada, leitura clara no mobile.",
  story:
    "Formato vertical 9:16, 1080x1920 (Instagram Stories / WhatsApp Status / anúncio vertical). Elementos centralizados com margem de segurança superior e inferior.",
  product_kit:
    "Formato quadrado 1080x1080 (criativo promocional de produto/kit). Produto/kit em destaque com fundo limpo de estúdio.",
};

const STYLES: Record<string, string> = {
  promocional: "estilo varejo promocional vibrante, alto contraste, cores fortes, comunicação de oferta",
  premium: "estilo premium elegante, paleta sofisticada, tipografia clean, sensação de produto de alto valor",
  institucional: "estilo institucional limpo, neutro, profissional, sem apelo de desconto",
  tecnico: "estilo técnico profissional, foco em especificações, ambiente industrial/comercial",
  varejo_popular: "estilo varejo popular brasileiro, comunicação direta, preço em destaque",
  b2b: "estilo B2B/profissional, ambiente corporativo, foco em volume e parceria comercial",
};

const FOCUSES: Record<string, string> = {
  produto: "destaque para um produto específico",
  kit: "destaque para kit/combo, sugerindo conjunto/economia",
  campanha: "comunicação institucional de campanha",
  desconto: "destaque para oferta/desconto",
  trafego: "atrair tráfego para o site",
  conversao: "foco em conversão imediata, CTA forte",
};

const TONES: Record<string, string> = {
  comercial: "tom comercial direto",
  elegante: "tom elegante e sofisticado",
  objetivo: "tom objetivo e informativo",
  moderno: "tom moderno e jovem",
  profissional: "tom profissional e técnico",
};

const InputSchema = z.object({
  creative_type: z.enum(CREATIVE_TYPES),
  variations: z.number().int().min(1).max(4).default(1),
  style: z.string().max(40).default("promocional"),
  focus: z.string().max(40).default("campanha"),
  tone: z.string().max(40).default("comercial"),
  campaign_id: z.string().uuid().optional().nullable(),
  generation_id: z.string().uuid().optional().nullable(),
  context: z
    .object({
      campaign_name: z.string().max(160).optional().nullable(),
      description: z.string().max(800).optional().nullable(),
      objective: z.string().max(120).optional().nullable(),
      audience: z.string().max(400).optional().nullable(),
      channel: z.string().max(60).optional().nullable(),
      titulo: z.string().max(160).optional().nullable(),
      cta: z.string().max(60).optional().nullable(),
      coupon_code: z.string().max(60).optional().nullable(),
      products: z
        .array(
          z.object({
            name: z.string().max(160),
            price: z.number().optional().nullable(),
            image_url: z.string().max(800).optional().nullable(),
            category: z.string().max(80).optional().nullable(),
          }),
        )
        .max(8)
        .default([]),
      combos: z
        .array(z.object({ name: z.string().max(160), item_count: z.number().int().optional().nullable() }))
        .max(8)
        .default([]),
      categories: z.array(z.string().max(80)).max(8).default([]),
    })
    .default(() => ({ products: [], combos: [], categories: [] })),
  extra_hint: z.string().max(600).optional().nullable(),
});

function styleLabel(s: string) {
  return STYLES[s] ?? "estilo promocional limpo";
}
function focusLabel(s: string) {
  return FOCUSES[s] ?? "comunicação de campanha";
}
function toneLabel(s: string) {
  return TONES[s] ?? "tom comercial";
}

function buildPrompt(input: z.infer<typeof InputSchema>, variation: number): string {
  const ctx = input.context;
  const products = (ctx.products ?? []).slice(0, 4);
  const combos = (ctx.combos ?? []).slice(0, 3);
  const cats = (ctx.categories ?? []).slice(0, 4);

  const itemBlock =
    products.length > 0
      ? `Produtos vinculados (use apenas estes, sem inventar):\n${products
          .map(
            (p) =>
              `• ${p.name}${p.price != null ? ` — R$ ${p.price.toFixed(2).replace(".", ",")}` : ""}${
                p.category ? ` (${p.category})` : ""
              }`,
          )
          .join("\n")}`
      : combos.length > 0
        ? `Kits/combos vinculados:\n${combos
            .map((c) => `• ${c.name}${c.item_count ? ` — ${c.item_count} itens` : ""}`)
            .join("\n")}`
        : cats.length > 0
          ? `Categorias vinculadas: ${cats.join(", ")}`
          : "Sem itens vinculados — usar comunicação institucional neutra de iluminação/material elétrico.";

  return [
    `Criativo de marketing profissional para a Led Maricá (e-commerce brasileiro de iluminação e materiais elétricos).`,
    `${FORMAT_HINT[input.creative_type]}`,
    `Estilo visual: ${styleLabel(input.style)}.`,
    `Foco: ${focusLabel(input.focus)}.`,
    `Tom: ${toneLabel(input.tone)}.`,
    ctx.campaign_name ? `Campanha: "${ctx.campaign_name}".` : "",
    ctx.objective ? `Objetivo: ${ctx.objective}.` : "",
    ctx.audience ? `Público-alvo: ${ctx.audience}.` : "",
    ctx.titulo ? `Mensagem principal sugerida: "${ctx.titulo}".` : "",
    ctx.cta ? `CTA sugerido: "${ctx.cta}".` : "",
    ctx.coupon_code ? `Cupom em uso: ${ctx.coupon_code} (mostrar o código com discrição se fizer sentido).` : "",
    itemBlock,
    `Variação #${variation} de ${input.variations}: mantenha o mesmo objetivo mas varie composição, ângulo, hierarquia visual.`,
    `Identidade visual: aparência profissional, boa legibilidade no mobile, contraste adequado, composição equilibrada, coerente com o segmento de iluminação e material elétrico.`,
    `REGRAS CRÍTICAS:`,
    `- NÃO inventar preços, descontos, percentuais de economia, frete grátis, especificações técnicas ou quantidades.`,
    `- NÃO escrever texto inventado sobre o produto.`,
    `- Se houver imagem real do produto, priorizar composições limpas que valorizem o item.`,
    `- Pode incluir título curto, CTA curto e o cupom (se fornecido). Nada além disso em texto.`,
    `- Sem marcas d'água, sem logos de terceiros, sem rostos identificáveis, sem bordas ou colagens.`,
    input.extra_hint ? `Instruções extras do administrador: ${input.extra_hint}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mime: string; ext: string } {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!m) throw new Error("data URL inválida");
  const mime = m[1];
  const ext = mime.split("/")[1].replace("jpeg", "jpg").replace("+xml", "");
  return { buffer: Buffer.from(m[2], "base64"), mime, ext };
}

export const generateCampaignCreatives = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: z.infer<typeof InputSchema>) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const adminUserId = (context as { adminUserId: string }).adminUserId;

    const variations = data.variations;
    const created: Record<string, never>[] = [];

    for (let i = 1; i <= variations; i++) {
      const prompt = buildPrompt(data, i);

      const res = await fetch(AI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-image-preview",
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
      });

      if (res.status === 429) throw new Error("Limite de requisições da IA atingido. Aguarde alguns instantes.");
      if (res.status === 402) throw new Error("Créditos da IA esgotados. Adicione créditos no workspace.");
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        console.error("[generateCampaignCreatives]", res.status, t.slice(0, 400));
        throw new Error(`Falha ao gerar criativo (${res.status})`);
      }
      const json = await res.json();
      const url: string | undefined = json?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!url || !url.startsWith("data:image/")) {
        throw new Error("IA não retornou imagem");
      }

      const { buffer, mime, ext } = dataUrlToBuffer(url);
      const folder = data.generation_id ?? data.campaign_id ?? "ad-hoc";
      const path = `creatives/${folder}/${data.creative_type}-v${i}-${Date.now()}.${ext}`;

      const up = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
        contentType: mime,
        upsert: false,
      });
      if (up.error) {
        console.error("[storage upload]", up.error);
        throw new Error("Falha ao salvar imagem");
      }
      const pub = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

      const ins = await supabaseAdmin
        .from("marketing_creatives")
        .insert({
          campaign_id: data.campaign_id ?? null,
          generation_id: data.generation_id ?? null,
          creative_type: data.creative_type,
          storage_path: path,
          public_url: pub,
          status: "draft",
          variation_index: i,
          prompt,
          style: data.style,
          focus: data.focus,
          tone: data.tone,
          origin: "ai_generated",
          metadata: {
            campaign_name: data.context.campaign_name ?? null,
            channel: data.context.channel ?? null,
          },
          created_by: adminUserId,
        })
        .select("*")
        .single();
      if (ins.error) {
        console.error("[insert creative]", ins.error);
        throw new Error("Falha ao registrar criativo");
      }
      created.push(ins.data as unknown as Record<string, never>);
    }

    return { ok: true as const, creatives: created };
  });

export const listCampaignCreatives = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator(
    (input: { campaign_id?: string | null; generation_id?: string | null }) => input,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("marketing_creatives").select("*").order("created_at", { ascending: false });
    if (data.campaign_id) q = q.eq("campaign_id", data.campaign_id);
    if (data.generation_id) q = q.eq("generation_id", data.generation_id);
    if (!data.campaign_id && !data.generation_id) return { creatives: [] };
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { creatives: rows ?? [] };
  });

export const updateCampaignCreative = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator(
    (input: {
      id: string;
      status?: "draft" | "approved" | "discarded";
      is_principal?: boolean;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { status?: string; is_principal?: boolean } = {};
    if (data.status) patch.status = data.status;
    if (typeof data.is_principal === "boolean") patch.is_principal = data.is_principal;

    // Se virar principal, desmarca outros do mesmo tipo na mesma campanha/geração
    if (data.is_principal === true) {
      const cur = await supabaseAdmin
        .from("marketing_creatives")
        .select("campaign_id, generation_id, creative_type")
        .eq("id", data.id)
        .single();
      if (cur.data) {
        let unset = supabaseAdmin
          .from("marketing_creatives")
          .update({ is_principal: false })
          .neq("id", data.id)
          .eq("creative_type", cur.data.creative_type);
        if (cur.data.campaign_id) unset = unset.eq("campaign_id", cur.data.campaign_id);
        else if (cur.data.generation_id) unset = unset.eq("generation_id", cur.data.generation_id);
        await unset;
      }
    }

    const { data: row, error } = await supabaseAdmin
      .from("marketing_creatives")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { creative: row };
  });

export const deleteCampaignCreative = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cur = await supabaseAdmin
      .from("marketing_creatives")
      .select("storage_path")
      .eq("id", data.id)
      .single();
    if (cur.data?.storage_path) {
      await supabaseAdmin.storage.from(BUCKET).remove([cur.data.storage_path]);
    }
    const { error } = await supabaseAdmin.from("marketing_creatives").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const linkCreativesToCampaign = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: { generation_id: string; campaign_id: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("marketing_creatives")
      .update({ campaign_id: data.campaign_id })
      .eq("generation_id", data.generation_id)
      .is("campaign_id", null);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export type CampaignCreative = {
  id: string;
  campaign_id: string | null;
  generation_id: string | null;
  creative_type: CreativeType;
  storage_path: string;
  public_url: string;
  status: "draft" | "approved" | "discarded";
  is_principal: boolean;
  variation_index: number;
  prompt: string | null;
  style: string | null;
  focus: string | null;
  tone: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
