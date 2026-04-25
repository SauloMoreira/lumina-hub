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
    const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
    const schedule = w.requestIdleCallback
      ? w.requestIdleCallback(() => setReady(true), { timeout: 2000 })
      : window.setTimeout(() => setReady(true), 1500);
    return () => {
      if (w.requestIdleCallback) (window as any).cancelIdleCallback?.(schedule);
      else clearTimeout(schedule as number);
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
