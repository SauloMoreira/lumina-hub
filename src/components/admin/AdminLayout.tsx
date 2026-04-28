import { useNavigate } from '@tanstack/react-router';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { AdminSidebar } from './AdminSidebar';
import { Toaster } from '@/components/ui/sonner';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import { RequireAdminMfa } from '@/components/auth/RequireAdminMfa';

export function AdminLayout({ children, title, action }: { children: ReactNode; title: string; action?: ReactNode }) {
  const { user, loading } = useAuth();
  const isAdmin = useIsAdmin();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav({ to: '/login' });
    if (isAdmin === false) nav({ to: '/' });
  }, [user, loading, isAdmin, nav]);

  if (loading || isAdmin === null) {
    return <PageSkeleton />;
  }
  if (!user || !isAdmin) return null;

  return (
    <div className="min-h-screen flex bg-muted/30">
      <AdminSidebar />
      <div className="flex-1 min-w-0">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-10">
          <h1 className="font-display text-xl font-semibold tracking-tight">{title}</h1>
          {action}
        </header>
        <main className="p-6">
          <RequireAdminMfa>{children}</RequireAdminMfa>
        </main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
