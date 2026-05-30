import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { ArrowLeft, Upload, Loader2, Sparkles, Download, FileSpreadsheet, PlayCircle, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  parseImportSheet,
  validateImportRows,
  enrichImportRows,
  simulateImport,
  commitImport,
  downloadRevisedSheet,
} from "@/server/productImport.functions";
import type { ImportRow } from "@/lib/productImport";
import { countRows } from "@/lib/productImport";

type SimResult = {
  plan: Array<{
    rowIndex: number;
    sku: string;
    nome: string;
    simAction: "create" | "update" | "skip" | "error";
    reasons: string[];
  }>;
  summary: { total: number; toCreate: number; toUpdate: number; toSkip: number; errors: number };
};

type CommitResult = {
  summary: {
    importId: string;
    fileName: string;
    total: number;
    created: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  log: Array<{
    rowIndex: number;
    sku: string;
    result: "created" | "updated" | "skipped" | "error";
    productId?: string;
    message?: string;
  }>;
};

export const Route = createFileRoute("/admin/produtos/importacao-ia")({
  component: ImportacaoIaPage,
});

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.replace(/^data:[^;]+;base64,/, ""));
    };
    reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });
}

function statusBadge(status: ImportRow["status"]) {
  if (status === "ready")
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">Pronto</Badge>;
  if (status === "needs_review")
    return <Badge variant="secondary">Aguarda revisão</Badge>;
  if (status === "invalid") return <Badge variant="destructive">Erro</Badge>;
  return <Badge variant="outline">Ignorada</Badge>;
}

function ImportacaoIaPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [sim, setSim] = useState<SimResult | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [detailRow, setDetailRow] = useState<ImportRow | null>(null);

  const counts = useMemo(() => countRows(rows), [rows]);
  const canImport = sim !== null && counts.ready > 0;

  async function handleParseFile(picked: File) {
    setFile(picked);
    setLoading("parse");
    setSim(null);
    setCommitResult(null);
    try {
      const b64 = await fileToBase64(picked);
      const res = await parseImportSheet({ data: { fileBase64: b64, fileName: picked.name } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRows(res.rows);
      setFileName(picked.name);
      toast.success(`Planilha lida: ${res.rows.length} linhas.`);
      await handleValidate(res.rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao ler planilha");
    } finally {
      setLoading(null);
    }
  }


  async function handleValidate(seed?: ImportRow[]) {
    const input = seed ?? rows;
    if (!input.length) return;
    setLoading("validate");
    setSim(null);
    try {
      const res = await validateImportRows({ data: { rows: input } });
      if (!res.ok) return;
      setRows(res.rows);
      toast.success(
        `Validação: ${res.counts.ready} prontos, ${res.counts.needsReview} aguardando revisão, ${res.counts.invalid} com erro.`,
      );
    } finally {
      setLoading(null);
    }
  }

  async function handleEnrich() {
    if (!rows.length) return;
    setLoading("enrich");
    try {
      const res = await enrichImportRows({ data: { rows, onlyEmpty: true } });
      if (!res.ok) return;
      setRows(res.rows);
      toast.success(`IA preencheu ${res.succeeded} linhas (${res.failed} falhas).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro IA");
    } finally {
      setLoading(null);
    }
  }

  async function handleSimulate() {
    if (!rows.length) return;
    setLoading("sim");
    setCommitResult(null);
    try {
      const res = await simulateImport({ data: { rows } });
      if (!res.ok) return;
      setSim({ plan: res.plan, summary: res.summary });
      toast.success(
        `Simulação: ${res.summary.toCreate} criar, ${res.summary.toUpdate} atualizar, ${res.summary.toSkip} ignorar, ${res.summary.errors} erro.`,
      );
    } finally {
      setLoading(null);
    }
  }

  async function handleCommit() {
    if (!sim) {
      toast.error("Execute a simulação antes de importar.");
      return;
    }
    if (
      !window.confirm(
        `Confirma a importação?\n\n${sim.summary.toCreate} criar · ${sim.summary.toUpdate} atualizar · ${sim.summary.toSkip} ignorar.`,
      )
    )
      return;
    setLoading("commit");
    try {
      const res = await commitImport({ data: { rows, fileName } });
      if (!res.ok) return;
      setCommitResult({ summary: res.summary, log: res.log });
      toast.success(
        `Importação concluída: ${res.summary.created} criados, ${res.summary.updated} atualizados.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro na importação");
    } finally {
      setLoading(null);
    }
  }

  async function handleDownload() {
    if (!rows.length) return;
    setLoading("download");
    try {
      const res = await downloadRevisedSheet({ data: { rows } });
      if (!res.ok) return;
      const bin = atob(res.fileBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Planilha revisada baixada.");
    } finally {
      setLoading(null);
    }
  }

  function handleCancel() {
    setRows([]);
    setFile(null);
    setFileName("");
    setSim(null);
    setCommitResult(null);
  }

  function downloadCommitLog() {
    if (!commitResult) return;
    const header = "rowIndex,sku,result,productId,message\n";
    const body = commitResult.log
      .map(
        (l) =>
          `${l.rowIndex},"${(l.sku ?? "").replace(/"/g, '""')}",${l.result},${l.productId ?? ""},"${(l.message ?? "").replace(/"/g, '""')}"`,
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `importacao_${commitResult.summary.importId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminLayout
      title="Importação de Produtos (IA)"
      action={
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/produtos">
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para Produtos
          </Link>
        </Button>
      }
    >
      <div className="space-y-6 max-w-7xl">
        {/* Introdução */}
        <div>
          <h1 className="font-display text-xl font-semibold mb-1">
            Importação de produtos por planilha
          </h1>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Baixe o modelo oficial, preencha os campos mínimos e envie a planilha para validação.
            A IA poderá sugerir descrições, slug, SEO e tags, mas a importação só será realizada
            após revisão e aprovação humana.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Card 1 — Modelo oficial */}
          <Card className="p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              <h2 className="font-display text-base font-semibold">Modelo oficial da planilha</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4 flex-1">
              Use sempre o arquivo modelo para garantir compatibilidade com o importador.
              Não altere os nomes das colunas.
            </p>
            <div className="space-y-3">
              <Button asChild variant="default" className="w-full">
                <a
                  href="/templates/Cadastro_Minimo_Produtos_Led_Marica_IA.xlsx"
                  download="Cadastro_Minimo_Produtos_Led_Marica_IA.xlsx"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Baixar modelo da planilha
                </a>
              </Button>
              <p className="text-xs text-muted-foreground">
                O arquivo deve ser mantido no formato original para que o agente de IA consiga ler
                corretamente as colunas esperadas.
              </p>
            </div>
          </Card>

          {/* Card 2 — Enviar planilha */}
          <Card className="p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <Upload className="h-5 w-5 text-primary" />
              <h2 className="font-display text-base font-semibold">Enviar planilha</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4 flex-1">
              A aba lida é <code>PRODUTOS_MÍNIMO</code> (ou a primeira aba disponível). Limite: 5 MB
              e 500 linhas.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild disabled={loading !== null} size="sm">
                <label className="cursor-pointer">
                  {loading === "parse" ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {file ? "Trocar planilha" : "Escolher e enviar planilha"}
                  <input
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleParseFile(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </Button>
              {file && (
                <span className="text-xs text-muted-foreground truncate max-w-[220px]">
                  {file.name}
                </span>
              )}
              {rows.length > 0 && (
                <Button onClick={handleCancel} variant="ghost" size="sm">
                  Cancelar
                </Button>
              )}
            </div>
          </Card>

          {/* Card 3 — Como usar */}
          <Card className="p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <PlayCircle className="h-5 w-5 text-amber-600" />
              <h2 className="font-display text-base font-semibold">Como usar</h2>
            </div>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal pl-4 flex-1">
              <li>Baixe o modelo oficial.</li>
              <li>Preencha os campos mínimos do produto.</li>
              <li>Salve a planilha em .xlsx.</li>
              <li>Envie a planilha nesta página.</li>
              <li>Aguarde a validação.</li>
              <li>Revise as sugestões da IA.</li>
              <li>Aprove apenas os produtos corretos.</li>
              <li>Execute a importação.</li>
            </ol>
          </Card>
        </div>

        {/* Destaque de segurança */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-800/40 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
          <p className="text-sm text-emerald-800 dark:text-emerald-200">
            <span className="font-semibold">Segurança:</span> A IA auxilia no preenchimento, mas não
            publica produtos automaticamente. Todo produto precisa de revisão e aprovação humana.
          </p>
        </div>


        {/* Resumo */}
        {rows.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SummaryCard label="Total" value={counts.total} />
            <SummaryCard label="Prontos" value={counts.ready} tone="ok" />
            <SummaryCard label="Aguarda revisão" value={counts.needsReview} tone="warn" />
            <SummaryCard label="Com erro" value={counts.invalid} tone="bad" />
            <SummaryCard label="Ignoradas" value={counts.ignored} tone="muted" />
          </div>
        )}

        {/* Ações */}
        {rows.length > 0 && (
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => handleValidate()} variant="outline" disabled={loading !== null}>
                {loading === "validate" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Validar
              </Button>
              <Button onClick={handleEnrich} variant="outline" disabled={loading !== null}>
                {loading === "enrich" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Completar com IA
              </Button>
              <Button onClick={handleDownload} variant="outline" disabled={loading !== null}>
                <Download className="h-4 w-4 mr-2" />
                Baixar revisada
              </Button>
              <Button onClick={handleSimulate} variant="secondary" disabled={loading !== null}>
                {loading === "sim" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4 mr-2" />
                )}
                Simular
              </Button>
              <Button onClick={handleCommit} disabled={!canImport || loading !== null}>
                {loading === "commit" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Importar aprovados
              </Button>
            </div>
            {!canImport && rows.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Execute a simulação e tenha pelo menos 1 produto pronto para liberar a importação.
              </p>
            )}
          </Card>
        )}

        {/* Resultado simulação */}
        {sim && !commitResult && (
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Simulação (nada foi gravado)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <SummaryCard label="Criar" value={sim.summary.toCreate} tone="ok" />
              <SummaryCard label="Atualizar" value={sim.summary.toUpdate} tone="warn" />
              <SummaryCard label="Ignorar" value={sim.summary.toSkip} tone="muted" />
              <SummaryCard label="Erros" value={sim.summary.errors} tone="bad" />
            </div>
          </Card>
        )}

        {/* Resultado commit */}
        {commitResult && (
          <Card className="p-4 border-emerald-500/40">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Importação concluída
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              ID: <code>{commitResult.summary.importId}</code>
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
              <SummaryCard label="Criados" value={commitResult.summary.created} tone="ok" />
              <SummaryCard label="Atualizados" value={commitResult.summary.updated} tone="warn" />
              <SummaryCard label="Ignorados" value={commitResult.summary.skipped} tone="muted" />
              <SummaryCard label="Erros" value={commitResult.summary.errors} tone="bad" />
            </div>
            <Button onClick={downloadCommitLog} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" /> Baixar log CSV
            </Button>
          </Card>
        )}

        {/* Tabela */}
        {rows.length > 0 && (
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead>Rev.</TableHead>
                    <TableHead>Aprov.</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.rowIndex}>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="font-mono text-xs">{r.sku || "—"}</TableCell>
                      <TableCell className="max-w-[260px] truncate">{r.nome_produto}</TableCell>
                      <TableCell>{r.categoria || "—"}</TableCell>
                      <TableCell className="text-right">
                        {r.preco_venda !== null
                          ? r.preco_venda.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.estoque_inicial ?? "—"}
                      </TableCell>
                      <TableCell>{r.ativo ? "Sim" : "Não"}</TableCell>
                      <TableCell>{r.revisado_humano ? "Sim" : "Não"}</TableCell>
                      <TableCell>{r.aprovado_importar ? "Sim" : "Não"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetailRow(r)}
                        >
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        {rows.length === 0 && !loading && (
          <Card className="p-8 text-center text-muted-foreground">
            <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Envie uma planilha para começar.</p>
          </Card>
        )}
      </div>

      {/* Modal de detalhes */}
      <Dialog open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailRow && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Linha {detailRow.rowIndex} · {detailRow.sku || "(sem SKU)"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                {detailRow.errors.length > 0 && (
                  <div className="rounded border border-destructive/30 bg-destructive/5 p-3">
                    <div className="flex items-center gap-2 font-semibold text-destructive mb-1">
                      <XCircle className="h-4 w-4" /> Erros
                    </div>
                    <ul className="list-disc pl-5 space-y-1">
                      {detailRow.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {detailRow.warnings.length > 0 && (
                  <div className="rounded border border-amber-400/40 bg-amber-50 dark:bg-amber-950/20 p-3">
                    <div className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-300 mb-1">
                      <AlertTriangle className="h-4 w-4" /> Avisos
                    </div>
                    <ul className="list-disc pl-5 space-y-1">
                      {detailRow.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <Section title="Dados originais">
                  <KV label="Ação" value={detailRow.action || "(criar)"} />
                  <KV label="Nome" value={detailRow.nome_produto} />
                  <KV label="Categoria" value={detailRow.categoria} />
                  <KV
                    label="Preço de custo"
                    value={
                      detailRow.preco_custo !== null
                        ? detailRow.preco_custo.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })
                        : "—"
                    }
                  />
                  <KV
                    label="Preço de venda"
                    value={
                      detailRow.preco_venda !== null
                        ? detailRow.preco_venda.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })
                        : "—"
                    }
                  />
                  <KV label="Estoque inicial" value={String(detailRow.estoque_inicial ?? "—")} />
                  <KV label="Ativo" value={detailRow.ativo ? "Sim" : "Não"} />
                  <KV label="Revisado humano" value={detailRow.revisado_humano ? "Sim" : "Não"} />
                  <KV
                    label="Aprovado importar"
                    value={detailRow.aprovado_importar ? "Sim" : "Não"}
                  />
                  {detailRow.observacoes_usuario && (
                    <KV label="Obs. usuário" value={detailRow.observacoes_usuario} />
                  )}
                </Section>
                <Section title="Sugestões da IA">
                  <KV label="Slug" value={detailRow.slug_sugerido || "—"} />
                  <KV
                    label="Confiança IA"
                    value={detailRow.nivel_confianca_ia || "—"}
                  />
                  <KV label="Título SEO" value={detailRow.titulo_seo || "—"} />
                  <KV label="Meta description" value={detailRow.meta_description || "—"} />
                  <KV label="Tags" value={detailRow.tags.join(", ") || "—"} />
                  <KV
                    label="Descrição curta"
                    value={detailRow.descricao_curta || "—"}
                    multi
                  />
                  <KV
                    label="Descrição longa"
                    value={detailRow.descricao_longa || "—"}
                    multi
                  />
                  {detailRow.observacoes_ia && (
                    <KV label="Obs. IA" value={detailRow.observacoes_ia} multi />
                  )}
                </Section>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function SummaryCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "bad" | "muted" | "neutral";
}) {
  const color =
    tone === "ok"
      ? "text-emerald-600"
      : tone === "warn"
        ? "text-amber-600"
        : tone === "bad"
          ? "text-destructive"
          : tone === "muted"
            ? "text-muted-foreground"
            : "text-foreground";
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="font-semibold text-sm mb-2">{title}</h4>
      <div className="rounded border bg-muted/30 divide-y">{children}</div>
    </div>
  );
}

function KV({ label, value, multi = false }: { label: string; value: string; multi?: boolean }) {
  return (
    <div className="px-3 py-2 grid grid-cols-3 gap-3 text-xs">
      <div className="text-muted-foreground">{label}</div>
      <div className={multi ? "col-span-2 whitespace-pre-wrap" : "col-span-2 truncate"}>
        {value}
      </div>
    </div>
  );
}
