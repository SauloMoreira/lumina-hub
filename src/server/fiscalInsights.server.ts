/**
 * Helpers server-only para insights fiscais.
 * Importado dinamicamente em operations.functions.ts e em fiscal.functions.ts
 * para não vazar `client.server` no bundle do cliente.
 */

export type FiscalQuickCounts = {
  productsActive: number;
  productsFiscalComplete: number;
  productsFiscalIncomplete: number;
  productsNeedReview: number;
  productsNoNcm: number;
  productsNoUnit: number;
  productsNoOrigin: number;
  productsNoWeightOrDims: number;
  productsNoEan: number;
  paidOrdersWithFiscalIssues: number;
  companyFiscalIncomplete: boolean;
  taxRegimeMissing: boolean;
};

export async function fetchFiscalQuickCounts(): Promise<FiscalQuickCounts> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

  async function count(filter: (q: any) => any): Promise<number> {
    try {
      const q = filter(
        supabaseAdmin.from('products').select('*', { count: 'exact', head: true }),
      );
      const { count } = await q;
      return count ?? 0;
    } catch {
      return 0;
    }
  }

  const [
    productsActive,
    productsFiscalComplete,
    productsFiscalIncomplete,
    productsNeedReview,
    productsNoNcm,
    productsNoUnit,
    productsNoOrigin,
    productsNoEan,
  ] = await Promise.all([
    count((q) => q.eq('active', true).neq('fiscal_status', 'nao_aplicavel')),
    count((q) => q.eq('active', true).eq('fiscal_status', 'completo')),
    count((q) => q.eq('active', true).eq('fiscal_status', 'incompleto')),
    count((q) => q.eq('active', true).eq('fiscal_status', 'revisar')),
    count((q) => q.eq('active', true).is('ncm', null)),
    count((q) => q.eq('active', true).or('commercial_unit.is.null,commercial_unit.eq.')),
    count((q) => q.eq('active', true).is('product_origin', null)),
    count((q) => q.eq('active', true).or('gtin_ean.is.null,gtin_ean.eq.')),
  ]);

  // Sem peso/dimensões (heurística: weight_kg/net/gross = 0/null E dimensões zeradas)
  let productsNoWeightOrDims = 0;
  try {
    const { data } = await supabaseAdmin
      .from('products')
      .select('id, weight_kg, net_weight, gross_weight, width_cm, height_cm, length_cm, active, fiscal_status')
      .eq('active', true)
      .neq('fiscal_status', 'nao_aplicavel')
      .limit(2000);
    productsNoWeightOrDims = (data ?? []).filter((p: any) => {
      const w = Number(p.weight_kg ?? p.net_weight ?? p.gross_weight ?? 0);
      const dimsOk =
        Number(p.width_cm ?? 0) > 0 &&
        Number(p.height_cm ?? 0) > 0 &&
        Number(p.length_cm ?? 0) > 0;
      return w <= 0 || !dimsOk;
    }).length;
  } catch {}

  // Pedidos pagos com algum item de produto fiscal incompleto/revisar
  let paidOrdersWithFiscalIssues = 0;
  try {
    const { data: items } = await supabaseAdmin
      .from('order_items')
      .select('order_id, product_id, products!inner(fiscal_status, active)')
      .in('products.fiscal_status', ['incompleto', 'revisar'])
      .limit(5000);
    const orderIds = Array.from(
      new Set((items ?? []).map((it: any) => it.order_id).filter(Boolean)),
    );
    if (orderIds.length > 0) {
      const { count } = await supabaseAdmin
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('id', orderIds)
        .eq('payment_status', 'paid');
      paidOrdersWithFiscalIssues = count ?? 0;
    }
  } catch {}

  // Dados fiscais da empresa
  let companyFiscalIncomplete = true;
  let taxRegimeMissing = true;
  try {
    const { data: fs } = await supabaseAdmin
      .from('finance_settings')
      .select(
        'fiscal_tax_regime, fiscal_default_nf_series, fiscal_default_operation_nature, fiscal_default_cfop_internal, fiscal_company_data_completed',
      )
      .limit(1)
      .maybeSingle();
    if (fs) {
      taxRegimeMissing = !fs.fiscal_tax_regime;
      companyFiscalIncomplete =
        !fs.fiscal_company_data_completed ||
        !fs.fiscal_tax_regime ||
        !fs.fiscal_default_nf_series ||
        !fs.fiscal_default_cfop_internal;
    }
  } catch {}

  return {
    productsActive,
    productsFiscalComplete,
    productsFiscalIncomplete,
    productsNeedReview,
    productsNoNcm,
    productsNoUnit,
    productsNoOrigin,
    productsNoWeightOrDims,
    productsNoEan,
    paidOrdersWithFiscalIssues,
    companyFiscalIncomplete,
    taxRegimeMissing,
  };
}
