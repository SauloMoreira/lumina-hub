import { createMiddleware } from '@tanstack/react-start';
import { requireSupabaseAuth } from './auth-middleware';

/**
 * Middleware que estende requireSupabaseAuth garantindo que o usuário
 * autenticado tem role='admin' em profiles. Lança 403 caso contrário.
 *
 * Também expõe `adminEmail` no contexto, útil para auditoria.
 */
export const requireAdmin = createMiddleware({ type: 'function' })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { supabaseAdmin } = await import('./client.server');
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
    const { supabaseAdmin } = await import('./client.server');
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

/**
 * Versão SOFT do MFA: não bloqueia. Se o admin não tem MFA configurado
 * ou a sessão ainda é aal1, registra um evento em security_events
 * ('admin_action_without_mfa') e deixa a ação prosseguir.
 *
 * Use em ações sensíveis (mutações de pedidos, conteúdo institucional,
 * configurações) durante a fase de homologação. Quando todos os admins
 * tiverem MFA configurado, troque para `requireAdminMfa`.
 */
export const requireAdminMfaSoft = createMiddleware({ type: 'function' })
  .middleware([requireAdmin])
  .server(async ({ next, context }) => {
    const { supabaseAdmin } = await import('./client.server');
    const ctx = context as {
      adminUserId: string;
      adminEmail: string | null;
      claims?: { aal?: string } & Record<string, unknown>;
    };
    const aal = ctx.claims?.aal;

    let hasVerifiedFactor = false;
    try {
      const { data } = await supabaseAdmin.auth.admin.getUserById(ctx.adminUserId);
      type FactorLite = { status?: string };
      const factors = (data?.user?.factors ?? []) as FactorLite[];
      hasVerifiedFactor = factors.some((f) => f?.status === 'verified');
    } catch {
      hasVerifiedFactor = false;
    }

    if (!hasVerifiedFactor || (aal && aal !== 'aal2')) {
      try {
        await supabaseAdmin.rpc('log_security_event', {
          _type: 'admin_action_without_mfa',
          _severity: 'warn',
          _identifier: ctx.adminEmail ?? ctx.adminUserId,
          _message: hasVerifiedFactor
            ? 'Admin executou ação sensível sem desafio MFA na sessão'
            : 'Admin executou ação sensível sem MFA configurado',
          _metadata: { adminUserId: ctx.adminUserId, aal: aal ?? null },
        });
      } catch {
        // não bloqueia em caso de falha de auditoria
      }
    }

    return next({ context: ctx });
  });
