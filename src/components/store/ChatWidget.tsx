import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useServerFn } from "@tanstack/react-start";
import { chatWithAI, loadChatHistory } from "@/server/chat.functions";
import { requestHumanHandoff } from "@/server/leadHandoff.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trackLeadCaptured } from "@/lib/tracking";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

type HandoffStep = "idle" | "offer" | "form" | "ready";

const SESSION_KEY = "ledm_chat_session";
const STORAGE_KEY = "ledm_chat_open";

const HUMAN_TRIGGERS = [
  "humano",
  "atendente",
  "vendedor",
  "vendedora",
  "consultor",
  "consultora",
  "pessoa de verdade",
  "alguém da equipe",
  "alguem da equipe",
  "whatsapp",
  "whats",
  "zap",
  "falar com alguém",
  "falar com alguem",
  "atendimento humano",
  "quero falar",
  "conectar com atendente",
  "conectar com um atendente",
  "conectar com humano",
  "transferir",
  "encaminhar para atendimento",
];

// Frases que a IA pode soltar pedindo dados de contato em texto livre.
// Quando detectadas, abrimos o formulário inline automaticamente.
const AI_ASKS_CONTACT_PATTERNS: RegExp[] = [
  /informe seu\s+(nome|telefone|whatsapp|e-?mail)/i,
  /me passa(r)?\s+seu\s+(nome|telefone|whatsapp|e-?mail)/i,
  /me informe\s+seu\s+(nome|telefone|whatsapp|e-?mail)/i,
  /seu\s+nome.*(telefone|whatsapp|e-?mail)/i,
  /(nome|telefone|whatsapp).*para que.*(equipe|atendente|contato)/i,
  /conectar (com|com um|você com).*(atendente|humano)/i,
];

function detectHumanRequest(text: string): boolean {
  const t = text.toLowerCase();
  return HUMAN_TRIGGERS.some((k) => t.includes(k));
}

function aiAskedForContact(text: string): boolean {
  return AI_ASKS_CONTACT_PATTERNS.some((re) => re.test(text));
}

function formatPhoneBR(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function getOrCreateSession(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `s_${crypto.randomUUID()}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

const WELCOME: Msg = {
  role: "assistant",
  content:
    "Olá! Sou o assistente da **Led Maricá** ⚡\n\nPosso te ajudar a encontrar produtos, tirar dúvidas técnicas ou fazer um orçamento. Como posso ajudar?",
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  // Handoff state
  const [handoffStep, setHandoffStep] = useState<HandoffStep>("idle");
  const [handoffName, setHandoffName] = useState("");
  const [handoffPhone, setHandoffPhone] = useState("");
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const chat = useServerFn(chatWithAI);
  const loadHistory = useServerFn(loadChatHistory);
  const handoff = useServerFn(requestHumanHandoff);

  useEffect(() => {
    const sid = getOrCreateSession();
    setSessionId(sid);
    setOpen(localStorage.getItem(STORAGE_KEY) === "1");
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const openHandler = () => {
      setOpen(true);
      localStorage.setItem(STORAGE_KEY, "1");
    };
    window.addEventListener("open-chat", openHandler);
    return () => window.removeEventListener("open-chat", openHandler);
  }, []);

  useEffect(() => {
    if (!open || !sessionId) return;
    loadHistory({ data: { sessionId } })
      .then((res) => {
        if (res.messages.length > 0) {
          setMessages(res.messages.map((m: any) => ({ role: m.role, content: m.content })));
        }
      })
      .catch(() => {});
  }, [open, sessionId, loadHistory]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, handoffStep]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  };

  const startHandoffOffer = () => {
    setHandoffStep("offer");
    setMessages((p) => [
      ...p,
      {
        role: "assistant",
        content:
          "Claro, posso te encaminhar para um atendente pelo WhatsApp.\n\nAntes disso, se quiser, eu também consigo te ajudar por aqui com dúvidas sobre produtos, preços, comparações, frete, formas de pagamento, troca, devolução e acompanhamento de pedido.\n\n**Como prefere seguir?**",
      },
    ]);
  };

  const handleContinueHere = () => {
    setHandoffStep("idle");
    setMessages((p) => [
      ...p,
      { role: "user", content: "Pode tentar me ajudar por aqui." },
      {
        role: "assistant",
        content: "Combinado! Me conta sua dúvida que eu te ajudo. 👇",
      },
    ]);
  };

  const handleWantWhatsapp = () => {
    setHandoffStep("form");
    setHandoffError(null);
    setMessages((p) => [
      ...p,
      { role: "user", content: "Quero ir para o WhatsApp." },
      {
        role: "assistant",
        content:
          "Perfeito. Para encaminhar seu atendimento, me informe seu **nome** e **telefone com WhatsApp**.\n\n_Usaremos esses dados apenas para registrar seu atendimento e facilitar o retorno da nossa equipe._",
      },
    ]);
  };

  const submitHandoff = async () => {
    setHandoffError(null);
    const trimmedName = handoffName.trim();
    const digits = handoffPhone.replace(/\D/g, "");
    if (trimmedName.length < 2 || /^\d+$/.test(trimmedName)) {
      setHandoffError("Informe um nome válido.");
      return;
    }
    if (digits.length < 10 || digits.length > 11) {
      setHandoffError("Telefone inválido. Use DDD + número (10 ou 11 dígitos).");
      return;
    }
    setHandoffLoading(true);
    try {
      const res = await handoff({
        data: {
          name: trimmedName,
          phone: digits,
          sessionId,
          pageUrl: typeof window !== "undefined" ? window.location.href : null,
        },
      });
      setWhatsappUrl(res.whatsappUrl);
      setHandoffStep("ready");
      trackLeadCaptured("chat_handoff");
      setMessages((p) => [
        ...p,
        {
          role: "assistant",
          content: res.leadSaved
            ? `Pronto, **${trimmedName}**! Registrei seu atendimento e vou te encaminhar para o WhatsApp com um resumo da nossa conversa.`
            : `Pronto, **${trimmedName}**! Não consegui registrar agora, mas você pode seguir para o WhatsApp normalmente.`,
        },
      ]);
    } catch (e: any) {
      // Mesmo com erro, tenta gerar link com os dados informados
      const fallbackText = encodeURIComponent(
        `Olá! Vim pelo site e gostaria de atendimento humano.\n\nMeu nome: ${trimmedName}\nMeu telefone: 55${digits}`
      );
      setWhatsappUrl(`https://web.whatsapp.com/send?phone=5521982126467&text=${fallbackText}`);
      setHandoffStep("ready");
      setMessages((p) => [
        ...p,
        {
          role: "assistant",
          content: `Não consegui registrar seu atendimento agora, **${trimmedName}**, mas você pode seguir para o WhatsApp normalmente.`,
        },
      ]);
    } finally {
      setHandoffLoading(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    // Intercepta pedido humano antes de mandar para a IA
    if (handoffStep === "idle" && detectHumanRequest(text)) {
      setMessages((p) => [...p, { role: "user", content: text }]);
      setInput("");
      startHandoffOffer();
      return;
    }

    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await chat({
        data: {
          messages: next.filter((m) => m !== WELCOME || messages.length > 1).map((m) => ({ role: m.role, content: m.content })),
          sessionId,
          userId,
        },
      });
      if (res.error) {
        setMessages((p) => [...p, { role: "assistant", content: `⚠️ ${res.error}` }]);
      } else {
        setMessages((p) => [...p, { role: "assistant", content: res.reply }]);
        if ((res as { leadCaptured?: boolean }).leadCaptured) {
          trackLeadCaptured("chat");
        }
      }
    } catch (e) {
      setMessages((p) => [...p, { role: "assistant", content: "⚠️ Erro de conexão. Tente novamente." }]);
    } finally {
      setLoading(false);
    }
  };

  const inputDisabled = loading || handoffStep === "form" || handoffStep === "ready";

  return (
    <>
      {/* Floating button */}
      <button
        onClick={toggle}
        aria-label={open ? "Fechar chat" : "Abrir chat"}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-105 hover:brightness-110",
          open && "rotate-90"
        )}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[34rem] w-[calc(100vw-3rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3 border-b border-border bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/20">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-display text-sm font-semibold">Atendimento Led Maricá</p>
              <p className="text-xs opacity-80">Resposta na hora • IA</p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-4">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border text-foreground"
                  )}
                >
                  <div className="prose prose-sm max-w-none break-words [&_p]:my-1 [&_ul]:my-1 [&_a]:text-inherit [&_a]:underline">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-border bg-card px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}

            {/* Handoff: oferta inicial */}
            {handoffStep === "offer" && !loading && (
              <div className="flex flex-col gap-2">
                <Button size="sm" variant="outline" onClick={handleContinueHere}>
                  Pode tentar me ajudar
                </Button>
                <Button size="sm" onClick={handleWantWhatsapp}>
                  Quero ir para o WhatsApp
                </Button>
              </div>
            )}

            {/* Handoff: formulário nome+telefone */}
            {handoffStep === "form" && (
              <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
                <input
                  value={handoffName}
                  onChange={(e) => setHandoffName(e.target.value)}
                  placeholder="Seu nome"
                  maxLength={120}
                  autoComplete="name"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <input
                  value={handoffPhone}
                  onChange={(e) => setHandoffPhone(formatPhoneBR(e.target.value))}
                  placeholder="(21) 99999-9999"
                  inputMode="tel"
                  autoComplete="tel"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                {handoffError && (
                  <p className="text-xs text-destructive">{handoffError}</p>
                )}
                <Button
                  size="sm"
                  className="w-full"
                  onClick={submitHandoff}
                  disabled={handoffLoading}
                >
                  {handoffLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continuar para o WhatsApp"}
                </Button>
                <p className="text-[10px] text-muted-foreground">
                  Usamos seus dados apenas para registrar este atendimento.
                </p>
              </div>
            )}

            {/* Handoff: pronto */}
            {handoffStep === "ready" && whatsappUrl && (
              <div className="flex flex-col gap-2">
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Falar no WhatsApp
                  </Button>
                </a>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setHandoffStep("idle");
                    setHandoffName("");
                    setHandoffPhone("");
                    setWhatsappUrl(null);
                  }}
                >
                  Continuar conversando aqui
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-border bg-card p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={
                handoffStep === "form"
                  ? "Preencha o formulário acima…"
                  : handoffStep === "ready"
                  ? "Clique em Falar no WhatsApp"
                  : "Digite sua mensagem..."
              }
              disabled={inputDisabled}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
            />
            <Button size="icon" onClick={send} disabled={inputDisabled || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
