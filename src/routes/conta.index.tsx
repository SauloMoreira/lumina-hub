import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LogOut, User as UserIcon, Package, MapPin, Shield } from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MfaSetup } from "@/components/auth/MfaSetup";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/conta/")({
  component: AccountPage,
});

function AccountPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-full bg-primary-tint flex items-center justify-center">
            <UserIcon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl tracking-tight">
              Olá, {user?.user_metadata?.name ?? user?.email?.split("@")[0] ?? "cliente"}
            </h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Link
            to="/conta/pedidos"
            className="bg-card border border-border rounded-xl p-5 hover:shadow-elevated transition-shadow block"
          >
            <div className="w-10 h-10 rounded-lg bg-primary-tint flex items-center justify-center mb-3">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-display font-semibold mb-0.5">Meus pedidos</h3>
            <p className="text-xs text-muted-foreground">Acompanhe suas compras</p>
          </Link>
          <Link
            to="/conta/enderecos"
            className="bg-card border border-border rounded-xl p-5 hover:shadow-elevated transition-shadow block"
          >
            <div className="w-10 h-10 rounded-lg bg-primary-tint flex items-center justify-center mb-3">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-display font-semibold mb-0.5">Endereços</h3>
            <p className="text-xs text-muted-foreground">Gerencie endereços</p>
          </Link>
          <Link
            to="/conta/dados"
            className="bg-card border border-border rounded-xl p-5 hover:shadow-elevated transition-shadow block"
          >
            <div className="w-10 h-10 rounded-lg bg-primary-tint flex items-center justify-center mb-3">
              <UserIcon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-display font-semibold mb-0.5">Meus dados</h3>
            <p className="text-xs text-muted-foreground">Atualize suas informações</p>
          </Link>
        </div>

        <Card className="mt-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-primary" />
              <h2 className="font-display font-semibold">Segurança</h2>
            </div>
            <MfaSetup />
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-end">
          <Button
            variant="ghost"
            onClick={() => {
              signOut();
              navigate({ to: "/" });
            }}
            className="text-muted-foreground"
          >
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
        </div>
      </div>
    </StoreLayout>
  );
}