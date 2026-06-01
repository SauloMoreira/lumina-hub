import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Guarda server-side para ações administrativas.
 * Garante que o `userId` autenticado (vindo de requireSupabaseAuth) é admin.
 * Retorna o registro de perfil do admin para uso posterior (email, status).
 *
 * Lança Error("Acesso negado") em qualquer falha — nunca vaza detalhes.
 */
export async function assertAdmin(userId: string | null | undefined): Promise<{
  id: string;
  email: string;
  role: string;
  status: string;
}> {
  if (!userId) throw new Error("Acesso negado");
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role, status")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) throw new Error("Acesso negado");
  if (data.role !== "admin") throw new Error("Acesso negado");
  if (data.status && data.status !== "active") throw new Error("Acesso negado");
  return data as { id: string; email: string; role: string; status: string };
}

/**
 * Exige sessão admin com AAL2 (segundo fator).
 * Usar para ações destrutivas / promoção a admin (Fase 1.1.0-c).
 */
export function assertAal2(claims: unknown): void {
  const aal = (claims as { aal?: string } | null | undefined)?.aal;
  if (aal !== "aal2") {
    throw new Error("MFA obrigatório para esta ação");
  }
}
