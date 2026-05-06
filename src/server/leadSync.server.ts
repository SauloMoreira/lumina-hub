/**
 * syncApprovedOrderToLead
 *
 * Cria ou atualiza um lead no CRM quando um pedido tem pagamento aprovado.
 * - Idempotente: reprocessar o mesmo pedido não duplica lead.
 * - Deduplicação: busca por converted_order, e-mail ou telefone.
 * - LGPD: não loga CPF, endereço completo nem tokens.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function syncApprovedOrderToLead(orderId: string): Promise<{
  ok: boolean;
  leadId: string | null;
  action: "created" | "updated" | "skipped" | "error";
  reason?: string;
}> {
  try {
    // 1. Buscar pedido
    const { data: orderRaw, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_number, user_id, total, status, payment_status, order_type, " +
          "company_id, company_name, address_snapshot, " +
          "utm_source, utm_medium, utm_campaign, utm_term, utm_content, " +
          "origin_page, origin_path, origin_context, referrer_url",
      )
      .eq("id", orderId)
      .single();

    if (orderErr || !orderRaw) {
      return { ok: false, leadId: null, action: "error", reason: "order not found" };
    }

    // Só sincroniza pedidos com pagamento aprovado
    if (order.payment_status !== "approved" && order.payment_status !== "paid") {
      return { ok: false, leadId: null, action: "skipped", reason: "payment not approved" };
    }

    // 2. Buscar profile do usuário
    const { data: profile } = order.user_id
      ? await supabaseAdmin
          .from("profiles")
          .select("name, email, phone")
          .eq("id", order.user_id)
          .single()
      : { data: null };

    const name = profile?.name || "Cliente";
    const email = profile?.email || null;
    const phone = profile?.phone || null;

    if (!email && !phone) {
      return { ok: false, leadId: null, action: "skipped", reason: "no email or phone" };
    }

    // 3. Extrair cidade/UF do address_snapshot (sem expor endereço completo)
    const addr = order.address_snapshot as Record<string, string> | null;
    const city = addr?.city || null;
    const state = addr?.state || null;

    // 4. Buscar itens do pedido (resumo para notes)
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("product_name, qty, unit_price")
      .eq("order_id", orderId);

    const itemsSummary = (items ?? [])
      .slice(0, 5)
      .map((i) => `${i.qty}x ${i.product_name}`)
      .join(", ");
    const extraItems = (items?.length ?? 0) > 5 ? ` (+${(items!.length - 5)} mais)` : "";
    const notesText =
      `Pedido #${order.order_number} confirmado — R$ ${Number(order.total).toFixed(2)}` +
      (itemsSummary ? ` — Itens: ${itemsSummary}${extraItems}` : "") +
      (city ? ` — ${city}/${state}` : "");

    // 5. Deduplicação: busca lead existente por converted_order, email ou phone
    let existingLeadId: string | null = null;

    // 5a. Por converted_order (mais específico)
    const { data: byOrder } = await supabaseAdmin
      .from("leads")
      .select("id")
      .eq("converted_order", orderId)
      .limit(1)
      .maybeSingle();
    if (byOrder?.id) existingLeadId = byOrder.id;

    // 5b. Por e-mail
    if (!existingLeadId && email) {
      const { data: byEmail } = await supabaseAdmin
        .from("leads")
        .select("id")
        .eq("email", email)
        .limit(1)
        .maybeSingle();
      if (byEmail?.id) existingLeadId = byEmail.id;
    }

    // 5c. Por telefone
    if (!existingLeadId && phone) {
      const { data: byPhone } = await supabaseAdmin
        .from("leads")
        .select("id")
        .eq("phone", phone)
        .limit(1)
        .maybeSingle();
      if (byPhone?.id) existingLeadId = byPhone.id;
    }

    // 6. Payload do lead
    const leadPayload: Record<string, unknown> = {
      name,
      email,
      phone,
      status: "ganhou",
      converted_order: orderId,
      estimated_value: order.total,
      notes: notesText,
      utm_source: order.utm_source ?? null,
      utm_medium: order.utm_medium ?? null,
      utm_campaign: order.utm_campaign ?? null,
      utm_term: order.utm_term ?? null,
      utm_content: order.utm_content ?? null,
      origin_page: order.origin_page ?? null,
      origin_path: order.origin_path ?? null,
      origin_context: order.origin_context ?? "checkout",
      referrer_url: order.referrer_url ?? null,
      updated_at: new Date().toISOString(),
    };

    let leadId: string;
    let action: "created" | "updated";

    if (existingLeadId) {
      // Atualizar lead existente — não sobrescrever origin se já tinha valor relevante
      const { error: updErr } = await supabaseAdmin
        .from("leads")
        .update(leadPayload as never)
        .eq("id", existingLeadId);
      if (updErr) {
        console.error("[leadSync] erro update lead", updErr.message);
        return { ok: false, leadId: null, action: "error", reason: updErr.message };
      }
      leadId = existingLeadId;
      action = "updated";
    } else {
      // Criar novo lead
      const insertPayload = {
        ...leadPayload,
        origin: "checkout",
        company: order.company_name ?? null,
      };
      const { data: created, error: insErr } = await supabaseAdmin
        .from("leads")
        .insert(insertPayload as never)
        .select("id")
        .single();
      if (insErr || !created?.id) {
        console.error("[leadSync] erro insert lead", insErr?.message);
        return { ok: false, leadId: null, action: "error", reason: insErr?.message };
      }
      leadId = created.id;
      action = "created";
    }

    // 7. Criar interação
    const interactionContent =
      `Pedido #${order.order_number} confirmado via Mercado Pago — R$ ${Number(order.total).toFixed(2)}`;
    await supabaseAdmin.from("lead_interactions").insert({
      lead_id: leadId,
      type: "status_change",
      content: interactionContent,
    } as never);

    console.log(`[leadSync] lead ${action}`, { leadId, orderId, orderNumber: order.order_number });
    return { ok: true, leadId, action };
  } catch (e) {
    console.error("[leadSync] exception", (e as Error).message);
    return { ok: false, leadId: null, action: "error", reason: (e as Error).message };
  }
}
