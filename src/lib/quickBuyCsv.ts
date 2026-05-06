/**
 * Parser de CSV simples para a Compra Rápida.
 *
 * Regras:
 * - Tratamos o CSV como TEXTO PURO. Nenhum conteúdo é interpretado como fórmula.
 * - Removemos prefixos perigosos (= + - @ TAB CR) das células — proteção contra
 *   CSV injection caso o cliente reabra o arquivo no Excel/Sheets depois.
 * - Aceitamos header com sinônimos: codigo|sku|ean|produto|cod e quantidade|qtd|qty|qte.
 * - Aceitamos , ou ; como separador (auto-detecção pela 1ª linha).
 * - Linhas vazias são ignoradas.
 * - Limite máx. de linhas válidas: 100.
 * - Códigos duplicados (case-insensitive, trim) são consolidados somando quantidades.
 * - Quantidade deve ser inteiro > 0.
 */

export const CSV_MAX_BYTES = 256 * 1024; // 256KB
export const CSV_MAX_ROWS = 100;

export type CsvParsedRow = { code: string; qty: number; raw: string };

export type CsvParseError =
  | { kind: "empty_file" }
  | { kind: "too_large"; bytes: number }
  | { kind: "no_rows" }
  | { kind: "too_many_rows"; total: number }
  | { kind: "missing_code_column" }
  | { kind: "missing_qty_column" };

export type CsvLineIssue =
  | { line: number; raw: string; reason: "empty_code" }
  | { line: number; raw: string; reason: "invalid_qty"; value: string };

export type CsvParseResult = {
  rows: CsvParsedRow[];
  issues: CsvLineIssue[];
  duplicatesConsolidated: number;
  totalLinesRead: number;
};

const CODE_HEADER_ALIASES = ["codigo", "código", "sku", "ean", "produto", "cod", "code"];
const QTY_HEADER_ALIASES = ["quantidade", "qtd", "qty", "qte", "quantity", "qnt", "unidades"];

/** Sanitiza valor de célula: remove caracteres perigosos no início (CSV injection). */
export function sanitizeCell(input: string): string {
  let v = (input ?? "").replace(/^\uFEFF/, ""); // BOM
  // Remove aspas externas
  v = v.trim();
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    v = v.slice(1, -1).replace(/""/g, '"');
  }
  // Strip prefixos perigosos repetidamente (=,+,-,@,TAB,CR)
  while (v.length > 0 && /^[=+\-@\t\r]/.test(v)) {
    v = v.slice(1);
  }
  // Remove qualquer caractere de controle que sobrou
  v = v.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  return v;
}

function normalizeHeader(s: string): string {
  return sanitizeCell(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Detecta separador entre `,` e `;` pela 1ª linha não vazia. */
function detectDelimiter(firstLine: string): "," | ";" {
  const semi = (firstLine.match(/;/g) ?? []).length;
  const comma = (firstLine.match(/,/g) ?? []).length;
  return semi > comma ? ";" : ",";
}

/**
 * Parser CSV minimalista compatível com aspas duplas escapadas ("").
 * Suficiente para 2 colunas; não cobre casos exóticos (multilinha em célula etc).
 */
function splitCsvLine(line: string, delim: "," | ";"): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === delim) {
        out.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
  }
  out.push(cur);
  return out;
}

export function parseQuickBuyCsv(
  text: string,
  fileSizeBytes: number,
): { ok: true; result: CsvParseResult } | { ok: false; error: CsvParseError } {
  if (fileSizeBytes > CSV_MAX_BYTES) {
    return { ok: false, error: { kind: "too_large", bytes: fileSizeBytes } };
  }

  const cleanText = (text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!cleanText.trim()) {
    return { ok: false, error: { kind: "empty_file" } };
  }

  const allLines = cleanText.split("\n").filter((l) => l.trim().length > 0);
  if (allLines.length === 0) {
    return { ok: false, error: { kind: "empty_file" } };
  }

  const delim = detectDelimiter(allLines[0]);
  const headerCols = splitCsvLine(allLines[0], delim).map(normalizeHeader);
  const codeIdx = headerCols.findIndex((h) => CODE_HEADER_ALIASES.includes(h));
  const qtyIdx = headerCols.findIndex((h) => QTY_HEADER_ALIASES.includes(h));

  // Se não tem header, tenta interpretar 1ª linha como dado (2 colunas)
  let dataLines = allLines.slice(1);
  let resolvedCodeIdx = codeIdx;
  let resolvedQtyIdx = qtyIdx;

  if (codeIdx < 0 && qtyIdx < 0) {
    // Sem header reconhecível — assume colunas 0=código, 1=qtd
    dataLines = allLines;
    resolvedCodeIdx = 0;
    resolvedQtyIdx = 1;
  } else {
    if (codeIdx < 0) return { ok: false, error: { kind: "missing_code_column" } };
    if (qtyIdx < 0) return { ok: false, error: { kind: "missing_qty_column" } };
  }

  if (dataLines.length === 0) {
    return { ok: false, error: { kind: "no_rows" } };
  }

  const issues: CsvLineIssue[] = [];
  // Mapa para consolidar duplicatas (chave = código normalizado)
  const map = new Map<string, CsvParsedRow>();
  let duplicates = 0;

  for (let i = 0; i < dataLines.length; i++) {
    const raw = dataLines[i];
    // 1-indexed humano: header conta, então linha = i+2 quando havia header
    const humanLine = codeIdx >= 0 || qtyIdx >= 0 ? i + 2 : i + 1;

    const cols = splitCsvLine(raw, delim);
    const codeRaw = sanitizeCell(cols[resolvedCodeIdx] ?? "");
    // Para qty, NÃO removemos prefixos como `-` (preservamos sinal para detectar negativos).
    const qtyCellRaw = (cols[resolvedQtyIdx] ?? "")
      .replace(/^\uFEFF/, "")
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .trim()
      .replace(/^"(.*)"$/s, "$1");

    if (!codeRaw) {
      // Linha sem código mas com algo — registra apenas se havia conteúdo
      if (cols.some((c) => sanitizeCell(c).length > 0)) {
        issues.push({ line: humanLine, raw, reason: "empty_code" });
      }
      continue;
    }

    // Quantidade: aceita "10", "10.0", "10,0" — converte vírgula em ponto
    const qtyNorm = qtyCellRaw.replace(",", ".");
    const qtyNum = Number(qtyNorm);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0 || !Number.isInteger(qtyNum)) {
      issues.push({ line: humanLine, raw, reason: "invalid_qty", value: qtyCellRaw });
      continue;
    }

    const key = codeRaw.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.qty += qtyNum;
      duplicates += 1;
    } else {
      map.set(key, { code: codeRaw, qty: qtyNum, raw });
    }
  }

  const rows = Array.from(map.values());

  if (rows.length === 0) {
    return { ok: false, error: { kind: "no_rows" } };
  }

  if (rows.length > CSV_MAX_ROWS) {
    return { ok: false, error: { kind: "too_many_rows", total: rows.length } };
  }

  return {
    ok: true,
    result: {
      rows,
      issues,
      duplicatesConsolidated: duplicates,
      totalLinesRead: dataLines.length,
    },
  };
}

/** CSV modelo para download. */
export const CSV_TEMPLATE_CONTENT = `codigo,quantidade
REF50W,10
7891234567890,5
PAINEL18W,20
`;
