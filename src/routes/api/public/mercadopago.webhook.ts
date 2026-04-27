import { createFileRoute } from '@tanstack/react-router';
import { createHmac, timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

// =============================================================================
// Webhook Mercado Pago
// POST /api/public/mercadopago/webhook
// Não confia no body: revalida o pagamento via GET /v1/payments/{id}.
// =============================================================================

type MPPayment = {
  id: number | string;
  status?: string;
  status_detail?: string;
  external_reference?: string | null;
  date_approved?: string | null;
  order?: { id?: number | string; type?: string } | null;
  live_mode?: boolean;
};

const TERMINAL_PAID = new Set(['approved']);
const STATUS_MAP: Record<string, string> = {
  approved: 'approved',
  authorized: 'in_process',
  in_process: 'in_process',
  in_mediation: 'in_process',
  pending: 'pending',
  rejected: 'rejected',
  cancelled: 'cancelled',
  refunded: 'refunded',
  charged_back: 'charged_back',
};

function safeJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function verifySignature(opts: {
  secret: string;
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
}): { ok: boolean; reason?: string } {
  if (!opts.signatureHeader) return { ok: false, reason: 'missing x-signature' };
  if (!opts.dataId) return { ok: false, reason: 'missing data.id' };

  // x-signature: ts=<timestamp>,v1=<hex>
  const parts = opts.signatureHeader.split(',').map((p) => p.trim());
  const map: Record<string, string> = {};
  for (const p of parts) {
    const [k, v] = p.split('=');
    if (k && v) map[k.trim()] = v.trim();
  }
  const ts = map['ts'];
  const v1 = map['v1'];
  if (!ts || !v1) return { ok: false, reason: 'malformed x-signature' };

  // Manifesto: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
  const manifestParts: string[] = [`id:${opts.dataId};`];
  if (opts.requestId) manifestParts.push(`request-id:${opts.requestId};`);
  manifestParts.push(`ts:${ts};`);
  const manifest = manifestParts.join('');

  const computed = createHmac('sha256', opts.secret).update(manifest).digest('hex');
  try {
    const a = Buffer.from(computed, 'hex');
    const b = Buffer.from(v1, 'hex');
    if (a.length !== b.length) return { ok: false, reason: 'signature length mismatch' };
    if (!timingSafeEqual(a, b)) return { ok: false, reason: 'signature mismatch' };
  } catch {
    return { ok: false, reason: 'signature compare error' };
  }
  return { ok: true };
}

async function fetchPayment(paymentId: string, accessToken: string): Promise<MPPayment | null> {
  try {
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) {
      console.error('[MP webhook] GET payment falhou', r.status);
      return null;
    }
    return (await r.json()) as MPPayment;
  } catch (e) {
    console.error('[MP webhook] exception GET payment', e);
    return null;
  }
}

export const Route = createFileRoute('/api/public/mercadopago/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

        // Headers
        const signatureHeader = request.headers.get('x-signature');
        const requestId = request.headers.get('x-request-id');

        const rawBody = await request.text();
        const body = safeJson(rawBody);

        // Query params (MP envia data.id também via query em alguns casos)
        const url = new URL(request.url);
        const queryDataId = url.searchParams.get('data.id') ?? url.searchParams.get('id');
        const queryType = url.searchParams.get('type') ?? url.searchParams.get('topic');

        const dataIdFromBody =
          (body as { data?: { id?: string | number } }).data?.id != null
            ? String((body as { data?: { id?: string | number } }).data!.id)
            : null;
        const dataId = dataIdFromBody ?? queryDataId;
        const type =
          ((body as { type?: string }).type as string | undefined) ??
          ((body as { topic?: string }).topic as string | undefined) ??
          queryType ??
          null;
        const action = (body as { action?: string }).action ?? null;
        const eventId = (body as { id?: string | number }).id != null ? String((body as { id?: string | number }).id) : null;
        const liveMode =
          typeof (body as { live_mode?: boolean }).live_mode === 'boolean'
            ? ((body as { live_mode?: boolean }).live_mode as boolean)
            : null;

        // 1) Auditoria — registra SEMPRE, antes de processar
        const headersObj: Record<string, string> = {};
        request.headers.forEach((v, k) => {
          headersObj[k] = v;
        });

        const { data: auditRow, error: auditErr } = await supabaseAdmin
          .from('payment_webhook_events')
          .insert({
            provider: 'mercadopago',
            event_id: eventId,
            action,
            type,
            data_id: dataId,
            live_mode: liveMode,
            payload: body as never,
            headers: headersObj as never,
          })
          .select('id')
          .single();
        if (auditErr) console.error('[MP webhook] erro audit insert', auditErr);
        const auditId = auditRow?.id ?? null;

        // 2) Validar assinatura (se secret configurado)
        if (webhookSecret) {
          const sig = verifySignature({
            secret: webhookSecret,
            signatureHeader,
            requestId,
            dataId,
          });
          if (!sig.ok) {
            console.warn('[MP webhook] assinatura inválida:', sig.reason);
            if (auditId) {
              await supabaseAdmin
                .from('payment_webhook_events')
                .update({ processing_error: `invalid signature: ${sig.reason}` })
                .eq('id', auditId);
            }
            return new Response('Unauthorized', { status: 401 });
          }
        } else {
          console.warn('[MP webhook] MERCADOPAGO_WEBHOOK_SECRET não configurado — pulando validação');
        }

        // 3) Só processa eventos do tipo payment
        const isPayment = type === 'payment' || type === 'payment.updated' || type === 'payment.created';
        if (!isPayment || !dataId) {
          if (auditId) {
            await supabaseAdmin
              .from('payment_webhook_events')
              .update({ processed: true })
              .eq('id', auditId);
          }
          return new Response('ok', { status: 200 });
        }

        if (!accessToken) {
          console.error('[MP webhook] MERCADOPAGO_ACCESS_TOKEN não configurado');
          if (auditId) {
            await supabaseAdmin
              .from('payment_webhook_events')
              .update({ processing_error: 'access token missing' })
              .eq('id', auditId);
          }
          return new Response('ok', { status: 200 });
        }

        // 4) Buscar dados oficiais do pagamento
        const payment = await fetchPayment(dataId, accessToken);
        if (!payment) {
          if (auditId) {
            await supabaseAdmin
              .from('payment_webhook_events')
              .update({ processing_error: 'failed to fetch payment' })
              .eq('id', auditId);
          }
          return new Response('ok', { status: 200 });
        }

        const externalRef = payment.external_reference;
        if (!externalRef) {
          if (auditId) {
            await supabaseAdmin
              .from('payment_webhook_events')
              .update({ processing_error: 'no external_reference', processed: true })
              .eq('id', auditId);
          }
          return new Response('ok', { status: 200 });
        }

        // 5) Localizar pedido
        const { data: order, error: orderErr } = await supabaseAdmin
          .from('orders')
          .select('id, payment_status, status, mp_payment_id, user_id')
          .eq('external_reference', externalRef)
          .single();
        if (orderErr || !order) {
          console.error('[MP webhook] pedido não encontrado para ref', externalRef, orderErr);
          if (auditId) {
            await supabaseAdmin
              .from('payment_webhook_events')
              .update({ processing_error: 'order not found' })
              .eq('id', auditId);
          }
          return new Response('ok', { status: 200 });
        }

        const mappedStatus = STATUS_MAP[payment.status ?? ''] ?? 'pending';
        const wasAlreadyPaid = order.payment_status === 'approved' || order.payment_status === 'paid';
        const willBePaid = TERMINAL_PAID.has(payment.status ?? '');

        // Idempotência: se já está pago e o evento de novo é "approved", apenas registra e sai
        if (wasAlreadyPaid && willBePaid) {
          if (auditId) {
            await supabaseAdmin
              .from('payment_webhook_events')
              .update({ processed: true })
              .eq('id', auditId);
          }
          return new Response('ok', { status: 200 });
        }

        // 6) Atualizar pedido
        type OrderUpdate = {
          payment_status: string;
          mp_payment_id: string;
          payment_provider: string;
          mp_merchant_order_id?: string;
          paid_at?: string;
          status?: string;
          cancelled_reason?: string;
        };
        const updates: OrderUpdate = {
          payment_status: mappedStatus,
          mp_payment_id: String(payment.id),
          payment_provider: 'mercadopago',
        };
        if (payment.order?.id) updates.mp_merchant_order_id = String(payment.order.id);
        if (willBePaid) {
          updates.paid_at = payment.date_approved ?? new Date().toISOString();
          if (order.status === 'pending') updates.status = 'confirmed';
        } else if (mappedStatus === 'cancelled' || mappedStatus === 'rejected') {
          if (order.status === 'pending') updates.status = 'cancelled';
          updates.cancelled_reason = `Pagamento ${mappedStatus} (${payment.status_detail ?? ''})`.trim();
        }

        const { error: updErr } = await supabaseAdmin
          .from('orders')
          .update(updates)
          .eq('id', order.id);
        if (updErr) {
          console.error('[MP webhook] erro update pedido', updErr);
          if (auditId) {
            await supabaseAdmin
              .from('payment_webhook_events')
              .update({ processing_error: `order update: ${updErr.message}` })
              .eq('id', auditId);
          }
          return new Response('ok', { status: 200 });
        }

        // Baixa de estoque idempotente quando aprovado
        if (willBePaid) {
          const { data: stockRes, error: stockErr } = await supabaseAdmin.rpc(
            'decrement_stock_for_order',
            { _order_id: order.id }
          );
          if (stockErr) {
            console.error('[MP webhook] erro decrement_stock_for_order', stockErr);
            if (auditId) {
              await supabaseAdmin
                .from('payment_webhook_events')
                .update({ processing_error: `stock decrement: ${stockErr.message}` })
                .eq('id', auditId);
            }
          } else {
            console.log('[MP webhook] estoque', { orderId: order.id, result: stockRes });
          }
        }

        // E-mail transacional ao cliente — idempotente, não bloqueia resposta ao MP
        try {
          const { sendOrderEmail } = await import('@/server/email/orderEmails');
          let emailType:
            | 'payment_approved'
            | 'payment_pending'
            | 'payment_failed'
            | null = null;
          if (willBePaid) emailType = 'payment_approved';
          else if (mappedStatus === 'pending' || mappedStatus === 'in_process') emailType = 'payment_pending';
          else if (mappedStatus === 'rejected' || mappedStatus === 'cancelled') emailType = 'payment_failed';
          if (emailType) {
            void sendOrderEmail({ orderId: order.id, type: emailType });
          }
        } catch (e) {
          console.error('[MP webhook] falha ao agendar e-mail', e);
        }

        if (auditId) {
          await supabaseAdmin
            .from('payment_webhook_events')
            .update({ processed: true })
            .eq('id', auditId);
        }

        return new Response('ok', { status: 200 });
      },
    },
  },
});
