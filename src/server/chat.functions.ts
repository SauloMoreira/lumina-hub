import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enforceRateLimit, getClientIdentifier } from "@/server/security/rateLimit";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatInput {
  messages: ChatMessage[];
  sessionId: string;
  userId?: string | null;
}

const SYSTEM_PROMPT = `Você é o assistente virtual da Led Maricá, loja de material elétrico e iluminação LED em Maricá/RJ.

Sua missão:
- Ajudar clientes a encontrar produtos (lâmpadas LED, disjuntores, fios, refletores, tomadas, etc.)
- Tirar dúvidas técnicas básicas (qual lâmpada para a sala? que disjuntor usar?)
- Recomendar produtos do catálogo quando relevante
- Informar sobre frete (grátis acima de R$ 199 para Maricá/RJ)
- Capturar interesse de compra: se o cliente demonstrar interesse forte (perguntar preço de obra, orçamento, projeto), peça nome, telefone e e-mail

Tom: cordial, direto, profissional. Use português do Brasil. Respostas curtas em markdown.
Nunca invente preços — peça para o cliente conferir no site ou diga que você não tem essa informação exata.
Se não souber algo técnico, seja honesto e sugira contato com a loja.`;

async function loadCatalogContext(): Promise<string> {
  const { data: products } = await supabaseAdmin
    .from("products")
    .select("name, slug, price, sale_price, brand, tags, stock_qty")
    .eq("active", true)
    .gt("stock_qty", 0)
    .limit(40);
  if (!products || products.length === 0) return "";
  const lines = products.map((p) => {
    const price = p.sale_price ?? p.price;
    return `- ${p.name}${p.brand ? ` (${p.brand})` : ""} — R$ ${Number(price).toFixed(2)} — /produto/${p.slug}`;
  });
  return `\n\nCatálogo atual (amostra):\n${lines.join("\n")}`;
}

function detectLeadIntent(text: string): boolean {
  const t = text.toLowerCase();
  const triggers = [
    "orçamento",
    "orcamento",
    "obra",
    "projeto",
    "atacado",
    "revenda",
    "instalador",
    "eletricista",
    "grande quantidade",
    "muitas peças",
    "muitas pecas",
  ];
  return triggers.some((k) => t.includes(k));
}

export const chatWithAI = createServerFn({ method: "POST" })
  .inputValidator((input: ChatInput) => {
    if (!input || !Array.isArray(input.messages)) throw new Error("messages é obrigatório");
    if (!input.sessionId || typeof input.sessionId !== "string") throw new Error("sessionId é obrigatório");
    if (input.messages.length > 30) input.messages = input.messages.slice(-30);
    for (const m of input.messages) {
      if (!m.content || m.content.length > 4000) throw new Error("Mensagem inválida");
      if (m.role !== "user" && m.role !== "assistant") throw new Error("Role inválida");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { reply: "Chat indisponível no momento.", error: "missing_key" };
    }

    const lastUser = [...data.messages].reverse().find((m) => m.role === "user");
    const catalog = await loadCatalogContext();

    // Persist user message
    if (lastUser) {
      await supabaseAdmin.from("chat_messages").insert({
        role: "user",
        content: lastUser.content,
        session_id: data.sessionId,
        user_id: data.userId ?? null,
      });
    }

    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT + catalog },
            ...data.messages,
          ],
        }),
      });

      if (resp.status === 429) {
        return { reply: "", error: "Muitas requisições. Aguarde um momento e tente novamente." };
      }
      if (resp.status === 402) {
        return { reply: "", error: "Créditos esgotados. Contate o suporte." };
      }
      if (!resp.ok) {
        const t = await resp.text();
        console.error("Lovable AI error:", resp.status, t);
        return { reply: "", error: "Erro ao consultar a IA." };
      }

      const json = (await resp.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const reply = json.choices?.[0]?.message?.content ?? "";

      // Persist assistant reply
      if (reply) {
        await supabaseAdmin.from("chat_messages").insert({
          role: "assistant",
          content: reply,
          session_id: data.sessionId,
          user_id: data.userId ?? null,
        });
      }

      // Lead capture: if intent detected, create a lead stub (admin can follow up)
      let leadCaptured = false;
      if (lastUser && detectLeadIntent(lastUser.content)) {
        const { data: existing } = await supabaseAdmin
          .from("leads")
          .select("id")
          .eq("notes", `chat:${data.sessionId}`)
          .maybeSingle();
        if (!existing) {
          await supabaseAdmin.from("leads").insert({
            name: "Visitante do chat",
            origin: "chat",
            status: "new",
            interest: lastUser.content.slice(0, 200),
            notes: `chat:${data.sessionId}`,
          });
          leadCaptured = true;
        }
      }

      return { reply, error: null, leadCaptured };
    } catch (e) {
      console.error("chatWithAI error:", e);
      return { reply: "", error: "Falha de comunicação com a IA." };
    }
  });

export const loadChatHistory = createServerFn({ method: "POST" })
  .inputValidator((input: { sessionId: string }) => {
    if (!input?.sessionId) throw new Error("sessionId obrigatório");
    return input;
  })
  .handler(async ({ data }) => {
    const { data: msgs } = await supabaseAdmin
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: true })
      .limit(50);
    return { messages: msgs ?? [] };
  });
