import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type UserMfaFactor = { status?: string; factor_type?: string };

function hasVerifiedTotpOnUser(user: unknown) {
  const factors = (user as { factors?: UserMfaFactor[] } | null)?.factors ?? [];
  return factors.some((factor) => factor.factor_type === "totp" && factor.status === "verified");
}

function getAalFromJwt(accessToken?: string) {
  try {
    const payload = accessToken?.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    return (JSON.parse(json) as { aal?: string }).aal ?? null;
  } catch {
    return null;
  }
}

/**
 * Gate do painel admin.
 *
 * Regra (Onda S1):
 *  - Admin sem fator MFA cadastrado → tela bloqueadora pedindo para ativar em /conta.
 *  - Admin com fator cadastrado mas sessão em AAL1 → redireciona para /mfa-challenge.
 *  - Apenas sessão AAL2 libera children.
 */
export function RequireAdminMfa({ children }: { children: React.ReactNode }) {
  const { session, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [hasFactor, setHasFactor] = useState(false);
  const [aal2, setAal2] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!user) {
        if (!cancelled) setChecking(false);
        return;
      }
      try {
        const fallbackHasVerified = hasVerifiedTotpOnUser(user);
        const tokenAal = getAalFromJwt(session?.access_token);
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        const isAal2 = aalData?.currentLevel === "aal2" || tokenAal === "aal2";
        const { data: f } = await supabase.auth.mfa.listFactors();
        const listedFactors = [...(f?.totp ?? []), ...(f?.all ?? [])];
        const hasVerified =
          listedFactors.some((x) => x.factor_type === "totp" && x.status === "verified") ||
          fallbackHasVerified;
        if (cancelled) return;
        setHasFactor(hasVerified);
        setAal2(isAal2);
        if (hasVerified && !isAal2) {
          navigate({
            to: "/mfa-challenge",
            search: { redirect: location.pathname + location.search },
          });
          return;
        }
      } catch {
        if (!cancelled) {
          const hasVerified = hasVerifiedTotpOnUser(user);
          const isAal2 = getAalFromJwt(session?.access_token) === "aal2";
          setHasFactor(hasVerified);
          setAal2(isAal2);
          if (hasVerified && !isAal2) {
            navigate({
              to: "/mfa-challenge",
              search: { redirect: location.pathname + location.search },
            });
          }
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [session?.access_token, user, navigate, location.pathname, location.search]);

  if (authLoading || checking) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasFactor) {
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
                Para acessar o painel administrativo você precisa ativar a autenticação em dois
                fatores (TOTP).
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

  if (!aal2) {
    // Redirect já disparado no effect; renderiza loader enquanto navega.
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
