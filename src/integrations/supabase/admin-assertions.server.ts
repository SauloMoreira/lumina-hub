import "@tanstack/react-start/server-only";

import { getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "./client.server";

type AdminProfile = { role: string | null; email: string | null };

/**
 * Verifica se o usuário tem pelo menos um fator MFA verificado
 * via Admin API (independente do AAL atual).
 */
async function userHasVerifiedFactor(userId: string): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    type FactorLite = { status?: string };
    const factors = (data?.user?.factors ?? []) as FactorLite[];
    return factors.some((f) => f?.status === "verified");
  } catch {
    return false;
  }
}

export async function assertAdminUserAal2(userId: string, aal?: string): Promise<AdminProfile> {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("role, email")
    .eq("id", userId)
    .single();

  if (error || !profile || profile.role !== "admin") {
    throw new Response("Forbidden: admin only", { status: 403 });
  }

  const hasFactor = await userHasVerifiedFactor(userId);
  if (!hasFactor) {
    throw new Response("Forbidden: MFA enrollment required", { status: 403 });
  }
  if (aal !== "aal2") {
    throw new Response("Unauthorized: MFA challenge required", { status: 401 });
  }

  return profile as AdminProfile;
}

/**
 * Helper para server functions que NÃO usam o middleware (têm helpers
 * locais `requireAdmin()` próprios). Recebe o bearer token do request,
 * valida admin + AAL2 + fator verificado e retorna o userId.
 */
export async function assertAdminAal2FromBearer(): Promise<string> {
  const auth = getRequestHeader("Authorization") || getRequestHeader("authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    throw new Response("Unauthorized", { status: 401 });
  }
  const token = auth.slice(7).trim();
  if (!token) throw new Response("Unauthorized", { status: 401 });

  const { data: claimsRes, error: cErr } = await supabaseAdmin.auth.getClaims(token);
  if (cErr || !claimsRes?.claims?.sub) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const userId = claimsRes.claims.sub as string;
  const aal = (claimsRes.claims as { aal?: string }).aal;
  await assertAdminUserAal2(userId, aal);
  return userId;
}