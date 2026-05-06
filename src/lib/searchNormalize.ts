// Normalização e expansão de termos de busca para a loja.
// Mantém paridade com a função SQL public.search_normalize().

const ACCENT_MAP: Record<string, string> = {
  á: "a",
  à: "a",
  â: "a",
  ã: "a",
  ä: "a",
  é: "e",
  è: "e",
  ê: "e",
  ë: "e",
  í: "i",
  ì: "i",
  î: "i",
  ï: "i",
  ó: "o",
  ò: "o",
  ô: "o",
  õ: "o",
  ö: "o",
  ú: "u",
  ù: "u",
  û: "u",
  ü: "u",
  ç: "c",
  ñ: "n",
};

export function normalizeSearch(text: string | null | undefined): string {
  if (!text) return "";
  const lowered = text.toLowerCase();
  let out = "";
  for (const ch of lowered) {
    out += ACCENT_MAP[ch] ?? ch;
  }
  return out
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Dicionário simples de sinônimos (LED / elétrica).
// Quando um token bate em uma chave, adicionamos os sinônimos como tokens extras.
// Sempre normalizar antes de comparar.
const SYNONYMS: Record<string, string[]> = {
  // Temperatura de cor
  "luz fria": ["6500k", "branco frio"],
  "branco frio": ["6500k", "luz fria"],
  "6500k": ["luz fria", "branco frio"],
  "luz quente": ["3000k", "branco quente"],
  "branco quente": ["3000k", "luz quente"],
  "3000k": ["luz quente", "branco quente"],
  "luz neutra": ["4000k", "branco neutro"],
  "branco neutro": ["4000k", "luz neutra"],
  "4000k": ["luz neutra", "branco neutro"],
  // Voltagem
  bivolt: ["127v", "220v", "bi volt", "bi-volt"],
  "bi volt": ["bivolt"],
  "bi-volt": ["bivolt"],
  // Tipos de luminária
  refletor: ["holofote", "projetor"],
  holofote: ["refletor", "projetor"],
  projetor: ["refletor", "holofote"],
  painel: ["plafon", "embutir"],
  embutir: ["embutido", "painel"],
  embutido: ["embutir", "painel"],
  lampada: ["lamp", "bulbo"],
  // Plurais comuns -> singular (também ajuda fios -> fio)
  refletores: ["refletor"],
  lampadas: ["lampada"],
  paineis: ["painel"],
  fios: ["fio"],
  cabos: ["cabo"],
};

// "18 w" -> "18w", "6500 k" -> "6500k", "ip 66" -> "ip66"
function compactUnits(s: string): string {
  return s
    .replace(/(\d)\s+(w|k|v|ip|a|hz|mm|cm|m|lm)\b/g, "$1$2")
    .replace(/\bip\s+(\d{2})\b/g, "ip$1")
    .replace(/\bbi[\s-]+volt\b/g, "bivolt");
}

/**
 * Expande um termo de busca em uma lista de tokens normalizados,
 * incluindo sinônimos LED/elétrica.
 *
 * Ex.: "luz fria 18w" -> ["luz fria", "18w", "6500k", "branco frio"]
 *      "refletores"    -> ["refletor"]
 */
export function expandSearchTerms(rawQuery: string | null | undefined): string[] {
  const normalized = compactUnits(normalizeSearch(rawQuery ?? ""));
  if (!normalized) return [];

  const tokens = new Set<string>();

  // Frase inteira (importante para "luz fria")
  tokens.add(normalized);

  // Tokens individuais (>= 2 caracteres)
  for (const t of normalized.split(" ")) {
    if (t.length >= 2) tokens.add(t);
  }

  // Bigramas para casar "luz fria", "branco frio" etc.
  const parts = normalized.split(" ");
  for (let i = 0; i < parts.length - 1; i += 1) {
    tokens.add(`${parts[i]} ${parts[i + 1]}`);
  }

  // Aplica sinônimos
  const expansions: string[] = [];
  for (const t of Array.from(tokens)) {
    const syns = SYNONYMS[t];
    if (syns) expansions.push(...syns);
  }
  for (const e of expansions) tokens.add(e);

  // Remove tokens vazios ou muito curtos
  return Array.from(tokens).filter((t) => t.length >= 2 && t.length <= 60);
}
