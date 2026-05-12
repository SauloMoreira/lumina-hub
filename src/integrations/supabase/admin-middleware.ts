import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "./auth-middleware";

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
    const { assertAdminUserAal2 } = await import("./admin-assertions.server");
    const ctx = context as {
      userId: string;
      claims?: { aal?: string } & Record<string, unknown>;
    };
    const profile = await assertAdminUserAal2(ctx.userId, ctx.claims?.aal);

    return next({
      context: {
        adminUserId: ctx.userId,
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

