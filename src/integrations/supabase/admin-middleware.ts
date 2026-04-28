import { createMiddleware } from '@tanstack/react-start';
import { requireSupabaseAuth } from './auth-middleware';
import { supabaseAdmin } from './client.server';

/**
 * Middleware que estende requireSupabaseAuth garantindo que o usuário
 * autenticado tem role='admin' em profiles. Lança 403 caso contrário.
 *
 * Também expõe `adminEmail` no contexto, útil para auditoria.
 */
export const requireAdmin = createMiddleware({ type: 'function' })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const userId = (context as { userId: string }).userId;
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('role, email')
      .eq('id', userId)
      .single();
    if (error || !data || data.role !== 'admin') {
      throw new Response('Forbidden: admin only', { status: 403 });
    }
    return next({
      context: {
        adminUserId: userId,
        adminEmail: data.email as string | null,
      },
    });
  });

/**
 * Versão estrita: além de admin, exige que o usuário tenha pelo menos
 * um fator MFA (TOTP) verificado e que o JWT atual reflita aal2.
 *
 * Use em endpoints sensíveis: editar produtos, cupons, banners, gerenciar
 * pedidos, alterar configurações, conceder admin a outros usuários etc.
 */
export const requireAdminMfa = createMiddleware({ type: 'function' })
  .middleware([requireAdmin])
  .server(async ({ next, context }) => {
    const ctx = context as {
      adminUserId: string;
      adminEmail: string | null;
      claims?: { aal?: string } & Record<string, unknown>;
    };
    const aal = ctx.claims?.aal;

    // Verifica fatores reais via Admin API (independe do AAL atual).
    let hasVerifiedFactor = false;
    try {
      const { data } = await supabaseAdmin.auth.admin.getUserById(ctx.adminUserId);
      type FactorLite = { status?: string };
      const factors = (data?.user?.factors ?? []) as FactorLite[];
      hasVerifiedFactor = factors.some((f) => f?.status === 'verified');
    } catch {
      hasVerifiedFactor = false;
    }

    if (!hasVerifiedFactor) {
      throw new Response('Forbidden: admin must enable MFA', { status: 403 });
    }
    // Se o admin já tem MFA mas a sessão ainda é aal1, exige re-autenticação MFA.
    if (aal && aal !== 'aal2') {
      throw new Response('Forbidden: MFA challenge required', { status: 403 });
    }

    return next({ context: ctx });
  });
