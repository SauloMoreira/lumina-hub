import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sanitizeAttributeText, normalizeKey } from "@/lib/productAttributes";

export type AttributeLabelRow = {
  id: string;
  attribute_key: string;
  raw_value: string;
  display_label: string;
  helper_text: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PublicAttributeLabel = {
  attribute_key: string;
  raw_value: string;
  display_label: string;
  helper_text: string | null;
};

// ---------------------------------------------------------------------------
// Auth helpers
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
  const { assertAdminAal2FromBearer } = await import("@/integrations/supabase/admin-middleware");
  return assertAdminAal2FromBearer();
}

// ---------------------------------------------------------------------------
// Listagem admin (todos, inclusive inativos)
// ---------------------------------------------------------------------------
export const adminListAttributeLabels = createServerFn({ method: "POST" }).handler(
  async (): Promise<AttributeLabelRow[]> => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("product_attribute_labels")
      .select("*")
      .order("attribute_key", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("raw_value", { ascending: true });
    if (error) throw error;
    return (data ?? []) as AttributeLabelRow[];
  },
);

// ---------------------------------------------------------------------------
// Listagem pública: rótulos ativos, em lote
// ---------------------------------------------------------------------------
const PublicListInput = z.object({
  attributeKeys: z.array(z.string().min(1).max(80)).min(1).max(40).optional(),
});

export const getPublicAttributeLabels = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => PublicListInput.parse(i ?? {}))
  .handler(async ({ data }): Promise<PublicAttributeLabel[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("product_attribute_labels")
      .select("attribute_key, raw_value, display_label, helper_text")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (data.attributeKeys && data.attributeKeys.length > 0) {
      const keys = data.attributeKeys.map((k) => normalizeKey(k)).filter(Boolean);
      if (keys.length > 0) q = q.in("attribute_key", keys);
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows ?? []) as PublicAttributeLabel[];
  });

// ---------------------------------------------------------------------------
// Criar
// ---------------------------------------------------------------------------
const CreateInput = z.object({
  attributeKey: z.string().min(1).max(80),
  rawValue: z.string().min(1).max(120),
  displayLabel: z.string().min(1).max(160),
  helperText: z.string().max(400).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

export const adminCreateAttributeLabel = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => CreateInput.parse(i))
  .handler(async ({ data }): Promise<AttributeLabelRow> => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const key = normalizeKey(data.attributeKey);
    if (!key) throw new Error("invalid_key");
    const rawValue = sanitizeAttributeText(data.rawValue, 120);
    const displayLabel = sanitizeAttributeText(data.displayLabel, 160);
    const helperText = data.helperText ? sanitizeAttributeText(data.helperText, 400) || null : null;
    if (!rawValue) throw new Error("invalid_value");
    if (!displayLabel) throw new Error("invalid_label");

    // Duplicidade case-insensitive
    const { data: existing } = await supabaseAdmin
      .from("product_attribute_labels")
      .select("id")
      .ilike("attribute_key", key)
      .ilike("raw_value", rawValue)
      .maybeSingle();
    if (existing) throw new Error("label_already_exists");

    const { data: inserted, error } = await supabaseAdmin
      .from("product_attribute_labels")
      .insert({
        attribute_key: key,
        raw_value: rawValue,
        display_label: displayLabel,
        helper_text: helperText,
        sort_order: data.sortOrder ?? 0,
        is_active: data.isActive ?? true,
      })
      .select("*")
      .single();
    if (error) throw error;
    return inserted as AttributeLabelRow;
  });

// ---------------------------------------------------------------------------
// Atualizar
// ---------------------------------------------------------------------------
const UpdateInput = z.object({
  id: z.string().uuid(),
  displayLabel: z.string().min(1).max(160).optional(),
  helperText: z.string().max(400).nullable().optional(),
  rawValue: z.string().min(1).max(120).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

export const adminUpdateAttributeLabel = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => UpdateInput.parse(i))
  .handler(async ({ data }): Promise<AttributeLabelRow> => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: {
      display_label?: string;
      helper_text?: string | null;
      raw_value?: string;
      sort_order?: number;
      is_active?: boolean;
    } = {};
    if (data.displayLabel !== undefined) {
      const v = sanitizeAttributeText(data.displayLabel, 160);
      if (!v) throw new Error("invalid_label");
      patch.display_label = v;
    }
    if (data.helperText !== undefined) {
      patch.helper_text = data.helperText
        ? sanitizeAttributeText(data.helperText, 400) || null
        : null;
    }
    if (data.rawValue !== undefined) {
      const v = sanitizeAttributeText(data.rawValue, 120);
      if (!v) throw new Error("invalid_value");
      patch.raw_value = v;
    }
    if (data.sortOrder !== undefined) patch.sort_order = data.sortOrder;
    if (data.isActive !== undefined) patch.is_active = data.isActive;

    const { data: updated, error } = await supabaseAdmin
      .from("product_attribute_labels")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return updated as AttributeLabelRow;
  });

// ---------------------------------------------------------------------------
// Remover
// ---------------------------------------------------------------------------
const DeleteInput = z.object({ id: z.string().uuid() });

export const adminDeleteAttributeLabel = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => DeleteInput.parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("product_attribute_labels")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
