import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const InputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional().nullable(),
  category: z.string().max(120).optional().nullable(),
  brand: z.string().max(120).optional().nullable(),
  price: z.number().nonnegative().optional().nullable(),
});

const ResultSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(220),
  keywords: z.string().min(1).max(400),
});

const BoostResultSchema = ResultSchema.extend({
  faq: z
    .array(
      z.object({
        question: z.string().min(3).max(200),
        answer: z.string().min(3).max(600),
      })
    )
    .min(2)
    .max(6),
});

const SYSTEM_PROMPT = `Você é especialista em SEO para e-commerce brasileiro de material elétrico e iluminação LED da loja Led Maricá (Maricá/RJ).
Gere campos de SEO otimizados em português brasileiro.
Regras:
- Título: até 60 caracteres, deve conter o nome do produto e a marca "Led Maricá".
- Descrição: até 160 caracteres, mencionar entrega rápida, benefício/economia e Maricá/RJ.
- Keywords: 6 a 10 termos separados por vírgula, incluir variações como "comprar X", "X preço", "X maricá".
- Não use aspas desnecessárias dentro dos campos.`;

const SYSTEM_PROMPT_BOOST = `${SYSTEM_PROMPT}
Adicionalmente, gere um FAQ com 3 a 5 perguntas e respostas curtas, úteis e específicas do produto (instalação, voltagem, garantia, indicação de uso, compatibilidade). Respostas em até 2 frases. Português brasileiro.`;

function buildUserPrompt(data: z.infer<typeof InputSchema>): string {
  return [
    `Produto: ${data.name}`,
    data.brand ? `Marca: ${data.brand}` : null,
    data.category ? `Categoria: ${data.category}` : null,
    data.price != null ? `Preço: R$ ${data.price.toFixed(2)}` : null,
    data.description ? `Descrição atual: ${data.description}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

async function callAiGateway(body: Record<string, unknown>) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error('LOVABLE_API_KEY não configurada');
  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new Error('Limite de requisições atingido. Tente novamente em instantes.');
  if (res.status === 402) throw new Error('Créditos da IA esgotados.');
  if (!res.ok) {
    const txt = await res.text();
    console.error('AI gateway error', res.status, txt);
    throw new Error(`Erro do provedor de IA (${res.status})`);
  }
  return res.json();
}

/** Geração rápida (botão manual no admin) — sem FAQ. */
export const improveProductSeo = createServerFn({ method: 'POST' })
  .inputValidator((raw: unknown) => InputSchema.parse(raw))
  .handler(async ({ data }) => {
    try {
      const json = await callAiGateway({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(data) },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'set_product_seo',
              description: 'Define os campos de SEO otimizados para o produto.',
              parameters: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Título SEO até 60 caracteres' },
                  description: { type: 'string', description: 'Meta description até 160 caracteres' },
                  keywords: { type: 'string', description: 'Palavras-chave separadas por vírgula' },
                },
                required: ['title', 'description', 'keywords'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'set_product_seo' } },
      });
      const argsRaw = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argsRaw) return { ok: false as const, error: 'Resposta da IA sem dados estruturados' };
      const parsed = ResultSchema.parse(typeof argsRaw === 'string' ? JSON.parse(argsRaw) : argsRaw);
      return { ok: true as const, ...parsed };
    } catch (e) {
      console.error('improveProductSeo error', e);
      return { ok: false as const, error: e instanceof Error ? e.message : 'Erro desconhecido' };
    }
  });

/** SEO Booster automático: gera title/description/keywords + FAQ e grava direto no produto. */
export const boostProductSeoAuto = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ productId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    try {
      // Verifica se o caller é admin (proteção extra além do RLS)
      const { data: profile } = await context.supabase
        .from('profiles')
        .select('role')
        .eq('id', context.userId)
        .maybeSingle();
      if (profile?.role !== 'admin') {
        return { ok: false as const, error: 'Acesso negado' };
      }

      const { data: product, error: pErr } = await supabaseAdmin
        .from('products')
        .select('id, name, description, brand, price, category_id, specs, categories:category_id(name)')
        .eq('id', data.productId)
        .maybeSingle();
      if (pErr || !product) return { ok: false as const, error: 'Produto não encontrado' };

      const promptInput = {
        name: product.name,
        description: product.description ?? null,
        brand: product.brand ?? null,
        category: (product as { categories?: { name?: string } | null }).categories?.name ?? null,
        price: product.price != null ? Number(product.price) : null,
      };

      const json = await callAiGateway({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_BOOST },
          { role: 'user', content: buildUserPrompt(promptInput) },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'set_product_seo_full',
              description: 'Define SEO completo do produto incluindo FAQ.',
              parameters: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  keywords: { type: 'string' },
                  faq: {
                    type: 'array',
                    minItems: 2,
                    maxItems: 6,
                    items: {
                      type: 'object',
                      properties: {
                        question: { type: 'string' },
                        answer: { type: 'string' },
                      },
                      required: ['question', 'answer'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['title', 'description', 'keywords', 'faq'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'set_product_seo_full' } },
      });

      const argsRaw = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argsRaw) return { ok: false as const, error: 'Resposta da IA sem dados estruturados' };
      const parsed = BoostResultSchema.parse(typeof argsRaw === 'string' ? JSON.parse(argsRaw) : argsRaw);

      const currentSpecs = (product.specs as Record<string, unknown> | null) ?? {};
      const newSpecs = {
        ...currentSpecs,
        seo_faq: parsed.faq,
        seo_boosted_at: new Date().toISOString(),
      };

      const { error: uErr } = await supabaseAdmin
        .from('products')
        .update({
          seo_title: parsed.title,
          seo_description: parsed.description,
          seo_keywords: parsed.keywords,
          specs: newSpecs,
        })
        .eq('id', data.productId);
      if (uErr) return { ok: false as const, error: uErr.message };

      return {
        ok: true as const,
        title: parsed.title,
        description: parsed.description,
        keywords: parsed.keywords,
        faqCount: parsed.faq.length,
      };
    } catch (e) {
      console.error('boostProductSeoAuto error', e);
      return { ok: false as const, error: e instanceof Error ? e.message : 'Erro desconhecido' };
    }
  });
