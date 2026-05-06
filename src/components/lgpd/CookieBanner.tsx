import { useState, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Cookie, Loader2 } from "lucide-react";
import { useCookieStore } from "@/stores/cookieStore";
import { Button } from "@/components/ui/button";

type PendingAction = "accept" | "reject" | "manage" | null;

export function CookieBanner() {
  const { consented, showBanner, acceptAll, rejectOptional, openPreferences } = useCookieStore();
  // Estado local de visibilidade — fecha INSTANTANEAMENTE no primeiro clique,
  // sem depender de re-render do store.
  const [hiddenLocal, setHiddenLocal] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const lockRef = useRef(false);

  if (consented || !showBanner || hiddenLocal) return null;

  const handleChoice = (action: "accept" | "reject") => {
    // Lock síncrono: primeiro clique vence; demais são ignorados.
    if (lockRef.current) return;
    lockRef.current = true;

    // 1) Feedback visual + animação de saída IMEDIATOS.
    setPending(action);
    setClosing(true);

    // 2) Persiste a escolha (síncrono — zustand+persist grava em localStorage).
    try {
      if (action === "accept") acceptAll();
      else rejectOptional();
    } catch (err) {
      if (import.meta.env.DEV) console.error("[CookieBanner] erro ao salvar consentimento:", err);
    }

    // 3) Garante o unmount do banner ao fim da animação,
    // independentemente do store.
    window.setTimeout(() => setHiddenLocal(true), 220);
  };

  const handleManage = () => {
    if (lockRef.current) return;
    setPending("manage");
    try {
      openPreferences();
    } catch (err) {
      if (import.meta.env.DEV) console.error("[CookieBanner] erro ao abrir preferências:", err);
    } finally {
      window.setTimeout(() => setPending(null), 200);
    }
  };

  const disabled = pending !== null;

  return (
    <div
      role="dialog"
      aria-label="Consentimento de cookies"
      aria-busy={disabled}
      className="fixed bottom-2 left-2 right-2 z-[70] mx-auto max-w-5xl rounded-lg bg-card border border-border shadow-2xl transition-transform duration-150 ease-out md:bottom-5 md:left-5 md:right-5"
      style={{
        animation: closing ? undefined : "lm-slideUp .35s cubic-bezier(.16,1,.3,1)",
        transform: closing ? "translateY(calc(100% + 24px))" : "translateY(0)",
        pointerEvents: closing ? "none" : "auto",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="px-3 py-3 sm:px-4 sm:py-4 grid lg:grid-cols-[1fr_auto] gap-3 sm:gap-4 items-center">
        <div className="space-y-1.5 sm:space-y-2 min-w-0">
          <div className="flex items-center gap-2">
            <Cookie className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
            <h2 className="font-display font-semibold text-sm sm:text-base">
              Privacidade e cookies
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-3xl line-clamp-3 sm:line-clamp-none">
            A Led Maricá utiliza cookies para melhorar sua experiência, personalizar recomendações e
            analisar tráfego. Ao clicar em <strong>Aceitar todos</strong>, você concorda com nossa{" "}
            <Link to="/privacidade" className="text-primary underline hover:opacity-80">
              Política de Privacidade
            </Link>{" "}
            e a <strong>LGPD</strong>.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col gap-2 lg:min-w-[200px] w-full">
          <Button
            onClick={() => handleChoice("accept")}
            size="sm"
            className="w-full active:scale-[.98] transition-transform"
            disabled={disabled}
            aria-busy={pending === "accept"}
          >
            {pending === "accept" ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Salvando…
              </>
            ) : (
              "Aceitar todos"
            )}
          </Button>
          <Button
            onClick={() => handleChoice("reject")}
            variant="outline"
            size="sm"
            className="w-full active:scale-[.98] transition-transform"
            disabled={disabled}
            aria-busy={pending === "reject"}
          >
            {pending === "reject" ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Salvando…
              </>
            ) : (
              "Apenas necessários"
            )}
          </Button>
          <Button
            onClick={handleManage}
            variant="ghost"
            size="sm"
            className="w-full active:scale-[.98] transition-transform"
            disabled={disabled}
            aria-busy={pending === "manage"}
          >
            {pending === "manage" ? "Abrindo…" : "Gerenciar cookies"}
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes lm-slideUp { from { transform: translateY(calc(100% + 24px)) } to { transform: translateY(0) } }
      `}</style>
    </div>
  );
}
