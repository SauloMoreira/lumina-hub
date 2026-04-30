import { createServerFn } from '@tanstack/react-start';
import { requireAdmin } from '@/integrations/supabase/admin-middleware';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { fetchSeoQuickCounts } from './seoInsights.functions';

/**
 * Agrega todos os contadores e alertas usados pelo
 * "Painel do Dia" e pela página de "Pendências".
 *
 * Tudo aqui é apenas leitura — nenhuma regra de negócio é alterada.
 * Usamos `count: 'exact', head: true` sempre que possível para não
 * trafegar listas grandes.
 */

export type Severity = 'low' | 'medium' | 'high';
export type CardStatus = 'ok' | 'warn' | 'danger' | 'unknown';

export type OperationsCard = {
  id: string;
  title: string;
  description: string;
  qty: number;
  status: CardStatus;
  ctaLabel: string;
  ctaHref: string | null;
  group: string;
};

export type OperationsAlert = {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  ctaLabel: string;
  ctaHref: string | null;
};

export type DailyOperation = {
  ordersCreatedToday: number;
  ordersPaidToday: number;
  revenueToday: number;
  leadsToday: number;
  b2bNegotiationsToday: number;
  productsSoldToday: number;
  avgTicketToday: number;
};

export type OperationsData = {
  cards: OperationsCard[];
  alerts: OperationsAlert[];
  daily: DailyOperation;
  generatedAt: string;
};

function startOfTodayISO(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return d.toISOString();
}

function hoursAgoISO(h: number): string {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

async function safeCount(
  build: () => ReturnType<typeof supabaseAdmin.from>,
  filter: (q: any) => any,
): Promise<number> {
  try {
    const q = filter(build().select('*', { count: 'exact', head: true }));
    const { count, error } = await q;
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export const getAdminOperations = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .handler(async (): Promise<OperationsData> => {
    const todayISO = startOfTodayISO();
    const stale24h = hoursAgoISO(24);

    // ============================================================
    // Pedidos
    // ============================================================
    const paidAwaitingShipping = await safeCount(
      () => supabaseAdmin.from('orders'),
      (q) =>
        q
          .eq('payment_status', 'paid')
          .in('status', ['paid', 'confirmed', 'preparing']),
    );
    const paidStuck24h = await safeCount(
      () => supabaseAdmin.from('orders'),
      (q) =>
        q
          .eq('payment_status', 'paid')
          .in('status', ['paid', 'confirmed', 'preparing'])
          .lt('updated_at', stale24h),
    );
    const ordersAwaitingPayment = await safeCount(
      () => supabaseAdmin.from('orders'),
      (q) => q.in('payment_status', ['pending', 'in_process', 'preference_created']),
    );

    // ============================================================
    // Leads
    // ============================================================
    const newLeads = await safeCount(
      () => supabaseAdmin.from('leads'),
      (q) => q.in('status', ['novo', 'new']),
    );
    const leadsNoResponse24h = await safeCount(
      () => supabaseAdmin.from('leads'),
      (q) => q.in('status', ['novo', 'new']).lt('created_at', stale24h),
    );

    // ============================================================
    // B2B
    // ============================================================
    const pendingCompanies = await safeCount(
      () => supabaseAdmin.from('companies'),
      (q) => q.eq('status', 'pending'),
    );
    const openNegotiations = await safeCount(
      () => supabaseAdmin.from('b2b_negotiations'),
      (q) => q.in('status', ['nova', 'em_andamento']),
    );

    // Pedidos B2B pagos aguardando separação
    const b2bPaidAwaitingShipping = await safeCount(
      () => supabaseAdmin.from('orders'),
      (q) =>
        q
          .eq('order_type', 'b2b')
          .eq('payment_status', 'paid')
          .in('status', ['paid', 'confirmed', 'preparing']),
    );

    // Receita / ticket médio B2B do dia + total economizado em B2B hoje
    let b2bRevenueToday = 0;
    let b2bOrdersPaidToday = 0;
    let b2bAvgTicketToday = 0;
    let b2bDiscountGivenToday = 0;
    try {
      const { data: b2bPaid } = await supabaseAdmin
        .from('orders')
        .select('total, b2b_discount_total')
        .eq('order_type', 'b2b')
        .eq('payment_status', 'paid')
        .gte('paid_at', startOfTodayISO());
      b2bOrdersPaidToday = (b2bPaid ?? []).length;
      b2bRevenueToday = (b2bPaid ?? []).reduce((s, o) => s + Number(o.total ?? 0), 0);
      b2bDiscountGivenToday = (b2bPaid ?? []).reduce(
        (s, o) => s + Number((o as { b2b_discount_total?: number }).b2b_discount_total ?? 0),
        0,
      );
      b2bAvgTicketToday = b2bOrdersPaidToday > 0 ? b2bRevenueToday / b2bOrdersPaidToday : 0;
    } catch {}

    // Configuração B2B (cupom)
    let b2bAllowsCoupon = false;
    try {
      const { data: bs } = await supabaseAdmin
        .from('b2b_settings')
        .select('allow_coupon_in_b2b')
        .limit(1)
        .maybeSingle();
      b2bAllowsCoupon = Boolean((bs as { allow_coupon_in_b2b?: boolean } | null)?.allow_coupon_in_b2b);
    } catch {}


    // ============================================================
    // Produtos
    // ============================================================
    // Estoque baixo: stock_qty <= stock_min_alert (e ativo)
    let lowStock = 0;
    try {
      const { data: lowRows } = await supabaseAdmin
        .from('products')
        .select('id, stock_qty, stock_min_alert, active')
        .eq('active', true)
        .limit(1000);
      lowStock = (lowRows ?? []).filter(
        (p) => Number(p.stock_qty ?? 0) <= Number(p.stock_min_alert ?? 0),
      ).length;
    } catch {}

    const productsNoImage = await safeCount(
      () => supabaseAdmin.from('products'),
      (q) =>
        q
          .eq('active', true)
          .or('images.is.null,images.eq.{}'),
    );
    const productsNoPrice = await safeCount(
      () => supabaseAdmin.from('products'),
      (q) => q.eq('active', true).or('price.is.null,price.eq.0'),
    );
    const productsNoWeight = await safeCount(
      () => supabaseAdmin.from('products'),
      (q) => q.eq('active', true).or('weight_kg.is.null,weight_kg.eq.0'),
    );
    const productsOutOfStock = await safeCount(
      () => supabaseAdmin.from('products'),
      (q) => q.eq('active', true).eq('stock_qty', 0),
    );
    const productsNoCategory = await safeCount(
      () => supabaseAdmin.from('products'),
      (q) => q.eq('active', true).is('category_id', null),
    );
    const productsNoSeo = await safeCount(
      () => supabaseAdmin.from('products'),
      (q) =>
        q
          .eq('active', true)
          .or('seo_title.is.null,seo_description.is.null'),
    );

    // B2B: preço sem qty mínima e vice-versa
    const b2bPriceNoMinQty = await safeCount(
      () => supabaseAdmin.from('products'),
      (q) =>
        q
          .eq('active', true)
          .eq('b2b_enabled', true)
          .not('b2b_price', 'is', null)
          .or('b2b_min_qty.is.null,b2b_min_qty.eq.0'),
    );
    const b2bMinQtyNoPrice = await safeCount(
      () => supabaseAdmin.from('products'),
      (q) =>
        q
          .eq('active', true)
          .eq('b2b_enabled', true)
          .not('b2b_min_qty', 'is', null)
          .gt('b2b_min_qty', 0)
          .is('b2b_price', null),
    );

    // ============================================================
    // Logística — bairros frete local
    // ============================================================
    const localZonesActive = await safeCount(
      () => supabaseAdmin.from('local_delivery_zones'),
      (q) => q.eq('is_active', true),
    );
    const localZonesNoPrice = await safeCount(
      () => supabaseAdmin.from('local_delivery_zones'),
      (q) =>
        q
          .eq('is_active', true)
          .eq('inherits_parent_price', false)
          .is('shipping_price', null),
    );

    // Retirada na loja sem endereço
    let pickupMissingAddress = 0;
    try {
      const { data: cs } = await supabaseAdmin
        .from('company_settings')
        .select('pickup_enabled, pickup_address')
        .limit(1)
        .maybeSingle();
      if (cs?.pickup_enabled && !cs?.pickup_address) {
        pickupMissingAddress = 1;
      }
    } catch {}

    // Webhook MP com erro
    const webhookErrors = await safeCount(
      () => supabaseAdmin.from('payment_webhook_events'),
      (q) =>
        q
          .gte('created_at', hoursAgoISO(24 * 7))
          .not('processing_error', 'is', null),
    );

    // ============================================================
    // Operação de hoje
    // ============================================================
    const ordersCreatedToday = await safeCount(
      () => supabaseAdmin.from('orders'),
      (q) => q.gte('created_at', todayISO),
    );
    const ordersPaidToday = await safeCount(
      () => supabaseAdmin.from('orders'),
      (q) => q.eq('payment_status', 'paid').gte('paid_at', todayISO),
    );
    let revenueToday = 0;
    let productsSoldToday = 0;
    let avgTicketToday = 0;
    try {
      const { data: paid } = await supabaseAdmin
        .from('orders')
        .select('id, total')
        .eq('payment_status', 'paid')
        .gte('paid_at', todayISO);
      const ids = (paid ?? []).map((o) => o.id);
      revenueToday = (paid ?? []).reduce((s, o) => s + Number(o.total ?? 0), 0);
      avgTicketToday = (paid ?? []).length > 0 ? revenueToday / (paid as any[]).length : 0;
      if (ids.length > 0) {
        const { data: items } = await supabaseAdmin
          .from('order_items')
          .select('qty')
          .in('order_id', ids);
        productsSoldToday = (items ?? []).reduce((s, it) => s + Number(it.qty ?? 0), 0);
      }
    } catch {}

    const leadsToday = await safeCount(
      () => supabaseAdmin.from('leads'),
      (q) => q.gte('created_at', todayISO),
    );
    const b2bNegotiationsToday = await safeCount(
      () => supabaseAdmin.from('b2b_negotiations'),
      (q) => q.gte('created_at', todayISO),
    );

    // Carrinhos abandonados
    const abandonedNew = await safeCount(
      () => supabaseAdmin.from('abandoned_carts'),
      (q) => q.in('status', ['novo', 'contato_enviado']),
    );
    const abandonedStuck24h = await safeCount(
      () => supabaseAdmin.from('abandoned_carts'),
      (q) => q.in('status', ['novo', 'contato_enviado']).lt('abandoned_at', stale24h),
    );
    let abandonedHighValue = 0;
    let abandonedTotalValue = 0;
    let abandonedB2bCount = 0;
    try {
      const { data: ac } = await supabaseAdmin
        .from('abandoned_carts')
        .select('subtotal_amount, company_id')
        .in('status', ['novo', 'contato_enviado'])
        .limit(500);
      (ac ?? []).forEach((c) => {
        const v = Number(c.subtotal_amount ?? 0);
        abandonedTotalValue += v;
        if (v >= 1000) abandonedHighValue += 1;
        if (c.company_id) abandonedB2bCount += 1;
      });
    } catch {}

    // ============================================================
    // SEO Insights (counts leves)
    // ============================================================
    let seo: Awaited<ReturnType<typeof fetchSeoQuickCounts>> = {
      productsNoSeoTitle: 0,
      productsNoSeoDescription: 0,
      productsNoImage: 0,
      productsNoDescription: 0,
      categoriesNoDescription: 0,
      homepageMissingSeo: false,
      b2bMissingSeo: false,
    };
    try { seo = await fetchSeoQuickCounts(); } catch {}

    const seoTotalIssues =
      seo.productsNoSeoTitle +
      seo.productsNoSeoDescription +
      seo.productsNoImage +
      seo.categoriesNoDescription +
      (seo.homepageMissingSeo ? 1 : 0) +
      (seo.b2bMissingSeo ? 1 : 0);

    // ============================================================
    // Marketing Integrations (pixels/analytics)
    // ============================================================
    let hasGa4 = false;
    let hasMetaPixel = false;
    let activeBadFormatCount = 0;
    try {
      const { data: integs } = await supabaseAdmin
        .from('marketing_integrations')
        .select('provider, account_id, enabled');
      const ID_PATTERNS: Record<string, RegExp> = {
        ga4: new RegExp('^G-[A-Z0-9]{6,}$', 'i'),
        gtm: new RegExp('^GTM-[A-Z0-9]{4,}$', 'i'),
        meta_pixel: new RegExp('^[0-9]{6,20}$'),
        tiktok_pixel: new RegExp('^[A-Z0-9]{15,30}$', 'i'),
        clarity: new RegExp('^[a-z0-9]{6,20}$', 'i'),
        google_ads: new RegExp('^AW-[0-9]{6,}$', 'i'),
      };
      (integs ?? []).forEach((i: any) => {
        if (i.provider === 'ga4') hasGa4 = true;
        if (i.provider === 'meta_pixel') hasMetaPixel = true;
        if (i.enabled) {
          const re = ID_PATTERNS[i.provider];
          if (re && !re.test(String(i.account_id ?? '').trim())) {
            activeBadFormatCount += 1;
          }
        }
      });
    } catch {}

    // ============================================================
    // Monta cards
    // ============================================================
    const cards: OperationsCard[] = [
      {
        id: 'paid-awaiting-shipping',
        title: 'Pedidos pagos aguardando separação',
        description: 'Pedidos já pagos que precisam ser separados para entrega ou retirada.',
        qty: paidAwaitingShipping,
        status:
          paidAwaitingShipping === 0
            ? 'ok'
            : paidStuck24h > 0
              ? 'danger'
              : 'warn',
        ctaLabel: 'Ver pedidos',
        ctaHref: '/admin/pedidos',
        group: 'Pedidos',
      },
      {
        id: 'orders-awaiting-payment',
        title: 'Pedidos aguardando pagamento',
        description: 'Pedidos criados mas ainda sem confirmação de pagamento.',
        qty: ordersAwaitingPayment,
        status: ordersAwaitingPayment === 0 ? 'ok' : 'warn',
        ctaLabel: 'Ver pedidos',
        ctaHref: '/admin/pedidos',
        group: 'Pedidos',
      },
      {
        id: 'new-leads',
        title: 'Leads novos',
        description: 'Leads que chegaram e ainda não foram trabalhados.',
        qty: newLeads,
        status:
          newLeads === 0 ? 'ok' : leadsNoResponse24h > 0 ? 'danger' : 'warn',
        ctaLabel: 'Responder leads',
        ctaHref: '/admin/leads',
        group: 'Clientes e leads',
      },
      {
        id: 'leads-no-response',
        title: 'Leads sem resposta há +24h',
        description: 'Leads que estão parados há mais de um dia. Risco de perder a venda.',
        qty: leadsNoResponse24h,
        status: leadsNoResponse24h === 0 ? 'ok' : 'danger',
        ctaLabel: 'Responder leads',
        ctaHref: '/admin/leads',
        group: 'Clientes e leads',
      },
      {
        id: 'pending-companies',
        title: 'Empresas B2B pendentes',
        description: 'Empresas aguardando aprovação para acessar preços de atacado.',
        qty: pendingCompanies,
        status: pendingCompanies === 0 ? 'ok' : 'warn',
        ctaLabel: 'Analisar empresas',
        ctaHref: '/admin/empresas',
        group: 'B2B',
      },
      {
        id: 'b2b-open-negotiations',
        title: 'Negociações B2B abertas',
        description: 'Negociações em andamento que precisam de retorno.',
        qty: openNegotiations,
        status: openNegotiations === 0 ? 'ok' : 'warn',
        ctaLabel: 'Ver negociações',
        ctaHref: null,
        group: 'B2B',
      },
      {
        id: 'b2b-paid-awaiting',
        title: 'Pedidos B2B pagos aguardando separação',
        description: 'Pedidos de empresa já pagos que precisam ser separados — priorize.',
        qty: b2bPaidAwaitingShipping,
        status: b2bPaidAwaitingShipping === 0 ? 'ok' : 'warn',
        ctaLabel: 'Ver pedidos',
        ctaHref: '/admin/pedidos',
        group: 'B2B',
      },
      {
        id: 'b2b-revenue-today',
        title: 'Vendas B2B pagas hoje',
        description:
          b2bOrdersPaidToday > 0
            ? `Ticket médio ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(b2bAvgTicketToday)} · ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(b2bDiscountGivenToday)} concedidos em desconto empresa.`
            : 'Nenhum pedido B2B pago foi registrado hoje ainda.',
        qty: b2bOrdersPaidToday,
        status: 'ok',
        ctaLabel: 'Ver pedidos B2B',
        ctaHref: '/admin/pedidos',
        group: 'B2B',
      },
      {
        id: 'low-stock',
        title: 'Produtos com estoque baixo',
        description: 'Produtos com estoque igual ou abaixo do mínimo definido.',
        qty: lowStock,
        status: lowStock === 0 ? 'ok' : 'warn',
        ctaLabel: 'Ver produtos',
        ctaHref: '/admin/produtos',
        group: 'Produtos',
      },
      {
        id: 'out-of-stock',
        title: 'Produtos ativos sem estoque',
        description: 'Produtos publicados mas sem unidades disponíveis.',
        qty: productsOutOfStock,
        status: productsOutOfStock === 0 ? 'ok' : 'danger',
        ctaLabel: 'Ver produtos',
        ctaHref: '/admin/produtos',
        group: 'Produtos',
      },
      {
        id: 'no-image',
        title: 'Produtos sem imagem',
        description: 'Produtos publicados sem imagem prejudicam a conversão.',
        qty: productsNoImage,
        status: productsNoImage === 0 ? 'ok' : 'warn',
        ctaLabel: 'Corrigir produtos',
        ctaHref: '/admin/produtos',
        group: 'Produtos',
      },
      {
        id: 'no-price',
        title: 'Produtos sem preço',
        description: 'Produtos ativos sem preço configurado não podem ser vendidos.',
        qty: productsNoPrice,
        status: productsNoPrice === 0 ? 'ok' : 'danger',
        ctaLabel: 'Corrigir produtos',
        ctaHref: '/admin/produtos',
        group: 'Produtos',
      },
      {
        id: 'no-weight',
        title: 'Produtos sem peso/dimensão',
        description: 'Sem essas informações o cálculo de frete pode falhar.',
        qty: productsNoWeight,
        status: productsNoWeight === 0 ? 'ok' : 'warn',
        ctaLabel: 'Corrigir produtos',
        ctaHref: '/admin/produtos',
        group: 'Produtos',
      },
      {
        id: 'local-zones-no-price',
        title: 'Bairros sem valor de frete',
        description: 'Bairros ativos para entrega local que ainda não têm valor configurado.',
        qty: localZonesNoPrice,
        status: localZonesNoPrice === 0 ? 'ok' : 'danger',
        ctaLabel: 'Configurar frete',
        ctaHref: '/admin/settings/frete-local',
        group: 'Logística',
      },
      {
        id: 'abandoned-carts',
        title: 'Carrinhos abandonados',
        description:
          abandonedTotalValue > 0
            ? `Valor total parado: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(abandonedTotalValue)}.`
            : 'Clientes que adicionaram produtos mas não finalizaram a compra.',
        qty: abandonedNew,
        status:
          abandonedNew === 0
            ? 'ok'
            : abandonedHighValue > 0 || abandonedStuck24h > 0
              ? 'danger'
              : 'warn',
        ctaLabel: 'Ver carrinhos',
        ctaHref: '/admin/carrinhos-abandonados',
        group: 'Pedidos',
      },
      {
        id: 'seo-pendencias',
        title: 'SEO com pendências',
        description: 'Produtos, categorias ou páginas com SEO incompleto. Corrigir ajuda a aparecer no Google.',
        qty: seoTotalIssues,
        status: seoTotalIssues === 0
          ? 'ok'
          : (seo.homepageMissingSeo || seo.productsNoSeoTitle > 10 ? 'danger' : 'warn'),
        ctaLabel: 'Ver SEO Insights',
        ctaHref: '/admin/seo',
        group: 'Marketing',
      },
    ];

    // ============================================================
    // Monta alertas importantes
    // ============================================================
    const alerts: OperationsAlert[] = [];

    if (paidStuck24h > 0) {
      alerts.push({
        id: 'paid-stuck',
        title: 'Pedidos pagos parados há mais de 24h',
        description: `${paidStuck24h} pedido(s) pago(s) ainda não foram separados. Atrasos comprometem a entrega.`,
        severity: 'high',
        ctaLabel: 'Ver pedidos',
        ctaHref: '/admin/pedidos',
      });
    }
    if (productsNoPrice > 0) {
      alerts.push({
        id: 'alert-no-price',
        title: 'Produtos ativos sem preço',
        description: `${productsNoPrice} produto(s) publicado(s) sem preço. O cliente não consegue comprar.`,
        severity: 'high',
        ctaLabel: 'Corrigir produtos',
        ctaHref: '/admin/produtos',
      });
    }
    if (localZonesActive === 0) {
      alerts.push({
        id: 'alert-local-zones-empty',
        title: 'Frete local sem bairros ativos',
        description: 'Você ainda não ativou nenhum bairro para entrega local em Maricá.',
        severity: 'medium',
        ctaLabel: 'Configurar frete',
        ctaHref: '/admin/settings/frete-local',
      });
    }
    if (localZonesNoPrice > 0) {
      alerts.push({
        id: 'alert-local-zones-no-price',
        title: 'Bairros ativos sem valor de frete',
        description: `${localZonesNoPrice} bairro(s) ativo(s) sem preço de frete. O checkout pode falhar.`,
        severity: 'high',
        ctaLabel: 'Configurar frete',
        ctaHref: '/admin/settings/frete-local',
      });
    }
    if (pickupMissingAddress > 0) {
      alerts.push({
        id: 'alert-pickup-no-address',
        title: 'Retirada na loja sem endereço',
        description: 'Você ativou a retirada na loja mas não cadastrou o endereço.',
        severity: 'medium',
        ctaLabel: 'Configurar empresa',
        ctaHref: '/admin/settings/company',
      });
    }
    if (pendingCompanies > 0) {
      alerts.push({
        id: 'alert-pending-companies',
        title: 'Empresas B2B aguardando aprovação',
        description: `${pendingCompanies} empresa(s) aguardando análise para liberar preços B2B.`,
        severity: 'medium',
        ctaLabel: 'Analisar empresas',
        ctaHref: '/admin/empresas',
      });
    }
    if (b2bPriceNoMinQty > 0) {
      alerts.push({
        id: 'alert-b2b-price-no-min',
        title: 'Produto B2B sem quantidade mínima',
        description: `${b2bPriceNoMinQty} produto(s) com preço B2B mas sem quantidade mínima definida.`,
        severity: 'medium',
        ctaLabel: 'Corrigir produtos',
        ctaHref: '/admin/produtos',
      });
    }
    if (b2bMinQtyNoPrice > 0) {
      alerts.push({
        id: 'alert-b2b-min-no-price',
        title: 'Produto B2B sem preço de atacado',
        description: `${b2bMinQtyNoPrice} produto(s) com quantidade mínima B2B mas sem preço B2B.`,
        severity: 'medium',
        ctaLabel: 'Corrigir produtos',
        ctaHref: '/admin/produtos',
      });
    }
    if (abandonedHighValue > 0) {
      alerts.push({
        id: 'alert-abandoned-high-value',
        title: 'Carrinho abandonado de alto valor',
        description: `${abandonedHighValue} carrinho(s) acima de R$ 1.000 aguardando contato pelo WhatsApp.`,
        severity: 'high',
        ctaLabel: 'Ver carrinhos',
        ctaHref: '/admin/carrinhos-abandonados',
      });
    }
    if (abandonedStuck24h > 0) {
      alerts.push({
        id: 'alert-abandoned-stuck',
        title: 'Carrinhos sem retorno há +24h',
        description: `${abandonedStuck24h} carrinho(s) abandonado(s) sem retorno do cliente.`,
        severity: 'medium',
        ctaLabel: 'Ver carrinhos',
        ctaHref: '/admin/carrinhos-abandonados',
      });
    }
    if (abandonedB2bCount > 0) {
      alerts.push({
        id: 'alert-abandoned-b2b',
        title: 'Carrinho B2B abandonado',
        description: `${abandonedB2bCount} carrinho(s) B2B aguardando recuperação.`,
        severity: 'medium',
        ctaLabel: 'Ver carrinhos',
        ctaHref: '/admin/carrinhos-abandonados',
      });
    }
    if (productsNoImage > 0) {
      alerts.push({
        id: 'alert-no-image',
        title: 'Produtos ativos sem imagem',
        description: `${productsNoImage} produto(s) publicado(s) sem imagem. Isso reduz suas vendas.`,
        severity: 'low',
        ctaLabel: 'Corrigir produtos',
        ctaHref: '/admin/produtos',
      });
    }
    if (webhookErrors > 0) {
      alerts.push({
        id: 'alert-webhook-errors',
        title: 'Webhooks de pagamento com erro',
        description: `${webhookErrors} webhook(s) do Mercado Pago com erro nos últimos 7 dias.`,
        severity: 'high',
        ctaLabel: 'Ver detalhes',
        ctaHref: '/admin',
      });
    }

    // SEO alerts
    if (seo.homepageMissingSeo) {
      alerts.push({
        id: 'alert-seo-home',
        title: 'Homepage sem SEO configurado',
        description: 'A homepage está sem título ou descrição SEO — perde tráfego do Google.',
        severity: 'high',
        ctaLabel: 'Configurar SEO',
        ctaHref: '/admin/conteudo/homepage',
      });
    }
    if (seo.b2bMissingSeo) {
      alerts.push({
        id: 'alert-seo-b2b',
        title: 'Vitrine B2B sem SEO',
        description: 'A página B2B está sem título e descrição SEO configurados.',
        severity: 'medium',
        ctaLabel: 'Ver SEO Insights',
        ctaHref: '/admin/seo',
      });
    }
    if (seo.productsNoSeoTitle > 0 || seo.productsNoSeoDescription > 0) {
      alerts.push({
        id: 'alert-seo-products',
        title: 'Produtos com SEO incompleto',
        description: `${seo.productsNoSeoTitle} sem título SEO, ${seo.productsNoSeoDescription} sem meta description.`,
        severity: 'medium',
        ctaLabel: 'Ver SEO Insights',
        ctaHref: '/admin/seo',
      });
    }
    if (seo.categoriesNoDescription > 0) {
      alerts.push({
        id: 'alert-seo-categories',
        title: 'Categorias sem descrição',
        description: `${seo.categoriesNoDescription} categoria(s) sem descrição prejudicam a navegação e o SEO.`,
        severity: 'low',
        ctaLabel: 'Ver SEO Insights',
        ctaHref: '/admin/seo',
      });
    }

    // Marketing Integrations (pixels/analytics)
    if (!hasGa4) {
      alerts.push({
        id: 'alert-no-ga4',
        title: 'Google Analytics 4 não configurado',
        description: 'Sem GA4 você não mede tráfego, conversões nem origem das vendas.',
        severity: 'medium',
        ctaLabel: 'Configurar GA4',
        ctaHref: '/admin/integracoes',
      });
    }
    if (!hasMetaPixel) {
      alerts.push({
        id: 'alert-no-meta-pixel',
        title: 'Meta Pixel não configurado',
        description: 'Sem o Meta Pixel, campanhas no Facebook/Instagram não otimizam para vendas.',
        severity: 'low',
        ctaLabel: 'Configurar Meta Pixel',
        ctaHref: '/admin/integracoes',
      });
    }
    if (activeBadFormatCount > 0) {
      alerts.push({
        id: 'alert-integrations-bad-format',
        title: 'Integração ativa com ID inválido',
        description: `${activeBadFormatCount} integração(ões) ativa(s) com ID em formato inválido — não estão coletando dados.`,
        severity: 'high',
        ctaLabel: 'Corrigir integrações',
        ctaHref: '/admin/integracoes',
      });
    }
    if (b2bPaidAwaitingShipping > 0) {
      alerts.push({
        id: 'alert-b2b-paid-awaiting',
        title: 'Pedidos B2B pagos aguardando separação',
        description: `${b2bPaidAwaitingShipping} pedido(s) de empresa pago(s) precisam ser separados — clientes B2B costumam ser exigentes com prazo.`,
        severity: 'medium',
        ctaLabel: 'Ver pedidos',
        ctaHref: '/admin/pedidos',
      });
    }
    if (b2bAllowsCoupon) {
      alerts.push({
        id: 'alert-b2b-coupon-on',
        title: 'Cupons permitidos em pedidos B2B',
        description: 'A configuração atual permite acumular cupom sobre o preço empresa. Revise se realmente quer essa política.',
        severity: 'low',
        ctaLabel: 'Revisar configurações B2B',
        ctaHref: '/admin/configuracoes-b2b',
      });
    }
      cards,
      alerts,
      daily: {
        ordersCreatedToday,
        ordersPaidToday,
        revenueToday,
        leadsToday,
        b2bNegotiationsToday,
        productsSoldToday,
        avgTicketToday,
      },
      generatedAt: new Date().toISOString(),
    };
  });
