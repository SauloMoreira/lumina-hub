import { getRequest, getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getClientIdentifier } from "./rateLimit";

/**
 * Chaves cujo valor deve ser totalmente substituído por "***" antes de gravar
 * em before/after. Comparação case-insensitive e por substring.
 */
const SENSITIVE_KEY_PATTERNS = [
  "password",
  "senha",
  "token",
  "secret",
  "apikey",
  "api_key",
  "access_key",
  "private_key",
  "service_role",
  "authorization",
  "cookie",
  "session",
  "card_number",
  "cvv",
  "cvc",
  "security_code",
];

/**
 * Chaves que devem ser mascaradas parcialmente (mostra apenas alguns dígitos).
 */
const PARTIAL_MASK_KEYS = ["cpf", "cnpj", "rg"];

function maskPartial(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 4) return "***";
  return `***${digits.slice(-4)}`;
}

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pat) => lower.includes(pat));
}

function isPartialMaskKey(key: string): boolean {
  const lower = key.toLowerCase();
  return PARTIAL_MASK_KEYS.some((pat) => lower === pat || lower.endsWith(`_${pat}`));
}

/**
 * Sanitiza recursivamente um valor antes de gravar na auditoria,
 * mascarando chaves sensíveis. Limite de profundidade para evitar stack overflow.
 */
function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[max-depth]";
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(k)) {
        out[k] = "***";
      } else if (isPartialMaskKey(k) && typeof v === "string") {
        out[k] = maskPartial(v);
      } else {
        out[k] = sanitize(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

/**
 * Registra uma ação administrativa na tabela admin_audit_log.
 * Use sempre dentro de server functions protegidas por requireAdmin.
 *
 * Sanitiza automaticamente campos sensíveis (tokens, secrets, senhas) e
 * mascara parcialmente CPF/CNPJ.
 */
export async function logAdminAction(params: {
  adminId: string;
  adminEmail?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  description?: string | null;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  let userAgent: string | null = null;
  try {
    userAgent = getRequestHeader("user-agent") ?? null;
  } catch {
    // Fora do contexto de request (ex: cron) — ignora.
  }
  let ip: string | null = null;
  try {
    ip = getClientIdentifier();
    if (ip === "unknown") ip = null;
  } catch {
    ip = null;
  }

  let adminEmail = params.adminEmail ?? null;
  if (!adminEmail) {
    try {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", params.adminId)
        .maybeSingle();
      adminEmail = data?.email ?? null;
    } catch {
      adminEmail = null;
    }
  }

  const safeBefore = params.before === undefined ? null : sanitize(params.before);
  const safeAfter = params.after === undefined ? null : sanitize(params.after);

  try {
    await supabaseAdmin.rpc("log_admin_action", {
      _admin_id: params.adminId,
      _admin_email: adminEmail,
      _action: params.action,
      _resource_type: params.resourceType,
      _resource_id: params.resourceId ?? null,
      _description: params.description ?? null,
      _before: safeBefore as never,
      _after: safeAfter as never,
      _ip: ip,
      _user_agent: userAgent,
    } as never);
  } catch (err) {
    // Auditoria nunca deve quebrar a operação principal.
    console.error("[auditLog] failed to log admin action:", err);
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[admin-audit] ${params.action} ${params.resourceType}${params.resourceId ? `:${params.resourceId}` : ""} by ${adminEmail ?? params.adminId}`,
    );
  }

  void getRequest;
}
