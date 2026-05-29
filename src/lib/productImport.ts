// Helpers puros (sem dependência de servidor/banco) para o Agente de Importação
// de Produtos via planilha. Pode ser usado tanto no cliente quanto no server fn.

export type ImportAction = "criar" | "atualizar" | "ignorar" | "";
export type ImportStatus =
  | "invalid" // tem erros que impedem importação
  | "needs_review" // só pode importar com revisado=sim & aprovado=sim
  | "ready" // válido E aprovado E revisado
  | "ignored"; // ação = ignorar

export type ImportConfidence = "alta" | "media" | "baixa";

export type ImportRow = {
  rowIndex: number; // linha original na planilha (1-based após cabeçalho)
  action: ImportAction;
  sku: string;
  nome_produto: string;
  categoria: string;
  preco_venda: number | null;
  estoque_inicial: number | null;
  ativo: boolean;
  revisado_humano: boolean;
  aprovado_importar: boolean;
  observacoes_usuario: string;

  // Campos preenchidos pela IA
  slug_sugerido: string | null;
  descricao_curta: string | null;
  descricao_longa: string | null;
  tags: string[];
  titulo_seo: string | null;
  meta_description: string | null;
  observacoes_ia: string | null;
  nivel_confianca_ia: ImportConfidence | null;

  // Resultado da validação
  status: ImportStatus;
  errors: string[];
  warnings: string[];

  // Resolução server-side
  matched_product_id: string | null; // produto existente por SKU
  matched_category_id: string | null; // categoria existente por nome/slug
};

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);
}

export function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  const cleaned = String(value)
    .trim()
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // remove pontos de milhar
    .replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function parseInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isInteger(value) ? value : Math.trunc(value);
  const cleaned = String(value).trim().replace(/[^\d-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function parseBoolPtBr(value: unknown, defaultValue = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return defaultValue;
  const s = String(value).trim().toLowerCase();
  if (!s) return defaultValue;
  if (["sim", "s", "yes", "y", "true", "1", "ativo"].includes(s)) return true;
  if (["não", "nao", "n", "no", "false", "0", "inativo"].includes(s)) return false;
  return defaultValue;
}

export function parseAction(value: unknown): ImportAction {
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  if (s === "criar" || s === "create" || s === "novo") return "criar";
  if (s === "atualizar" || s === "update" || s === "editar") return "atualizar";
  if (s === "ignorar" || s === "ignore" || s === "pular") return "ignorar";
  return "";
}

export function parseTags(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value)
    .split(/[;,|]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export type ImportCounts = {
  total: number;
  ready: number;
  needsReview: number;
  invalid: number;
  ignored: number;
};

export function countRows(rows: ImportRow[]): ImportCounts {
  const c: ImportCounts = {
    total: rows.length,
    ready: 0,
    needsReview: 0,
    invalid: 0,
    ignored: 0,
  };
  for (const r of rows) {
    if (r.status === "ignored") c.ignored += 1;
    else if (r.status === "ready") c.ready += 1;
    else if (r.status === "invalid") c.invalid += 1;
    else c.needsReview += 1;
  }
  return c;
}
