// Templates HTML transacionais — sem dependências externas.
// Sempre escapa entrada do usuário; valores monetários em BRL.

export type EmailMessageType =
  | 'order_created'
  | 'payment_approved'
  | 'payment_pending'
  | 'payment_failed'
  | 'order_processing'
  | 'order_shipped';

export interface OrderEmailItem {
  name: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderEmailParams {
  storeName: string;
  customerName?: string | null;
  orderNumber: number | string;
  items: OrderEmailItem[];
  subtotal: number;
  shippingTotal: number;
  discountTotal: number;
  bundleDiscountTotal?: number;
  total: number;
  orderUrl: string;
  supportEmail?: string | null;
  supportWhatsapp?: string | null;
  retryUrl?: string | null;
  trackingCode?: string | null;
  messageType: EmailMessageType;
  deliveryMethod?: 'delivery' | 'pickup' | 'local_delivery' | string;
  pickup?: {
    storeName?: string | null;
    storeAddress?: string | null;
    storePhone?: string | null;
    instructions?: string | null;
    readyEta?: string | null;
  } | null;
  localDelivery?: {
    district?: string | null;
    eta?: string | null;
    service?: string | null;
  } | null;
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function esc(input: unknown): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface TemplateContent {
  subject: string;
  preheader: string;
  headline: string;
  intro: string;
  ctaLabel: string;
  ctaUrl: string;
  secondaryCta?: { label: string; url: string };
  showItems: boolean;
}

function getContent(p: OrderEmailParams): TemplateContent {
  const num = `#${p.orderNumber}`;
  switch (p.messageType) {
    case 'order_created':
      return {
        subject: `Recebemos seu pedido ${num}`,
        preheader: 'Aguardando confirmação de pagamento.',
        headline: `Recebemos seu pedido ${num}!`,
        intro:
          'Obrigado pela sua compra. Seu pedido foi registrado e está aguardando a confirmação do pagamento. Assim que o pagamento for aprovado, daremos início à separação.',
        ctaLabel: 'Acompanhar pedido',
        ctaUrl: p.orderUrl,
        showItems: true,
      };
    case 'payment_approved':
      return {
        subject: `Pagamento aprovado — Pedido ${num}`,
        preheader: 'Seu pagamento foi confirmado.',
        headline: `Pagamento aprovado!`,
        intro: `Seu pagamento do pedido ${num} foi confirmado. Estamos preparando seus produtos para envio.`,
        ctaLabel: 'Acompanhar pedido',
        ctaUrl: p.orderUrl,
        showItems: true,
      };
    case 'payment_pending':
      return {
        subject: `Pagamento pendente — Pedido ${num}`,
        preheader: 'Aguardando confirmação do pagamento.',
        headline: 'Pagamento em análise',
        intro: `Seu pagamento do pedido ${num} ainda está em processamento (boleto, Pix ou análise antifraude). O pedido será preparado assim que for aprovado.`,
        ctaLabel: 'Acompanhar pedido',
        ctaUrl: p.orderUrl,
        showItems: false,
      };
    case 'payment_failed':
      return {
        subject: `Não foi possível aprovar o pagamento do Pedido ${num}`,
        preheader: 'Você pode tentar pagar novamente.',
        headline: 'Pagamento não aprovado',
        intro: `Não conseguimos confirmar o pagamento do seu pedido ${num}. Seu pedido segue reservado e você pode tentar pagar novamente.`,
        ctaLabel: p.retryUrl ? 'Tentar pagar novamente' : 'Ver pedido',
        ctaUrl: p.retryUrl ?? p.orderUrl,
        secondaryCta: p.supportWhatsapp
          ? { label: 'Falar com atendimento', url: p.supportWhatsapp }
          : undefined,
        showItems: false,
      };
    case 'order_processing':
      return {
        subject: `Seu pedido ${num} está em separação`,
        preheader: 'Estamos preparando seus produtos.',
        headline: `Pedido ${num} em separação`,
        intro:
          'Boa notícia! Seu pedido foi liberado para separação. Você receberá uma nova mensagem assim que ele for despachado.',
        ctaLabel: 'Acompanhar pedido',
        ctaUrl: p.orderUrl,
        showItems: false,
      };
    case 'order_shipped':
      return {
        subject: `Seu pedido ${num} foi enviado`,
        preheader: p.trackingCode ? `Código de rastreio: ${p.trackingCode}` : 'Seu pedido está a caminho.',
        headline: 'Pedido a caminho!',
        intro: p.trackingCode
          ? `Seu pedido ${num} foi enviado. Código de rastreio: <strong>${esc(p.trackingCode)}</strong>.`
          : `Seu pedido ${num} foi enviado.`,
        ctaLabel: 'Acompanhar pedido',
        ctaUrl: p.orderUrl,
        showItems: false,
      };
  }
}

export function buildOrderEmailTemplate(p: OrderEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const c = getContent(p);
  const greeting = p.customerName ? `Olá, ${esc(p.customerName)}!` : 'Olá!';

  const itemsRows = c.showItems
    ? p.items
        .map(
          (i) => `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:#222;">
              ${esc(i.name)}<br/>
              <span style="color:#888;font-size:12px;">Qtd: ${i.qty} × ${BRL.format(i.unitPrice)}</span>
            </td>
            <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-size:14px;color:#222;white-space:nowrap;">
              ${BRL.format(i.totalPrice)}
            </td>
          </tr>`
        )
        .join('')
    : '';

  const isPickup = p.deliveryMethod === 'pickup';
  const isLocalDelivery = p.deliveryMethod === 'local_delivery';
  const shippingLabel = isPickup
    ? 'Retirada na loja'
    : isLocalDelivery
    ? 'Frete Local Maricá'
    : 'Frete';
  const shippingValue = isPickup
    ? 'Grátis'
    : (p.shippingTotal > 0 ? BRL.format(p.shippingTotal) : 'Grátis');

  const totalsBlock = c.showItems
    ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;font-size:14px;color:#444;">
      <tr><td>Subtotal</td><td style="text-align:right;">${BRL.format(p.subtotal)}</td></tr>
      ${p.discountTotal > 0 ? `<tr><td>Desconto</td><td style="text-align:right;color:#0a7a3e;">- ${BRL.format(p.discountTotal)}</td></tr>` : ''}
      <tr><td>${shippingLabel}</td><td style="text-align:right;">${shippingValue}</td></tr>
      <tr><td style="padding-top:8px;font-weight:bold;color:#111;border-top:1px solid #eee;">Total</td>
          <td style="padding-top:8px;text-align:right;font-weight:bold;color:#111;border-top:1px solid #eee;">${BRL.format(p.total)}</td></tr>
    </table>`
    : '';

  const itemsBlock = c.showItems
    ? `
    <h3 style="font-size:14px;color:#111;margin:24px 0 8px;">Resumo do pedido</h3>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${itemsRows}
    </table>
    ${totalsBlock}`
    : '';

  const pickupBlock = (isPickup && p.pickup)
    ? `
    <div style="margin-top:20px;padding:16px;background:#f8f9fb;border:1px solid #e5e7eb;border-radius:8px;">
      <h3 style="margin:0 0 8px;font-size:14px;color:#111;">📍 Retirada na loja</h3>
      ${p.pickup.storeName ? `<p style="margin:0 0 4px;font-size:14px;color:#111;font-weight:600;">${esc(p.pickup.storeName)}</p>` : ''}
      ${p.pickup.storeAddress ? `<p style="margin:0 0 4px;font-size:13px;color:#444;white-space:pre-line;">${esc(p.pickup.storeAddress)}</p>` : ''}
      ${p.pickup.storePhone ? `<p style="margin:0 0 4px;font-size:13px;color:#444;">Telefone: ${esc(p.pickup.storePhone)}</p>` : ''}
      ${p.pickup.readyEta ? `<p style="margin:8px 0 0;font-size:13px;color:#444;"><strong>Tempo estimado de preparo:</strong> ${esc(p.pickup.readyEta)}</p>` : ''}
      ${p.pickup.instructions ? `<p style="margin:8px 0 0;font-size:12px;color:#666;white-space:pre-line;">${esc(p.pickup.instructions)}</p>` : ''}
    </div>`
    : '';

  const localBlock = (isLocalDelivery && p.localDelivery)
    ? `
    <div style="margin-top:20px;padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
      <h3 style="margin:0 0 8px;font-size:14px;color:#111;">🚚 Frete Local Maricá/RJ</h3>
      ${p.localDelivery.district ? `<p style="margin:0 0 4px;font-size:14px;color:#111;font-weight:600;">${esc(p.localDelivery.district)}</p>` : ''}
      ${p.localDelivery.eta ? `<p style="margin:0 0 4px;font-size:13px;color:#444;">Prazo estimado: ${esc(p.localDelivery.eta)}</p>` : ''}
      <p style="margin:8px 0 0;font-size:12px;color:#666;">Entrega realizada por nossa equipe local após confirmação do pagamento.</p>
    </div>`
    : '';

  const secondaryBtn = c.secondaryCta
    ? `<a href="${esc(c.secondaryCta.url)}" style="display:inline-block;margin-left:8px;padding:12px 22px;border:1px solid #d4d4d8;color:#333;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">${esc(c.secondaryCta.label)}</a>`
    : '';

  const supportLine = p.supportEmail
    ? `<p style="font-size:12px;color:#888;margin-top:24px;">Precisa de ajuda? Escreva para <a href="mailto:${esc(p.supportEmail)}" style="color:#555;">${esc(p.supportEmail)}</a>.</p>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(c.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <tr><td style="padding:24px 28px;border-bottom:1px solid #eee;">
        <strong style="font-size:16px;color:#111;letter-spacing:.3px;">${esc(p.storeName)}</strong>
      </td></tr>
      <tr><td style="padding:28px;">
        <p style="margin:0 0 8px;font-size:14px;color:#555;">${greeting}</p>
        <h1 style="margin:0 0 12px;font-size:22px;color:#111;line-height:1.3;">${esc(c.headline)}</h1>
        <p style="margin:0 0 20px;font-size:14px;color:#444;line-height:1.6;">${c.intro}</p>
        <a href="${esc(c.ctaUrl)}" style="display:inline-block;padding:12px 22px;background:#111111;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">${esc(c.ctaLabel)}</a>
        ${secondaryBtn}
        ${itemsBlock}
        ${pickupBlock}
        ${localBlock}
        ${supportLine}
      </td></tr>
      <tr><td style="padding:18px 28px;background:#fafafa;border-top:1px solid #eee;font-size:11px;color:#999;text-align:center;">
        © ${new Date().getFullYear()} ${esc(p.storeName)}. Este é um e-mail transacional referente ao seu pedido.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  const itemsTxt = c.showItems
    ? '\n\nResumo do pedido:\n' +
      p.items.map((i) => `- ${i.name} x${i.qty} — ${BRL.format(i.totalPrice)}`).join('\n') +
      `\nSubtotal: ${BRL.format(p.subtotal)}` +
      (p.discountTotal > 0 ? `\nDesconto: -${BRL.format(p.discountTotal)}` : '') +
      `\n${shippingLabel}: ${shippingValue}` +
      `\nTotal: ${BRL.format(p.total)}`
    : '';

  const pickupTxt = (isPickup && p.pickup)
    ? `\n\nRetirada na loja:` +
      (p.pickup.storeName ? `\n${p.pickup.storeName}` : '') +
      (p.pickup.storeAddress ? `\n${p.pickup.storeAddress}` : '') +
      (p.pickup.storePhone ? `\nTelefone: ${p.pickup.storePhone}` : '') +
      (p.pickup.readyEta ? `\nTempo estimado: ${p.pickup.readyEta}` : '') +
      (p.pickup.instructions ? `\n${p.pickup.instructions}` : '')
    : '';

  const localTxt = (isLocalDelivery && p.localDelivery)
    ? `\n\nFrete Local Maricá/RJ:` +
      (p.localDelivery.district ? `\n${p.localDelivery.district}` : '') +
      (p.localDelivery.eta ? `\nPrazo: ${p.localDelivery.eta}` : '')
    : '';

  const text = `${greeting}

${c.headline}

${c.intro.replace(/<[^>]+>/g, '')}

${c.ctaLabel}: ${c.ctaUrl}${itemsTxt}${pickupTxt}${localTxt}

— ${p.storeName}`;

  return { subject: c.subject, html, text };
}
