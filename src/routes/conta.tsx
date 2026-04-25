import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { LogOut, User as UserIcon, Package, MapPin } from 'lucide-react';
import { StoreLayout } from '@/components/layout/StoreLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

export const Route = createFileRoute('/conta')({ component: AccountPage });

function AccountPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: '/login' });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return <StoreLayout><div className="container mx-auto px-4 py-12 text-center text-muted-foreground">Carregando...</div></StoreLayout>;
  }

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-full bg-primary-tint flex items-center justify-center">
            <UserIcon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl tracking-tight">Olá, {user.user_metadata.name ?? user.email?.split('@')[0]}</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: Package, title: 'Meus pedidos', desc: 'Acompanhe suas compras', to: '/conta/pedidos' as const },
            { icon: MapPin, title: 'Endereços', desc: 'Gerencie endereços', to: '/conta' as const },
            { icon: UserIcon, title: 'Meus dados', desc: 'Atualize suas informações', to: '/conta' as const },
          ].map((item) => (
            <Link key={item.title} to={item.to} className="bg-card border border-border rounded-xl p-5 hover:shadow-elevated transition-shadow block">
              <div className="w-10 h-10 rounded-lg bg-primary-tint flex items-center justify-center mb-3">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display font-semibold mb-0.5">{item.title}</h3>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </Link>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="ghost" onClick={() => { signOut(); navigate({ to: '/' }); }} className="text-muted-foreground">
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
        </div>
      </div>
    </StoreLayout>
  );
}
