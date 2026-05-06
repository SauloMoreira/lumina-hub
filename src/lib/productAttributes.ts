/**
 * Atributos técnicos dos produtos — engine pura (sem I/O).
 *
 * Inclui:
 *  - Sugestões prontas (Potência, Temperatura de cor, Voltagem, IP, etc.).
 *  - Normalização de valores comuns (18W, 6500K, IP66, Bivolt, 1500lm, 12 meses).
 *  - Parser por regex local que sugere atributos a partir do nome/descrição/tags.
 *
 * Regras importantes:
 *  - Default `is_visible = true`, `is_filterable = false`.
 *  - Não usar IA aqui. Não fazer chamadas externas.
 *  - Não escolher entre conflitos automaticamente — devolver lista.
 */

export type AttributeSuggestion = {
  key: string;
  label: string;
  unit?: string;
  placeholder?: string;
  description?: string;
  filterableByDefault?: boolean;
};

export const ATTRIBUTE_SUGGESTIONS: AttributeSuggestion[] = [
  {
    key: "power",
    label: "Potência",
    unit: "W",
    placeholder: "18",
    description: "Potência elétrica do produto.",
  },
  {
    key: "color_temperature",
    label: "Temperatura de cor",
    unit: "K",
    placeholder: "6500",
    description: "3000K quente, 4000K neutra, 6500K fria.",
  },
  { key: "voltage", label: "Voltagem", placeholder: "127V, 220V ou Bivolt" },
  { key: "ip_rating", label: "Proteção IP", placeholder: "IP65" },
  { key: "luminous_flux", label: "Fluxo luminoso", unit: "lm", placeholder: "1500" },
  { key: "color", label: "Cor", placeholder: "Branco, Preto…" },
  { key: "material", label: "Material", placeholder: "Alumínio, Plástico…" },
  { key: "application", label: "Aplicação", placeholder: "Interno, Externo, Industrial…" },
  {
    key: "installation_type",
    label: "Tipo de instalação",
    placeholder: "Embutir, Sobrepor, Pendente…",
  },
  { key: "warranty", label: "Garantia", placeholder: "12 meses" },
  { key: "brand", label: "Marca", placeholder: "Ex.: Ourolux" },
];

const SUGGESTION_BY_KEY = new Map(ATTRIBUTE_SUGGESTIONS.map((s) => [s.key, s]));

export function getSuggestion(key: string): AttributeSuggestion | undefined {
  return SUGGESTION_BY_KEY.get(key.toLowerCase());
}

// ---------------------------------------------------------------------------
// Sanitização defensiva — removemos qualquer HTML para evitar XSS.
// ---------------------------------------------------------------------------
export function sanitizeAttributeText(input: string | null | undefined, maxLen = 500): string {
  if (input == null) return "";
  const stripped = String(input)
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim();
  return stripped.length > maxLen ? stripped.slice(0, maxLen) : stripped;
}

export function normalizeKey(key: string): string {
  return sanitizeAttributeText(key, 80)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ---------------------------------------------------------------------------
// Normalização de valores conhecidos.
// Devolve { value, unit } no formato canônico esperado pelo banco.
// ---------------------------------------------------------------------------
export type NormalizedValue = { value: string; unit: string | null };

export function normalizeAttributeValue(
  key: string,
  rawValue: string,
  rawUnit?: string | null,
): NormalizedValue {
  const k = normalizeKey(key);
  const value = sanitizeAttributeText(rawValue, 500);
  const unit = sanitizeAttributeText(rawUnit ?? "", 20);

  if (!value) return { value: "", unit: unit || null };

  switch (k) {
    case "power": {
      const m = value.match(/(\d+(?:[.,]\d+)?)\s*w?/i);
      if (m) return { value: m[1].replace(",", "."), unit: "W" };
      return { value, unit: unit || "W" };
    }
    case "color_temperature": {
      const lower = value.toLowerCase();
      if (/luz\s*quente|branco\s*quente/.test(lower)) return { value: "3000", unit: "K" };
      if (/luz\s*neutra|branco\s*neutro/.test(lower)) return { value: "4000", unit: "K" };
      if (/luz\s*fria|branco\s*frio/.test(lower)) return { value: "6500", unit: "K" };
      const m = value.match(/(\d{3,5})\s*k?/i);
      if (m) return { value: m[1], unit: "K" };
      return { value, unit: unit || "K" };
    }
    case "voltage": {
      const lower = value.toLowerCase().replace(/\s+/g, "");
      if (/bi-?volt|biv/.test(lower)) return { value: "Bivolt", unit: null };
      const m = value.match(/(\d{2,3})\s*v?/i);
      if (m) return { value: `${m[1]}V`, unit: null };
      return { value, unit: unit || null };
    }
    case "ip_rating": {
      const m = value.match(/ip\s*(\d{2})/i);
      if (m) return { value: `IP${m[1]}`, unit: null };
      return { value: value.toUpperCase().replace(/\s+/g, ""), unit: null };
    }
    case "luminous_flux": {
      const m = value.match(/(\d{2,6})\s*lm?/i);
      if (m) return { value: m[1], unit: "lm" };
      return { value, unit: unit || "lm" };
    }
    case "warranty": {
      const lower = value.toLowerCase();
      const meses = lower.match(/(\d{1,3})\s*(?:m|mes|meses)\b/);
      if (meses) return { value: `${meses[1]} meses`, unit: null };
      const anos = lower.match(/(\d{1,2})\s*(?:a|ano|anos)\b/);
      if (anos) {
        const n = Number(anos[1]);
        return { value: `${n * 12} meses`, unit: null };
      }
      return { value, unit: unit || null };
    }
    default:
      return { value, unit: unit || null };
  }
}

// ---------------------------------------------------------------------------
// Formatação para exibição.
// ---------------------------------------------------------------------------
export function formatAttributeDisplay(value: string, unit?: string | null): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  const u = (unit ?? "").trim();
  if (!u) return v;
  // Unidades coladas (W, K, lm) ficam sem espaço; outras com espaço
  const noSpace = /^(W|K|lm|kW|V|Hz|mA|A)$/i.test(u);
  return noSpace ? `${v}${u}` : `${v} ${u}`;
}

// ---------------------------------------------------------------------------
// Parser por regex local: gera sugestões a partir de texto livre.
// ---------------------------------------------------------------------------
export type ParsedAttribute = {
  key: string;
  label: string;
  value: string;
  unit: string | null;
  /** Quando há mais de um match (ex.: "3000K/6500K") devolvemos várias opções. */
  conflict?: string[];
  /** Trecho do texto original que originou a sugestão. */
  match?: string;
};

const POWER_RE = /(\d{1,4}(?:[.,]\d{1,2})?)\s*w\b/gi;
const KELVIN_RE = /(\d{3,5})\s*k\b/gi;
const IP_RE = /\bip\s*(\d{2})\b/gi;
const VOLT_RE = /\b(110|127|220|240)\s*v\b|\b(bi-?volt)\b/gi;
const LUMEN_RE = /(\d{2,6})\s*lm\b/gi;
const WARRANTY_MONTHS_RE = /\b(\d{1,3})\s*(?:m|mes|meses)\b\s*(?:de\s*garantia|garantia)?/gi;
const WARRANTY_YEARS_RE = /(?:garantia(?:\s*de)?\s*)?(\d{1,2})\s*(?:a|ano|anos)\b/gi;

const COLOR_TEMP_KEYWORDS: Array<{ rx: RegExp; kelvin: string }> = [
  { rx: /\b(luz\s*quente|branco\s*quente)\b/gi, kelvin: "3000" },
  { rx: /\b(luz\s*neutra|branco\s*neutro)\b/gi, kelvin: "4000" },
  { rx: /\b(luz\s*fria|branco\s*frio)\b/gi, kelvin: "6500" },
];

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function collectMatches(text: string, rx: RegExp, group = 1): string[] {
  const out: string[] = [];
  // recriamos para garantir lastIndex zerado
  const re = new RegExp(rx.source, rx.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const v = m[group] ?? m[0];
    if (v) out.push(v);
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  return out;
}

export type ParseInput = {
  name?: string | null;
  description?: string | null;
  tags?: string[] | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

export function parseAttributesFromText(input: ParseInput): ParsedAttribute[] {
  const text = sanitizeAttributeText(
    [
      input.name ?? "",
      input.seoTitle ?? "",
      input.description ?? "",
      input.seoDescription ?? "",
      Array.isArray(input.tags) ? input.tags.join(" ") : "",
    ]
      .join(" \n ")
      .trim(),
    8000,
  );
  if (!text) return [];

  const out: ParsedAttribute[] = [];

  // Potência
  const powers = uniq(collectMatches(text, POWER_RE).map((v) => v.replace(",", ".")));
  if (powers.length === 1) {
    out.push({
      key: "power",
      label: "Potência",
      value: powers[0],
      unit: "W",
      match: `${powers[0]}W`,
    });
  } else if (powers.length > 1) {
    out.push({
      key: "power",
      label: "Potência",
      value: powers[0],
      unit: "W",
      conflict: powers.map((p) => `${p}W`),
      match: powers.join(" / "),
    });
  }

  // Temperatura de cor — combina números + termos
  const kelvins = uniq(collectMatches(text, KELVIN_RE));
  for (const kw of COLOR_TEMP_KEYWORDS) {
    if (kw.rx.test(text)) kelvins.push(kw.kelvin);
  }
  const kelvinsUniq = uniq(kelvins);
  if (kelvinsUniq.length === 1) {
    out.push({
      key: "color_temperature",
      label: "Temperatura de cor",
      value: kelvinsUniq[0],
      unit: "K",
      match: `${kelvinsUniq[0]}K`,
    });
  } else if (kelvinsUniq.length > 1) {
    out.push({
      key: "color_temperature",
      label: "Temperatura de cor",
      value: kelvinsUniq[0],
      unit: "K",
      conflict: kelvinsUniq.map((k) => `${k}K`),
      match: kelvinsUniq.join(" / "),
    });
  }

  // Proteção IP
  const ips = uniq(collectMatches(text, IP_RE).map((v) => `IP${v}`));
  if (ips.length === 1) {
    out.push({ key: "ip_rating", label: "Proteção IP", value: ips[0], unit: null, match: ips[0] });
  } else if (ips.length > 1) {
    out.push({
      key: "ip_rating",
      label: "Proteção IP",
      value: ips[0],
      unit: null,
      conflict: ips,
      match: ips.join(" / "),
    });
  }

  // Voltagem
  const voltMatches: string[] = [];
  const reVolt = new RegExp(VOLT_RE.source, VOLT_RE.flags);
  let mv: RegExpExecArray | null;
  while ((mv = reVolt.exec(text)) !== null) {
    if (mv[2]) voltMatches.push("Bivolt");
    else if (mv[1]) voltMatches.push(`${mv[1]}V`);
    if (reVolt.lastIndex === mv.index) reVolt.lastIndex++;
  }
  const volts = uniq(voltMatches);
  if (volts.length === 1) {
    out.push({ key: "voltage", label: "Voltagem", value: volts[0], unit: null, match: volts[0] });
  } else if (volts.length > 1) {
    // Bivolt + 127/220 não é conflito real — bivolt vence
    if (volts.includes("Bivolt")) {
      out.push({
        key: "voltage",
        label: "Voltagem",
        value: "Bivolt",
        unit: null,
        match: volts.join(" / "),
      });
    } else {
      out.push({
        key: "voltage",
        label: "Voltagem",
        value: volts[0],
        unit: null,
        conflict: volts,
        match: volts.join(" / "),
      });
    }
  }

  // Fluxo luminoso
  const lumens = uniq(collectMatches(text, LUMEN_RE));
  if (lumens.length === 1) {
    out.push({
      key: "luminous_flux",
      label: "Fluxo luminoso",
      value: lumens[0],
      unit: "lm",
      match: `${lumens[0]}lm`,
    });
  } else if (lumens.length > 1) {
    out.push({
      key: "luminous_flux",
      label: "Fluxo luminoso",
      value: lumens[0],
      unit: "lm",
      conflict: lumens.map((l) => `${l}lm`),
      match: lumens.join(" / "),
    });
  }

  // Garantia
  const monthMatches = collectMatches(text, WARRANTY_MONTHS_RE);
  const yearMatches = collectMatches(text, WARRANTY_YEARS_RE);
  if (monthMatches.length > 0) {
    const months = monthMatches[0];
    out.push({
      key: "warranty",
      label: "Garantia",
      value: `${months} meses`,
      unit: null,
      match: `${months} meses`,
    });
  } else if (yearMatches.length > 0) {
    const years = Number(yearMatches[0]);
    if (Number.isFinite(years) && years > 0 && years < 25) {
      out.push({
        key: "warranty",
        label: "Garantia",
        value: `${years * 12} meses`,
        unit: null,
        match: `${years} ano(s)`,
      });
    }
  }

  return out;
}
