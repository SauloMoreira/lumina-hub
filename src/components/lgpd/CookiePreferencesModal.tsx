import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { useCookieStore, type CookiePreferences } from "@/stores/cookieStore";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type CategoryKey = keyof CookiePreferences;

const COOKIE_CATEGORIES: Array<{
  key: CategoryKey;
  name: string;
  description: string;
  cookies: { name: string; purpose: string; duration: string; provider: string }[];
  locked: boolean;
}> = [
  {
    key: "necessary",
    name: "Cookies necessários",
    description:
      "Essenciais para o funcionamento do site. Incluem autenticação, carrinho, segurança e preferências de sessão. Não podem ser desativados.",
    cookies: [
      {
        name: "lm-auth-token",
        purpose: "Sessão de login",
        duration: "Sessão",
        provider: "Supabase",
      },
      {
        name: "led-marica-cart",
        purpose: "Itens do carrinho",
        duration: "30 dias",
        provider: "Led Maricá",
      },
      {
        name: "lm-cookie-consent",
        purpose: "Preferências de consentimento",
        duration: "365 dias",
        provider: "Led Maricá",
      },
    ],
    locked: true,
  },
  {
    key: "analytics",
    name: "Cookies de análise e desempenho",
    description:
      "Ajudam a entender como os visitantes interagem com o site. Dados coletados de forma anônima e agregada.",
    cookies: [
      {
        name: "_ga / _ga_*",
        purpose: "Google Analytics — medição de tráfego",
        duration: "2 anos",
        provider: "Google",
      },
      {
        name: "_clck / _clsk",
        purpose: "Microsoft Clarity — mapa de calor",
        duration: "1 ano",
        provider: "Microsoft",
      },
    ],
    locked: false,
  },
  {
    key: "marketing",
    name: "Cookies de marketing e publicidade",
    description:
      "Utilizados para exibir anúncios relevantes com base nos seus interesses e medir a eficácia das campanhas.",
    cookies: [
      {
        name: "_fbp / _fbc",
        purpose: "Meta Pixel — rastreamento de conversões",
        duration: "90 dias",
        provider: "Meta",
      },
      {
        name: "_gcl_*",
        purpose: "Google Ads — atribuição de conversão",
        duration: "90 dias",
        provider: "Google",
      },
    ],
    locked: false,
  },
  {
    key: "personalization",
    name: "Cookies de personalização",
    description:
      "Permitem lembrar suas preferências e oferecer recomendações com base no histórico de navegação e chat com IA.",
    cookies: [
      {
        name: "lm-recent-views",
        purpose: "Produtos vistos recentemente",
        duration: "30 dias",
        provider: "Led Maricá",
      },
      {
        name: "lm-ai-prefs",
        purpose: "Preferências do chat com IA",
        duration: "90 dias",
        provider: "Led Maricá",
      },
    ],
    locked: false,
  },
];

export function CookiePreferencesModal() {
  const { showPreferences, preferences, savePreferences, closePreferences, acceptAll } =
    useCookieStore();
  const [local, setLocal] = useState<CookiePreferences>({ ...preferences });
  const [expanded, setExpanded] = useState<CategoryKey | null>(null);

  useEffect(() => {
    if (showPreferences) setLocal({ ...preferences });
  }, [showPreferences, preferences]);

  if (!showPreferences) return null;

  const toggle = (key: CategoryKey) => {
    if (key === "necessary") return;
    setLocal((p) => ({ ...p, [key]: !p[key] }));
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-[80]"
        onClick={closePreferences}
        style={{ animation: "lm-fadeIn .2s ease-out" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Preferências de cookies"
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[90] w-[min(720px,95vw)] max-h-[90vh] bg-card rounded-xl shadow-2xl border border-border flex flex-col"
        style={{ animation: "lm-modalIn .25s cubic-bezier(.16,1,.3,1)" }}
      >
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-display font-bold text-lg">Preferências de cookies</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              LGPD — Lei 13.709/2018 · Você pode alterar a qualquer momento
            </p>
          </div>
          <button
            onClick={closePreferences}
            className="w-8 h-8 rounded-md hover:bg-surface flex items-center justify-center text-muted-foreground"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-3 flex-1">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Escolha quais categorias de cookies deseja permitir. Os necessários não podem ser
            desativados. Para detalhes, consulte nossa{" "}
            <Link to="/privacidade" className="text-primary underline">
              Política de Privacidade
            </Link>
            .
          </p>

          {COOKIE_CATEGORIES.map((cat) => {
            const isOn = local[cat.key];
            const isExpanded = expanded === cat.key;

            return (
              <div key={cat.key} className="border border-border rounded-lg p-4 bg-background/40">
                <div className="flex items-start gap-4">
                  <Switch
                    checked={isOn}
                    onCheckedChange={() => toggle(cat.key)}
                    disabled={cat.locked}
                    aria-label={cat.name}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-sm">{cat.name}</h3>
                      {cat.locked && (
                        <span className="text-[10px] uppercase tracking-wider bg-primary-tint text-primary px-2 py-0.5 rounded">
                          Sempre ativo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {cat.description}
                    </p>
                    <button
                      onClick={() => setExpanded(isExpanded ? null : cat.key)}
                      className="text-xs text-primary hover:underline mt-2 inline-flex items-center gap-1"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                      {isExpanded ? "Ocultar cookies" : "Ver cookies desta categoria"}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b border-border">
                          <th className="py-2 pr-2 font-medium">Cookie</th>
                          <th className="py-2 pr-2 font-medium">Finalidade</th>
                          <th className="py-2 pr-2 font-medium">Duração</th>
                          <th className="py-2 font-medium">Provedor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cat.cookies.map((c) => (
                          <tr key={c.name} className="border-b border-border/50 last:border-0">
                            <td className="py-2 pr-2 font-mono text-[11px]">{c.name}</td>
                            <td className="py-2 pr-2 text-muted-foreground">{c.purpose}</td>
                            <td className="py-2 pr-2 text-muted-foreground">{c.duration}</td>
                            <td className="py-2 text-muted-foreground">{c.provider}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 p-5 border-t border-border">
          <Button onClick={() => savePreferences(local)} variant="outline" className="flex-1">
            Salvar preferências
          </Button>
          <Button onClick={acceptAll} className="flex-1">
            Aceitar todos
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes lm-modalIn {
          from { opacity: 0; transform: translate(-50%,-50%) scale(.96) }
          to   { opacity: 1; transform: translate(-50%,-50%) scale(1) }
        }
      `}</style>
    </>
  );
}
