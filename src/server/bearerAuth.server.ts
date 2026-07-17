import { getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Resolve o user id a partir do header Authorization (bearer) da request atual.
 * Retorna null para chamadas anônimas ou tokens inválidos.
 */
export async function getOptionalUserIdFromBearer(): Promise<string | null> {
  try {
    const auth = getRequestHeader("Authorization") || getRequestHeader("authorization");
    if (!auth || !auth.toLowerCase().startsWith("bearer ")) return null;
    const token = auth.slice(7).trim();
    if (!token) return null;
    const { data: userRes } = await supabaseAdmin.auth.getUser(token);
    return userRes.user?.id ?? null;
  } catch {
    return null;
  }
}
