import { createMiddleware } from '@tanstack/react-start';
import { requireSupabaseAuth } from './auth-middleware';
import { supabaseAdmin } from './client.server';

/**
 * Middleware que estende requireSupabaseAuth garantindo que o usuário
 * autenticado tem role='admin' em profiles. Lança 403 caso contrário.
 */
export const requireAdmin = createMiddleware({ type: 'function' })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const userId = (context as { userId: string }).userId;
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    if (error || !data || data.role !== 'admin') {
      throw new Response('Forbidden: admin only', { status: 403 });
    }
    return next({ context: { adminUserId: userId } });
  });
