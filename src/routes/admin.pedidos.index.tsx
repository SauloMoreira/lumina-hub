import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Eye } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { ORDER_STATUS_OPTIONS, orderStatusLabel } from "@/lib/orderStatus";

export const Route = createFileRoute("/admin/pedidos/")({ component: PedidosAdmin });

const STATUSES = ORDER_STATUS_OPTIONS;

function PedidosAdmin() {
  const [orders, setOrders] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const PAGE_SIZE = 20;

  const load = async () => {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE;
    let query = supabase
      .from("orders")
      .select(
        "id, order_number, status, payment_status, total, created_at, address_snapshot, delivery_method",
      )
      .order("created_at", { ascending: false })
      .range(from, to);
    if (filterStatus) query = query.eq("status", filterStatus);
    const { data } = await query;
    const rows = (data as any[]) ?? [];
    setHasMore(rows.length > PAGE_SIZE);
    setOrders(rows.slice(0, PAGE_SIZE));
  };
  useEffect(() => {
    load();
  }, [filterStatus, page]);

  const fmt = (n: number) =>
    Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const filtered = orders.filter((o) => {
    const txt = `${o.order_number} ${(o.address_snapshot as any)?.recipient ?? ""}`.toLowerCase();
    return txt.includes(q.toLowerCase());
  });

  return (
    <AdminLayout title="Pedidos">
      <div className="bg-card border border-border rounded-xl">
        <div className="p-4 border-b border-border flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nº ou cliente…"
              className="pl-9"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todos os status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {orderStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground bg-muted/40">
              <tr>
                <th className="px-4 py-3 font-medium">Nº</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Pgto</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum pedido.
                  </td>
                </tr>
              )}
              {filtered.map((o) => (
                <tr key={o.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs">#{o.order_number}</td>
                  <td className="px-4 py-3 text-xs">
                    {new Date(o.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    {(o.address_snapshot as any)?.recipient ?? "—"}
                    {o.delivery_method === "pickup" && (
                      <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] uppercase font-bold tracking-wide">
                        Retirada
                      </span>
                    )}
                    {o.delivery_method === "local_delivery" && (
                      <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[10px] uppercase font-bold tracking-wide">
                        Frete Local
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">{fmt(Number(o.total))}</td>
                  <td className="px-4 py-3">
                    <StatusBadge value={o.payment_status} kind="payment" />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={o.status} kind="order" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/admin/pedidos/$orderId" params={{ orderId: o.id }}>
                        <Eye className="w-4 h-4 mr-1" /> Detalhes
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-border text-sm">
          <span className="text-muted-foreground">Página {page}</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function StatusBadge({ value, kind }: { value: string; kind: "order" | "payment" }) {
  const colors: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    confirmed: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    preparing: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
    shipped: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
    delivered: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    approved: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    cancelled: "bg-red-500/10 text-red-700 dark:text-red-400",
    failed: "bg-red-500/10 text-red-700 dark:text-red-400",
    refunded: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[value] ?? "bg-muted text-muted-foreground"}`}
    >
      {orderStatusLabel(value)}
    </span>
  );
}
