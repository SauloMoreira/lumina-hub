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
  preco_custo: number | null;
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

  // Dados técnicos opcionais (v1.0.2). Chaves limitadas a TECH_FIELDS abaixo.
  // Valores como string trimmed; campos vazios NÃO aparecem aqui.
  tech: Record<string, string>;

  // Resultado da validação
  status: ImportStatus;
  errors: string[];
  warnings: string[];

  // Resolução server-side
  matched_product_id: string | null; // produto existente por SKU
  matched_category_id: string | null; // categoria existente por nome/slug
};

// ===================== Dados técnicos opcionais (v1.0.2) =====================
// Todos OPCIONAIS. IA NÃO pode inventar valor; pode apenas formatar/organizar.
// `mapsTo` indica colunas em `products`; demais campos vão para product_attributes.
export type TechFieldDef = {
  key: string;
  label: string;
  unit?: string;
  numeric?: boolean;
  /** Quando preenchido, exige revisão humana (certificacao, norma). */
  requireReview?: boolean;
  /** Coluna direta em products; sem isso vira product_attributes. */
  mapsTo?: "brand" | "weight_kg";
  /** Validação leve de formato. */
  pattern?: RegExp;
};

export const TECH_FIELDS: readonly TechFieldDef[] = [
  { key: "marca", label: "Marca", mapsTo: "brand" },
  { key: "modelo", label: "Modelo" },
  { key: "potencia_w", label: "Potência", unit: "W", numeric: true },
  { key: "tensao_v", label: "Tensão", unit: "V" },
  { key: "corrente_a", label: "Corrente", unit: "A", numeric: true },
  { key: "frequencia_hz", label: "Frequência", unit: "Hz", numeric: true },
  { key: "temperatura_cor_k", label: "Temperatura de cor", unit: "K", numeric: true },
  { key: "fluxo_luminoso_lm", label: "Fluxo luminoso", unit: "lm", numeric: true },
  { key: "eficiencia_lm_w", label: "Eficiência", unit: "lm/W", numeric: true },
  { key: "soquete", label: "Soquete" },
  { key: "grau_protecao_ip", label: "Grau de proteção IP", pattern: /^IP\d{2}$/i },
  { key: "cor_produto", label: "Cor" },
  { key: "material", label: "Material" },
  { key: "dimensoes", label: "Dimensões" },
  { key: "peso_kg", label: "Peso", unit: "kg", numeric: true, mapsTo: "weight_kg" },
  { key: "comprimento_m", label: "Comprimento", unit: "m", numeric: true },
  { key: "bitola_mm", label: "Bitola", unit: "mm", numeric: true },
  { key: "amperagem_a", label: "Amperagem", unit: "A", numeric: true },
  { key: "numero_polos", label: "Número de polos", numeric: true },
  { key: "curva_disjuntor", label: "Curva disjuntor" },
  { key: "tipo_instalacao", label: "Tipo de instalação" },
  { key: "vida_util_horas", label: "Vida útil", unit: "h", numeric: true },
  { key: "certificacao", label: "Certificação", requireReview: true },
  { key: "norma_tecnica", label: "Norma técnica", requireReview: true },
  { key: "garantia", label: "Garantia" },
  { key: "codigo_fornecedor", label: "Código do fornecedor" },
  { key: "observacoes_tecnicas", label: "Observações técnicas" },
  { key: "fonte_dados_tecnicos", label: "Fonte dos dados técnicos" },
  { key: "dados_tecnicos_revisados", label: "Dados técnicos revisados" },
] as const;

export const TECH_FIELD_KEYS: readonly string[] = TECH_FIELDS.map((f) => f.key);

export function getTechFieldDef(key: string): TechFieldDef | undefined {
  return TECH_FIELDS.find((f) => f.key === key);
}

/** Sanitiza valor técnico vindo da planilha/edição (trim, max 500, vazio→null). */
export function sanitizeTechValue(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, 500) : null;
}

/** Validação leve, NÃO bloqueante exceto erro de formato evidente. */
export function validateTechValue(
  def: TechFieldDef,
  value: string,
): { error?: string; warning?: string } {
  if (def.numeric) {
    const cleaned = value.replace(",", ".").replace(/[^\d.-]/g, "");
    const n = Number(cleaned);
    if (!Number.isFinite(n) || cleaned === "") {
      return { error: `${def.label}: valor numérico inválido ("${value}").` };
    }
    if (n < 0) {
      return { error: `${def.label}: não pode ser negativo.` };
    }
  }
  if (def.pattern && !def.pattern.test(value)) {
    return { warning: `${def.label}: formato fora do padrão esperado (ex.: IP20, IP65).` };
  }
  if (def.requireReview) {
    return {
      warning: `${def.label} preenchido — exige revisão humana com fonte (embalagem, fornecedor, catálogo).`,
    };
  }
  return {};
}


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
