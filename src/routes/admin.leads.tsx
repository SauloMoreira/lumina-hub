import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Eye, Trash2, Phone, Mail } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const Route = createFileRoute('/admin/leads')({ component: LeadsPage });

const STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'] as const;

function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [edit, setEdit] = useState({ status: 'new', notes: '', estimated_value: '' });

  const load = async () => {
    let q = supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (filterStatus) q = q.eq('status', filterStatus);
    const { data } = await q;
    setLeads((data as any) ?? []);
  };
  useEffect(() => { load(); }, [filterStatus]);

  const openDetail = (l: any) => {
    setSelected(l);
    setEdit({ status: l.status ?? 'new', notes: l.notes ?? '', estimated_value: l.estimated_value ? String(l.estimated_value) : '' });
    setOpen(true);
  };

  const save = async () => {
    if (!selected) return;
    const { error } = await supabase.from('leads').update({
      status: edit.status,
      notes: edit.notes || null,
      estimated_value: edit.estimated_value ? Number(edit.estimated_value) : null,
    }).eq('id', selected.id);
    if (error) return toast.error(error.message);
    toast.success('Lead atualizado'); setOpen(false); load();
  };

  const del = async (id: string) => {
    if (!confirm('Excluir lead?')) return;
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <AdminLayout title="Leads">
      <div className="bg-card border border-border rounded-xl">
        <div className="p-4 border-b border-border">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Todos os status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground bg-muted/40">
            <tr><th className="px-4 py-3 font-medium">Nome</th><th className="px-4 py-3 font-medium">Contato</th><th className="px-4 py-3 font-medium">Origem</th><th className="px-4 py-3 font-medium">Interesse</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Data</th><th></th></tr>
          </thead>
          <tbody>
            {leads.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum lead.</td></tr>}
            {leads.map((l) => (
              <tr key={l.id} className="border-t border-border hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{l.name}</td>
                <td className="px-4 py-3 text-xs space-y-0.5">
                  {l.email && <div className="flex items-center gap-1 text-muted-foreground"><Mail className="w-3 h-3" />{l.email}</div>}
                  {l.phone && <div className="flex items-center gap-1 text-muted-foreground"><Phone className="w-3 h-3" />{l.phone}</div>}
                </td>
                <td className="px-4 py-3 text-xs">{l.origin ?? '—'}</td>
                <td className="px-4 py-3 text-xs max-w-xs truncate">{l.interest ?? '—'}</td>
                <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded bg-muted">{l.status}</span></td>
                <td className="px-4 py-3 text-xs">{new Date(l.created_at).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(l)}><Eye className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => del(l.id)}><Trash2 className="w-4 h-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Lead: {selected?.name}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">E-mail</Label><p>{selected.email ?? '—'}</p></div>
                <div><Label className="text-xs">Telefone</Label><p>{selected.phone ?? '—'}</p></div>
                <div><Label className="text-xs">Empresa</Label><p>{selected.company ?? '—'}</p></div>
                <div><Label className="text-xs">Origem</Label><p>{selected.origin ?? '—'}</p></div>
              </div>
              {selected.interest && <div><Label className="text-xs">Interesse</Label><p className="text-muted-foreground">{selected.interest}</p></div>}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                <div><Label>Status</Label>
                  <select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><Label>Valor estimado (R$)</Label><input type="number" step="0.01" value={edit.estimated_value} onChange={(e) => setEdit({ ...edit, estimated_value: e.target.value })} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm" /></div>
              </div>
              <div><Label>Notas</Label><Textarea rows={3} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
