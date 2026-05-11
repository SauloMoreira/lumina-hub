import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard, FieldLabel, inputClass, inputStyle, inputFocusHandlers, PrimaryButton } from "@/components/auth/AuthCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buildSeo } from "@/lib/seo";

export const Route = createFileRoute("/mfa-challenge")({
  head: () => buildSeo({ title: "Verificação em duas etapas", url: "/mfa-challenge", noindex: true }),
  validateSearch: (s: Record<string, unknown>): { redirect?: string } =>
    typeof s.redirect === "string" ? { redirect: s.redirect } : {},
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: MfaChallengePage,
});

function MfaChallengePage() {
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noFactor, setNoFactor] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalData?.currentLevel === "aal2") {
          navigate({ to: (redirectTo || "/admin") as never });
          return;
        }
        const { data, error: fErr } = await supabase.auth.mfa.listFactors();
        if (fErr) throw fErr;
        const totp = (data?.totp ?? []).find((f) => f.status === "verified");
        if (!totp) {
          setNoFactor(true);
        } else {
          setFactorId(totp.id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao iniciar verificação MFA");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, redirectTo]);

  const handleVerify = async () => {
    if (!factorId || code.length !== 6 || verifying) return;
    setVerifying(true);
    setError(null);
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: ch.id,
        code,
      });
      if (vErr) throw vErr;
      toast.success("Verificação concluída.");
      navigate({ to: (redirectTo || "/admin") as never });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Código inválido";
      setError(msg);
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (noFactor) {
    return (
      <AuthCard title="Configure o MFA" subtitle="Você precisa cadastrar um fator TOTP antes de continuar.">
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Sua conta não tem MFA configurado.</AlertDescription>
        </Alert>
        <Link
          to="/conta"
          className="inline-flex items-center justify-center w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:brightness-110"
        >
          Ir para Minha conta e ativar MFA
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Verificação em duas etapas"
      subtitle="Digite o código de 6 dígitos do seu app autenticador."
    >
      <div className="flex justify-center mb-4">
        <ShieldCheck className="w-10 h-10 text-emerald-600" />
      </div>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <FieldLabel htmlFor="otp">Código TOTP</FieldLabel>
      <input
        id="otp"
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => {
          setError(null);
          setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && code.length === 6) {
            e.preventDefault();
            void handleVerify();
          }
        }}
        placeholder="000000"
        className={inputClass + " font-mono text-center tracking-[0.5em] text-lg"}
        style={inputStyle}
        {...inputFocusHandlers}
      />
      <div className="mt-6">
        <PrimaryButton
          type="button"
          loading={verifying}
          onClick={() => void handleVerify()}
          disabled={code.length !== 6}
        >
          {verifying ? "Verificando..." : "Verificar"}
        </PrimaryButton>
      </div>
      <button
        type="button"
        onClick={async () => {
          await supabase.auth.signOut();
          navigate({ to: "/login" });
        }}
        className="mt-4 text-xs text-muted-foreground hover:text-foreground w-full text-center"
      >
        Cancelar e sair
      </button>
    </AuthCard>
  );
}
