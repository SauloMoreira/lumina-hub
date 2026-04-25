import { Header } from './Header';
import { Footer } from './Footer';
import { CartDrawer } from '@/components/store/CartDrawer';
import { ChatWidget } from '@/components/store/ChatWidget';
import { Toaster } from '@/components/ui/sonner';
import type { ReactNode } from 'react';

export function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <CartDrawer />
      <ChatWidget />
      <Toaster position="top-right" richColors />
    </div>
  );
}
