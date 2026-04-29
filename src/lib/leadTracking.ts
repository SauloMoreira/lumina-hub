/**
 * Captura de origem/UTM dos leads.
 *
 * Estratégia:
 * - Quando o usuário entra no site, capturamos UTMs e referrer e
 *   guardamos em sessionStorage (TTL implícito = sessão do navegador).
 * - Em qualquer formulário que crie lead (contato, cadastro empresa,
 *   chat handoff, negociação B2B), pegamos esses dados via
 *   `getLeadTrackingPayload()` e enviamos para o servidor.
 *
 * Não dependemos de cookies para evitar problemas com LGPD: dados ficam
 * apenas no sessionStorage do próprio usuário e somem ao fechar o browser.
 */

const STORAGE_KEY = 'lead_tracking_v1';

export type LeadTrackingPayload = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  origin_page?: string | null;
  origin_path?: string | null;
  referrer_url?: string | null;
  origin_context?: string | null;
  origin_product_id?: string | null;
  origin_product_name?: string | null;
  origin_category_id?: string | null;
};

function safeWindow() {
  try {
    return typeof window !== 'undefined' ? window : null;
  } catch {
    return null;
  }
}

export function captureTrackingFromCurrentUrl(): void {
  const win = safeWindow();
  if (!win) return;
  try {
    const url = new URL(win.location.href);
    const params = url.searchParams;
    const existing = readStored() ?? {};
    const next: LeadTrackingPayload = { ...existing };

    // UTMs — só atualiza se vierem na URL atual (preserva primeira atribuição)
    const utm_source = params.get('utm_source');
    const utm_medium = params.get('utm_medium');
    const utm_campaign = params.get('utm_campaign');
    const utm_term = params.get('utm_term');
    const utm_content = params.get('utm_content');
    if (utm_source) next.utm_source = utm_source.slice(0, 200);
    if (utm_medium) next.utm_medium = utm_medium.slice(0, 200);
    if (utm_campaign) next.utm_campaign = utm_campaign.slice(0, 200);
    if (utm_term) next.utm_term = utm_term.slice(0, 200);
    if (utm_content) next.utm_content = utm_content.slice(0, 200);

    // Página/path mais recente
    next.origin_page = (win.location.origin + win.location.pathname).slice(0, 500);
    next.origin_path = win.location.pathname.slice(0, 500);

    // Referrer apenas na primeira visita
    if (!existing.referrer_url) {
      const ref = win.document?.referrer || '';
      if (ref) next.referrer_url = ref.slice(0, 500);
    }

    win.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* silencioso */
  }
}

function readStored(): LeadTrackingPayload | null {
  const win = safeWindow();
  if (!win) return null;
  try {
    const raw = win.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LeadTrackingPayload) : null;
  } catch {
    return null;
  }
}

export function getLeadTrackingPayload(
  override?: Partial<LeadTrackingPayload>,
): LeadTrackingPayload {
  const stored = readStored() ?? {};
  return { ...stored, ...(override ?? {}) };
}

/** Atualiza contexto de origem específico (ex.: visita de produto). */
export function setOriginContext(ctx: {
  context?: string;
  productId?: string;
  productName?: string;
  categoryId?: string;
}): void {
  const win = safeWindow();
  if (!win) return;
  try {
    const existing = readStored() ?? {};
    const next: LeadTrackingPayload = {
      ...existing,
      origin_context: ctx.context ?? existing.origin_context ?? null,
      origin_product_id: ctx.productId ?? existing.origin_product_id ?? null,
      origin_product_name: ctx.productName ?? existing.origin_product_name ?? null,
      origin_category_id: ctx.categoryId ?? existing.origin_category_id ?? null,
    };
    win.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* silencioso */
  }
}
