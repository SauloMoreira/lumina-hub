import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Search, Eye } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ORDER_STATUS_OPTIONS, PAYMENT_STATUS_OPTIONS, orderStatusLabel } from '@/lib/orderStatus';

export const Route = createFileRoute('/admin/pedidos')({ component: PedidosAdmin });

const STATUSES = ORDER_STATUS_OPTIONS;
const PAYMENT_STATUSES = PAYMENT_STATUS_OPTIONS;

function PedidosAdmin() {
  const [orders, setOrders] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [edit, setEdit] = useState({ status: '', payment_status: '', tracking_code: '', shipping_carrier: '', admin_notes: '' });

  const PAGE_SIZE = 20;

  const load = async () => {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE; // pega 1 extra para detectar próxima página
    let query = supabase
      .from('orders')
      .select('id, order_number, status, payment_status, total, created_at, address_snapshot')
      .order('created_at', { ascending: false })
      .range(from, to);
    if (filterStatus) query = query.eq('status', filterStatus);
    const { data } = await query;
    const rows = (data as any[]) ?? [];
    setHasMore(rows.length > PAGE_SIZE);
    setOrders(rows.slice(0, PAGE_SIZE));
  };
  useEffect(() => { load(); }, [filterStatus, page]);

  const openDetail = async (o: any) => {
    setSelected(o);
    setEdit({ status: o.status, payment_status: o.payment_status ?? 'pending', tracking_code: o.tracking_code ?? '', shipping_carrier: o.shipping_carrier ?? '', admin_notes: o.admin_notes ?? '' });
    const { data } = await supabase.from('order_items').select('*').eq('order_id', o.id);
    setItems((data as any) ?? []);
    setOpen(true);
  };

  const save = async () => {
    if (!selected) return;
    const { error } = await supabase.from('orders').update(edit).eq('id', selected.id);
    if (error) return toast.error(error.message);
    toast.success('Pedido atualizado'); setOpen(false); load();
  };

  const fmt = (n: number) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const filtered = orders.filter((o) => {
    const txt = `${o.order_number} ${(o.address_snapshot as any)?.recipient ?? ''}`.toLowerCase();
    return txt.includes(q.toLowerCase());
  });

  return (
    <AdminLayout title="Pedidos">
      <div className="bg-card border border-border rounded-xl">
        <div className="p-4 border-b border-border flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nº ou cliente…" className="pl-9" />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Todos os status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{orderStatusLabel(s)}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground bg-muted/40">
              <tr><th className="px-4 py-3 font-medium">Nº</th><th className="px-4 py-3 font-medium">Data</th><th className="px-4 py-3 font-medium">Cliente</th><th className="px-4 py-3 font-medium">Total</th><th className="px-4 py-3 font-medium">Pgto</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum pedido.</td></tr>}
              {filtered.map((o) => (
                <tr key={o.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs">#{o.order_number}</td>
                  <td className="px-4 py-3 text-xs">{new Date(o.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3">{(o.address_snapshot as any)?.recipient ?? '—'}</td>
                  <td className="px-4 py-3 font-medium">{fmt(Number(o.total))}</td>
                  <td className="px-4 py-3"><Badge value={o.payment_status} kind="payment" /></td>
                  <td className="px-4 py-3"><Badge value={o.status} kind="order" /></td>
                  <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={() => openDetail(o)}><Eye className="w-4 h-4 mr-1" /> Detalhes</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-border text-sm">
          <span className="text-muted-foreground">Página {page}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Pedido #{selected?.order_number}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><Label>Status do pedido</Label>
                  <select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                    {STATUSES.map((s) => <option key={s} value={s}>{orderStatusLabel(s)}</option>)}
                  </select>
                </div>
                <div><Label>Status do pagamento</Label>
                  <select value={edit.payment_status} onChange={(e) => setEdit({ ...edit, payment_status: e.target.value })} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                    {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{orderStatusLabel(s)}</option>)}
                  </select>
                </div>
                <div><Label>Transportadora</Label><Input value={edit.shipping_carrier} onChange={(e) => setEdit({ ...edit, shipping_carrier: e.target.value })} /></div>
                <div><Label>Código de rastreio</Label><Input value={edit.tracking_code} onChange={(e) => setEdit({ ...edit, tracking_code: e.target.value })} /></div>
              </div>

              <div><Label>Notas internas</Label><Textarea rows={2} value={edit.admin_notes} onChange={(e) => setEdit({ ...edit, admin_notes: e.target.value })} /></div>

              <div className="bg-muted/30 rounded-lg p-3 text-sm">
                <p className="font-semibold mb-1">Endereço</p>
                {selected.address_snapshot ? (
                  <p className="text-muted-foreground text-xs">
                    {selected.address_snapshot.recipient} — {selected.address_snapshot.street}, {selected.address_snapshot.number} {selected.address_snapshot.complement && `(${selected.address_snapshot.complement})`} — {selected.address_snapshot.neighborhood}, {selected.address_snapshot.city}/{selected.address_snapshot.state} — CEP {selected.address_snapshot.zip_code}
                  </p>
                ) : <p className="text-muted-foreground">—</p>}
              </div>

              <div>
                <p className="font-semibold mb-2 text-sm">Itens</p>
                <div className="space-y-1">
                  {items.map((it) => (
                    <div key={it.id} className="flex justify-between text-sm border-b border-border py-1.5">
                      <span>{it.qty}× {it.product_name}</span>
                      <span className="font-medium">{fmt(Number(it.total_price))}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(Number(selected.subtotal))}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Frete</span><span>{fmt(Number(selected.shipping_cost))}</span></div>
                  {Number(selected.discount) > 0 && <div className="flex justify-between text-emerald-600"><span>Desconto</span><span>-{fmt(Number(selected.discount))}</span></div>}
                  <div className="flex justify-between font-bold text-base pt-1 border-t border-border"><span>Total</span><span>{fmt(Number(selected.total))}</span></div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={save}>Salvar alterações</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function Badge({ value, kind }: { value: string; kind: 'order' | 'payment' }) {
  const colors: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    confirmed: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    preparing: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
    shipped: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
    delivered: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    paid: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    cancelled: 'bg-red-500/10 text-red-700 dark:text-red-400',
    failed: 'bg-red-500/10 text-red-700 dark:text-red-400',
    refunded: 'bg-muted text-muted-foreground',
  };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[value] ?? 'bg-muted text-muted-foreground'}`}>{orderStatusLabel(value)}</span>;
}
