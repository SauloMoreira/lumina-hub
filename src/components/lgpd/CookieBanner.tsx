import { useState, useRef } from 'react';
import { Link } from '@tanstack/react-router';
import { Cookie, Loader2 } from 'lucide-react';
import { useCookieStore } from '@/stores/cookieStore';
import { Button } from '@/components/ui/button';

type PendingAction = 'accept' | 'reject' | 'manage' | null;

export function CookieBanner() {
  const { consented, showBanner, acceptAll, rejectOptional, openPreferences } = useCookieStore();
  const [closing, setClosing] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const lockRef = useRef(false);

  if (consented || !showBanner) return null;

  const handleChoice = (action: 'accept' | 'reject') => {
    if (lockRef.current) return;
    lockRef.current = true;
    setPending(action);
    setClosing(true);

    // Atualização otimista: persiste a escolha imediatamente.
    // O banner já está em animação de saída por causa de `closing`.
    try {
      if (action === 'accept') acceptAll();
      else rejectOptional();
    } catch (err) {
      if (import.meta.env.DEV) console.error('[CookieBanner] erro ao salvar consentimento:', err);
      // Fallback: garante o unmount mesmo se o store falhar.
      window.setTimeout(() => {
        setClosing(false);
        setPending(null);
        lockRef.current = false;
      }, 250);
    }
  };

  const handleManage = () => {
    if (lockRef.current) return;
    setPending('manage');
    // Abre o painel imediatamente — sem animação de saída do banner.
    try {
      openPreferences();
    } catch (err) {
      if (import.meta.env.DEV) console.error('[CookieBanner] erro ao abrir preferências:', err);
    } finally {
      // Reseta o estado visual logo após (modal tomará foco).
      window.setTimeout(() => setPending(null), 200);
    }
  };

  const disabled = pending !== null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-[60] pointer-events-none transition-opacity duration-200 ease-out"
        aria-hidden
        style={{
          animation: closing ? undefined : 'lm-fadeIn .3s ease-out',
          opacity: closing ? 0 : 1,
        }}
      />
      <div
        role="dialog"
        aria-label="Consentimento de cookies"
        aria-busy={disabled}
        className="fixed bottom-0 left-0 right-0 z-[70] bg-card border-t border-border shadow-2xl transition-transform duration-200 ease-out"
        style={{
          animation: closing ? undefined : 'lm-slideUp .35s cubic-bezier(.16,1,.3,1)',
          transform: closing ? 'translateY(100%)' : 'translateY(0)',
        }}
      >
        <div className="container mx-auto px-4 py-5 grid lg:grid-cols-[1fr_auto] gap-5 items-center">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Cookie className="w-5 h-5 text-primary" />
              <h2 className="font-display font-semibold text-base">Privacidade e cookies</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
              A Led Maricá utiliza cookies para melhorar sua experiência, personalizar recomendações,
              analisar tráfego e exibir publicidade relevante. Ao clicar em <strong>Aceitar todos</strong>,
              você concorda com o uso conforme nossa{' '}
              <Link to="/privacidade" className="text-primary underline hover:opacity-80">
                Política de Privacidade
              </Link>{' '}
              e a <strong>LGPD (Lei 13.709/2018)</strong>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-2 lg:min-w-[200px]">
            <Button
              onClick={() => handleChoice('accept')}
              size="sm"
              className="w-full active:scale-[.98] transition-transform"
              disabled={disabled}
              aria-busy={pending === 'accept'}
            >
              {pending === 'accept' ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Salvando…</>
              ) : (
                'Aceitar todos'
              )}
            </Button>
            <Button
              onClick={() => handleChoice('reject')}
              variant="outline"
              size="sm"
              className="w-full active:scale-[.98] transition-transform"
              disabled={disabled}
              aria-busy={pending === 'reject'}
            >
              {pending === 'reject' ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Salvando…</>
              ) : (
                'Apenas necessários'
              )}
            </Button>
            <Button
              onClick={handleManage}
              variant="ghost"
              size="sm"
              className="w-full active:scale-[.98] transition-transform"
              disabled={disabled}
              aria-busy={pending === 'manage'}
            >
              {pending === 'manage' ? 'Abrindo…' : 'Gerenciar cookies'}
            </Button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes lm-slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes lm-fadeIn  { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </>
  );
}
