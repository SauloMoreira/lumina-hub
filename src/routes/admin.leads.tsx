import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Eye, Trash2, Phone, Mail, LayoutGrid, List, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  LEAD_STATUS_OPTIONS,
  LEAD_STATUS_LABELS,
  leadStatusLabel,
  leadOriginLabel,
} from '@/lib/constants/leadStatus';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/admin/leads')({ component: LeadsPage });

const STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'] as const;
type Status = (typeof STATUSES)[number];

const STATUS_STYLES: Record<Status, string> = {
  new: 'bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400',
  contacted: 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400',
  qualified: 'bg-violet-500/15 text-violet-600 border-violet-500/30 dark:text-violet-400',
  proposal: 'bg-cyan-500/15 text-cyan-600 border-cyan-500/30 dark:text-cyan-400',
  won: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400',
  lost: 'bg-rose-500/15 text-rose-600 border-rose-500/30 dark:text-rose-400',
};

const StatusBadge = ({ status }: { status?: string | null }) => {
  const s = (status as Status) || 'new';
  return (
    <span
      className={cn(
        'inline-flex items-center text-xs px-2 py-0.5 rounded-md border font-medium',
        STATUS_STYLES[s] ?? 'bg-muted text-muted-foreground border-border'
      )}
    >
      {leadStatusLabel(s)}
    </span>
  );
};

function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [filterOrigin, setFilterOrigin] = useState('all');
  const [filterInterest, setFilterInterest] = useState('all');
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [edit, setEdit] = useState({ status: 'new', notes: '', estimated_value: '' });

  const load = async () => {
    let q = supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (filterStatus && filterStatus !== 'all') q = q.eq('status', filterStatus);
    const { data } = await q;
    setLeads((data as any) ?? []);
  };
  useEffect(() => { load(); }, [filterStatus]);

  // Distinct origin/interest values from current dataset
  const originOptions = Array.from(
    new Set(leads.map((l) => l.origin).filter(Boolean))
  ) as string[];
  const interestOptions = Array.from(
    new Set(leads.map((l) => l.interest).filter(Boolean))
  ) as string[];

  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const filteredLeads = leads.filter((l) => {
    if (filterOrigin !== 'all' && (l.origin ?? '') !== filterOrigin) return false;
    if (filterInterest !== 'all' && (l.interest ?? '') !== filterInterest) return false;
    if (search.trim()) {
      const q = norm(search.trim());
      const hay = norm(`${l.name ?? ''} ${l.company ?? ''}`);
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const hasActiveFilters =
    !!search.trim() || filterOrigin !== 'all' || filterInterest !== 'all' || !!filterStatus;

  const clearFilters = () => {
    setSearch('');
    setFilterOrigin('all');
    setFilterInterest('all');
    setFilterStatus('');
  };

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

  const updateStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from('leads').update({ status }).eq('id', id);
    if (error) return toast.error(error.message);
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
  };

  const onDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const onDrop = (e: React.DragEvent, status: Status) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.status === status) return;
    updateStatus(id, status);
  };

  const leadsByStatus = (s: Status) => leads.filter((l) => (l.status ?? 'new') === s);

  return (
    <AdminLayout title="Leads">
      <div className="bg-card border border-border rounded-xl">
        <div className="p-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <select
            value={filterStatus || 'all'}
            onChange={(e) => setFilterStatus(e.target.value === 'all' ? '' : e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {LEAD_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="inline-flex rounded-md border border-border bg-background p-0.5">
            <button
              onClick={() => setView('kanban')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 h-8 text-xs rounded-sm transition-colors',
                view === 'kanban' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Kanban
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 h-8 text-xs rounded-sm transition-colors',
                view === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <List className="w-3.5 h-3.5" /> Lista
            </button>
          </div>
        </div>

        {view === 'kanban' ? (
          <div className="p-4 overflow-x-auto">
            <div className="grid grid-flow-col auto-cols-[minmax(260px,1fr)] gap-3 min-w-full">
              {STATUSES.map((s) => {
                const items = leadsByStatus(s);
                return (
                  <div
                    key={s}
                    onDragOver={onDragOver}
                    onDrop={(e) => onDrop(e, s)}
                    className="bg-muted/30 border border-border rounded-lg flex flex-col min-h-[300px]"
                  >
                    <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={s} />
                      </div>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{items.length}</Badge>
                    </div>
                    <div className="p-2 space-y-2 flex-1">
                      {items.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-6">Nenhum lead</p>
                      )}
                      {items.map((l) => (
                        <div
                          key={l.id}
                          draggable
                          onDragStart={(e) => onDragStart(e, l.id)}
                          onClick={() => openDetail(l)}
                          className="bg-card border border-border rounded-md p-2.5 cursor-grab active:cursor-grabbing hover:border-primary/50 hover:shadow-sm transition-all"
                        >
                          <div className="font-medium text-sm truncate">{l.name}</div>
                          {l.company && (
                            <div className="text-xs text-muted-foreground truncate">{l.company}</div>
                          )}
                          <div className="mt-1.5 space-y-0.5">
                            {l.email && (
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Mail className="w-3 h-3 shrink-0" />
                                <span className="truncate">{l.email}</span>
                              </div>
                            )}
                            {l.phone && (
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Phone className="w-3 h-3 shrink-0" />
                                <span className="truncate">{l.phone}</span>
                              </div>
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-[10px] text-muted-foreground">
                              {leadOriginLabel(l.origin)}
                            </span>
                            {l.estimated_value && (
                              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                R$ {Number(l.estimated_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
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
                  <td className="px-4 py-3 text-xs">{leadOriginLabel(l.origin)}</td>
                  <td className="px-4 py-3 text-xs max-w-xs truncate">{l.interest ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                  <td className="px-4 py-3 text-xs">{new Date(l.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(l)}><Eye className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => del(l.id)}><Trash2 className="w-4 h-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
                <div><Label className="text-xs">Origem</Label><p>{leadOriginLabel(selected.origin)}</p></div>
              </div>
              {selected.interest && <div><Label className="text-xs">Interesse</Label><p className="text-muted-foreground">{selected.interest}</p></div>}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                <div><Label>Status</Label>
                  <select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                    {STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>)}
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
