import { lazy, Suspense, useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';

const ChatWidget = lazy(() =>
  import('./ChatWidget').then((m) => ({ default: m.ChatWidget })),
);

/**
 * Defer mounting ChatWidget until after first paint + idle so it doesn't
 * block hydration. Shows a lightweight floating button placeholder meanwhile.
 */
export function ChatWidgetLazy() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const hasRic = typeof window.requestIdleCallback === 'function';
    const handle: number = hasRic
      ? window.requestIdleCallback(() => setReady(true), { timeout: 2000 })
      : (window.setTimeout(() => setReady(true), 1500) as unknown as number);
    return () => {
      if (hasRic && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(handle);
      } else {
        clearTimeout(handle);
      }
    };
  }, []);

  if (!ready) {
    return (
      <button
        aria-label="Abrir chat"
        onClick={() => setReady(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <Suspense fallback={null}>
      <ChatWidget />
    </Suspense>
  );
}
