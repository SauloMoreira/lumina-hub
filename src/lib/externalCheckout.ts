export function reserveExternalCheckoutWindow(): Window | null {
  if (typeof window === 'undefined') return null;

  const popup = window.open('', '_blank');
  if (!popup) return null;

  try {
    popup.document.title = 'Abrindo Mercado Pago';
    popup.document.body.textContent = 'Abrindo Mercado Pago...';
  } catch {
    // Ignore browser restrictions and still use the reserved tab if available.
  }

  return popup;
}

export function redirectToExternalCheckout(url: string, popup?: Window | null) {
  if (typeof window === 'undefined') return;

  if (popup && !popup.closed) {
    try {
      popup.opener = null;
      popup.location.assign(url);
      popup.focus();
      return;
    } catch {
      // Fall through to a regular external open.
    }
  }

  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (opened) {
    try {
      opened.opener = null;
      opened.focus();
    } catch {
      // No-op.
    }
    return;
  }

  try {
    if (window.top && window.top !== window.self) {
      window.top.location.href = url;
      return;
    }
  } catch {
    // Cross-origin frame restrictions can block top navigation.
  }

  window.location.href = url;
}

export function closeReservedCheckoutWindow(popup?: Window | null) {
  if (!popup || popup.closed) return;
  try {
    popup.close();
  } catch {
    // No-op.
  }
}
