import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "./security/assertAdmin";
import { logAdminAction } from "./security/auditLog";

/**
 * v1.1.0-a — Administração de Usuários e Clientes (fase de leitura).
 *
 * Server functions somente-leitura para listar e ver detalhes de
 * usuários/clientes cadastrados. Nenhuma ação destrutiva nesta fase.
 *
 * Todas as funções:
 * - exigem sessão autenticada (requireSupabaseAuth)
 * - validam que o usuário é admin (assertAdmin)
 * - operam via supabaseAdmin (bypass RLS) com escopo controlado
 * - nunca retornam senhas, tokens ou secrets
 */

// ---------- Tipos públicos ----------

export type AdminUserType =
  | "admin"
  | "cliente_b2b_aprovado"
  | "cliente_b2b_pendente"
  | "cliente_b2b_bloqueado"
  | "cliente_b2c"
  | "cliente_bloqueado"
  | "cliente_arquivado";

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  created_at: string | null;
  derived_type: AdminUserType;
  company_id: string | null;
  company_name: string | null;
  company_status: string | null;
  orders_count: number;
  last_order_at: string | null;
};

type FilterKind =
  | "all"
  | "admins"
  | "b2c"
  | "b2b_approved"
  | "b2b_pending"
  | "blocked"
  | "active"
  | "with_orders"
  | "without_orders";

function deriveType(args: {
  role: string;
  status: string;
  companyStatus: string | null;
}): AdminUserType {
  if (args.role === "admin") return "admin";
  if (args.status === "archived") return "cliente_arquivado";
  if (args.status === "blocked") return "cliente_bloqueado";
  if (args.companyStatus === "approved") return "cliente_b2b_aprovado";
  if (args.companyStatus === "pending") return "cliente_b2b_pendente";
  if (args.companyStatus === "blocked" || args.companyStatus === "rejected") {
    return "cliente_b2b_bloqueado";
  }
  return "cliente_b2c";
}

// ---------- Listagem ----------

const listInput = z.object({
  search: z.string().trim().max(200).optional().nullable(),
  filter: z
    .enum([
      "all",
      "admins",
      "b2c",
      "b2b_approved",
      "b2b_pending",
      "blocked",
      "active",
      "with_orders",
      "without_orders",
    ])
    .optional()
    .nullable(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const limit = data.limit ?? 500;

    // 1. Perfis (filtro de role / status quando possível direto na query)
    let q = supabaseAdmin
      .from("profiles")
      .select("id, name, email, phone, role, status, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (data.filter === "admins") q = q.eq("role", "admin");
    if (data.filter === "blocked") q = q.in("status", ["blocked", "archived"]);
    if (data.filter === "active") q = q.eq("status", "active");

    const term = (data.search ?? "").trim();
    if (term) {
      const s = `%${term}%`;
      q = q.or(`name.ilike.${s},email.ilike.${s},phone.ilike.${s}`);
    }

    const { data: profiles, error } = await q;
    if (error) throw new Error(error.message);
    const rows = profiles ?? [];
    if (rows.length === 0) {
      return { users: [] as AdminUserRow[], total: 0 };
    }

    const userIds = rows.map((r) => r.id);

    // 2. Vínculos com empresas (company_users + companies)
    const { data: links } = await supabaseAdmin
      .from("company_users")
      .select("user_id, company_id")
      .in("user_id", userIds);

    const linkByUser = new Map<string, string>();
    const companyIds = new Set<string>();
    for (const l of links ?? []) {
      // primeiro vínculo vence (na prática há 1 empresa por usuário)
      if (!linkByUser.has(l.user_id)) {
        linkByUser.set(l.user_id, l.company_id);
        companyIds.add(l.company_id);
      }
    }

    const companyMap = new Map<
      string,
      { id: string; name: string; status: string }
    >();
    if (companyIds.size > 0) {
      const { data: companies } = await supabaseAdmin
        .from("companies")
        .select("id, legal_name, trade_name, status")
        .in("id", Array.from(companyIds));
      for (const c of companies ?? []) {
        companyMap.set(c.id, {
          id: c.id,
          name: c.trade_name || c.legal_name,
          status: c.status,
        });
      }
    }

    // 3. Pedidos: contagem + último por usuário
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("user_id, created_at")
      .in("user_id", userIds)
      .order("created_at", { ascending: false });

    const orderStats = new Map<string, { count: number; last: string | null }>();
    for (const o of orders ?? []) {
      if (!o.user_id) continue;
      const cur = orderStats.get(o.user_id) ?? { count: 0, last: null };
      cur.count += 1;
      if (!cur.last) cur.last = o.created_at as string;
      orderStats.set(o.user_id, cur);
    }

    // 4. Empresa-busca (filtro por nome de empresa só pode ser pós-join)
    let users: AdminUserRow[] = rows.map((p) => {
      const companyId = linkByUser.get(p.id) ?? null;
      const company = companyId ? companyMap.get(companyId) ?? null : null;
      const stats = orderStats.get(p.id) ?? { count: 0, last: null };
      const derived = deriveType({
        role: p.role,
        status: p.status,
        companyStatus: company?.status ?? null,
      });
      return {
        id: p.id,
        name: p.name,
        email: p.email,
        phone: p.phone,
        role: p.role,
        status: p.status,
        created_at: p.created_at,
        derived_type: derived,
        company_id: companyId,
        company_name: company?.name ?? null,
        company_status: company?.status ?? null,
        orders_count: stats.count,
        last_order_at: stats.last,
      };
    });

    // Busca por nome de empresa (pós-join)
    if (term) {
      const lower = term.toLowerCase();
      users = users.filter(
        (u) =>
          u.name.toLowerCase().includes(lower) ||
          u.email.toLowerCase().includes(lower) ||
          (u.phone ?? "").toLowerCase().includes(lower) ||
          (u.company_name ?? "").toLowerCase().includes(lower),
      );
    }

    // Filtros pós-derivação
    if (data.filter === "b2c") {
      users = users.filter((u) => u.derived_type === "cliente_b2c");
    } else if (data.filter === "b2b_approved") {
      users = users.filter((u) => u.derived_type === "cliente_b2b_aprovado");
    } else if (data.filter === "b2b_pending") {
      users = users.filter((u) => u.derived_type === "cliente_b2b_pendente");
    } else if (data.filter === "with_orders") {
      users = users.filter((u) => u.orders_count > 0);
    } else if (data.filter === "without_orders") {
      users = users.filter((u) => u.orders_count === 0);
    }

    return { users, total: users.length };
  });

// ---------- Resumo (cards) ----------

export const adminUsersSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const [
      totalRes,
      adminsRes,
      blockedRes,
      pendingCompaniesRes,
      approvedCompaniesRes,
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("status", "active"),
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .in("status", ["blocked", "archived"]),
      supabaseAdmin
        .from("companies")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabaseAdmin
        .from("companies")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved"),
    ]);

    const total = totalRes.count ?? 0;
    const admins = adminsRes.count ?? 0;
    const blocked = blockedRes.count ?? 0;
    const b2bPending = pendingCompaniesRes.count ?? 0;
    const b2bApproved = approvedCompaniesRes.count ?? 0;

    return {
      total,
      admins,
      blocked,
      b2b_pending: b2bPending,
      b2b_approved: b2bApproved,
      // B2C = total - admins - (usuários vinculados a empresa aprovada/pendente)
      // calculado de forma aproximada via company_users distinct
      b2c_approx: Math.max(0, total - admins - b2bApproved - b2bPending),
    };
  });

// ---------- Detalhe ----------

const detailInput = z.object({ user_id: z.string().uuid() });

export const adminGetUserDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => detailInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email, phone, role, status, avatar_url, created_at, updated_at")
      .eq("id", data.user_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) throw new Error("Usuário não encontrado");

    const { data: links } = await supabaseAdmin
      .from("company_users")
      .select("company_id, role, created_at")
      .eq("user_id", data.user_id);

    const companyIds = (links ?? []).map((l) => l.company_id);
    const { data: companies } = companyIds.length
      ? await supabaseAdmin
          .from("companies")
          .select(
            "id, cnpj, legal_name, trade_name, status, approved_at, approved_by, blocked_at, rejection_reason",
          )
          .in("id", companyIds)
      : { data: [] };

    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, total, status, payment_status, created_at")
      .eq("user_id", data.user_id)
      .order("created_at", { ascending: false })
      .limit(50);

    const { data: addresses } = await supabaseAdmin
      .from("addresses")
      .select(
        "id, label, recipient, zip_code, street, number, complement, neighborhood, city, state, is_default",
      )
      .eq("user_id", data.user_id);

    const { data: leads } = await supabaseAdmin
      .from("leads")
      .select("id, name, status, score_temperature, created_at, converted_order")
      .or(`email.eq.${profile.email}`)
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: auditLogs } = await supabaseAdmin
      .from("admin_audit_log")
      .select("id, action, resource_type, description, created_at, admin_email")
      .eq("resource_type", "user")
      .eq("resource_id", data.user_id)
      .order("created_at", { ascending: false })
      .limit(20);

    return {
      profile,
      companies: companies ?? [],
      orders: orders ?? [],
      addresses: addresses ?? [],
      leads: leads ?? [],
      audit_logs: auditLogs ?? [],
    };
  });
