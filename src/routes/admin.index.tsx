import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { DollarSign, ShoppingBag, Users, AlertTriangle, TrendingUp, Package } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Link } from '@tanstack/react-router';
import { orderStatusLabel } from '@/lib/orderStatus';

export const Route = createFileRoute('/admin/')({ component: AdminDashboard });

interface KPIs {
  monthRevenue: number;
  monthOrders: number;
  avgTicket: number;
  pendingOrders: number;
  newLeads: number;
  lowStock: number;
}

function AdminDashboard() {
  const [k, setK] = useState<KPIs | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [chart, setChart] = useState<{ day: string; total: number }[]>([]);

  useEffect(() => {
    (async () => {
      const startMonth = new Date();
      startMonth.setDate(1);
      startMonth.setHours(0, 0, 0, 0);

      const [orders, leads, lowStock, recentOrders] = await Promise.all([
        supabase.from('orders').select('total, status, payment_status, created_at').gte('created_at', startMonth.toISOString()),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('products').select('id', { count: 'exact', head: true }).lt('stock_qty', 10).eq('active', true),
        supabase.from('orders').select('id, order_number, total, status, payment_status, created_at, address_snapshot').order('created_at', { ascending: false }).limit(8),
      ]);

      const paid = (orders.data ?? []).filter((o) => o.payment_status === 'paid');
      const monthRevenue = paid.reduce((s, o) => s + Number(o.total), 0);
      const monthOrders = (orders.data ?? []).length;
      const avgTicket = paid.length ? monthRevenue / paid.length : 0;
      const pendingOrders = (orders.data ?? []).filter((o) => o.status === 'pending').length;

      // chart por dia (últimos 14 dias)
      const days: Record<string, number> = {};
      const now = new Date();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        days[d.toISOString().slice(0, 10)] = 0;
      }
      paid.forEach((o) => {
        const day = String(o.created_at).slice(0, 10);
        if (day in days) days[day] += Number(o.total);
      });
      setChart(Object.entries(days).map(([day, total]) => ({ day, total })));

      setK({
        monthRevenue,
        monthOrders,
        avgTicket,
        pendingOrders,
        newLeads: leads.count ?? 0,
        lowStock: lowStock.count ?? 0,
      });
      setRecent(recentOrders.data ?? []);
    })();
  }, []);

  const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const maxBar = Math.max(...chart.map((c) => c.total), 1);

  return (
    <AdminLayout title="Dashboard">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <KpiCard icon={DollarSign} label="Receita do mês" value={k ? fmt(k.monthRevenue) : '—'} accent />
        <KpiCard icon={ShoppingBag} label="Pedidos do mês" value={k ? String(k.monthOrders) : '—'} />
        <KpiCard icon={TrendingUp} label="Ticket médio" value={k ? fmt(k.avgTicket) : '—'} />
        <KpiCard icon={Package} label="Pedidos pendentes" value={k ? String(k.pendingOrders) : '—'} />
        <KpiCard icon={Users} label="Leads novos" value={k ? String(k.newLeads) : '—'} />
        <KpiCard icon={AlertTriangle} label="Estoque baixo" value={k ? String(k.lowStock) : '—'} warn={!!k && k.lowStock > 0} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <h2 className="font-display font-semibold mb-4">Receita (últimos 14 dias)</h2>
          <div className="flex items-end gap-1 h-48">
            {chart.map((c) => (
              <div key={c.day} className="flex-1 flex flex-col items-center gap-1" title={`${c.day}: ${fmt(c.total)}`}>
                <div className="w-full bg-primary/20 hover:bg-primary/40 rounded-t transition-colors" style={{ height: `${(c.total / maxBar) * 100}%`, minHeight: c.total > 0 ? '4px' : '1px' }} />
                <span className="text-[10px] text-muted-foreground">{c.day.slice(8)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-display font-semibold mb-4">Pedidos recentes</h2>
          <div className="space-y-2">
            {recent.length === 0 && <p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p>}
            {recent.map((o) => (
              <Link key={o.id} to={'/admin/pedidos' as any} className="flex items-center justify-between gap-2 p-2 rounded hover:bg-muted text-sm">
                <span className="font-mono text-xs">#{o.order_number}</span>
                <span className="text-muted-foreground truncate flex-1 px-1">{(o.address_snapshot as any)?.recipient ?? '—'}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground whitespace-nowrap">{orderStatusLabel(o.status)}</span>
                <span className="font-medium whitespace-nowrap">{fmt(Number(o.total))}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function KpiCard({ icon: Icon, label, value, accent, warn }: { icon: any; label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className={`bg-card border rounded-xl p-4 ${warn ? 'border-destructive/40' : 'border-border'}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon className={`w-3.5 h-3.5 ${warn ? 'text-destructive' : ''}`} /> {label}
      </div>
      <p className={`font-display font-bold text-xl tracking-tight ${accent ? 'text-primary' : warn ? 'text-destructive' : ''}`}>{value}</p>
    </div>
  );
}
