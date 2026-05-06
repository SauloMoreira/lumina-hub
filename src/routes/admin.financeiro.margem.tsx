import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Receipt, Save } from "lucide-react";
import { buildSeo } from "@/lib/seo";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getFinanceMargin,
  updateProductCost,
  type FinanceMarginRow,
} from "@/server/finance.functions";

export const Route = createFileRoute("/admin/financeiro/margem")({
  head: () =>
    buildSeo({ title: "Margem de lucro", url: "/admin/financeiro/margem", noindex: true }),
  component: MarginPage,
});

type StatusFilter = "all" | "good" | "attention" | "critical" | "no_cost";

function brl(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusBadge(s: FinanceMarginRow["status"]) {
  const map: Record<string, { label: string; className: string }> = {
    good: { label: "Boa", className: "bg-green-100 text-green-800" },
    attention: { label: "Atenção", className: "bg-amber-100 text-amber-800" },
    critical: { label: "Crítica", className: "bg-red-100 text-red-800" },
    no_cost: { label: "Sem custo", className: "bg-muted text-muted-foreground" },
    na: { label: "—", className: "bg-muted text-muted-foreground" },
  };
  const c = map[s] ?? map.na;
  return <span className={`text-xs px-2 py-0.5 rounded-full ${c.className}`}>{c.label}</span>;
}

function MarginPage() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<FinanceMarginRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editCost, setEditCost] = useState("");
  const [editMin, setEditMin] = useState("");

  function load() {
    setLoading(true);
    getFinanceMargin({ data: { status, search, page: 1, pageSize: 100 } })
      .then((r) => setRows(r.rows))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search]);

  function startEdit(r: FinanceMarginRow) {
    setEditing(r.id);
    setEditCost(r.cost_price != null ? String(r.cost_price) : "");
    setEditMin(r.min_margin_percent != null ? String(r.min_margin_percent) : "");
  }

  async function saveEdit(id: string) {
    try {
      await updateProductCost({
        data: {
          productId: id,
          cost_price: editCost === "" ? null : Number(editCost),
          min_margin_percent: editMin === "" ? null : Number(editMin),
        },
      });
      toast.success("Atualizado.");
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    }
  }

  const filters: Array<{ id: StatusFilter; label: string }> = [
    { id: "all", label: "Todos" },
    { id: "good", label: "Margem boa" },
    { id: "attention", label: "Atenção" },
    { id: "critical", label: "Crítica" },
    { id: "no_cost", label: "Sem custo" },
  ];

  return (
    <AdminLayout title="Margem de lucro">
      <div className="max-w-7xl mx-auto">
        <Link
          to={"/admin" as never}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao painel
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <Receipt className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-display font-bold">Margem de lucro por produto</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {filters.map((f) => (
            <Button
              key={f.id}
              size="sm"
              variant={status === f.id ? "default" : "outline"}
              onClick={() => setStatus(f.id)}
            >
              {f.label}
            </Button>
          ))}
          <div className="ml-auto w-full sm:w-72">
            <Input
              placeholder="Buscar produto ou SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Carregando…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground border border-dashed border-border rounded-xl">
            Nenhum produto encontrado para esse filtro.
          </div>
        ) : (
          <div className="overflow-x-auto bg-card border border-border rounded-xl">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground bg-muted/40">
                <tr>
                  <th className="text-left p-3">Produto</th>
                  <th className="text-right p-3">Venda</th>
                  <th className="text-right p-3">B2B</th>
                  <th className="text-right p-3">Custo</th>
                  <th className="text-right p-3">Margem</th>
                  <th className="text-right p-3">Mín. %</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-right p-3">Vendidos</th>
                  <th className="text-right p-3">Lucro</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const sellPrice = r.sale_price ?? r.price;
                  const isEditing = editing === r.id;
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-3">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.sku ?? "—"} · {r.category_name ?? "sem categoria"}
                        </div>
                      </td>
                      <td className="p-3 text-right">{brl(sellPrice)}</td>
                      <td className="p-3 text-right">
                        {r.b2b_price != null ? (
                          <div>
                            <div>{brl(r.b2b_price)}</div>
                            {r.b2b_status !== "na" && (
                              <div className="mt-0.5">
                                {statusBadge(r.b2b_status as FinanceMarginRow["status"])}
                              </div>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {isEditing ? (
                          <Input
                            className="h-8 w-24 text-right"
                            type="number"
                            step="0.01"
                            value={editCost}
                            onChange={(e) => setEditCost(e.target.value)}
                          />
                        ) : (
                          brl(r.cost_price)
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {r.margin_amount != null ? (
                          <div>
                            <div>{brl(r.margin_amount)}</div>
                            <div className="text-xs text-muted-foreground">
                              {r.margin_percent?.toFixed(1)}%
                            </div>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {isEditing ? (
                          <Input
                            className="h-8 w-20 text-right"
                            type="number"
                            step="0.1"
                            placeholder={String(r.effective_min_margin_percent)}
                            value={editMin}
                            onChange={(e) => setEditMin(e.target.value)}
                          />
                        ) : (
                          <span
                            title={
                              r.min_margin_percent == null
                                ? "Usando padrão da loja"
                                : "Definida no produto"
                            }
                          >
                            {r.min_margin_percent != null
                              ? `${r.min_margin_percent}%`
                              : `${r.effective_min_margin_percent}% (padrão)`}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">{statusBadge(r.status)}</td>
                      <td className="p-3 text-right">{r.qty_sold}</td>
                      <td className="p-3 text-right">{brl(r.gross_profit)}</td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                              Cancelar
                            </Button>
                            <Button size="sm" onClick={() => saveEdit(r.id)}>
                              <Save className="w-3 h-3 mr-1" />
                              Salvar
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => startEdit(r)}>
                            Editar custo
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
