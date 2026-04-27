// Orquestrador idempotente de e-mails transacionais ligados a pedidos.
// - Carrega pedido + itens + profile do cliente
// - Verifica em email_events se já foi enviado (status='sent')
// - Renderiza template, envia via Resend, registra em email_events
// - NUNCA lança: falha de e-mail não pode quebrar fluxo de pedido/pagamento

import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { sendTransactionalEmail } from './resend';
import { buildOrderEmailTemplate, type EmailMessageType } from './templates';

function getSiteUrl(): string {
  return (process.env.SITE_URL ?? '').replace(/\/$/, '') || 'https://localhost';
}

function getStoreName(): string {
  return process.env.STORE_NAME ?? 'Nossa Loja';
}

function getSupportEmail(): string | null {
  return process.env.RESEND_REPLY_TO_EMAIL ?? null;
}

interface SendOrderEmailOptions {
  orderId: string;
  type: EmailMessageType;
  /** Se true, ignora a checagem de idempotência (uso administrativo). Default: false. */
  force?: boolean;
}

export async function sendOrderEmail(opts: SendOrderEmailOptions): Promise<{
  ok: boolean;
  skipped?: 'already_sent' | 'no_email' | 'order_not_found';
  error?: string;
}> {
  try {
    // 1) Carregar pedido + itens
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select(
        'id, order_number, user_id, status, payment_status, subtotal, discount, shipping_cost, total, tracking_code, address_snapshot, order_items(product_name, qty, unit_price, total_price)'
      )
      .eq('id', opts.orderId)
      .single();

    if (orderErr || !order) {
      console.error('[email] pedido não encontrado', opts.orderId, orderErr);
      return { ok: false, skipped: 'order_not_found' };
    }

    // 2) Buscar e-mail e nome do cliente (profiles)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, name')
      .eq('id', order.user_id)
      .single();

    // Fallback: tentar address_snapshot
    type AddressSnap = { recipient?: string } | null;
    const snap = (order.address_snapshot as AddressSnap) ?? null;

    const customerEmail = profile?.email ?? null;
    const customerName = profile?.name ?? snap?.recipient ?? null;

    if (!customerEmail) {
      console.warn('[email] cliente sem e-mail', { orderId: order.id, userId: order.user_id });
      return { ok: false, skipped: 'no_email' };
    }

    // 3) Idempotência
    if (!opts.force) {
      const { data: existing } = await supabaseAdmin
        .from('email_events')
        .select('id')
        .eq('order_id', order.id)
        .eq('type', opts.type)
        .eq('status', 'sent')
        .maybeSingle();
      if (existing) {
        return { ok: true, skipped: 'already_sent' };
      }
    }

    // 4) Renderizar template
    const orderUrl = `${getSiteUrl()}/pedido/${order.id}/confirmacao`;
    const retryUrl =
      opts.type === 'payment_failed'
        ? `${getSiteUrl()}/checkout/failure?order_id=${order.id}`
        : null;

    const items = (order.order_items ?? []).map((i) => ({
      name: i.product_name,
      qty: Number(i.qty),
      unitPrice: Number(i.unit_price),
      totalPrice: Number(i.total_price),
    }));

    const { subject, html, text } = buildOrderEmailTemplate({
      storeName: getStoreName(),
      customerName,
      orderNumber: order.order_number,
      items,
      subtotal: Number(order.subtotal ?? 0),
      shippingTotal: Number(order.shipping_cost ?? 0),
      discountTotal: Number(order.discount ?? 0),
      total: Number(order.total ?? 0),
      orderUrl,
      retryUrl,
      supportEmail: getSupportEmail(),
      trackingCode: order.tracking_code ?? null,
      messageType: opts.type,
    });

    // 5) Registrar pending
    const { data: eventRow } = await supabaseAdmin
      .from('email_events')
      .insert({
        order_id: order.id,
        customer_email: customerEmail,
        type: opts.type,
        subject,
        provider: 'resend',
        status: 'pending',
      })
      .select('id')
      .single();

    // 6) Enviar
    const result = await sendTransactionalEmail({
      to: customerEmail,
      subject,
      html,
      text,
      metadata: { orderId: order.id, type: opts.type },
    });

    // 7) Atualizar evento
    if (eventRow?.id) {
      if (result.ok) {
        await supabaseAdmin
          .from('email_events')
          .update({
            status: result.skipped ? 'skipped' : 'sent',
            provider_message_id: result.messageId ?? null,
            sent_at: new Date().toISOString(),
          })
          .eq('id', eventRow.id);
      } else {
        await supabaseAdmin
          .from('email_events')
          .update({
            status: 'failed',
            error_message: result.error ?? 'unknown',
          })
          .eq('id', eventRow.id);
      }
    }

    return { ok: result.ok, error: result.error };
  } catch (e) {
    // NUNCA propagar — não pode quebrar fluxo de pedido/pagamento
    const msg = e instanceof Error ? e.message : 'erro desconhecido';
    console.error('[email] sendOrderEmail exception', e);
    return { ok: false, error: msg };
  }
}
