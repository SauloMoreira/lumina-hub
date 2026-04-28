import { lazy, Suspense, useEffect, useState } from 'react';

const CookieBanner = lazy(() =>
  import('@/components/lgpd/CookieBanner').then((module) => ({ default: module.CookieBanner }))
);
const CookiePreferencesModal = lazy(() =>
  import('@/components/lgpd/CookiePreferencesModal').then((module) => ({ default: module.CookiePreferencesModal }))
);
const ConditionalScripts = lazy(() =>
  import('@/components/lgpd/ConditionalScripts').then((module) => ({ default: module.ConditionalScripts }))
);

export function LgpdLayer() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const activate = () => setEnabled(true);

    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(activate, { timeout: 1200 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = window.setTimeout(activate, 500);
    return () => window.clearTimeout(timeoutId);
  }, []);

  if (!enabled) return null;

  return (
    <Suspense fallback={null}>
      <CookieBanner />
      <CookiePreferencesModal />
      <ConditionalScripts />
    </Suspense>
  );
}