import { Link } from '@tanstack/react-router';
import { Cookie } from 'lucide-react';
import { useCookieStore } from '@/stores/cookieStore';
import { Button } from '@/components/ui/button';

export function CookieBanner() {
  const { consented, showBanner, acceptAll, rejectOptional, openPreferences } = useCookieStore();

  if (consented || !showBanner) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-[60] pointer-events-none"
        aria-hidden
        style={{ animation: 'lm-fadeIn .3s ease-out' }}
      />
      <div
        role="dialog"
        aria-label="Consentimento de cookies"
        className="fixed bottom-0 left-0 right-0 z-[70] bg-card border-t border-border shadow-2xl"
        style={{ animation: 'lm-slideUp .35s cubic-bezier(.16,1,.3,1)' }}
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
            <Button onClick={acceptAll} size="sm" className="w-full">
              Aceitar todos
            </Button>
            <Button onClick={rejectOptional} variant="outline" size="sm" className="w-full">
              Apenas necessários
            </Button>
            <Button onClick={openPreferences} variant="ghost" size="sm" className="w-full">
              Gerenciar cookies
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
