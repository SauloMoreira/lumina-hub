import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { AdminSidebar } from "./AdminSidebar";
import { Toaster } from "@/components/ui/sonner";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { RequireAdminMfa } from "@/components/auth/RequireAdminMfa";
import { AdminAlertsBell } from "./AdminAlertsBell";
import { AdminCommandPalette } from "./AdminCommandPalette";
import { Button } from "@/components/ui/button";

export function AdminLayout({
  children,
  title,
  action,
}: {
  children: ReactNode;
  title: string;
  action?: ReactNode;
}) {
  const { user, loading } = useAuth();
  const isAdmin = useIsAdmin();
  const nav = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
    if (isAdmin === false) nav({ to: "/" });
  }, [user, loading, isAdmin, nav]);

  useEffect(() => {
    if (!isAdmin) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isAdmin]);

  if (loading || isAdmin === null) {
    return <PageSkeleton />;
  }
  if (!user || !isAdmin) return null;

  return (
    <div className="min-h-screen flex bg-muted/30">
      <AdminSidebar />
      <div className="flex-1 min-w-0">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-10 gap-4">
          <h1 className="font-display text-xl font-semibold tracking-tight pl-12 lg:pl-0 truncate">
            {title}
          </h1>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaletteOpen(true)}
              className="gap-2 text-muted-foreground hidden sm:inline-flex"
              aria-label="Buscar"
            >
              <Search className="h-4 w-4" />
              <span className="hidden md:inline">Buscar…</span>
              <kbd className="hidden md:inline-flex pointer-events-none ml-2 h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                ⌘K
              </kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              onClick={() => setPaletteOpen(true)}
              aria-label="Buscar"
            >
              <Search className="h-5 w-5" />
            </Button>
            {action}
            <AdminAlertsBell />
          </div>
        </header>
        <main className="p-6">
          <RequireAdminMfa>{children}</RequireAdminMfa>
        </main>
      </div>
      <AdminCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <Toaster position="top-right" richColors />
    </div>
  );
}
