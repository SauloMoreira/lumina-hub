import { useCookieStore } from '@/stores/cookieStore';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    fbq?: (...args: any[]) => void;
    dataLayer?: any[];
    __LM_PERSONALIZATION?: boolean;
  }
}

export function trackEvent(event: string, data?: Record<string, any>) {
  if (typeof window === 'undefined') return;
  const { preferences, consented } = useCookieStore.getState();
  if (!consented) return;

  if (preferences.analytics && window.gtag) {
    window.gtag('event', event, data);
  }

  if (preferences.marketing && window.fbq) {
    const pixelEvents: Record<string, string> = {
      view_product: 'ViewContent',
      add_to_cart: 'AddToCart',
      begin_checkout: 'InitiateCheckout',
      purchase: 'Purchase',
      search: 'Search',
      lead_captured: 'Lead',
    };
    if (pixelEvents[event]) window.fbq('track', pixelEvents[event], data);
  }
}

export function trackViewProduct(product: {
  id: string;
  name: string;
  price: number;
  sale_price?: number | null;
  category_id?: string | null;
}) {
  trackEvent('view_product', {
    content_type: 'product',
    content_ids: [product.id],
    content_name: product.name,
    content_category: product.category_id ?? undefined,
    value: product.sale_price ?? product.price,
    currency: 'BRL',
  });
}

export function trackAddToCart(
  product: { id: string; name: string; price: number; sale_price?: number | null },
  qty: number
) {
  trackEvent('add_to_cart', {
    content_ids: [product.id],
    content_name: product.name,
    value: (product.sale_price ?? product.price) * qty,
    currency: 'BRL',
    num_items: qty,
  });
}

export function trackBeginCheckout(value: number, numItems: number) {
  trackEvent('begin_checkout', { value, currency: 'BRL', num_items: numItems });
}

export function trackPurchase(order: { order_number?: number | string; total: number; items?: unknown[] }) {
  trackEvent('purchase', {
    transaction_id: order.order_number,
    value: order.total,
    currency: 'BRL',
    num_items: order.items?.length,
  });
}

export function trackSearch(query: string) {
  trackEvent('search', { search_string: query });
}

export function trackLeadCaptured(origin: string) {
  trackEvent('lead_captured', { lead_origin: origin });
}
