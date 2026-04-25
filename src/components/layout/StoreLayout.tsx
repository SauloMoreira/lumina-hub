import { Header } from './Header';
import { Footer } from './Footer';
import { CartDrawer } from '@/components/store/CartDrawer';
import { ChatWidgetLazy } from '@/components/store/ChatWidgetLazy';
import { CookieBanner } from '@/components/lgpd/CookieBanner';
import { CookiePreferencesModal } from '@/components/lgpd/CookiePreferencesModal';
import { ConditionalScripts } from '@/components/lgpd/ConditionalScripts';
import { Toaster } from '@/components/ui/sonner';
import type { ReactNode } from 'react';

export function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <CartDrawer />
      <ChatWidgetLazy />
      <CookieBanner />
      <CookiePreferencesModal />
      <ConditionalScripts />
      <Toaster position="top-right" richColors />
    </div>
  );
}
