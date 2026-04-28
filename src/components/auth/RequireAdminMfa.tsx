import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Wrapper de proteção do painel admin: se o usuário admin não tiver
 * MFA verificado, mostra tela bloqueadora pedindo para ativar em /conta.
 *
 * Renderiza children apenas quando há ao menos um fator TOTP verificado.
 */
export function RequireAdminMfa({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [hasMfa, setHasMfa] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!user) { setChecking(false); return; }
      try {
        const { data } = await supabase.auth.mfa.listFactors();
        const verified = [
          ...(data?.totp ?? []),
          ...((data as unknown as { phone?: Array<{ status: string }> })?.phone ?? []),
        ].filter((f) => f.status === 'verified');
        if (!cancelled) setHasMfa(verified.length > 0);
      } catch {
        if (!cancelled) setHasMfa(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    check();
    return () => { cancelled = true; };
  }, [user]);

  if (authLoading || checking) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasMfa) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="max-w-md w-full bg-card border rounded-lg p-6 shadow-sm">
          <div className="flex items-start gap-3 mb-4">
            <ShieldAlert className="w-6 h-6 text-amber-600 mt-0.5" />
            <div>
              <h2 className="font-display text-lg font-semibold">
                MFA obrigatório para administradores
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Para acessar o painel administrativo você precisa ativar a
                autenticação em dois fatores (TOTP).
              </p>
            </div>
          </div>
          <Link
            to="/conta"
            className="inline-flex items-center justify-center w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:brightness-110"
          >
            Ativar MFA agora
          </Link>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Use Google Authenticator, 1Password, Authy ou similar.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
