import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type FeeSource = "mercado_pago_real" | "estimated" | "unknown";

export type MpFeeBreakdown = {
  gross: number | null;
  feeReal: number | null;
  netReal: number | null;
  feeEstimated: number | null;
  netEstimated: number | null;
  feeDetails: unknown | null;
  source: FeeSource;
};

export type MpEstimateConfig = {
  default_percent: number;
  default_fixed: number;
  pix_percent: number;
  pix_fixed: number;
  credit_percent: number;
  credit_fixed: number;
  boleto_percent: number;
  boleto_fixed: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function loadFeeConfig(): Promise<MpEstimateConfig> {
  const { data } = await supabaseAdmin
    .from("finance_settings")
    .select(
      "mp_fee_default_percent, mp_fee_pix_percent, mp_fee_pix_fixed, mp_fee_credit_percent, mp_fee_credit_fixed, mp_fee_boleto_percent, mp_fee_boleto_fixed",
    )
    .limit(1)
    .maybeSingle();
  return {
    default_percent: Number(data?.mp_fee_default_percent ?? 4.99),
    default_fixed: 0,
    pix_percent: Number(data?.mp_fee_pix_percent ?? 0.99),
    pix_fixed: Number(data?.mp_fee_pix_fixed ?? 0),
    credit_percent: Number(data?.mp_fee_credit_percent ?? 4.99),
    credit_fixed: Number(data?.mp_fee_credit_fixed ?? 0),
    boleto_percent: Number(data?.mp_fee_boleto_percent ?? 3.49),
    boleto_fixed: Number(data?.mp_fee_boleto_fixed ?? 0),
  };
}

export function estimateFee(
  gross: number,
  paymentTypeOrMethod: string | null | undefined,
  cfg: MpEstimateConfig,
): number {
  const t = (paymentTypeOrMethod ?? "").toLowerCase();
  let pct = cfg.default_percent;
  let fixed = cfg.default_fixed;
  if (t === "pix" || t.includes("pix")) {
    pct = cfg.pix_percent;
    fixed = cfg.pix_fixed;
  } else if (t === "credit_card" || t.includes("credit")) {
    pct = cfg.credit_percent;
    fixed = cfg.credit_fixed;
  } else if (t === "ticket" || t.includes("boleto")) {
    pct = cfg.boleto_percent;
    fixed = cfg.boleto_fixed;
  }
  return round2(gross * (pct / 100) + fixed);
}

/**
 * Recebe payload "v1/payments/{id}" do MP e calcula breakdown financeiro.
 */
export async function computeMpFees(payment: {
  transaction_amount?: number | null;
  fee_details?: Array<{ amount?: number; type?: string }> | null;
  payment_method_id?: string | null;
  payment_type_id?: string | null;
}): Promise<MpFeeBreakdown> {
  const gross =
    typeof payment.transaction_amount === "number" ? round2(payment.transaction_amount) : null;
  const cfg = await loadFeeConfig();
  let feeReal: number | null = null;
  let netReal: number | null = null;
  let source: FeeSource = "unknown";
  let feeDetails: unknown | null = null;

  if (Array.isArray(payment.fee_details) && payment.fee_details.length > 0) {
    const sum = payment.fee_details.reduce((acc, f) => acc + (Number(f?.amount) || 0), 0);
    if (sum > 0) {
      feeReal = round2(sum);
      feeDetails = payment.fee_details;
      if (gross != null) netReal = round2(gross - feeReal);
      source = "mercado_pago_real";
    }
  }

  let feeEstimated: number | null = null;
  let netEstimated: number | null = null;
  if (gross != null && gross > 0) {
    feeEstimated = estimateFee(gross, payment.payment_type_id ?? payment.payment_method_id, cfg);
    netEstimated = round2(gross - feeEstimated);
    if (source === "unknown") source = "estimated";
  }

  return { gross, feeReal, netReal, feeEstimated, netEstimated, feeDetails, source };
}
