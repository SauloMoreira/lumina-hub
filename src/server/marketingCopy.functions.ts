import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/integrations/supabase/admin-middleware";

const BriefSchema = z.object({
  objective: z.string().min(1).max(120),
  channel: z.string().min(1).max(60),
  audience: z.string().max(400).optional().nullable(),
  focus_kind: z.enum(["produto", "kit", "categoria", "cupom", "livre"]).default("livre"),
  focus_id: z.string().max(60).optional().nullable(),
  focus_label: z.string().max(200).optional().nullable(),
  starts_at: z.string().max(40).optional().nullable(),
  ends_at: z.string().max(40).optional().nullable(),
  tone: z.string().max(80).optional().nullable(),
  creative_type: z.string().max(120).optional().nullable(),
  market: z.enum(["varejo", "b2b", "ambos"]).default("varejo"),
  notes: z.string().max(2000).optional().nullable(),
});
export type CampaignBrief = z.infer<typeof BriefSchema>;

const Reference = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().optional().nullable(),
  price: z.number().optional().nullable(),
  b2b_price: z.number().optional().nullable(),
  stock: z.number().int().optional().nullable(),
  category: z.string().optional().nullable(),
});

const ResultSchema = z.object({
  estrategia: z.object({
    nome_campanha: z.string().min(3).max(120),
    descricao_curta: z.string().min(10).max(400),
    descricao_longa: z.string().min(20).max(2000),
    objetivo: z.string().min(3).max(200),
    publico_alvo: z.string().min(3).max(400),
    canais_recomendados: z.array(z.string()).max(8),
    periodo_sugerido: z.string().max(200),
    meta_sugerida: z.string().max(400),
    utm_campaign_sugerido: z.string().max(80),
  }),
  textos: z.object({
    titulo: z.string().min(3).max(120),
    chamadas_banner: z.array(z.string()).max(6),
    cta: z.string().min(2).max(60),
    instagram_feed: z.string().max(2200),
    instagram_story: z.string().max(600),
    whatsapp: z.string().max(1500),
    email_assunto: z.string().max(120),
    email_preheader: z.string().max(160),
    email_corpo: z.string().max(4000),
    b2b: z.string().max(2000).optional().nullable(),
  }),
  utm: z.object({
    utm_source: z.string().max(60),
    utm_medium: z.string().max(60),
    utm_campaign: z.string().max(80),
    utm_content: z.string().max(60).optional().nullable(),
    utm_term: z.string().max(60).optional().nullable(),
    base_url_sugerida: z.string().max(400).optional().nullable(),
  }),
  criativos: z.object({
    prompt_banner_home: z.string().max(1200),
    prompt_post_quadrado: z.string().max(1200),
    prompt_story: z.string().max(1200),
    prompt_produto_kit: z.string().max(1200),
    diretrizes_visuais: z.array(z.string()).max(8),
  }),
  calendario: z
    .array(
      z.object({
        data: z.string().max(40),
        canal: z.string().max(40),
        conteudo: z.string().max(400),
        cta: z.string().max(80).optional().nullable(),
      }),
    )
    .max(20),
  vinculos_sugeridos: z.object({
    product_ids: z.array(z.string()).max(40).default([]),
    combo_ids: z.array(z.string()).max(20).default([]),
    category_ids: z.array(z.string()).max(20).default([]),
    coupon_ids: z.array(z.string()).max(5).default([]),
    justificativa: z.string().max(800).optional().nullable(),
  }),
  pontos_de_atencao: z.array(z.string()).max(20).default([]),
  confianca: z.enum(["alta", "media", "baixa"]),
});
export type CampaignSuggestion = z.infer<typeof ResultSchema>;

const InputSchema = z.object({
  brief: BriefSchema,
  references: z
    .object({
      products: z.array(Reference).max(40).default([]),
      combos: z.array(Reference).max(20).default([]),
      categories: z.array(Reference).max(20).default([]),
      coupons: z
        .array(
          z.object({
            id: z.string(),
            code: z.string(),
            description: z.string().optional().nullable(),
            discount: z.string().optional().nullable(),
            active: z.boolean().optional().nullable(),
          }),
        )
        .max(20)
        .default([]),
    })
    .default({ products: [], combos: [], categories: [], coupons: [] }),
});

const SYSTEM_PROMPT = `Você é o "Assistente de Marketing IA" da Led Maricá (Maricá/RJ), e-commerce de material elétrico, iluminação LED e ferramentas. Gera RASCUNHOS de campanha comercial para revisão humana — nada é disparado automaticamente.

REGRAS OBRIGATÓRIAS:
1. Use APENAS dados reais informados no contexto (produtos, kits, categorias, cupons). NUNCA invente preço, estoque, desconto, frete grátis ou prazo de entrega.
2. Se faltar dado, registre em "pontos_de_atencao".
3. Não use termos absolutos sem comprovação ("o mais barato do mercado", "o melhor do Brasil").
4. Não cite cupom inexistente como ativo. Use somente cupons fornecidos no contexto.
5. Não inclua CPF, dados de pagamento, tokens ou dados sensíveis nos textos.
6. WhatsApp e e-mail são RASCUNHOS. Não prometa disparo. Lembre que envios em massa exigem opt-in/LGPD.
7. Português do Brasil, tom comercial e claro. Adapte ao tom solicitado.
8. UTMs em snake_case minúsculo, sem acentos nem espaços.
9. Para B2B, foque em volume, recompra, prazo, condição de empresa. Nunca exponha preço de empresa em material público.
10. Vincule somente IDs presentes no contexto. Se não houver bom encaixe, deixe vazio e explique em "pontos_de_atencao".

Devolva sempre via tool call estruturada.`;

function buildContext(input: z.infer<typeof InputSchema>): string {
  const { brief, references } = input;
  const lines: string[] = [];
  lines.push(`Objetivo: ${brief.objective}`);
  lines.push(`Canal principal: ${brief.channel}`);
  lines.push(`Mercado: ${brief.market}`);
  if (brief.audience) lines.push(`Público-alvo: ${brief.audience}`);
  if (brief.focus_kind && brief.focus_kind !== "livre")
    lines.push(`Foco: ${brief.focus_kind}${brief.focus_label ? ` — ${brief.focus_label}` : ""}`);
  if (brief.starts_at) lines.push(`Início desejado: ${brief.starts_at}`);
  if (brief.ends_at) lines.push(`Término desejado: ${brief.ends_at}`);
  if (brief.tone) lines.push(`Tom: ${brief.tone}`);
  if (brief.creative_type) lines.push(`Tipo de criativo: ${brief.creative_type}`);
  if (brief.notes) lines.push(`Observações do admin: ${brief.notes}`);

  if (references.products.length) {
    lines.push("\nProdutos disponíveis (use apenas estes):");
    references.products.slice(0, 30).forEach((p) => {
      lines.push(
        `- [${p.id}] ${p.name}${p.category ? ` (${p.category})` : ""}${p.price != null ? ` — R$ ${p.price.toFixed(2)}` : ""}${p.stock != null ? ` — estoque ${p.stock}` : ""}`,
      );
    });
  }
  if (references.combos.length) {
    lines.push("\nKits/combos disponíveis:");
    references.combos.forEach((c) => lines.push(`- [${c.id}] ${c.name}`));
  }
  if (references.categories.length) {
    lines.push("\nCategorias disponíveis:");
    references.categories.forEach((c) => lines.push(`- [${c.id}] ${c.name}`));
  }
  if (references.coupons.length) {
    lines.push("\nCupons ativos disponíveis:");
    references.coupons.forEach((c) =>
      lines.push(`- [${c.id}] ${c.code}${c.description ? ` — ${c.description}` : ""}${c.discount ? ` — ${c.discount}` : ""}`),
    );
  } else {
    lines.push("\nCupons ativos disponíveis: nenhum (NÃO invente cupom)");
  }
  return lines.join("\n");
}

export const generateMarketingCampaign = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((raw: unknown) => InputSchema.parse(raw))
  .handler(async ({ data, context }) => {
    try {
      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) return { ok: false as const, error: "LOVABLE_API_KEY não configurada" };

      const model = "google/gemini-2.5-flash";
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildContext(data) },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "set_campaign_draft",
                description: "Rascunho completo de campanha de marketing para revisão humana.",
                parameters: {
                  type: "object",
                  properties: {
                    estrategia: {
                      type: "object",
                      properties: {
                        nome_campanha: { type: "string" },
                        descricao_curta: { type: "string" },
                        descricao_longa: { type: "string" },
                        objetivo: { type: "string" },
                        publico_alvo: { type: "string" },
                        canais_recomendados: { type: "array", items: { type: "string" } },
                        periodo_sugerido: { type: "string" },
                        meta_sugerida: { type: "string" },
                        utm_campaign_sugerido: { type: "string" },
                      },
                      required: [
                        "nome_campanha",
                        "descricao_curta",
                        "descricao_longa",
                        "objetivo",
                        "publico_alvo",
                        "canais_recomendados",
                        "periodo_sugerido",
                        "meta_sugerida",
                        "utm_campaign_sugerido",
                      ],
                    },
                    textos: {
                      type: "object",
                      properties: {
                        titulo: { type: "string" },
                        chamadas_banner: { type: "array", items: { type: "string" } },
                        cta: { type: "string" },
                        instagram_feed: { type: "string" },
                        instagram_story: { type: "string" },
                        whatsapp: { type: "string" },
                        email_assunto: { type: "string" },
                        email_preheader: { type: "string" },
                        email_corpo: { type: "string" },
                        b2b: { type: "string" },
                      },
                      required: [
                        "titulo",
                        "chamadas_banner",
                        "cta",
                        "instagram_feed",
                        "instagram_story",
                        "whatsapp",
                        "email_assunto",
                        "email_preheader",
                        "email_corpo",
                      ],
                    },
                    utm: {
                      type: "object",
                      properties: {
                        utm_source: { type: "string" },
                        utm_medium: { type: "string" },
                        utm_campaign: { type: "string" },
                        utm_content: { type: "string" },
                        utm_term: { type: "string" },
                        base_url_sugerida: { type: "string" },
                      },
                      required: ["utm_source", "utm_medium", "utm_campaign"],
                    },
                    criativos: {
                      type: "object",
                      properties: {
                        prompt_banner_home: { type: "string" },
                        prompt_post_quadrado: { type: "string" },
                        prompt_story: { type: "string" },
                        prompt_produto_kit: { type: "string" },
                        diretrizes_visuais: { type: "array", items: { type: "string" } },
                      },
                      required: [
                        "prompt_banner_home",
                        "prompt_post_quadrado",
                        "prompt_story",
                        "prompt_produto_kit",
                        "diretrizes_visuais",
                      ],
                    },
                    calendario: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          data: { type: "string" },
                          canal: { type: "string" },
                          conteudo: { type: "string" },
                          cta: { type: "string" },
                        },
                        required: ["data", "canal", "conteudo"],
                      },
                    },
                    vinculos_sugeridos: {
                      type: "object",
                      properties: {
                        product_ids: { type: "array", items: { type: "string" } },
                        combo_ids: { type: "array", items: { type: "string" } },
                        category_ids: { type: "array", items: { type: "string" } },
                        coupon_ids: { type: "array", items: { type: "string" } },
                        justificativa: { type: "string" },
                      },
                    },
                    pontos_de_atencao: { type: "array", items: { type: "string" } },
                    confianca: { type: "string", enum: ["alta", "media", "baixa"] },
                  },
                  required: [
                    "estrategia",
                    "textos",
                    "utm",
                    "criativos",
                    "calendario",
                    "vinculos_sugeridos",
                    "pontos_de_atencao",
                    "confianca",
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "set_campaign_draft" } },
        }),
      });

      if (res.status === 429)
        return { ok: false as const, error: "Limite de requisições atingido. Tente novamente em instantes." };
      if (res.status === 402)
        return { ok: false as const, error: "Créditos da IA esgotados." };
      if (!res.ok) {
        const txt = await res.text();
        console.error("AI gateway error", res.status, txt);
        return { ok: false as const, error: `Erro do provedor de IA (${res.status})` };
      }

      const json = (await res.json()) as {
        choices?: { message?: { tool_calls?: { function?: { arguments?: unknown } }[] } }[];
      };
      const argsRaw = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argsRaw) return { ok: false as const, error: "Resposta da IA sem dados estruturados" };
      const parsed = ResultSchema.parse(
        typeof argsRaw === "string" ? JSON.parse(argsRaw) : argsRaw,
      );

      // Log no histórico (não bloqueia em caso de falha)
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const ctx = context as { adminUserId?: string; adminEmail?: string | null };
        const { data: row } = await supabaseAdmin
          .from("marketing_ai_generations")
          .insert({
            admin_user_id: ctx.adminUserId ?? "00000000-0000-0000-0000-000000000000",
            admin_email: ctx.adminEmail ?? null,
            brief: data.brief as never,
            suggestion: parsed as never,
            model,
            status: "generated",
          } as never)
          .select("id")
          .single();
        return { ok: true as const, suggestion: parsed, generationId: row?.id ?? null };
      } catch (e) {
        console.error("marketing_ai_generations insert error", e);
        return { ok: true as const, suggestion: parsed, generationId: null };
      }
    } catch (e) {
      console.error("generateMarketingCampaign error", e);
      return { ok: false as const, error: e instanceof Error ? e.message : "Erro desconhecido" };
    }
  });

const ApplySchema = z.object({
  generation_id: z.string().uuid(),
  campaign_id: z.string().uuid().optional().nullable(),
  applied_payload: z.record(z.string(), z.unknown()).optional().nullable(),
  status: z.enum(["applied", "discarded"]).default("applied"),
});

export const markMarketingGeneration = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((raw: unknown) => ApplySchema.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("marketing_ai_generations")
      .update({
        status: data.status,
        applied_campaign_id: data.campaign_id ?? null,
        applied_payload: (data.applied_payload ?? null) as never,
      } as never)
      .eq("id", data.generation_id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
