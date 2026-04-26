/**
 * Converte uma URL pública do Supabase Storage para a versão otimizada
 * via /render/image (WebP + resize + cache CDN).
 *
 * Se a URL já for /render/image, mantém. Se for externa, retorna como veio.
 */
export function optimizeBannerUrl(
  url: string | null | undefined,
  opts: { width: number; quality?: number },
): string {
  if (!url) return '';
  // Já está sendo servido pelo render endpoint
  if (url.includes('/storage/v1/render/image/')) return url;
  // Não é Supabase Storage
  if (!url.includes('/storage/v1/object/public/')) return url;
  const rendered = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  const sep = rendered.includes('?') ? '&' : '?';
  const q = opts.quality ?? 78;
  return `${rendered}${sep}width=${opts.width}&quality=${q}&format=webp&resize=cover`;
}
