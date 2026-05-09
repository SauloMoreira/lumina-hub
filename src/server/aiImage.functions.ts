import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "@/integrations/supabase/admin-middleware";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

/**
 * Gera uma imagem (data URL base64) para produto ou kit/combo,
 * usando Gemini Image Preview através do Lovable AI Gateway.
 *
 * Retorna `dataUrl` que pode ser convertido em arquivo no cliente
 * e enviado ao bucket apropriado.
 */
export const generateProductImage = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator(
    (input: {
      kind: "product" | "bundle";
      name: string;
      brand?: string | null;
      category?: string | null;
      attributes?: string | null;
      hint?: string | null;
    }) => input,
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const name = (data.name ?? "").trim();
    if (!name) throw new Error("Informe o nome para gerar a imagem.");

    const brand = (data.brand ?? "").trim();
    const category = (data.category ?? "").trim();
    const attributes = (data.attributes ?? "").trim();
    const hint = (data.hint ?? "").trim();

    const composition =
      data.kind === "bundle"
        ? "Composição de KIT: vários produtos do mesmo conjunto agrupados elegantemente, dispostos em arranjo organizado, transmitindo ideia de combo/kit completo."
        : "Composição de PRODUTO ÚNICO: o produto ao centro, em destaque, sem elementos competindo.";

    const prompt =
      `Foto de produto premium para e-commerce brasileiro de iluminação e materiais elétricos (Led Maricá). ` +
      `Item: "${name}"${brand ? ` da marca ${brand}` : ""}${category ? `, categoria: ${category}` : ""}. ` +
      (attributes ? `Características técnicas: ${attributes}. ` : "") +
      `${composition} ` +
      `Fundo branco puro liso (#FFFFFF) ou levemente acinzentado (estilo packshot/catálogo), iluminação de estúdio suave e uniforme, sombras realistas e sutis, sem reflexos exagerados. ` +
      `Fotorealista, qualidade profissional de catálogo, foco nítido, cores fiéis. ` +
      `IMPORTANTE: o item visual deve representar literalmente o produto descrito acima — se cita "lâmpada LED bulbo 9W", mostre exatamente esse tipo; se cita "disjuntor", mostre disjuntor; se cita "cabo PP", mostre cabo PP; respeite cor, formato, voltagem/potência mencionada. ` +
      `Formato quadrado 1024x1024. ` +
      `NÃO incluir: texto, logos, marcas d'água, pessoas, mãos, embalagens com escrita, frames, bordas, colagens. ` +
      (hint ? `Detalhes adicionais do administrador: ${hint}.` : "");

    const res = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (res.status === 429)
      throw new Error("Limite de requisições da IA atingido. Aguarde alguns instantes.");
    if (res.status === 402)
      throw new Error("Créditos da IA esgotados. Adicione créditos no workspace.");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("[generateProductImage] error", res.status, t.slice(0, 500));
      throw new Error(`Falha ao gerar imagem (${res.status})`);
    }

    const json = await res.json();
    const url: string | undefined = json?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!url || !url.startsWith("data:image/")) {
      console.error("[generateProductImage] resposta sem imagem");
      throw new Error("IA não retornou imagem");
    }
    return { dataUrl: url };
  });
