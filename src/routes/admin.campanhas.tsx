import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const Route = createFileRoute('/admin/campanhas')({ component: CampanhasPage });

function CampanhasPage() {
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', type: 'email', status: 'draft', subject: '', content: '', scheduled_at: '' });

  const load = async () => {
    const { data } = await supabase.from('marketing_campaigns').select('*').order('created_at', { ascending: false });
    setList((data as any) ?? []);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ name: '', type: 'email', status: 'draft', subject: '', content: '', scheduled_at: '' }); setOpen(true); };
  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      name: c.name, type: c.type ?? 'email', status: c.status ?? 'draft',
      subject: c.subject ?? '', content: c.content ?? '',
      scheduled_at: c.scheduled_at ? c.scheduled_at.slice(0, 16) : '',
    });
    setOpen(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name, type: form.type, status: form.status,
      subject: form.subject || null, content: form.content || null,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
    };
    const res = editing ? await supabase.from('marketing_campaigns').update(payload).eq('id', editing.id) : await supabase.from('marketing_campaigns').insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success('Salvo'); setOpen(false); load();
  };

  const del = async (id: string) => {
    if (!confirm('Excluir campanha?')) return;
    const { error } = await supabase.from('marketing_campaigns').delete().eq('id', id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <AdminLayout title="Campanhas" action={<Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nova campanha</Button>}>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground bg-muted/40">
            <tr><th className="px-4 py-3 font-medium">Nome</th><th className="px-4 py-3 font-medium">Tipo</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Métricas</th><th className="px-4 py-3 font-medium">Agendada</th><th></th></tr>
          </thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhuma campanha.</td></tr>}
            {list.map((c) => (
              <tr key={c.id} className="border-t border-border hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-xs uppercase">{c.type ?? '—'}</td>
                <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded bg-muted">{c.status}</span></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">env {c.sent_count ?? 0} · ab {c.open_count ?? 0} · clk {c.click_count ?? 0}</td>
                <td className="px-4 py-3 text-xs">{c.scheduled_at ? new Date(c.scheduled_at).toLocaleString('pt-BR') : '—'}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => del(c.id)}><Trash2 className="w-4 h-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Editar campanha' : 'Nova campanha'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div><Label>Nome</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="email">E-mail</option>
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>
              <div><Label>Status</Label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="draft">Rascunho</option>
                  <option value="scheduled">Agendada</option>
                  <option value="sent">Enviada</option>
                  <option value="paused">Pausada</option>
                </select>
              </div>
            </div>
            <div><Label>Assunto</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
            <div><Label>Conteúdo</Label><Textarea rows={5} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
            <div><Label>Agendar para</Label><Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} /></div>
            <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
