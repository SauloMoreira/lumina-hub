import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  normalizeAttributeValue,
  normalizeKey,
  parseAttributesFromText,
  sanitizeAttributeText,
} from "@/lib/productAttributes";

export type ProductAttributeRow = {
  id: string;
  product_id: string;
  attribute_key: string;
  attribute_label: string;
  attribute_value: string;
  attribute_unit: string | null;
  sort_order: number;
  is_visible: boolean;
  is_filterable: boolean;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Auth helpers (mesmo padrão do productRelations.functions.ts)
// ---------------------------------------------------------------------------
async function getOptionalUserId(): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const auth = getRequestHeader("Authorization") || getRequestHeader("authorization");
    if (auth && auth.toLowerCase().startsWith("bearer ")) {
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
  const { assertAdminAal2FromBearer } = await import("@/integrations/supabase/admin-assertions.server");
  return assertAdminAal2FromBearer();
}

// ---------------------------------------------------------------------------
// Lista atributos de um produto (admin — vê tudo, inclusive ocultos)
// ---------------------------------------------------------------------------
const ListInput = z.object({ productId: z.string().uuid() });

export const adminListProductAttributes = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => ListInput.parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("product_attributes")
      .select("*")
      .eq("product_id", data.productId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (rows ?? []) as ProductAttributeRow[];
  });

// ---------------------------------------------------------------------------
// Lista atributos VISÍVEIS de um produto (página pública)
// ---------------------------------------------------------------------------
export const getPublicProductAttributes = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => ListInput.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("product_attributes")
      .select("id, attribute_key, attribute_label, attribute_value, attribute_unit, sort_order")
      .eq("product_id", data.productId)
      .eq("is_visible", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (rows ?? []) as Array<
      Pick<
        ProductAttributeRow,
        | "id"
        | "attribute_key"
        | "attribute_label"
        | "attribute_value"
        | "attribute_unit"
        | "sort_order"
      >
    >;
  });

// ---------------------------------------------------------------------------
// Criar atributo
// ---------------------------------------------------------------------------
const UpsertInput = z.object({
  productId: z.string().uuid(),
  attributeKey: z.string().min(1).max(80),
  attributeLabel: z.string().min(1).max(120),
  attributeValue: z.string().min(1).max(500),
  attributeUnit: z.string().max(20).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isVisible: z.boolean().optional(),
  isFilterable: z.boolean().optional(),
});

export const adminCreateProductAttribute = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => UpsertInput.parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const key = normalizeKey(data.attributeKey);
    if (!key) throw new Error("invalid_key");
    const label = sanitizeAttributeText(data.attributeLabel, 120);
    if (!label) throw new Error("invalid_label");

    const normalized = normalizeAttributeValue(
      key,
      data.attributeValue,
      data.attributeUnit ?? null,
    );
    if (!normalized.value) throw new Error("invalid_value");

    const { data: existing } = await supabaseAdmin
      .from("product_attributes")
      .select("id")
      .eq("product_id", data.productId)
      .eq("attribute_key", key)
      .maybeSingle();
    if (existing) throw new Error("attribute_already_exists");

    const { data: maxRow } = await supabaseAdmin
      .from("product_attributes")
      .select("sort_order")
      .eq("product_id", data.productId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = data.sortOrder ?? (maxRow?.sort_order ?? -1) + 1;

    const { data: inserted, error } = await supabaseAdmin
      .from("product_attributes")
      .insert({
        product_id: data.productId,
        attribute_key: key,
        attribute_label: label,
        attribute_value: normalized.value,
        attribute_unit: normalized.unit,
        sort_order: nextOrder,
        is_visible: data.isVisible ?? true,
        is_filterable: data.isFilterable ?? false,
      })
      .select("*")
      .single();
    if (error) throw error;
    return inserted as ProductAttributeRow;
  });

// ---------------------------------------------------------------------------
// Atualizar atributo
// ---------------------------------------------------------------------------
const UpdateInput = z.object({
  id: z.string().uuid(),
  attributeLabel: z.string().min(1).max(120).optional(),
  attributeValue: z.string().min(1).max(500).optional(),
  attributeUnit: z.string().max(20).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isVisible: z.boolean().optional(),
  isFilterable: z.boolean().optional(),
});

export const adminUpdateProductAttribute = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => UpdateInput.parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: getErr } = await supabaseAdmin
      .from("product_attributes")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (getErr) throw getErr;
    if (!existing) throw new Error("not_found");

    const patch: {
      attribute_label?: string;
      attribute_value?: string;
      attribute_unit?: string | null;
      sort_order?: number;
      is_visible?: boolean;
      is_filterable?: boolean;
    } = {};
    if (data.attributeLabel !== undefined) {
      const label = sanitizeAttributeText(data.attributeLabel, 120);
      if (!label) throw new Error("invalid_label");
      patch.attribute_label = label;
    }
    if (data.attributeValue !== undefined || data.attributeUnit !== undefined) {
      const normalized = normalizeAttributeValue(
        existing.attribute_key,
        data.attributeValue ?? existing.attribute_value,
        data.attributeUnit !== undefined ? data.attributeUnit : existing.attribute_unit,
      );
      if (!normalized.value) throw new Error("invalid_value");
      patch.attribute_value = normalized.value;
      patch.attribute_unit = normalized.unit;
    }
    if (data.sortOrder !== undefined) patch.sort_order = data.sortOrder;
    if (data.isVisible !== undefined) patch.is_visible = data.isVisible;
    if (data.isFilterable !== undefined) patch.is_filterable = data.isFilterable;

    const { data: updated, error } = await supabaseAdmin
      .from("product_attributes")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return updated as ProductAttributeRow;
  });

// ---------------------------------------------------------------------------
// Reordenar (lista de ids na ordem desejada)
// ---------------------------------------------------------------------------
const ReorderInput = z.object({
  productId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()).min(1).max(200),
});

export const adminReorderProductAttributes = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => ReorderInput.parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Atualiza um a um (lista pequena por produto)
    for (let i = 0; i < data.orderedIds.length; i++) {
      const id = data.orderedIds[i];
      const { error } = await supabaseAdmin
        .from("product_attributes")
        .update({ sort_order: i })
        .eq("id", id)
        .eq("product_id", data.productId);
      if (error) throw error;
    }
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Remover
// ---------------------------------------------------------------------------
const DeleteInput = z.object({ id: z.string().uuid() });

export const adminDeleteProductAttribute = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => DeleteInput.parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("product_attributes").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Sugerir atributos a partir do conteúdo do produto
// ---------------------------------------------------------------------------
const SuggestInput = z.object({ productId: z.string().uuid() });

export type AttributeSuggestionResult = {
  key: string;
  label: string;
  value: string;
  unit: string | null;
  match?: string;
  conflict?: string[];
  alreadyExists: boolean;
};

export const adminSuggestProductAttributes = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => SuggestInput.parse(i))
  .handler(async ({ data }): Promise<AttributeSuggestionResult[]> => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: product, error: pErr }, { data: existing, error: eErr }] = await Promise.all([
      supabaseAdmin
        .from("products")
        .select("name, description, tags, seo_title, seo_description")
        .eq("id", data.productId)
        .maybeSingle(),
      supabaseAdmin
        .from("product_attributes")
        .select("attribute_key")
        .eq("product_id", data.productId),
    ]);
    if (pErr) throw pErr;
    if (eErr) throw eErr;
    if (!product) throw new Error("product_not_found");

    const existingKeys = new Set(
      ((existing ?? []) as Array<{ attribute_key: string }>).map((r) => r.attribute_key),
    );

    const parsed = parseAttributesFromText({
      name: product.name,
      description: product.description,
      tags: Array.isArray(product.tags) ? product.tags : null,
      seoTitle: product.seo_title,
      seoDescription: product.seo_description,
    });

    return parsed.map((p) => ({
      key: p.key,
      label: p.label,
      value: p.value,
      unit: p.unit,
      match: p.match,
      conflict: p.conflict,
      alreadyExists: existingKeys.has(p.key),
    }));
  });
