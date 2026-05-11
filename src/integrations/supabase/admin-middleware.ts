import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "./auth-middleware";

/**
 * Verifica se o usuário tem pelo menos um fator MFA verificado
 * via Admin API (independente do AAL atual).
 */
async function userHasVerifiedFactor(userId: string): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("./client.server");
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    type FactorLite = { status?: string };
    const factors = (data?.user?.factors ?? []) as FactorLite[];
    return factors.some((f) => f?.status === "verified");
  } catch {
    return false;
  }
}

/**
 * Middleware ESTRITO para todas as ações administrativas.
 *
 * Exige:
 *  1. usuário autenticado;
 *  2. role 'admin' em profiles;
 *  3. fator MFA (TOTP) verificado;
 *  4. sessão atual em AAL2 (challenge MFA já respondido nesta sessão).
 *
 * Sessão admin em AAL1 é rejeitada com 401 ("MFA challenge required"),
 * o frontend trata redirecionando para /mfa-challenge.
 *
 * Admin sem fator cadastrado é rejeitado com 403 ("MFA enrollment required"),
 * o frontend redireciona para /conta para configurar MFA.
 */
export const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { supabaseAdmin } = await import("./client.server");
    const ctx = context as {
      userId: string;
      claims?: { aal?: string } & Record<string, unknown>;
    };
    const userId = ctx.userId;

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("role, email")
      .eq("id", userId)
      .single();
    if (error || !profile || profile.role !== "admin") {
      throw new Response("Forbidden: admin only", { status: 403 });
    }

    const hasFactor = await userHasVerifiedFactor(userId);
    if (!hasFactor) {
      throw new Response("Forbidden: MFA enrollment required", { status: 403 });
    }

    const aal = ctx.claims?.aal;
    if (aal !== "aal2") {
      throw new Response("Unauthorized: MFA challenge required", { status: 401 });
    }

    return next({
      context: {
        adminUserId: userId,
        adminEmail: profile.email as string | null,
      },
    });
  });

/**
 * Aliases mantidos para compatibilidade com server functions existentes.
 * A partir da Onda S1 (mai/2026), TODOS exigem AAL2 + fator verificado.
 * `requireAdminMfaSoft` deixou de ser "soft" — qualquer chamada com sessão
 * AAL1 é rejeitada com 401, mesmo em produção.
 */
export const requireAdminMfa = requireAdmin;
export const requireAdminMfaSoft = requireAdmin;

/**
 * Helper para server functions que NÃO usam o middleware (têm helpers
 * locais `requireAdmin()` próprios). Recebe o bearer token do request,
 * valida admin + AAL2 + fator verificado e retorna o userId.
 */
export async function assertAdminAal2FromBearer(): Promise<string> {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const { supabaseAdmin } = await import("./client.server");
  const auth = getRequestHeader("Authorization") || getRequestHeader("authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    throw new Response("Unauthorized", { status: 401 });
  }
  const token = auth.slice(7).trim();
  if (!token) throw new Response("Unauthorized", { status: 401 });

  const { data: claimsRes, error: cErr } = await supabaseAdmin.auth.getClaims(token);
  if (cErr || !claimsRes?.claims?.sub) {
    throw new Response("Unauthorized", { status: 401 });
  }
  const userId = claimsRes.claims.sub as string;
  const aal = (claimsRes.claims as { aal?: string }).aal;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (!profile || profile.role !== "admin") {
    throw new Response("Forbidden: admin only", { status: 403 });
  }

  const hasFactor = await userHasVerifiedFactor(userId);
  if (!hasFactor) {
    throw new Response("Forbidden: MFA enrollment required", { status: 403 });
  }
  if (aal !== "aal2") {
    throw new Response("Unauthorized: MFA challenge required", { status: 401 });
  }
  return userId;
}
