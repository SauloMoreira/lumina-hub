// Consulta CNPJ na ReceitaWS (free tier: ~3 req/min).
// Server-only.

export type CnpjLookupResult =
  | {
      ok: true;
      situation: string; // ex: 'ATIVA'
      legalName: string;
      tradeName: string | null;
      openedAt: string | null; // ISO date
      restrictions: string | null; // 'situacao_especial' se houver
      raw: Record<string, unknown>;
    }
  | { ok: false; reason: string };

export async function lookupCnpj(cnpj: string): Promise<CnpjLookupResult> {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return { ok: false, reason: "CNPJ inválido" };

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`https://receitaws.com.br/v1/cnpj/${digits}`, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
    clearTimeout(t);

    if (res.status === 429) return { ok: false, reason: "Limite de consultas atingido" };
    if (!res.ok) return { ok: false, reason: `Falha na consulta (${res.status})` };

    const json = (await res.json()) as Record<string, unknown>;
    if (json.status === "ERROR") {
      return { ok: false, reason: String(json.message ?? "CNPJ não encontrado") };
    }

    const situation = String(json.situacao ?? "").toUpperCase();
    const legalName = String(json.nome ?? "");
    const tradeName = json.fantasia ? String(json.fantasia) : null;
    const openedRaw = json.abertura ? String(json.abertura) : null; // dd/mm/yyyy
    const restrictions = json.situacao_especial ? String(json.situacao_especial) : null;

    let openedAt: string | null = null;
    if (openedRaw && /^\d{2}\/\d{2}\/\d{4}$/.test(openedRaw)) {
      const [d, m, y] = openedRaw.split("/");
      openedAt = `${y}-${m}-${d}`;
    }

    return {
      ok: true,
      situation,
      legalName,
      tradeName,
      openedAt,
      restrictions,
      raw: json,
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Erro ao consultar CNPJ",
    };
  }
}

export type AutoApprovalDecision = {
  approve: boolean;
  reason: string;
};

/**
 * Critério: situação ATIVA + sem situação especial + abertura > 6 meses.
 */
export function decideAutoApproval(info: CnpjLookupResult): AutoApprovalDecision {
  if (!info.ok) return { approve: false, reason: info.reason };

  if (info.situation !== "ATIVA") {
    return { approve: false, reason: `Situação cadastral: ${info.situation || "desconhecida"}` };
  }

  if (info.restrictions && info.restrictions.trim().length > 0) {
    return { approve: false, reason: `Situação especial: ${info.restrictions}` };
  }

  if (!info.openedAt) {
    return { approve: false, reason: "Data de abertura indisponível" };
  }

  const opened = new Date(info.openedAt + "T00:00:00Z").getTime();
  const sixMonthsMs = 1000 * 60 * 60 * 24 * 30 * 6;
  if (Date.now() - opened < sixMonthsMs) {
    return { approve: false, reason: "Empresa aberta há menos de 6 meses" };
  }

  return { approve: true, reason: "CNPJ ativo e sem restrições" };
}
