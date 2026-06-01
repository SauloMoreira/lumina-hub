import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  AuthCard,
  FieldLabel,
  FieldError,
  inputClass,
  inputStyle,
  inputFocusHandlers,
  PrimaryButton,
} from "@/components/auth/AuthCard";
import { buildSeo } from "@/lib/seo";
import { translateAuthError } from "@/lib/authErrors";

export const Route = createFileRoute("/reset-password")({
  head: () => buildSeo({ title: "Redefinir senha", url: "/reset-password", noindex: true }),
  component: ResetPasswordPage,
});

const schema = z
  .object({
    password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "As senhas não coincidem",
  });

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Aguarda o Supabase processar o token de recovery presente na URL.
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      // detectSessionInUrl no client.ts já trata o hash.
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session) {
        setReady(true);
        return;
      }
      // Se ainda não veio, escuta o evento PASSWORD_RECOVERY.
      const { data: sub } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          setReady(true);
        }
      });
      // Se em ~3s não validar, mostra erro.
      const t = setTimeout(() => {
        if (mounted && !ready) {
          setLinkError(
            "O link de redefinição é inválido ou expirou. Solicite um novo em 'Esqueci minha senha'.",
          );
        }
      }, 3000);
      return () => {
        sub.subscription.unsubscribe();
        clearTimeout(t);
      };
    };
    void init();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = schema.safeParse({ password, confirm });
    if (!r.success) {
      const es: typeof errors = {};
      r.error.issues.forEach((i) => {
        es[i.path[0] as keyof typeof errors] = i.message;
      });
      setErrors(es);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast.success("Senha redefinida com sucesso!");
      setTimeout(() => navigate({ to: "/conta" }), 1500);
    } catch (err) {
      toast.error(translateAuthError(err, "Não foi possível redefinir a senha."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Redefinir senha"
      subtitle="Escolha uma nova senha de acesso"
      footer={
        <p className="text-center text-[12px] mt-6" style={{ color: "#94A3B8" }}>
          <Link to="/login" className="font-medium" style={{ color: "#1A56DB" }}>
            Voltar para o login
          </Link>
        </p>
      }
    >
      {linkError ? (
        <div
          className="rounded-lg p-4 text-[13px]"
          style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B" }}
        >
          {linkError}
          <div className="mt-3">
            <Link
              to="/esqueci-senha"
              className="font-medium underline"
              style={{ color: "#991B1B" }}
            >
              Solicitar novo link
            </Link>
          </div>
        </div>
      ) : done ? (
        <div
          className="rounded-lg p-4 flex gap-3"
          style={{ backgroundColor: "#ECFDF5", border: "1px solid #A7F3D0" }}
        >
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#059669" }} />
          <div className="text-[13px]" style={{ color: "#065F46" }}>
            Senha redefinida com sucesso. Redirecionando…
          </div>
        </div>
      ) : !ready ? (
        <div className="text-center text-[13px] text-text-faint py-6">
          Validando link de redefinição…
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <FieldLabel htmlFor="password">Nova senha</FieldLabel>
            <div className="relative">
              <input
                id="password"
                type={showPwd ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass + " pr-10"}
                style={inputStyle}
                {...inputFocusHandlers}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint hover:text-foreground"
                aria-label="Mostrar/ocultar senha"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <FieldError message={errors.password} />
          </div>
          <div>
            <FieldLabel htmlFor="confirm">Confirmar nova senha</FieldLabel>
            <input
              id="confirm"
              type={showPwd ? "text" : "password"}
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
              style={inputStyle}
              {...inputFocusHandlers}
            />
            <FieldError message={errors.confirm} />
          </div>
          <div className="pt-2">
            <PrimaryButton loading={loading}>
              {loading ? "Salvando..." : "Redefinir senha"}
            </PrimaryButton>
          </div>
        </form>
      )}
    </AuthCard>
  );
}
