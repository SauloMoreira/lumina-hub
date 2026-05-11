// Allowlists e helpers compartilhados para uploads de imagem.
// Exclui propositalmente SVG (XSS via <script>) e qualquer formato executável.
export const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const ALLOWED_IMAGE_ACCEPT = ALLOWED_IMAGE_MIME.join(",");

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

export function validateImageFile(file: File): { ok: true } | { ok: false; reason: string } {
  if (!ALLOWED_IMAGE_MIME.includes(file.type as (typeof ALLOWED_IMAGE_MIME)[number])) {
    return { ok: false, reason: "Formato inválido. Use JPG, PNG, WebP ou GIF." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, reason: "Arquivo muito grande. Máx 10 MB." };
  }
  return { ok: true };
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
