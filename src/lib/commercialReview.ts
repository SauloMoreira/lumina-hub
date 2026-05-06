/**
 * Engine pura de Revisão Comercial.
 *
 * NUNCA altera dados. Apenas classifica produtos com base em campos do
 * próprio cadastro (price, sale_price, cost_price, min_margin_percent,
 * b2b_price, b2b_min_qty, b2b_enabled).
 *
 * Não usa histórico de vendas (isso fica para a Onda 2).
 */

export type CommercialStatus =
  | "no_price"
  | "no_cost"
  | "negative_margin"
  | "critical_margin"
  | "attention_margin"
  | "b2b_critical"
  | "b2b_incomplete"
  | "healthy";

export type CommercialIssueCode =
  | "no_price"
  | "no_cost"
  | "negative_margin"
  | "critical_margin"
  | "attention_margin"
  | "b2b_critical"
  | "b2b_inconsistent"
  | "b2b_price_without_min_qty"
  | "b2b_min_qty_without_price";

export type CommercialIssue = {
  code: CommercialIssueCode;
  severity: "high" | "medium" | "low";
  message: string;
  recommendation: string;
};

export type CommercialReviewInput = {
  id: string;
  name?: string | null;
  sku?: string | null;
  price: number | null;
  sale_price?: number | null;
  cost_price: number | null;
  min_margin_percent?: number | null;
  b2b_enabled?: boolean | null;
  b2b_price?: number | null;
  b2b_min_qty?: number | null;
};

export type CommercialReviewResult = {
  effectivePrice: number | null;
  margin: number | null;
  marginPercent: number | null;
  b2bMargin: number | null;
  b2bMarginPercent: number | null;
  effectiveMinMargin: number;
  status: CommercialStatus;
  primaryStatusLabel: string;
  issues: CommercialIssue[];
};

export const STATUS_LABEL: Record<CommercialStatus, string> = {
  no_price: "Sem preço",
  no_cost: "Sem custo",
  negative_margin: "Margem negativa",
  critical_margin: "Margem crítica",
  attention_margin: "Margem em atenção",
  b2b_critical: "B2B crítico",
  b2b_incomplete: "B2B incompleto",
  healthy: "Saudável",
};

export const STATUS_TONE: Record<CommercialStatus, "danger" | "warn" | "ok" | "info"> = {
  no_price: "danger",
  no_cost: "warn",
  negative_margin: "danger",
  critical_margin: "danger",
  attention_margin: "warn",
  b2b_critical: "danger",
  b2b_incomplete: "warn",
  healthy: "ok",
};

const ATTENTION_BUFFER = 5; // pontos percentuais acima da mínima ainda é "atenção"
const DEFAULT_MIN_MARGIN = 25; // fallback quando finance_settings não informa

function num(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function computeCommercialReview(
  product: CommercialReviewInput,
  defaultMinMarginPercent: number = DEFAULT_MIN_MARGIN,
): CommercialReviewResult {
  const price = num(product.price);
  const salePrice = num(product.sale_price);
  const cost = num(product.cost_price);
  const effectivePrice =
    salePrice != null && salePrice > 0 ? salePrice : price && price > 0 ? price : null;
  const minMarginRaw = num(product.min_margin_percent);
  const effectiveMinMargin =
    minMarginRaw != null && minMarginRaw > 0 ? minMarginRaw : defaultMinMarginPercent;

  const issues: CommercialIssue[] = [];

  // ---------- Preço ----------
  const hasNoPrice = effectivePrice == null || effectivePrice <= 0;
  if (hasNoPrice) {
    issues.push({
      code: "no_price",
      severity: "high",
      message: "Produto sem preço de venda válido.",
      recommendation: "Cadastre um preço de venda válido.",
    });
  }

  // ---------- Custo ----------
  const hasNoCost = cost == null;
  if (hasNoCost) {
    issues.push({
      code: "no_cost",
      severity: "medium",
      message: "Custo (cost_price) não cadastrado.",
      recommendation: "Cadastre o custo para calcular margem corretamente.",
    });
  }

  // ---------- Margem varejo ----------
  let margin: number | null = null;
  let marginPercent: number | null = null;
  if (!hasNoPrice && !hasNoCost && effectivePrice && cost != null) {
    margin = effectivePrice - cost;
    marginPercent = (margin / effectivePrice) * 100;
    if (marginPercent < 0) {
      issues.push({
        code: "negative_margin",
        severity: "high",
        message: `Margem atual ${marginPercent.toFixed(1)}% — venda dá prejuízo.`,
        recommendation: "Revise preço de venda, custo ou descontos aplicados.",
      });
    } else if (marginPercent < effectiveMinMargin) {
      issues.push({
        code: "critical_margin",
        severity: "high",
        message: `Margem ${marginPercent.toFixed(1)}% abaixo da mínima ${effectiveMinMargin}%.`,
        recommendation: "Revise preço de venda, custo ou descontos aplicados.",
      });
    } else if (marginPercent < effectiveMinMargin + ATTENTION_BUFFER) {
      issues.push({
        code: "attention_margin",
        severity: "low",
        message: `Margem ${marginPercent.toFixed(1)}% próxima do mínimo (${effectiveMinMargin}%).`,
        recommendation: "Margem apertada — acompanhe descontos e custo.",
      });
    }
  }

  // ---------- B2B ----------
  const b2bPrice = num(product.b2b_price);
  const b2bMinQty = num(product.b2b_min_qty);
  let b2bMargin: number | null = null;
  let b2bMarginPercent: number | null = null;

  if (b2bPrice != null && b2bPrice > 0 && (b2bMinQty == null || b2bMinQty <= 0)) {
    issues.push({
      code: "b2b_price_without_min_qty",
      severity: "medium",
      message: "Preço B2B cadastrado sem quantidade mínima B2B.",
      recommendation: "Defina quantidade mínima B2B ou remova o preço B2B.",
    });
  }
  if ((b2bPrice == null || b2bPrice <= 0) && b2bMinQty != null && b2bMinQty > 0) {
    issues.push({
      code: "b2b_min_qty_without_price",
      severity: "medium",
      message: "Quantidade mínima B2B definida sem preço B2B.",
      recommendation: "Cadastre preço B2B ou remova a quantidade mínima.",
    });
  }
  if (b2bPrice != null && b2bPrice > 0 && effectivePrice != null && b2bPrice >= effectivePrice) {
    issues.push({
      code: "b2b_inconsistent",
      severity: "medium",
      message: "Preço B2B maior ou igual ao preço de varejo — sem vantagem para o cliente.",
      recommendation: "Ajuste o preço B2B para ser menor que o varejo.",
    });
  }
  if (b2bPrice != null && b2bPrice > 0 && cost != null) {
    b2bMargin = b2bPrice - cost;
    b2bMarginPercent = (b2bMargin / b2bPrice) * 100;
    if (b2bMarginPercent < effectiveMinMargin) {
      issues.push({
        code: "b2b_critical",
        severity: "high",
        message: `Margem B2B ${b2bMarginPercent.toFixed(1)}% abaixo da mínima ${effectiveMinMargin}%.`,
        recommendation: "Revise a condição de atacado para proteger a margem.",
      });
    }
  }

  // ---------- Status primário ----------
  const status = pickPrimaryStatus(issues);

  return {
    effectivePrice,
    margin,
    marginPercent,
    b2bMargin,
    b2bMarginPercent,
    effectiveMinMargin,
    status,
    primaryStatusLabel: STATUS_LABEL[status],
    issues,
  };
}

const STATUS_PRIORITY: CommercialStatus[] = [
  "negative_margin",
  "critical_margin",
  "b2b_critical",
  "no_price",
  "no_cost",
  "b2b_incomplete",
  "attention_margin",
  "healthy",
];

function pickPrimaryStatus(issues: CommercialIssue[]): CommercialStatus {
  const codes = new Set(issues.map((i) => i.code));
  const has = (c: CommercialIssueCode) => codes.has(c);
  const candidates: CommercialStatus[] = [];
  if (has("negative_margin")) candidates.push("negative_margin");
  if (has("critical_margin")) candidates.push("critical_margin");
  if (has("b2b_critical")) candidates.push("b2b_critical");
  if (has("no_price")) candidates.push("no_price");
  if (has("no_cost")) candidates.push("no_cost");
  if (
    has("b2b_price_without_min_qty") ||
    has("b2b_min_qty_without_price") ||
    has("b2b_inconsistent")
  ) {
    candidates.push("b2b_incomplete");
  }
  if (has("attention_margin")) candidates.push("attention_margin");
  if (candidates.length === 0) return "healthy";
  for (const s of STATUS_PRIORITY) {
    if (candidates.includes(s)) return s;
  }
  return "healthy";
}
