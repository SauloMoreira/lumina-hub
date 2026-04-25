import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

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

/**
 * Gera campos SEO (title, description, keywords) para um produto usando Lovable AI Gateway.
 * Usa tool-calling para garantir saída estruturada.
 */
export const improveProductSeo = createServerFn({ method: 'POST' })
  .inputValidator((raw: unknown) => InputSchema.parse(raw))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: 'LOVABLE_API_KEY não configurada' };
    }

    const userPrompt = [
      `Produto: ${data.name}`,
      data.brand ? `Marca: ${data.brand}` : null,
      data.category ? `Categoria: ${data.category}` : null,
      data.price != null ? `Preço: R$ ${data.price.toFixed(2)}` : null,
      data.description ? `Descrição atual: ${data.description}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const systemPrompt = `Você é especialista em SEO para e-commerce brasileiro de material elétrico e iluminação LED da loja Led Maricá (Maricá/RJ).
Gere campos de SEO otimizados em português brasileiro.
Regras:
- Título: até 60 caracteres, deve conter o nome do produto e a marca "Led Maricá".
- Descrição: até 160 caracteres, mencionar entrega rápida, benefício/economia e Maricá/RJ.
- Keywords: 6 a 10 termos separados por vírgula, incluir variações como "comprar X", "X preço", "X maricá".
- Não use aspas desnecessárias dentro dos campos.`;

    try {
      const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
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
        }),
      });

      if (res.status === 429) return { ok: false as const, error: 'Limite de requisições atingido. Tente novamente em instantes.' };
      if (res.status === 402) return { ok: false as const, error: 'Créditos da IA esgotados. Adicione créditos na sua workspace.' };
      if (!res.ok) {
        const txt = await res.text();
        console.error('AI gateway error', res.status, txt);
        return { ok: false as const, error: `Erro do provedor de IA (${res.status})` };
      }

      const json = await res.json();
      const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
      const argsRaw = toolCall?.function?.arguments;
      if (!argsRaw) return { ok: false as const, error: 'Resposta da IA sem dados estruturados' };

      const parsed = ResultSchema.parse(typeof argsRaw === 'string' ? JSON.parse(argsRaw) : argsRaw);
      return { ok: true as const, ...parsed };
    } catch (e) {
      console.error('improveProductSeo error', e);
      return { ok: false as const, error: e instanceof Error ? e.message : 'Erro desconhecido ao gerar SEO' };
    }
  });
