import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "@/integrations/supabase/admin-middleware";

const AI_IMAGE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

/**
 * Gera uma imagem de banner promocional para a home, usando Lovable AI
 * (Gemini image preview). Retorna data URL (base64) que pode ser convertido
 * em File no cliente e enviado pro bucket product-images/banners/.
 */
export const generateBannerImage = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator(
    (input: {
      title: string;
      subtitle?: string | null;
      description?: string | null;
      campaignType?: string | null;
      extraHint?: string | null;
    }) => input,
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const title = (data.title ?? "").trim();
    if (!title) throw new Error("Título é obrigatório para gerar banner");
    const subtitle = (data.subtitle ?? "").trim();
    const description = (data.description ?? "").trim();
    const type = (data.campaignType ?? "promotion").trim();
    const hint = (data.extraHint ?? "").trim();

    const themeHint =
      type === "free_shipping"
        ? "Caminhão de entrega em movimento, ícones de logística, gradiente verde-azulado vibrante."
        : type === "category"
          ? "Composição com produtos elétricos modernos (disjuntores, cabos, ferramentas) elegantemente dispostos."
          : type === "launch"
            ? "Visual de lançamento moderno, brilho difuso, partículas de luz, paleta sofisticada."
            : type === "seasonal"
              ? "Elementos sazonais sutis, paleta temática, ambiente acolhedor e comercial."
              : type === "institutional"
                ? "Visual corporativo limpo, com ícones de confiança, garantia e atendimento."
                : "Lâmpadas LED brilhantes, raios de luz quente, paleta moderna azul profundo com âmbar.";

    const prompt =
      `Banner promocional premium para e-commerce de iluminação e materiais elétricos brasileiro. ` +
      `Tema: "${title}"${subtitle ? `, subtítulo: "${subtitle}"` : ""}${description ? `, contexto: "${description}"` : ""}. ` +
      `${themeHint} ` +
      `IMPORTANTE: o visual deve refletir literalmente o tema, subtítulo e contexto acima — represente os produtos/conceitos mencionados (ex.: se o título cita "lâmpadas LED", mostre lâmpadas LED; se cita "ferramentas", mostre ferramentas; se cita "frete grátis", mostre logística/entrega). ` +
      `Composição: lado esquerdo VAZIO/limpo (espaço negativo) para sobreposição de texto, lado direito com o elemento visual principal. ` +
      `Sem texto algum na imagem, sem logos, sem marcas d'água, sem pessoas. ` +
      `Formato widescreen 1920x768, fotorealista ou ilustração premium moderna, iluminação dramática, qualidade de hero banner de e-commerce de alto padrão. ` +
      (hint ? `Detalhes adicionais: ${hint}.` : "");

    const res = await fetch(AI_IMAGE_URL, {
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
      console.error("[generateBannerImage] error", res.status, t.slice(0, 500));
      throw new Error(`Falha ao gerar imagem (${res.status})`);
    }

    const json = await res.json();
    const url: string | undefined = json?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!url || !/^data:(image\/(jpeg|png|webp|gif));base64,/i.test(url)) {
      console.error("[generateBannerImage] resposta sem imagem válida");
      throw new Error("IA não retornou imagem válida (formato não permitido)");
    }
    return { dataUrl: url };
  });
