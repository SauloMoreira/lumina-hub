import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// Listar zonas + aliases (admin)
// ============================================================
export const listLocalDeliveryZones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    // is_admin é validado via RLS (admin_all). Para non-admin, retornará vazio.
    const { data: zones, error } = await supabase
      .from("local_delivery_zones")
      .select(
        "id, district, name, display_name, parent_zone_id, is_alias, inherits_parent_price, shipping_price, estimated_delivery_time, is_active, notes, sort_order, created_at, updated_at",
      )
      .order("district", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("[listLocalDeliveryZones] err", error);
      return { ok: false as const, error: error.message };
    }
    const { data: aliases } = await supabase
      .from("local_delivery_zone_aliases")
      .select("id, zone_id, alias_name, alias_normalized, created_at")
      .order("alias_name", { ascending: true });
    return { ok: true as const, zones: zones ?? [], aliases: aliases ?? [] };
  });

// ============================================================
// Atualizar zona (admin)
// ============================================================
export const updateLocalDeliveryZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        shipping_price: z.number().min(0).max(99999).nullable().optional(),
        estimated_delivery_time: z.string().max(120).nullable().optional(),
        is_active: z.boolean().optional(),
        notes: z.string().max(500).nullable().optional(),
        display_name: z.string().min(1).max(120).optional(),
        district: z.string().min(1).max(80).optional(),
        inherits_parent_price: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...patch } = data;
    const { error } = await supabase
      .from("local_delivery_zones")
      .update(patch as never)
      .eq("id", id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

// ============================================================
// Criar zona (admin) — bairro principal ou alias
// ============================================================
export const createLocalDeliveryZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().min(1).max(120),
        display_name: z.string().min(1).max(120),
        district: z.string().min(1).max(80),
        is_alias: z.boolean().default(false),
        parent_zone_id: z.string().uuid().nullable().optional(),
        inherits_parent_price: z.boolean().default(false),
        shipping_price: z.number().min(0).max(99999).nullable().optional(),
        estimated_delivery_time: z.string().max(120).nullable().optional(),
        is_active: z.boolean().default(false),
        notes: z.string().max(500).nullable().optional(),
        sort_order: z.number().int().min(0).max(99999).default(999),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("local_delivery_zones")
      .insert(data as never)
      .select("id")
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, id: (row as { id: string }).id };
  });

// ============================================================
// Aliases — criar/excluir
// ============================================================
export const createLocalDeliveryAlias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ zone_id: z.string().uuid(), alias_name: z.string().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("local_delivery_zone_aliases").insert(data as never);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const deleteLocalDeliveryAlias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("local_delivery_zone_aliases").delete().eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
