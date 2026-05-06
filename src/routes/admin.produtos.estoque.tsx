import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  AlertTriangle,
  Package,
  RefreshCw,
  Download,
  Search,
  TrendingUp,
  TimerOff,
  CircleSlash,
  CircleAlert,
  Settings,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getStockReport,
  exportStockCsv,
  getStockSettings,
  updateStockSettings,
  adjustProductStock,
  type StockReportRow,
  type StockSettings,
  type StockStatus,
} from "@/server/stockOps.functions";

export const Route = createFileRoute("/admin/produtos/estoque")({ component: StockPage });

type Filter =
  | "all"
  | "low"
  | "zero"
  | "inactive"
  | "high_movement"
  | "no_param"
  | "allow_oos"
  | "block_oos"
  | "healthy";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "low", label: "Estoque baixo" },
  { id: "zero", label: "Estoque zerado" },
  { id: "inactive", label: "Produto parado" },
  { id: "high_movement", label: "Alto giro" },
  { id: "healthy", label: "Saudável" },
  { id: "no_param", label: "Sem mínimo configurado" },
  { id: "allow_oos", label: "Permite venda sem estoque" },
  { id: "block_oos", label: "Não permite venda sem estoque" },
];

function statusBadge(status: StockStatus) {
  switch (status) {
    case "healthy":
      return { label: "Saudável", cls: "bg-emerald-100 text-emerald-700" };
    case "low":
      return { label: "Baixo", cls: "bg-amber-100 text-amber-800" };
    case "zero":
      return { label: "Zerado", cls: "bg-red-100 text-red-700" };
    case "inactive":
      return { label: "Parado", cls: "bg-slate-200 text-slate-700" };
    case "high_movement":
      return { label: "Alto giro", cls: "bg-blue-100 text-blue-700" };
    case "no_param":
      return { label: "Sem parâmetro", cls: "bg-muted text-muted-foreground" };
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function StockPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const reportQ = useQuery({
    queryKey: ["admin-stock-report"],
    queryFn: () => getStockReport(),
    staleTime: 30_000,
  });
  const settingsQ = useQuery({
    queryKey: ["admin-stock-settings"],
    queryFn: () => getStockSettings(),
    staleTime: 60_000,
  });

  const rows = reportQ.data?.rows ?? [];
  const settings = reportQ.data?.settings ?? settingsQ.data;

  const counters = useMemo(() => {
    let low = 0,
      zero = 0,
      inactive = 0,
      high = 0,
      noParam = 0,
      healthy = 0,
      highLow = 0;
    for (const r of rows) {
      if (r.status === "low") low++;
      if (r.status === "zero") zero++;
      if (r.status === "inactive") inactive++;
      if (r.status === "high_movement") high++;
      if (r.status === "healthy") healthy++;
      if (r.stock_min_alert === null) noParam++;
      if (
        r.status === "high_movement" &&
        settings &&
        r.stock_qty <= (r.stock_min_alert ?? settings.default_min_stock)
      )
        highLow++;
    }
    return { low, zero, inactive, high, noParam, healthy, highLow };
  }, [rows, settings]);

  const filtered = useMemo(() => {
    let arr = rows;
    switch (filter) {
      case "low":
        arr = arr.filter((r) => r.status === "low");
        break;
      case "zero":
        arr = arr.filter((r) => r.status === "zero");
        break;
      case "inactive":
        arr = arr.filter((r) => r.status === "inactive");
        break;
      case "high_movement":
        arr = arr.filter((r) => r.status === "high_movement");
        break;
      case "healthy":
        arr = arr.filter((r) => r.status === "healthy");
        break;
      case "no_param":
        arr = arr.filter((r) => r.stock_min_alert === null);
        break;
      case "allow_oos":
        arr = arr.filter((r) => r.allow_out_of_stock_sales);
        break;
      case "block_oos":
        arr = arr.filter((r) => !r.allow_out_of_stock_sales);
        break;
    }
    const term = q.trim().toLowerCase();
    if (term) {
      arr = arr.filter(
        (r) =>
          r.name.toLowerCase().includes(term) ||
          (r.sku ?? "").toLowerCase().includes(term) ||
          (r.category_name ?? "").toLowerCase().includes(term),
      );
    }
    // ordem útil: zerado e baixo primeiro
    const order: Record<StockStatus, number> = {
      zero: 0,
      low: 1,
      high_movement: 2,
      inactive: 3,
      no_param: 4,
      healthy: 5,
    };
    return arr
      .slice()
      .sort((a, b) => order[a.status] - order[b.status] || b.qty_sold_window - a.qty_sold_window);
  }, [rows, filter, q]);

  const handleExport = async () => {
    try {
      const res = await exportStockCsv();
      const blob = new Blob([res.content], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao exportar CSV.");
    }
  };

  const refresh = async () => {
    qc.invalidateQueries({ queryKey: ["admin-operations"] });
    await reportQ.refetch();
    toast.success("Relatório de estoque atualizado.");
  };

  return (
    <AdminLayout
      title="Estoque"
      action={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={reportQ.isFetching}>
            <RefreshCw className={`w-4 h-4 mr-1 ${reportQ.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" /> Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSettings((v) => !v)}>
            <Settings className="w-4 h-4 mr-1" /> Configurações
          </Button>
          <Link to={"/admin/produtos" as any}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" /> Produtos
            </Button>
          </Link>
        </div>
      }
    >
      {/* Cards principais */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <Card icon={CircleAlert} title="Estoque baixo" qty={counters.low} tone="warn" />
        <Card icon={CircleSlash} title="Estoque zerado" qty={counters.zero} tone="danger" />
        <Card icon={TimerOff} title="Produtos parados" qty={counters.inactive} tone="muted" />
        <Card icon={TrendingUp} title="Alto giro" qty={counters.high} tone="info" />
        <Card icon={AlertTriangle} title="Sem mínimo" qty={counters.noParam} tone="muted" />
        <Card icon={Package} title="Saudáveis" qty={counters.healthy} tone="ok" />
      </div>

      {counters.highLow > 0 && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5" />
          <div>
            <strong>{counters.highLow}</strong> produto(s) com boa saída e estoque baixo. Avalie
            priorizar a reposição manual desses itens.
          </div>
        </div>
      )}

      {showSettings && settings && (
        <SettingsPanel
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["admin-stock-settings"] });
            qc.invalidateQueries({ queryKey: ["admin-stock-report"] });
            qc.invalidateQueries({ queryKey: ["admin-operations"] });
          }}
        />
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-3">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filter === f.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, SKU ou categoria…"
          className="pl-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* Tabela */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Produto</th>
                <th className="text-left px-3 py-2">SKU</th>
                <th className="text-left px-3 py-2">Categoria</th>
                <th className="text-right px-3 py-2">Estoque</th>
                <th className="text-right px-3 py-2">Mín.</th>
                <th className="text-right px-3 py-2">
                  Vendidos {settings?.sales_window_days ?? 30}d
                </th>
                <th className="text-left px-3 py-2">Última venda</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Sem estoque</th>
                <th className="text-right px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {reportQ.isLoading ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-muted-foreground">
                    Nenhum produto encontrado para esse filtro.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <Row key={r.product_id} row={r} onAdjusted={() => reportQ.refetch()} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        Esta fase é apenas para visibilidade. Não bloqueia venda, não dispara compra e não envia
        pedido para fornecedor.
      </p>
    </AdminLayout>
  );
}

function Card({
  icon: Icon,
  title,
  qty,
  tone,
}: {
  icon: typeof Package;
  title: string;
  qty: number;
  tone: "ok" | "warn" | "danger" | "info" | "muted";
}) {
  const tones: Record<typeof tone, string> = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-800",
    info: "border-blue-200 bg-blue-50 text-blue-800",
    muted: "border-border bg-card text-foreground",
  } as const;
  return (
    <div className={`rounded-lg border p-3 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-medium opacity-80">
        <Icon className="w-4 h-4" /> {title}
      </div>
      <div className="text-2xl font-semibold mt-1">{qty}</div>
    </div>
  );
}

function Row({ row, onAdjusted }: { row: StockReportRow; onAdjusted: () => void }) {
  const badge = statusBadge(row.status);
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(String(row.stock_qty));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const n = Number(val);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Informe uma quantidade válida.");
      return;
    }
    setSaving(true);
    try {
      await adjustProductStock({ data: { product_id: row.product_id, new_stock_qty: n } });
      toast.success("Estoque ajustado.");
      setOpen(false);
      onAdjusted();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao ajustar estoque.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <tr className="border-t border-border hover:bg-muted/30">
        <td className="px-3 py-2 max-w-[260px] truncate" title={row.name}>
          {row.name}
        </td>
        <td className="px-3 py-2 text-muted-foreground">{row.sku ?? "—"}</td>
        <td className="px-3 py-2 text-muted-foreground">{row.category_name ?? "—"}</td>
        <td className="px-3 py-2 text-right font-medium">{row.stock_qty}</td>
        <td className="px-3 py-2 text-right text-muted-foreground">{row.stock_min_alert ?? "—"}</td>
        <td className="px-3 py-2 text-right">{row.qty_sold_window}</td>
        <td className="px-3 py-2 text-muted-foreground">
          {fmtDate(row.last_sold_at)}
          {row.days_since_last_sale !== null && row.last_sold_at && (
            <span className="text-xs ml-1 opacity-70">({row.days_since_last_sale}d)</span>
          )}
        </td>
        <td className="px-3 py-2">
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.cls}`}>
            {badge.label}
          </span>
        </td>
        <td className="px-3 py-2 text-xs">
          {row.allow_out_of_stock_sales ? (
            <span className="text-amber-700">Permitido</span>
          ) : (
            <span className="text-muted-foreground">Bloqueado</span>
          )}
        </td>
        <td className="px-3 py-2 text-right whitespace-nowrap">
          <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
            Ajustar
          </Button>
          <Link to={"/admin/produtos/$id" as any} params={{ id: row.product_id } as any}>
            <Button size="sm" variant="ghost">
              Editar
            </Button>
          </Link>
        </td>
      </tr>
      {open && (
        <tr className="bg-muted/20 border-t border-border">
          <td colSpan={10} className="px-3 py-3">
            <div className="flex items-end gap-2 flex-wrap">
              <div>
                <label className="text-xs text-muted-foreground">Novo estoque</label>
                <Input
                  type="number"
                  min={0}
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                  className="w-32"
                />
              </div>
              <Button size="sm" onClick={submit} disabled={saving}>
                Salvar ajuste
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <span className="text-xs text-muted-foreground ml-2">
                Estoque atual: {row.stock_qty}. O ajuste é registrado no log administrativo.
              </span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function SettingsPanel({
  settings,
  onClose,
  onSaved,
}: {
  settings: StockSettings;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    default_min_stock: settings.default_min_stock,
    inactive_days_threshold: settings.inactive_days_threshold,
    sales_window_days: settings.sales_window_days,
    high_movement_min_qty: settings.high_movement_min_qty,
    alert_low_stock_enabled: settings.alert_low_stock_enabled,
    alert_out_of_stock_enabled: settings.alert_out_of_stock_enabled,
    alert_inactive_product_enabled: settings.alert_inactive_product_enabled,
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await updateStockSettings({ data: form });
      toast.success("Configurações de estoque salvas.");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium">Configurações de estoque</h3>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <NumField
          label="Estoque mínimo padrão"
          help="Usado quando o produto não tem mínimo configurado."
          value={form.default_min_stock}
          onChange={(v) => setForm({ ...form, default_min_stock: v })}
        />
        <NumField
          label="Dias para considerar parado"
          help="Sem venda neste período → produto parado."
          value={form.inactive_days_threshold}
          onChange={(v) => setForm({ ...form, inactive_days_threshold: v })}
        />
        <NumField
          label="Janela de saída (dias)"
          help="Período usado para calcular quantidade vendida."
          value={form.sales_window_days}
          onChange={(v) => setForm({ ...form, sales_window_days: v })}
        />
        <NumField
          label="Mínimo para alto giro (un.)"
          help="Vendas no período ≥ valor → produto considerado de alto giro."
          value={form.high_movement_min_qty}
          onChange={(v) => setForm({ ...form, high_movement_min_qty: v })}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <ToggleField
          label="Alerta de estoque baixo"
          checked={form.alert_low_stock_enabled}
          onChange={(v) => setForm({ ...form, alert_low_stock_enabled: v })}
        />
        <ToggleField
          label="Alerta de estoque zerado"
          checked={form.alert_out_of_stock_enabled}
          onChange={(v) => setForm({ ...form, alert_out_of_stock_enabled: v })}
        />
        <ToggleField
          label="Alerta de produto parado"
          checked={form.alert_inactive_product_enabled}
          onChange={(v) => setForm({ ...form, alert_inactive_product_enabled: v })}
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancelar
        </Button>
        <Button size="sm" onClick={submit} disabled={saving}>
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

function NumField({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Input
        type="number"
        min={0}
        value={String(value)}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      />
      {help && <p className="text-[11px] text-muted-foreground mt-1">{help}</p>}
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm border border-border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/30">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded"
      />
      {label}
    </label>
  );
}
