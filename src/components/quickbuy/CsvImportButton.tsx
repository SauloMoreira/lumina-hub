import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload, X, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import {
  CSV_MAX_BYTES,
  CSV_MAX_ROWS,
  CSV_TEMPLATE_CONTENT,
  parseQuickBuyCsv,
  type CsvLineIssue,
  type CsvParseError,
  type CsvParsedRow,
} from "@/lib/quickBuyCsv";

type Props = {
  onParsed: (rows: CsvParsedRow[]) => void;
  isProcessing?: boolean;
};

function describeError(e: CsvParseError): string {
  switch (e.kind) {
    case "empty_file":
      return "O arquivo está vazio.";
    case "too_large":
      return `Arquivo muito grande (${Math.round(e.bytes / 1024)} KB). Máximo ${Math.round(CSV_MAX_BYTES / 1024)} KB.`;
    case "no_rows":
      return "Nenhuma linha válida encontrada no arquivo.";
    case "too_many_rows":
      return `Limite de ${CSV_MAX_ROWS} itens por importação. O arquivo tem ${e.total}.`;
    case "missing_code_column":
      return 'Coluna "codigo" (ou sku/ean/produto) não encontrada no cabeçalho.';
    case "missing_qty_column":
      return 'Coluna "quantidade" (ou qtd/qty) não encontrada no cabeçalho.';
    default:
      return "Erro ao processar o arquivo.";
  }
}

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE_CONTENT], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo-compra-rapida.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CsvImportButton({ onParsed, isProcessing }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [issues, setIssues] = useState<CsvLineIssue[]>([]);
  const [summary, setSummary] = useState<{
    rows: number;
    duplicates: number;
    fileName: string;
  } | null>(null);

  const handleFile = async (file: File) => {
    if (!file) return;

    // Validações de extensão e tamanho ANTES de ler
    const isCsv =
      file.type === "text/csv" ||
      file.type === "application/vnd.ms-excel" ||
      file.type === "" || // alguns navegadores mandam vazio
      file.name.toLowerCase().endsWith(".csv");

    if (!isCsv) {
      toast.error("Envie um arquivo .csv válido.");
      return;
    }

    if (file.size > CSV_MAX_BYTES) {
      toast.error(`Arquivo muito grande. Máximo ${Math.round(CSV_MAX_BYTES / 1024)} KB.`);
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseQuickBuyCsv(text, file.size);
      if (!parsed.ok) {
        toast.error(describeError(parsed.error));
        setIssues([]);
        setSummary(null);
        return;
      }

      const { rows, issues: lineIssues, duplicatesConsolidated } = parsed.result;
      setIssues(lineIssues);
      setSummary({
        rows: rows.length,
        duplicates: duplicatesConsolidated,
        fileName: file.name,
      });

      const messages: string[] = [];
      messages.push(`${rows.length} linha(s) válida(s) lida(s).`);
      if (duplicatesConsolidated > 0) {
        messages.push(
          `Encontramos ${duplicatesConsolidated} código(s) repetido(s) e consolidamos as quantidades.`,
        );
      }
      if (lineIssues.length > 0) {
        messages.push(`${lineIssues.length} linha(s) ignorada(s) por erro.`);
      }
      toast.success(messages.join(" "));

      onParsed(rows);
    } catch (err) {
      console.error("CSV read failed", err);
      toast.error("Não foi possível ler o arquivo.");
    } finally {
      // Permite reimportar o mesmo arquivo
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="mt-6 pt-5 border-t border-border">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground text-sm">Importar arquivo CSV</h3>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Importe um arquivo CSV com duas colunas:{" "}
        <code className="px-1 rounded bg-muted">codigo</code> e{" "}
        <code className="px-1 rounded bg-muted">quantidade</code>. Você pode usar SKU, EAN/código de
        barras ou código interno do produto. Máximo {CSV_MAX_ROWS} itens.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isProcessing}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground font-semibold hover:brightness-110 transition shadow-primary disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          <Upload className="w-4 h-4" /> Importar CSV
        </button>
        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-border bg-background text-foreground hover:bg-muted transition text-sm"
        >
          <Download className="w-4 h-4" /> Baixar modelo CSV
        </button>
        {summary && (
          <button
            type="button"
            onClick={() => {
              setSummary(null);
              setIssues([]);
            }}
            className="inline-flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-background text-muted-foreground hover:bg-muted transition text-xs"
          >
            <X className="w-3.5 h-3.5" /> Limpar importação
          </button>
        )}
      </div>

      {summary && (
        <div className="mt-3 flex items-start gap-2 text-xs bg-primary/5 border border-primary/30 rounded-md px-3 py-2">
          <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="text-foreground/80">
            <strong className="text-foreground">{summary.fileName}</strong> — {summary.rows}{" "}
            item(ns) importado(s).{" "}
            {summary.duplicates > 0 && (
              <span>
                Encontramos {summary.duplicates} código(s) repetido(s) e consolidamos as
                quantidades.
              </span>
            )}
          </div>
        </div>
      )}

      {issues.length > 0 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer inline-flex items-center gap-1.5 text-warning font-semibold">
            <AlertTriangle className="w-3.5 h-3.5" /> {issues.length} linha(s) ignorada(s)
          </summary>
          <ul className="mt-2 max-h-40 overflow-auto border border-warning/30 bg-warning/5 rounded-md p-2 space-y-1">
            {issues.slice(0, 50).map((iss, idx) => (
              <li key={idx} className="font-mono text-[11px] text-foreground/80">
                Linha {iss.line}:{" "}
                {iss.reason === "empty_code"
                  ? "código vazio"
                  : `quantidade inválida ("${iss.value}")`}{" "}
                — <span className="opacity-70">{iss.raw.slice(0, 80)}</span>
              </li>
            ))}
            {issues.length > 50 && (
              <li className="text-[11px] text-muted-foreground">… e mais {issues.length - 50}.</li>
            )}
          </ul>
        </details>
      )}
    </div>
  );
}
