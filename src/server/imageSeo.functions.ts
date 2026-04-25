import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const InputSchema = z.object({
  productName: z.string().min(1).max(200),
  category: z.string().max(120).optional().nullable(),
  brand: z.string().max(120).optional().nullable(),
  index: z.number().int().min(0).max(20).optional(),
});

const ResultSchema = z.object({
  alt: z.string().min(3).max(180),
  title: z.string().min(3).max(120),
  caption: z.string().min(3).max(220),
  filename: z
    .string()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9-]+(\.(webp|jpg|png))?$/i, 'filename inválido'),
});

const SYSTEM_PROMPT = `Você é especialista em SEO de imagens para e-commerce brasileiro de material elétrico e iluminação LED da Led Maricá (Maricá/RJ).
Para cada imagem de produto, gere:
- alt: texto descritivo curto (até 125 caracteres) que explique o produto e contenha a marca e cidade quando fizer sentido.
- title: tooltip curto (até 90 caracteres) com o nome do produto.
- caption: legenda contextual de 1 frase com benefício/uso típico.
- filename: nome de arquivo SEO em kebab-case (somente letras minúsculas, números e hífen), com extensão .webp.
Regras: português brasileiro, sem aspas, sem emojis, sem pontuação no filename além de hífens.`;

export const generateImageSeo = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => InputSchema.parse(raw))
  .handler(async ({ data, context }) => {
    try {
      const { data: profile } = await context.supabase
        .from('profiles')
        .select('role')
        .eq('id', context.userId)
        .maybeSingle();
      if (profile?.role !== 'admin') return { ok: false as const, error: 'Acesso negado' };

      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) return { ok: false as const, error: 'LOVABLE_API_KEY não configurada' };

      const userPrompt = [
        `Produto: ${data.productName}`,
        data.brand ? `Marca: ${data.brand}` : null,
        data.category ? `Categoria: ${data.category}` : null,
        data.index != null ? `Imagem nº ${data.index + 1} do produto` : null,
      ]
        .filter(Boolean)
        .join('\n');

      const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          tools: [
            {
              type: 'function',
              function: {
                name: 'set_image_seo',
                description: 'Define metadados SEO da imagem do produto.',
                parameters: {
                  type: 'object',
                  properties: {
                    alt: { type: 'string' },
                    title: { type: 'string' },
                    caption: { type: 'string' },
                    filename: { type: 'string' },
                  },
                  required: ['alt', 'title', 'caption', 'filename'],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: 'function', function: { name: 'set_image_seo' } },
        }),
      });

      if (res.status === 429) return { ok: false as const, error: 'Limite de requisições atingido. Tente novamente em instantes.' };
      if (res.status === 402) return { ok: false as const, error: 'Créditos da IA esgotados.' };
      if (!res.ok) {
        const txt = await res.text();
        console.error('AI gateway error', res.status, txt);
        return { ok: false as const, error: `Erro do provedor de IA (${res.status})` };
      }

      const json = (await res.json()) as {
        choices?: { message?: { tool_calls?: { function?: { arguments?: unknown } }[] } }[];
      };
      const argsRaw = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argsRaw) return { ok: false as const, error: 'Resposta da IA sem dados estruturados' };
      const parsed = ResultSchema.parse(typeof argsRaw === 'string' ? JSON.parse(argsRaw) : argsRaw);
      // Garantir extensão .webp
      const hasExt = /\.(webp|jpg|png)$/i;
      const filename = hasExt.test(parsed.filename) ? parsed.filename : `${parsed.filename}.webp`;
      return { ok: true as const, ...parsed, filename };
    } catch (e) {
      console.error('generateImageSeo error', e);
      return { ok: false as const, error: e instanceof Error ? e.message : 'Erro desconhecido' };
    }
  });
