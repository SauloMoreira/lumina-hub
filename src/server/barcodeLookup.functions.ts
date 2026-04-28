import { createServerFn } from '@tanstack/react-start';
import { requireAdmin } from '@/integrations/supabase/admin-middleware';

/**
 * Allowlist de hosts confiáveis para fetchExternalImage.
 * Mantém-se restrito a CDNs conhecidas usadas no fluxo de cadastro de produtos
 * (Cosmos/Bluesoft + grandes provedores de imagem). Bloqueia SSRF para
 * 127.x, 10.x, 192.168.x, 169.254.x, ::1 etc.
 */
const ALLOWED_IMAGE_HOSTS: readonly RegExp[] = [
  /(^|\.)cosmos\.bluesoft\.com\.br$/i,
  /(^|\.)bluesoft\.com\.br$/i,
  /(^|\.)akamaihd\.net$/i,
  /(^|\.)cloudfront\.net$/i,
  /(^|\.)googleusercontent\.com$/i,
  /(^|\.)gstatic\.com$/i,
  /(^|\.)mlstatic\.com$/i,
  /(^|\.)amazonaws\.com$/i,
  /(^|\.)imgur\.com$/i,
];

function isPrivateHostname(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  // IPv4 literais privados / loopback / link-local / metadata
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true; // inclui 169.254.169.254 (cloud metadata)
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^0\./.test(h)) return true;
  // IPv6 loopback / link-local / unique local
  if (h === '::1' || h === '[::1]') return true;
  if (h.startsWith('fe80:') || h.startsWith('[fe80:')) return true;
  if (h.startsWith('fc') || h.startsWith('fd')) return true;
  return false;
}

function isAllowedImageHost(host: string): boolean {
  if (isPrivateHostname(host)) return false;
  return ALLOWED_IMAGE_HOSTS.some((re) => re.test(host));
}


export type BarcodeLookupResult = {
  ok: boolean;
  source: 'cosmos' | 'ai' | 'cosmos+ai' | 'none';
  confidence: 'high' | 'medium' | 'low';
  notFoundMessage?: string;
  raw?: {
    description?: string | null;
    brand?: string | null;
    category?: string | null;
    ncm?: string | null;
    gpc?: string | null;
    thumbnail?: string | null;
    avg_price?: number | null;
    max_price?: number | null;
    images?: string[];
  };
  suggested: {
    name: string | null;
    brand: string | null;
    categoryHint: string | null; // nome textual da categoria sugerida
    description: string | null;
    tags: string[];
    seo_title: string | null;
    seo_description: string | null;
    seo_keywords: string | null;
    images: string[];
    referencePrice?: number | null;
  };
  error?: string;
  imagesNote?: string | null;
};

const COSMOS_URL = 'https://api.cosmos.bluesoft.com.br/gtins/';
const AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const AI_IMAGE_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

function sanitizeBarcode(raw: string): string {
  return (raw ?? '').replace(/\D+/g, '').trim();
}

async function fetchCosmos(barcode: string, token: string) {
  const res = await fetch(`${COSMOS_URL}${barcode}.json`, {
    method: 'GET',
    headers: {
      'X-Cosmos-Token': token,
      'Content-Type': 'application/json',
      'User-Agent': 'Lovable-LedMarica/1.0 (cosmos-lookup)',
    },
  });
  if (res.status === 404) return { found: false as const };
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Cosmos error ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return { found: true as const, data };
}

function extractCosmosImages(data: unknown): string[] {
  const out: string[] = [];
  const d = data as Record<string, unknown> | null;
  if (!d) return out;
  const thumb = typeof d.thumbnail === 'string' ? d.thumbnail : null;
  if (thumb && /^https?:\/\//i.test(thumb)) out.push(thumb);
  const arr = Array.isArray((d as { images?: unknown }).images) ? ((d as { images?: unknown[] }).images ?? []) : [];
  for (const item of arr) {
    if (typeof item === 'string' && /^https?:\/\//i.test(item)) out.push(item);
    else if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      const url = typeof obj.url === 'string' ? obj.url : typeof obj.image === 'string' ? obj.image : null;
      if (url && /^https?:\/\//i.test(url)) out.push(url);
    }
  }
  // dedupe preservando ordem, máximo 6
  return Array.from(new Set(out)).slice(0, 6);
}

async function callAI(prompt: string, system: string) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error('LOVABLE_API_KEY não configurada');

  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'product_data',
            description: 'Dados padronizados do produto para e-commerce',
            parameters: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Nome comercial padronizado' },
                brand: { type: 'string', description: 'Marca, ou string vazia se desconhecida' },
                category_hint: { type: 'string', description: 'Categoria sugerida em português, p. ex. "Lâmpadas LED"' },
                description: { type: 'string', description: 'Descrição comercial concisa (3-5 frases)' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Até 8 tags curtas' },
                seo_title: { type: 'string', description: 'Título SEO (máx 60 chars)' },
                seo_description: { type: 'string', description: 'Meta description (máx 160 chars)' },
                seo_keywords: { type: 'string', description: 'Palavras-chave separadas por vírgula' },
              },
              required: ['name', 'brand', 'category_hint', 'description', 'tags', 'seo_title', 'seo_description', 'seo_keywords'],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'product_data' } },
    }),
  });

  if (res.status === 429) throw new Error('Limite de requisições da IA atingido. Tente novamente em instantes.');
  if (res.status === 402) throw new Error('Créditos da IA esgotados. Adicione créditos no workspace.');
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`IA error ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const tc = data?.choices?.[0]?.message?.tool_calls?.[0];
  const argsStr = tc?.function?.arguments;
  if (!argsStr) throw new Error('IA não retornou dados estruturados');
  try {
    return JSON.parse(argsStr) as {
      name: string;
      brand: string;
      category_hint: string;
      description: string;
      tags: string[];
      seo_title: string;
      seo_description: string;
      seo_keywords: string;
    };
  } catch {
    throw new Error('IA retornou JSON inválido');
  }
}

export const lookupBarcode = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .inputValidator((input: { barcode: string; categoriesAvailable?: string[] }) => input)
  .handler(async ({ data }): Promise<BarcodeLookupResult> => {
    const code = sanitizeBarcode(data.barcode);
    if (!code || code.length < 8 || code.length > 14) {
      return {
        ok: false,
        source: 'none',
        confidence: 'low',
        error: 'Código de barras inválido. Use EAN-8, EAN-13, UPC ou GTIN-14 (apenas dígitos).',
        suggested: emptySuggestion(),
      };
    }

    const cosmosToken = process.env.COSMOS_BLUESOFT_TOKEN;
    let cosmosData: Record<string, unknown> | null = null;

    if (cosmosToken) {
      try {
        const result = await fetchCosmos(code, cosmosToken);
        if (result.found) cosmosData = result.data as Record<string, unknown>;
      } catch (e) {
        console.error('[barcodeLookup] cosmos error:', e);
      }
    }

    // Se Cosmos não retornou nada, tentar somente IA com aviso de baixa confiança
    if (!cosmosData) {
      try {
        const ai = await callAI(
          `Tente identificar o produto pelo código de barras EAN/GTIN: ${code}. ` +
            `Se NÃO conhecer com segurança esse código, retorne campos vazios — não invente. ` +
            `Categorias disponíveis no sistema (use uma quando fizer sentido): ${(data.categoriesAvailable ?? []).join(' | ') || 'sem lista'}.`,
          'Você é um catalogador de produtos para e-commerce brasileiro de iluminação e materiais elétricos. Nunca invente especificações técnicas. Se não souber, retorne strings vazias e arrays vazios.',
        );
        const hasData = (ai.name && ai.name.trim().length > 0) || (ai.brand && ai.brand.trim().length > 0);
        if (!hasData) {
          return {
            ok: false,
            source: 'none',
            confidence: 'low',
            notFoundMessage: 'Não encontramos dados confiáveis para este código de barras.',
            suggested: emptySuggestion(),
          };
        }
        return {
          ok: true,
          source: 'ai',
          confidence: 'low',
          suggested: {
            name: ai.name || null,
            brand: ai.brand || null,
            categoryHint: ai.category_hint || null,
            description: ai.description || null,
            tags: Array.isArray(ai.tags) ? ai.tags.filter(Boolean).slice(0, 8) : [],
            seo_title: ai.seo_title || null,
            seo_description: ai.seo_description || null,
            seo_keywords: ai.seo_keywords || null,
            images: [],
          },
        };
      } catch (e) {
        return {
          ok: false,
          source: 'none',
          confidence: 'low',
          error: e instanceof Error ? e.message : 'Erro ao consultar IA',
          notFoundMessage: 'Não encontramos dados confiáveis para este código de barras.',
          suggested: emptySuggestion(),
        };
      }
    }

    // Cosmos OK — extrair campos brutos
    const cd = cosmosData;
    const description = (cd.description as string) ?? null;
    const brand = ((cd.brand as Record<string, unknown> | null)?.name as string | undefined) ?? null;
    const category =
      ((cd.gpc as Record<string, unknown> | null)?.description as string | undefined) ??
      ((cd.ncm as Record<string, unknown> | null)?.description as string | undefined) ??
      null;
    const ncm = ((cd.ncm as Record<string, unknown> | null)?.code as string | undefined) ?? null;
    const thumbnail = (cd.thumbnail as string) ?? null;
    let images = extractCosmosImages(cd);
    const avg_price = typeof cd.avg_price === 'number' ? (cd.avg_price as number) : null;
    const max_price = typeof cd.max_price === 'number' ? (cd.max_price as number) : null;

    // Padronizar com IA usando dados reais
    let aiOut: Awaited<ReturnType<typeof callAI>> | null = null;
    try {
      aiOut = await callAI(
        `Padronize os dados deste produto para e-commerce brasileiro de iluminação/materiais elétricos.\n\n` +
          `Dados confiáveis encontrados na base GTIN:\n` +
          `- Descrição original: ${description ?? '(vazio)'}\n` +
          `- Marca: ${brand ?? '(vazio)'}\n` +
          `- Categoria GPC/NCM: ${category ?? '(vazio)'}\n` +
          `- NCM: ${ncm ?? '(vazio)'}\n` +
          `- EAN: ${code}\n\n` +
          `Categorias disponíveis no sistema: ${(data.categoriesAvailable ?? []).join(' | ') || 'sem lista'}\n\n` +
          `Gere nome comercial limpo, descrição (3-5 frases sem inventar especificações), tags, e SEO. ` +
          `Para category_hint, prefira uma das categorias disponíveis se houver match razoável.`,
        'Você é um catalogador de produtos para e-commerce brasileiro. Use APENAS as informações fornecidas. Não invente potência, voltagem, temperatura de cor ou outras specs que não estejam nos dados.',
      );
    } catch (e) {
      console.error('[barcodeLookup] AI standardization failed:', e);
    }

    // Sem fallback de busca externa: se a Cosmos não trouxe imagens, o usuário decide no diálogo
    // entre gerar com IA ou subir manualmente.
    const imagesNote: string | null =
      images.length === 0
        ? 'Nenhuma imagem encontrada na base GTIN. Você pode gerar uma imagem com IA ou subir manualmente.'
        : null;

    const suggested = aiOut
      ? {
          name: aiOut.name || description || null,
          brand: aiOut.brand || brand || null,
          categoryHint: aiOut.category_hint || category || null,
          description: aiOut.description || description || null,
          tags: Array.isArray(aiOut.tags) ? aiOut.tags.filter(Boolean).slice(0, 8) : [],
          seo_title: aiOut.seo_title || null,
          seo_description: aiOut.seo_description || null,
          seo_keywords: aiOut.seo_keywords || null,
          images,
          referencePrice: avg_price ?? max_price ?? null,
        }
      : {
          name: description,
          brand,
          categoryHint: category,
          description,
          tags: [],
          seo_title: null,
          seo_description: null,
          seo_keywords: null,
          images,
          referencePrice: avg_price ?? max_price ?? null,
        };

    return {
      ok: true,
      source: aiOut ? 'cosmos+ai' : 'cosmos',
      confidence: aiOut ? 'high' : 'medium',
      raw: { description, brand, category, ncm, thumbnail, avg_price, max_price, images },
      suggested,
      imagesNote,
    };
  });

function emptySuggestion(): BarcodeLookupResult['suggested'] {
  return {
    name: null,
    brand: null,
    categoryHint: null,
    description: null,
    tags: [],
    seo_title: null,
    seo_description: null,
    seo_keywords: null,
    images: [],
    referencePrice: null,
  };
}

/**
 * Proxy de imagem para contornar CORS quando o browser baixa imagens externas
 * (ex.: thumbnails da Cosmos hospedadas em CDNs sem Access-Control-Allow-Origin).
 * Usado pelo ProductImageManager.addExternalImages.
 */
export const fetchExternalImage = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .inputValidator((input: { url: string }) => input)
  .handler(async ({ data }) => {
    const raw = (data.url ?? '').trim();
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error('URL inválida');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Protocolo não permitido');
    }
    // Bloqueia SSRF: hosts privados, loopback, metadata e tudo fora da allowlist
    if (!isAllowedImageHost(parsed.hostname)) {
      throw new Error(`Host de imagem não permitido: ${parsed.hostname}`);
    }
    // Em produção, exigir HTTPS
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      throw new Error('Em produção apenas HTTPS é permitido');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(parsed.toString(), {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LedMarica-Importer/1.0)' },
        redirect: 'follow',
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Falha ao baixar imagem (${res.status})`);
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/')) throw new Error('URL não é uma imagem');
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 10 * 1024 * 1024) throw new Error('Imagem maior que 10MB');
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      return { base64, contentType, size: buf.byteLength };
    } finally {
      clearTimeout(timeout);
    }
  });

/**
 * Gera uma imagem do produto usando Lovable AI (Gemini image preview).
 */
export const generateProductImage = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .inputValidator((input: { name: string; brand?: string | null; category?: string | null; extraHint?: string | null }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error('LOVABLE_API_KEY não configurada');

    const name = (data.name ?? '').trim();
    if (!name) throw new Error('Nome do produto é obrigatório para gerar imagem');
    const brand = (data.brand ?? '').trim();
    const category = (data.category ?? '').trim();
    const hint = (data.extraHint ?? '').trim();

    const prompt =
      `Foto de produto realista de e-commerce: ${name}` +
      (brand ? `, marca ${brand}` : '') +
      (category ? `, categoria ${category}` : '') +
      (hint ? `. ${hint}` : '') +
      `. Iluminação de estúdio, fundo branco puro, ângulo frontal levemente em perspectiva, ` +
      `nitidez alta, sombra suave, sem texto, sem logo inventado, sem marca d'água, sem pessoas. ` +
      `Estilo catálogo profissional para loja de iluminação e materiais elétricos.`;

    const res = await fetch(AI_IMAGE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3.1-flash-image-preview',
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text'],
      }),
    });

    if (res.status === 429) throw new Error('Limite de requisições da IA atingido. Aguarde alguns instantes.');
    if (res.status === 402) throw new Error('Créditos da IA esgotados. Adicione créditos no workspace.');
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.error('[generateProductImage] error', res.status, t.slice(0, 500));
      throw new Error(`Falha ao gerar imagem (${res.status})`);
    }

    const json = await res.json();
    const url: string | undefined = json?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!url || !url.startsWith('data:image/')) {
      console.error('[generateProductImage] resposta sem imagem:', JSON.stringify(json).slice(0, 500));
      throw new Error('IA não retornou imagem');
    }
    return { dataUrl: url };
  });
