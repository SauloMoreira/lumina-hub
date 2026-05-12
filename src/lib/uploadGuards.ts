// Allowlists e helpers compartilhados para uploads de imagem.
// Exclui propositalmente SVG (XSS via <script>) e qualquer formato executável.
export const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME)[number];

export const ALLOWED_IMAGE_ACCEPT = ALLOWED_IMAGE_MIME.join(",");

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

export function isAllowedImageMime(mime: string | null | undefined): mime is AllowedImageMime {
  if (!mime) return false;
  // normaliza: image/JPEG -> image/jpeg, e remove parâmetros (;charset=...)
  const m = mime.toLowerCase().split(";")[0].trim();
  return (ALLOWED_IMAGE_MIME as readonly string[]).includes(m);
}

export function validateImageFile(file: File): { ok: true } | { ok: false; reason: string } {
  if (!isAllowedImageMime(file.type)) {
    return { ok: false, reason: "Formato inválido. Use JPG, PNG, WebP ou GIF." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, reason: "Arquivo muito grande. Máx 10 MB." };
  }
  // Bloqueia extensão dupla potencialmente perigosa (.svg.jpg, .html.png etc.)
  const lower = file.name.toLowerCase();
  if (/\.(svg|svgz|html?|js|mjs|cjs|php|exe|sh)\b/i.test(lower)) {
    return { ok: false, reason: "Nome de arquivo inválido (extensão não permitida)." };
  }
  return { ok: true };
}

/**
 * Valida e decodifica uma data URL de imagem usando a allowlist segura.
 * Bloqueia SVG, HTML, JS e qualquer MIME fora de jpeg/png/webp/gif.
 */
export function parseSafeImageDataUrl(
  dataUrl: string,
):
  | { ok: true; mime: AllowedImageMime; ext: string; bytes: Uint8Array }
  | { ok: false; reason: string } {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    return { ok: false, reason: "data URL inválida" };
  }
  const m = dataUrl.match(/^data:([^;,]+)(;[^,]*)?,(.+)$/i);
  if (!m) return { ok: false, reason: "data URL malformada" };
  const mime = m[1].toLowerCase().trim();
  const params = (m[2] ?? "").toLowerCase();
  const payload = m[3];
  if (!isAllowedImageMime(mime)) {
    return { ok: false, reason: `Formato de imagem não permitido (${mime}).` };
  }
  if (!params.includes(";base64")) {
    return { ok: false, reason: "Apenas data URLs base64 são aceitas." };
  }
  let bin: string;
  try {
    bin = typeof atob === "function" ? atob(payload) : Buffer.from(payload, "base64").toString("binary");
  } catch {
    return { ok: false, reason: "Falha ao decodificar base64." };
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return { ok: false, reason: "Imagem maior que 10MB." };
  }
  const ext = mime.split("/")[1].replace("jpeg", "jpg");
  return { ok: true, mime: mime as AllowedImageMime, ext, bytes };
}

// Valida URLs em campos editáveis (CTA, link de banner, etc.).
// Bloqueia javascript:, data:, vbscript:, file: e protocolos arbitrários.
export function isSafePublicUrl(raw: string | null | undefined): boolean {
  if (!raw) return true; // vazio é ok
  const v = raw.trim();
  if (!v) return true;
  // permite paths internos
  if (v.startsWith("/") || v.startsWith("#")) return !/[<>"]/.test(v);
  // permite mailto/tel
  if (/^(mailto:|tel:)/i.test(v)) return !/[<>"]/.test(v);
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
