import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/integrations/supabase/admin-middleware";

const InputSchema = z.object({
  name: z.string().min(1).max(200),
  brand: z.string().max(120).optional().nullable(),
  category: z.string().max(120).optional().nullable(),
  sku: z.string().max(120).optional().nullable(),
  description: z.string().max(8000).optional().nullable(),
  tags: z.array(z.string()).max(40).optional().nullable(),
  barcode: z.string().max(40).optional().nullable(),
  ncm: z.string().max(20).optional().nullable(),
  attributes: z.record(z.string(), z.unknown()).optional().nullable(),
  price: z.number().nonnegative().optional().nullable(),
  stock: z.number().int().optional().nullable(),
  imageAlts: z.array(z.string()).max(20).optional().nullable(),
});

const FaqItem = z.object({
  pergunta: z.string().min(3).max(220),
  resposta: z.string().min(3).max(700),
});

const ResultSchema = z.object({
  descricao_longa: z.string().min(20).max(4000),
  descricao_curta: z.string().min(10).max(400),
  titulo_seo: z.string().min(5).max(70),
  meta_description: z.string().min(20).max(200),
  palavras_chave_principais: z.array(z.string()).min(1).max(12),
  palavras_chave_secundarias: z.array(z.string()).max(20).default([]),
  tags_sugeridas: z.array(z.string()).max(20).default([]),
  alt_text_imagem: z.string().min(5).max(180),
  faq: z.array(FaqItem).max(6).default([]),
  pontos_de_atencao: z.array(z.string()).max(10).default([]),
  fontes_consultadas: z.array(z.string()).max(10).default([]),
  confianca: z.enum(["alta", "media", "baixa"]),
});

export type ProductCopyResult = z.infer<typeof ResultSchema>;

const SYSTEM_PROMPT = `Você é especialista em cadastro de produtos para e-commerce de material elétrico, iluminação LED e ferramentas da loja Led Maricá (Maricá/RJ), com foco em SEO, conversão e confiabilidade técnica.

REGRAS OBRIGATÓRIAS (NÃO VIOLAR):
1. NÃO invente especificações técnicas (tensão, potência, amperagem, IP, certificação, material, metragem, bitola, garantia, norma, compatibilidade).
2. Use APENAS dados informados ou inferíveis com segurança do nome/categoria.
3. Se faltar dado técnico relevante, liste em "pontos_de_atencao".
4. Texto original em português do Brasil — não copie de outros sites.
5. Sem exageros comerciais nem promessas não comprovadas.
6. Linguagem clara, comercial, profissional.
7. SEO natural: palavras-chave relevantes sem repetição artificial.
8. Considere intenção local quando útil (ex.: "material elétrico em Maricá/RJ").
9. Título SEO ≤ 60 caracteres. Meta description ≤ 160 caracteres.
10. NUNCA altere preço, SKU, categoria ou estoque.

Devolva SEMPRE via tool call estruturada.`;

function buildPrompt(d: z.infer<typeof InputSchema>): string {
  const lines = [
    `Nome: ${d.name}`,
    d.brand ? `Marca: ${d.brand}` : "Marca: não informado",
    d.category ? `Categoria: ${d.category}` : "Categoria: não informado",
    d.sku ? `SKU: ${d.sku}` : null,
    d.barcode ? `GTIN/EAN: ${d.barcode}` : null,
    d.ncm ? `NCM: ${d.ncm}` : null,
    d.price != null ? `Preço: R$ ${d.price.toFixed(2)}` : null,
    d.stock != null ? `Estoque: ${d.stock}` : null,
    d.tags?.length ? `Tags atuais: ${d.tags.join(", ")}` : null,
    d.attributes && Object.keys(d.attributes).length
      ? `Atributos técnicos:\n${JSON.stringify(d.attributes, null, 2)}`
      : "Atributos técnicos: não informado",
    d.imageAlts?.length ? `Alt text das imagens: ${d.imageAlts.join(" | ")}` : null,
    d.description ? `Descrição atual:\n${d.description}` : "Descrição atual: vazia",
  ].filter(Boolean);
  return lines.join("\n");
}

export const generateProductCopy = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((raw: unknown) => InputSchema.parse(raw))
  .handler(async ({ data }) => {
    try {
      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) return { ok: false as const, error: "LOVABLE_API_KEY não configurada" };

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildPrompt(data) },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "set_product_copy",
                description: "Sugestões de copy comercial e SEO para o produto.",
                parameters: {
                  type: "object",
                  properties: {
                    descricao_longa: { type: "string" },
                    descricao_curta: { type: "string" },
                    titulo_seo: { type: "string" },
                    meta_description: { type: "string" },
                    palavras_chave_principais: { type: "array", items: { type: "string" } },
                    palavras_chave_secundarias: { type: "array", items: { type: "string" } },
                    tags_sugeridas: { type: "array", items: { type: "string" } },
                    alt_text_imagem: { type: "string" },
                    faq: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          pergunta: { type: "string" },
                          resposta: { type: "string" },
                        },
                        required: ["pergunta", "resposta"],
                        additionalProperties: false,
                      },
                    },
                    pontos_de_atencao: { type: "array", items: { type: "string" } },
                    fontes_consultadas: { type: "array", items: { type: "string" } },
                    confianca: { type: "string", enum: ["alta", "media", "baixa"] },
                  },
                  required: [
                    "descricao_longa",
                    "descricao_curta",
                    "titulo_seo",
                    "meta_description",
                    "palavras_chave_principais",
                    "alt_text_imagem",
                    "confianca",
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "set_product_copy" } },
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
      return { ok: true as const, suggestion: parsed };
    } catch (e) {
      console.error("generateProductCopy error", e);
      return { ok: false as const, error: e instanceof Error ? e.message : "Erro desconhecido" };
    }
  });
