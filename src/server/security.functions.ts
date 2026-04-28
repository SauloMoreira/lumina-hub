import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { requireAdmin } from '@/integrations/supabase/admin-middleware';

/**
 * Painel resumido da Central de Segurança.
 * - Eventos de webhook (últimos N e contagem por status)
 * - Eventos de segurança (CSP, falhas auth, rate limit, ssrf, etc.)
 * - Eventos de rate limit recentes
 * - Status MFA dos admins
 */
export const getSecurityOverview = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .handler(async () => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [webhooks, secEvents, rlEvents, admins] = await Promise.all([
      supabaseAdmin
        .from('payment_webhook_events')
        .select('id, provider, type, action, processed, processing_error, created_at, data_id, live_mode')
        .gte('created_at', since7d)
        .order('created_at', { ascending: false })
        .limit(50),
      supabaseAdmin
        .from('security_events')
        .select('id, type, severity, identifier, message, metadata, created_at')
        .gte('created_at', since7d)
        .order('created_at', { ascending: false })
        .limit(100),
      supabaseAdmin
        .from('rate_limit_events')
        .select('action, identifier, created_at')
        .gte('created_at', since24h)
        .order('created_at', { ascending: false })
        .limit(200),
      supabaseAdmin
        .from('profiles')
        .select('id, email, name, role, created_at')
        .eq('role', 'admin'),
    ]);

    // Stats de webhook (últimos 7d)
    const webhookList = webhooks.data ?? [];
    const webhookStats = {
      total: webhookList.length,
      processed: webhookList.filter((w) => w.processed).length,
      withError: webhookList.filter((w) => w.processing_error).length,
      invalidSignature: webhookList.filter((w) =>
        (w.processing_error ?? '').toLowerCase().includes('invalid signature'),
      ).length,
    };

    // Stats de eventos de segurança
    const secList = secEvents.data ?? [];
    const secStats = {
      total: secList.length,
      byType: secList.reduce<Record<string, number>>((acc, e) => {
        acc[e.type] = (acc[e.type] ?? 0) + 1;
        return acc;
      }, {}),
      bySeverity: secList.reduce<Record<string, number>>((acc, e) => {
        acc[e.severity] = (acc[e.severity] ?? 0) + 1;
        return acc;
      }, {}),
    };

    // Stats de rate limit
    const rlList = rlEvents.data ?? [];
    const rlStats = {
      total: rlList.length,
      byAction: rlList.reduce<Record<string, number>>((acc, e) => {
        acc[e.action] = (acc[e.action] ?? 0) + 1;
        return acc;
      }, {}),
    };

    // MFA status — Supabase não expõe MFA factors via service_role na tabela profiles,
    // então buscamos via Admin API auth.users
    const adminUsers = admins.data ?? [];
    const adminMfa: Array<{
      id: string;
      email: string;
      name: string | null;
      hasMfa: boolean;
      factors: number;
    }> = [];
    for (const a of adminUsers) {
      try {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(a.id);
        type FactorLite = { status?: string };
        const factors = (u?.user?.factors ?? []) as FactorLite[];
        const verified = factors.filter((f) => f?.status === 'verified');
        adminMfa.push({
          id: a.id,
          email: a.email,
          name: a.name ?? null,
          hasMfa: verified.length > 0,
          factors: verified.length,
        });
      } catch {
        adminMfa.push({ id: a.id, email: a.email, name: a.name ?? null, hasMfa: false, factors: 0 });
      }
    }

    return {
      webhookStats,
      webhookRecent: webhookList.slice(0, 20),
      secStats,
      secRecent: secList.slice(0, 30),
      rlStats,
      rlRecent: rlList.slice(0, 30),
      adminMfa,
    };
  });

export const listSecurityEvents = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .inputValidator(z.object({
    type: z.string().max(50).optional(),
    limit: z.number().int().min(1).max(500).default(100),
  }))
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from('security_events')
      .select('id, type, severity, identifier, message, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(data.limit);
    if (data.type) q = q.eq('type', data.type);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { events: rows ?? [] };
  });

/** Lista o histórico de auditoria de ações administrativas. */
export const listAdminAuditLog = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .inputValidator(z.object({
    resourceType: z.string().max(50).optional(),
    adminId: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(500).default(100),
  }))
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from('admin_audit_log')
      .select('id, admin_id, admin_email, action, resource_type, resource_id, description, ip, user_agent, created_at')
      .order('created_at', { ascending: false })
      .limit(data.limit);
    if (data.resourceType) q = q.eq('resource_type', data.resourceType);
    if (data.adminId) q = q.eq('admin_id', data.adminId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { events: rows ?? [] };
  });
