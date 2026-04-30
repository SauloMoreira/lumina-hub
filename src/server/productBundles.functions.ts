import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

// ----------------------------------------------------------------------------
// Tipos compartilhados
// ----------------------------------------------------------------------------
export type BundleAvailability =
  | 'available'
  | 'partial'
  | 'unavailable'
  | 'needs_review';

export type BundleItemPublic = {
  id: string;
  product_id: string;
  quantity: number;
  sort_order: number;
  is_required: boolean;
  product: {
    id: string;
    name: string;
    slug: string;
    sku: string | null;
    brand: string | null;
    image: string | null;
    active: boolean;
    retail_price: number; // price (sem sale)
    sale_price: number | null;
    final_price: number; // sale_price ?? price
    stock_qty: number;
    free_shipping_eligible: boolean;
    b2b_enabled: boolean;
    b2b_min_qty: number | null;
  };
  // Status calculado por item
  status: 'ok' | 'inactive' | 'no_price' | 'no_stock';
};

export type BundleDiscountType = 'none' | 'fixed_amount' | 'percentage';

export type BundlePublic = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  is_featured: boolean;
  start_date: string | null;
  end_date: string | null;
  discount_type: BundleDiscountType;
  discount_value: number;
  items: BundleItemPublic[];
  subtotal: number;
  items_count: number;
  total_units: number;
  availability: BundleAvailability;
};

// Limite seguro de desconto percentual para combos (admin pode rever depois)
export const BUNDLE_PERCENT_LIMIT = 50;

export type BundleAdminRow = {
  id: string;
  slug: string | null;
  name: string;
  is_active: boolean;
  is_featured: boolean;
  image_url: string | null;
  items_count: number;
  start_date: string | null;
  end_date: string | null;
  updated_at: string;
};

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
async function getOptionalUserId(): Promise<string | null> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  try {
    const { getRequestHeader } = await import('@tanstack/react-start/server');
    const auth = getRequestHeader('Authorization') || getRequestHeader('authorization');
    if (auth && auth.toLowerCase().startsWith('bearer ')) {
      const token = auth.slice(7).trim();
      const { data: userRes } = await supabaseAdmin.auth.getUser(token);
      return userRes.user?.id ?? null;
    }
  } catch {
    /* anon */
  }
  return null;
}

async function requireAdmin(): Promise<string> {
  const userId = await getOptionalUserId();
  if (!userId) throw new Error('not_authenticated');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.role !== 'admin') throw new Error('not_authorized');
  return userId;
}

function classifyItem(p: {
  active: boolean;
  final_price: number;
  stock_qty: number;
}): BundleItemPublic['status'] {
  if (!p.active) return 'inactive';
  if (!(p.final_price > 0)) return 'no_price';
  if (p.stock_qty <= 0) return 'no_stock';
  return 'ok';
}

function calcAvailability(items: BundleItemPublic[]): BundleAvailability {
  if (items.length === 0) return 'needs_review';
  const required = items.filter((i) => i.is_required);
  const reqUnavailable = required.filter(
    (i) => i.product.stock_qty < i.quantity || i.status === 'no_stock'
  );
  const reqBroken = required.some(
    (i) => i.status === 'inactive' || i.status === 'no_price'
  );
  if (reqBroken) return 'unavailable';
  if (reqUnavailable.length === required.length && required.length > 0) {
    return 'unavailable';
  }
  if (reqUnavailable.length > 0) return 'partial';
  // Algum opcional indisponível?
  const someoneShort = items.some(
    (i) => i.product.stock_qty < i.quantity || i.status !== 'ok'
  );
  return someoneShort ? 'partial' : 'available';
}

async function loadBundlesWithItems(filter: {
  bundleIds?: string[];
  slug?: string;
  onlyActive?: boolean;
  featuredFirst?: boolean;
  limit?: number;
}): Promise<BundlePublic[]> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  let q = supabaseAdmin
    .from('product_bundles')
    .select(
      `id, slug, name, description, image_url, is_active, is_featured,
       start_date, end_date, discount_type, discount_value, updated_at,
       items:product_bundle_items (
         id, product_id, quantity, sort_order, is_required,
         product:products (
           id, name, slug, sku, brand, images, active,
           price, sale_price, stock_qty, free_shipping_eligible,
           b2b_enabled, b2b_min_qty
         )
       )`
    );

  if (filter.bundleIds?.length) q = q.in('id', filter.bundleIds);
  if (filter.slug) q = q.eq('slug', filter.slug);
  if (filter.onlyActive) {
    const nowIso = new Date().toISOString();
    q = q
      .eq('is_active', true)
      .or(`start_date.is.null,start_date.lte.${nowIso}`)
      .or(`end_date.is.null,end_date.gte.${nowIso}`);
  }
  if (filter.featuredFirst) q = q.order('is_featured', { ascending: false });
  q = q.order('updated_at', { ascending: false });
  if (filter.limit) q = q.limit(filter.limit);

  const { data, error } = await q;
  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, any>>;
  return rows.map((b) => {
    const itemRows = (b.items ?? []) as Array<Record<string, any>>;
    const items: BundleItemPublic[] = itemRows
      .map((it) => {
        const p = it.product as Record<string, any> | null;
        if (!p) return null;
        const retail = Number(p.price ?? 0);
        const sale = p.sale_price != null ? Number(p.sale_price) : null;
        const finalPrice = sale != null && sale > 0 ? sale : retail;
        const productInfo: BundleItemPublic['product'] = {
          id: p.id,
          name: p.name,
          slug: p.slug,
          sku: p.sku ?? null,
          brand: p.brand ?? null,
          image:
            Array.isArray(p.images) && p.images.length > 0
              ? (p.images[0] as string)
              : null,
          active: !!p.active,
          retail_price: retail,
          sale_price: sale,
          final_price: finalPrice,
          stock_qty: Number(p.stock_qty ?? 0),
          free_shipping_eligible: !!p.free_shipping_eligible,
          b2b_enabled: !!p.b2b_enabled,
          b2b_min_qty: p.b2b_min_qty != null ? Number(p.b2b_min_qty) : null,
        };
        return {
          id: it.id,
          product_id: it.product_id,
          quantity: Number(it.quantity ?? 1),
          sort_order: Number(it.sort_order ?? 0),
          is_required: !!it.is_required,
          product: productInfo,
          status: classifyItem(productInfo),
        } as BundleItemPublic;
      })
      .filter((x): x is BundleItemPublic => x !== null)
      .sort((a, b) => a.sort_order - b.sort_order);

    const subtotal = items.reduce(
      (acc, it) => acc + it.product.final_price * it.quantity,
      0
    );
    const totalUnits = items.reduce((acc, it) => acc + it.quantity, 0);

    return {
      id: b.id,
      slug: b.slug,
      name: b.name,
      description: b.description,
      image_url: b.image_url,
      is_active: !!b.is_active,
      is_featured: !!b.is_featured,
      start_date: b.start_date,
      end_date: b.end_date,
      discount_type: (b.discount_type ?? 'none') as BundleDiscountType,
      discount_value: Number(b.discount_value ?? 0),
      items,
      subtotal,
      items_count: items.length,
      total_units: totalUnits,
      availability: calcAvailability(items),
    } satisfies BundlePublic;
  });
}

// ----------------------------------------------------------------------------
// PUBLIC: lista combos ativos
// ----------------------------------------------------------------------------
const ListPublicInput = z.object({
  limit: z.number().int().min(1).max(48).optional(),
  featuredOnly: z.boolean().optional(),
});

export const listPublicBundles = createServerFn({ method: 'POST' })
  .inputValidator((i: unknown) => ListPublicInput.parse(i ?? {}))
  .handler(async ({ data }) => {
    const bundles = await loadBundlesWithItems({
      onlyActive: true,
      featuredFirst: true,
      limit: data.limit ?? 24,
    });
    const filtered = data.featuredOnly ? bundles.filter((b) => b.is_featured) : bundles;
    // Apenas combos com pelo menos 1 item válido
    return filtered.filter((b) => b.items.length > 0);
  });

// ----------------------------------------------------------------------------
// PUBLIC: detalhe de combo por slug
// ----------------------------------------------------------------------------
const GetBySlugInput = z.object({ slug: z.string().trim().min(1).max(160) });

export const getPublicBundleBySlug = createServerFn({ method: 'POST' })
  .inputValidator((i: unknown) => GetBySlugInput.parse(i))
  .handler(async ({ data }) => {
    const bundles = await loadBundlesWithItems({
      slug: data.slug,
      onlyActive: true,
      limit: 1,
    });
    return bundles[0] ?? null;
  });

// ----------------------------------------------------------------------------
// PUBLIC: combos que contêm um produto específico
// ----------------------------------------------------------------------------
const ListByProductInput = z.object({
  productId: z.string().uuid(),
  limit: z.number().int().min(1).max(12).optional(),
});

export const listPublicBundlesByProduct = createServerFn({ method: 'POST' })
  .inputValidator((i: unknown) => ListByProductInput.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    // 1. Busca os bundle_ids que contêm este produto
    const { data: links, error } = await supabaseAdmin
      .from('product_bundle_items')
      .select('bundle_id')
      .eq('product_id', data.productId);
    if (error) throw error;
    const bundleIds = Array.from(
      new Set(((links ?? []) as Array<{ bundle_id: string }>).map((l) => l.bundle_id))
    );
    if (bundleIds.length === 0) return [];

    // 2. Carrega os combos completos, filtrando por ativos/validade
    const bundles = await loadBundlesWithItems({
      bundleIds,
      onlyActive: true,
      featuredFirst: true,
      limit: data.limit ?? 4,
    });

    // 3. Filtra: precisa ter pelo menos 1 item, slug válido, e nenhum
    //    obrigatório quebrado (inativo/sem preço)
    const valid = bundles.filter((b) => {
      if (!b.slug) return false;
      if (b.items.length === 0) return false;
      const broken = b.items.some(
        (it) => it.is_required && (it.status === 'inactive' || it.status === 'no_price')
      );
      if (broken) return false;
      return true;
    });

    return valid.slice(0, data.limit ?? 4);
  });

// ----------------------------------------------------------------------------
// ADMIN: lista combos
// ----------------------------------------------------------------------------
export const adminListBundles = createServerFn({ method: 'POST' })
  .inputValidator(() => ({}))
  .handler(async () => {
    await requireAdmin();
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data, error } = await supabaseAdmin
      .from('product_bundles')
      .select(
        `id, slug, name, is_active, is_featured, image_url, start_date, end_date, updated_at,
         items:product_bundle_items(id)`
      )
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as Array<Record<string, any>>).map<BundleAdminRow>((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      is_active: !!b.is_active,
      is_featured: !!b.is_featured,
      image_url: b.image_url,
      items_count: Array.isArray(b.items) ? b.items.length : 0,
      start_date: b.start_date,
      end_date: b.end_date,
      updated_at: b.updated_at,
    }));
  });

// ----------------------------------------------------------------------------
// ADMIN: detalhe de combo (com itens "crus" + dados de produto)
// ----------------------------------------------------------------------------
const AdminGetInput = z.object({ id: z.string().uuid() });

export const adminGetBundle = createServerFn({ method: 'POST' })
  .inputValidator((i: unknown) => AdminGetInput.parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const list = await loadBundlesWithItems({ bundleIds: [data.id], limit: 1 });
    return list[0] ?? null;
  });

// ----------------------------------------------------------------------------
// ADMIN: criar
// ----------------------------------------------------------------------------
const slugRegex = /^[a-z0-9-]+$/;

const DiscountTypeEnum = z.enum(['none', 'fixed_amount', 'percentage']);

function validateDiscount(input: { discountType?: BundleDiscountType; discountValue?: number }) {
  const t = input.discountType ?? 'none';
  const v = Number(input.discountValue ?? 0);
  if (t === 'none') return { discount_type: 'none' as const, discount_value: 0 };
  if (!Number.isFinite(v) || v <= 0) {
    throw new Error('bundle_discount_value_invalid');
  }
  if (t === 'percentage' && v > BUNDLE_PERCENT_LIMIT) {
    throw new Error('bundle_discount_percent_over_limit');
  }
  if (t === 'fixed_amount' && v > 100000) {
    throw new Error('bundle_discount_value_invalid');
  }
  return { discount_type: t, discount_value: Math.round(v * 100) / 100 };
}

const AdminCreateInput = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(160).regex(slugRegex).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  imageUrl: z.string().trim().max(2000).optional().nullable(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  discountType: DiscountTypeEnum.optional(),
  discountValue: z.number().min(0).max(100000).optional(),
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export const adminCreateBundle = createServerFn({ method: 'POST' })
  .inputValidator((i: unknown) => AdminCreateInput.parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const slug = data.slug || slugify(data.name);
    const disc = validateDiscount({
      discountType: data.discountType,
      discountValue: data.discountValue,
    });
    const { data: row, error } = await supabaseAdmin
      .from('product_bundles')
      .insert({
        name: data.name,
        slug,
        description: data.description ?? null,
        image_url: data.imageUrl ?? null,
        is_active: data.isActive ?? false,
        is_featured: data.isFeatured ?? false,
        start_date: data.startDate ?? null,
        end_date: data.endDate ?? null,
        notes: data.notes ?? null,
        discount_type: disc.discount_type,
        discount_value: disc.discount_value,
      })
      .select('id')
      .single();
    if (error) {
      if ((error as any).code === '23505') throw new Error('slug_already_exists');
      throw error;
    }
    return { id: row!.id as string };
  });

// ----------------------------------------------------------------------------
// ADMIN: atualizar
// ----------------------------------------------------------------------------
const AdminUpdateInput = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(160).optional(),
  slug: z.string().trim().min(2).max(160).regex(slugRegex).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  imageUrl: z.string().trim().max(2000).optional().nullable(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  discountType: DiscountTypeEnum.optional(),
  discountValue: z.number().min(0).max(100000).optional(),
});

export const adminUpdateBundle = createServerFn({ method: 'POST' })
  .inputValidator((i: unknown) => AdminUpdateInput.parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    type BundlePatch = {
      name?: string;
      slug?: string;
      description?: string | null;
      image_url?: string | null;
      is_active?: boolean;
      is_featured?: boolean;
      start_date?: string | null;
      end_date?: string | null;
      notes?: string | null;
      discount_type?: BundleDiscountType;
      discount_value?: number;
    };
    const patch: BundlePatch = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.slug !== undefined) patch.slug = data.slug;
    if (data.description !== undefined) patch.description = data.description;
    if (data.imageUrl !== undefined) patch.image_url = data.imageUrl;
    if (data.isActive !== undefined) patch.is_active = data.isActive;
    if (data.isFeatured !== undefined) patch.is_featured = data.isFeatured;
    if (data.startDate !== undefined) patch.start_date = data.startDate;
    if (data.endDate !== undefined) patch.end_date = data.endDate;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.discountType !== undefined || data.discountValue !== undefined) {
      const disc = validateDiscount({
        discountType: data.discountType,
        discountValue: data.discountValue,
      });
      patch.discount_type = disc.discount_type;
      patch.discount_value = disc.discount_value;
    }

    // Se for ativar, valida cadastro
    if (data.isActive === true) {
      const detail = await loadBundlesWithItems({ bundleIds: [data.id], limit: 1 });
      const b = detail[0];
      if (!b || b.items.length === 0) throw new Error('bundle_has_no_items');
      const broken = b.items.filter(
        (it) => it.is_required && (it.status === 'inactive' || it.status === 'no_price')
      );
      if (broken.length > 0) throw new Error('bundle_has_broken_items');
    }

    const { error } = await supabaseAdmin
      .from('product_bundles')
      .update(patch)
      .eq('id', data.id);
    if (error) {
      if ((error as any).code === '23505') throw new Error('slug_already_exists');
      throw error;
    }
    return { ok: true };
  });

// ----------------------------------------------------------------------------
// ADMIN: deletar
// ----------------------------------------------------------------------------
const AdminDeleteInput = z.object({ id: z.string().uuid() });

export const adminDeleteBundle = createServerFn({ method: 'POST' })
  .inputValidator((i: unknown) => AdminDeleteInput.parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error } = await supabaseAdmin
      .from('product_bundles')
      .delete()
      .eq('id', data.id);
    if (error) throw error;
    return { ok: true };
  });

// ----------------------------------------------------------------------------
// ADMIN: itens (add / update / remove)
// ----------------------------------------------------------------------------
const AdminAddItemInput = z.object({
  bundleId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(9999),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isRequired: z.boolean().optional(),
});

export const adminAddBundleItem = createServerFn({ method: 'POST' })
  .inputValidator((i: unknown) => AdminAddItemInput.parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    // Tenta upsert: se já existir, soma quantidade
    const { data: existing } = await supabaseAdmin
      .from('product_bundle_items')
      .select('id, quantity')
      .eq('bundle_id', data.bundleId)
      .eq('product_id', data.productId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from('product_bundle_items')
        .update({ quantity: existing.quantity + data.quantity })
        .eq('id', existing.id);
      if (error) throw error;
      return { ok: true, merged: true };
    }

    const { error } = await supabaseAdmin.from('product_bundle_items').insert({
      bundle_id: data.bundleId,
      product_id: data.productId,
      quantity: data.quantity,
      sort_order: data.sortOrder ?? 0,
      is_required: data.isRequired ?? true,
    });
    if (error) throw error;
    return { ok: true, merged: false };
  });

const AdminUpdateItemInput = z.object({
  id: z.string().uuid(),
  quantity: z.number().int().min(1).max(9999).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isRequired: z.boolean().optional(),
});

export const adminUpdateBundleItem = createServerFn({ method: 'POST' })
  .inputValidator((i: unknown) => AdminUpdateItemInput.parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    type ItemPatch = { quantity?: number; sort_order?: number; is_required?: boolean };
    const patch: ItemPatch = {};
    if (data.quantity !== undefined) patch.quantity = data.quantity;
    if (data.sortOrder !== undefined) patch.sort_order = data.sortOrder;
    if (data.isRequired !== undefined) patch.is_required = data.isRequired;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error } = await supabaseAdmin
      .from('product_bundle_items')
      .update(patch)
      .eq('id', data.id);
    if (error) throw error;
    return { ok: true };
  });

const AdminRemoveItemInput = z.object({ id: z.string().uuid() });

export const adminRemoveBundleItem = createServerFn({ method: 'POST' })
  .inputValidator((i: unknown) => AdminRemoveItemInput.parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error } = await supabaseAdmin
      .from('product_bundle_items')
      .delete()
      .eq('id', data.id);
    if (error) throw error;
    return { ok: true };
  });

// ----------------------------------------------------------------------------
// ADMIN: busca de produto para adicionar ao combo
// ----------------------------------------------------------------------------
const AdminSearchInput = z.object({
  query: z.string().trim().min(2).max(120),
  limit: z.number().int().min(1).max(20).optional(),
});

export const adminSearchProductsForBundle = createServerFn({ method: 'POST' })
  .inputValidator((i: unknown) => AdminSearchInput.parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const term = `%${data.query.replace(/[%_]/g, '\\$&')}%`;
    const { data: rows, error } = await supabaseAdmin
      .from('products')
      .select('id, name, slug, sku, brand, active, images, price, sale_price, stock_qty')
      .or(`name.ilike.${term},sku.ilike.${term},gtin_ean.ilike.${term}`)
      .order('active', { ascending: false })
      .order('name', { ascending: true })
      .limit(data.limit ?? 10);
    if (error) throw error;
    return ((rows ?? []) as Array<Record<string, any>>).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      slug: r.slug as string,
      sku: (r.sku as string | null) ?? null,
      brand: (r.brand as string | null) ?? null,
      active: !!r.active,
      image:
        Array.isArray(r.images) && r.images.length > 0 ? (r.images[0] as string) : null,
      price: Number(r.price ?? 0),
      sale_price: r.sale_price != null ? Number(r.sale_price) : null,
      stock_qty: Number(r.stock_qty ?? 0),
    }));
  });
