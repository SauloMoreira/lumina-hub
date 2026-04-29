import { useNavigate } from '@tanstack/react-router';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { AdminSidebar } from './AdminSidebar';
import { Toaster } from '@/components/ui/sonner';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import { RequireAdminMfa } from '@/components/auth/RequireAdminMfa';
import { AdminAlertsBell } from './AdminAlertsBell';

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
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-10 gap-4">
          <h1 className="font-display text-xl font-semibold tracking-tight pl-12 lg:pl-0 truncate">{title}</h1>
          <div className="flex items-center gap-2 shrink-0">
            {action}
            <AdminAlertsBell />
          </div>
        </header>
        <main className="p-6">
          <RequireAdminMfa>{children}</RequireAdminMfa>
        </main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
