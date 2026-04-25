import { Outlet } from '@tanstack/react-router';
import { Header } from './Header';
import { Footer } from './Footer';
import { CartDrawer } from '@/components/store/CartDrawer';
import { Toaster } from '@/components/ui/sonner';

export function StoreLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
      <Toaster position="top-right" richColors />
    </div>
  );
}
