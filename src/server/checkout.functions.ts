import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

// ============================================================
// ViaCEP — público, sem token
// ============================================================
export const lookupCep = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) =>
    z
      .object({
        cep: z
          .string()
          .transform((v) => v.replace(/\D/g, ''))
          .pipe(z.string().regex(/^\d{8}$/, 'CEP deve ter 8 dígitos')),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    try {
      const r = await fetch(`https://viacep.com.br/ws/${data.cep}/json/`);
      if (!r.ok) return { ok: false as const, error: 'CEP não encontrado' };
      const j = (await r.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (j.erro) return { ok: false as const, error: 'CEP não encontrado' };
      return {
        ok: true as const,
        street: j.logradouro ?? '',
        neighborhood: j.bairro ?? '',
        city: j.localidade ?? '',
        state: j.uf ?? '',
      };
    } catch {
      return { ok: false as const, error: 'Erro ao consultar CEP' };
    }
  });

// ============================================================
// Cálculo de frete — STUB local
// TODO: substituir pela chamada real ao Melhor Envio quando token disponível
// ============================================================
export const calculateShipping = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) =>
    z
      .object({
        zipCode: z.string().transform((v) => v.replace(/\D/g, '')),
        subtotal: z.number().min(0),
        weightKg: z.number().min(0).default(1),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    if (!/^\d{8}$/.test(data.zipCode)) {
      return { services: [], estimated: true as const, error: 'CEP deve ter 8 dígitos' };
    }

    // Estimativa local por região (DDD do CEP)
    const prefix = parseInt(data.zipCode.slice(0, 2), 10);
    let basePac = 22;
    let baseSedex = 38;
    let daysPac = 7;
    let daysSedex = 3;

    // RJ (20-28) — perto da loja
    if (prefix >= 20 && prefix <= 28) {
      basePac = 14;
      baseSedex = 24;
      daysPac = 3;
      daysSedex = 1;
    } else if (prefix >= 1 && prefix <= 19) {
      // SP
      basePac = 22;
      baseSedex = 36;
      daysPac = 5;
      daysSedex = 2;
    } else if (prefix >= 80 && prefix <= 99) {
      // Sul
      basePac = 32;
      baseSedex = 52;
      daysPac = 8;
      daysSedex = 4;
    } else if (prefix >= 40 && prefix <= 65) {
      // Nordeste
      basePac = 38;
      baseSedex = 64;
      daysPac = 10;
      daysSedex = 5;
    }

    const weightFactor = Math.max(1, data.weightKg);
    const services = [
      {
        id: 'pac',
        name: 'PAC',
        carrier: 'Correios',
        price: Number((basePac * weightFactor).toFixed(2)),
        days: daysPac,
      },
      {
        id: 'sedex',
        name: 'SEDEX',
        carrier: 'Correios',
        price: Number((baseSedex * weightFactor).toFixed(2)),
        days: daysSedex,
      },
    ];

    // Frete grátis local (RJ Maricá) acima de R$ 199
    if (prefix >= 24 && prefix <= 25 && data.subtotal >= 199) {
      services.unshift({
        id: 'local',
        name: 'Entrega local Maricá',
        carrier: 'Led Maricá',
        price: 0,
        days: 1,
      });
    }

    return { services, estimated: true as const };
  });

// ============================================================
// Aplicar cupom
// ============================================================
export const applyCoupon = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().min(1).max(40), subtotal: z.number().min(0) }).parse(input)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: rows, error } = await supabaseAdmin.rpc('apply_coupon' as never, {
      _code: data.code,
      _subtotal: data.subtotal,
    } as never);
    if (error) return { valid: false, discount: 0, message: 'Erro ao validar cupom' };
    const row = (Array.isArray(rows) ? rows[0] : rows) as
      | { valid: boolean; discount: number; message: string }
      | null;
    return {
      valid: Boolean(row?.valid),
      discount: Number(row?.discount ?? 0),
      message: String(row?.message ?? ''),
    };
  });

// ============================================================
// Criar pedido (RLS aplicada como o usuário)
// ============================================================
const CreateOrderInput = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        name: z.string(),
        sku: z.string().nullable().optional(),
        image: z.string().nullable().optional(),
        unitPrice: z.number().min(0),
        qty: z.number().int().min(1),
      })
    )
    .min(1),
  shipping: z.object({
    carrier: z.string(),
    service: z.string(),
    cost: z.number().min(0),
  }),
  address: z.object({
    recipient: z.string().min(1),
    zipCode: z
      .string()
      .transform((v) => v.replace(/\D/g, ''))
      .pipe(z.string().regex(/^\d{8}$/, 'CEP deve ter 8 dígitos')),
    street: z.string().min(1),
    number: z.string().min(1),
    complement: z.string().optional().nullable(),
    neighborhood: z.string().optional().nullable(),
    city: z.string().min(1),
    state: z.string().length(2),
    saveAddress: z.boolean().default(false),
  }),
  couponCode: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const createOrder = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateOrderInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Recalcula subtotal/desconto/total no servidor (nunca confiar no cliente)
    const subtotal = data.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);

    let discount = 0;
    if (data.couponCode) {
      const { data: rows } = await supabase.rpc('apply_coupon' as never, {
        _code: data.couponCode,
        _subtotal: subtotal,
      } as never);
      const row = Array.isArray(rows) ? (rows as Array<{ valid: boolean; discount: number }>)[0] : (rows as { valid: boolean; discount: number } | null);
      if (row?.valid) discount = Number(row.discount);
    }

    const total = Math.max(0, subtotal - discount + data.shipping.cost);

    // Salvar endereço (opcional)
    let addressId: string | null = null;
    if (data.address.saveAddress) {
      const { data: addr } = await supabase
        .from('addresses')
        .insert({
          user_id: userId,
          recipient: data.address.recipient,
          zip_code: data.address.zipCode,
          street: data.address.street,
          number: data.address.number,
          complement: data.address.complement ?? null,
          neighborhood: data.address.neighborhood ?? null,
          city: data.address.city,
          state: data.address.state,
        })
        .select('id')
        .single();
      addressId = addr?.id ?? null;
    }

    // Criar pedido
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        status: 'pending',
        payment_status: 'pending',
        payment_method: 'mercadopago',
        subtotal,
        discount,
        shipping_cost: data.shipping.cost,
        total,
        coupon_code: data.couponCode ?? null,
        shipping_carrier: data.shipping.carrier,
        shipping_service: data.shipping.service,
        address_id: addressId,
        address_snapshot: data.address as never,
        notes: data.notes ?? null,
      })
      .select('id, order_number')
      .single();

    if (orderErr || !order) {
      return { ok: false as const, error: orderErr?.message ?? 'Falha ao criar pedido' };
    }

    // Criar itens
    const { error: itemsErr } = await supabase.from('order_items').insert(
      data.items.map((i) => ({
        order_id: order.id,
        product_id: i.productId,
        product_name: i.name,
        product_sku: i.sku ?? null,
        product_image: i.image ?? null,
        unit_price: i.unitPrice,
        qty: i.qty,
        total_price: i.unitPrice * i.qty,
      }))
    );

    if (itemsErr) {
      return { ok: false as const, error: itemsErr.message };
    }

    // Disparar e-mail "pedido recebido" — não bloqueia retorno; falhas são logadas
    try {
      const { sendOrderEmail } = await import('@/server/email/orderEmails');
      void sendOrderEmail({ orderId: order.id, type: 'order_created' });
    } catch (e) {
      console.error('[checkout] falha ao agendar e-mail order_created', e);
    }

    return {
      ok: true as const,
      orderId: order.id,
      orderNumber: order.order_number,
    };
  });

// ============================================================
// Buscar pedido por id (para confirmação e detalhe)
// ============================================================
export const getOrderById = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', data.id)
      .single();
    if (error || !order) return { ok: false as const, error: 'Pedido não encontrado' };
    return { ok: true as const, order };
  });

// ============================================================
// Listar pedidos do usuário
// ============================================================
export const listMyOrders = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, status, payment_status, total, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    return { orders: data ?? [] };
  });
