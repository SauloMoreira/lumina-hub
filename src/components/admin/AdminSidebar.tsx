import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import {
  LayoutDashboard,
  Package,
  Tags,
  ShoppingBag,
  Ticket,
  Users,
  Megaphone,
  Image as ImageIcon,
  LogOut,
  Store,
  FileText,
  Building2,
  Mail,
  Shield,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo-navbar.png';
import { cn } from '@/lib/utils';

const items: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/admin/produtos', label: 'Produtos', icon: Package },
  { to: '/admin/categorias', label: 'Categorias', icon: Tags },
  { to: '/admin/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { to: '/admin/cupons', label: 'Cupons', icon: Ticket },
  { to: '/admin/leads', label: 'Leads', icon: Users },
  { to: '/admin/campanhas', label: 'Campanhas', icon: Megaphone },
  { to: '/admin/banners', label: 'Banners', icon: ImageIcon },
  { to: '/admin/institutional-pages', label: 'Páginas', icon: FileText },
  { to: '/admin/contact-messages', label: 'Mensagens', icon: Mail },
  { to: '/admin/settings/company', label: 'Empresa', icon: Building2 },
];

export function AdminSidebar() {
  const loc = useLocation();
  const nav = useNavigate();
  const path = loc.pathname;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    nav({ to: '/login' });
  };

  return (
    <aside className="w-60 shrink-0 bg-card border-r border-border flex flex-col h-screen sticky top-0">
      <div className="h-16 px-4 flex items-center border-b border-border">
        <Link to={'/admin' as any} className="flex items-center gap-2">
          <img src={logo} alt="Led Maricá" className="h-8 w-auto" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin</span>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {items.map((it) => {
          const active = it.exact ? path === it.to : path.startsWith(it.to);
          return (
            <Link
              key={it.to}
              to={it.to as any}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <it.icon className="w-4 h-4" />
              {it.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border space-y-1">
        <Link
          to="/"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Store className="w-4 h-4" /> Ver loja
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </div>
    </aside>
  );
}
