import { getRequest, getRequestHeader } from '@tanstack/react-start/server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { getClientIdentifier } from './rateLimit';

/**
 * Registra uma ação administrativa na tabela admin_audit_log.
 * Use sempre dentro de server functions protegidas por requireAdmin.
 *
 * @example
 *   await logAdminAction({
 *     adminId: context.adminUserId,
 *     action: 'update',
 *     resourceType: 'product',
 *     resourceId: product.id,
 *     description: `Editou produto "${product.name}"`,
 *     before: oldData,
 *     after: newData,
 *   });
 */
export async function logAdminAction(params: {
  adminId: string;
  adminEmail?: string | null;
  action: string;          // 'create' | 'update' | 'delete' | 'login' | string custom
  resourceType: string;    // 'product' | 'order' | 'coupon' | 'banner' | ...
  resourceId?: string | null;
  description?: string | null;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  let userAgent: string | null = null;
  try {
    userAgent = getRequestHeader('user-agent') ?? null;
  } catch {
    // Fora do contexto de request (ex: cron) — ignora.
  }
  let ip: string | null = null;
  try {
    ip = getClientIdentifier();
    if (ip === 'unknown') ip = null;
  } catch {
    ip = null;
  }

  let adminEmail = params.adminEmail ?? null;
  if (!adminEmail) {
    try {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('id', params.adminId)
        .maybeSingle();
      adminEmail = data?.email ?? null;
    } catch {
      adminEmail = null;
    }
  }

  try {
    await supabaseAdmin.rpc('log_admin_action', {
      _admin_id: params.adminId,
      _admin_email: adminEmail,
      _action: params.action,
      _resource_type: params.resourceType,
      _resource_id: params.resourceId ?? null,
      _description: params.description ?? null,
      _before: (params.before ?? null) as never,
      _after: (params.after ?? null) as never,
      _ip: ip,
      _user_agent: userAgent,
    } as never);
  } catch (err) {
    // Auditoria nunca deve quebrar a operação principal.
    console.error('[auditLog] failed to log admin action:', err);
  }

  // Mantém visibilidade extra no console em ambiente de dev.
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log(
      `[admin-audit] ${params.action} ${params.resourceType}${params.resourceId ? `:${params.resourceId}` : ''} by ${adminEmail ?? params.adminId}`,
    );
  }

  // Avoid unused-import lint when getRequest isn't called explicitly.
  void getRequest;
}
