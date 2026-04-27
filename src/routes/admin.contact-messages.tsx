import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Archive, CheckCircle2, Eye } from 'lucide-react';
import { toast } from 'sonner';

import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  adminListContactMessages,
  adminUpdateContactMessageStatus,
} from '@/server/institutional.functions';

export const Route = createFileRoute('/admin/contact-messages')({
  component: AdminContactMessages,
});

type Msg = {
  id: string; name: string; email: string; phone: string | null;
  subject: string | null; message: string; status: string; created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  new: 'Nova', read: 'Lida', answered: 'Respondida', archived: 'Arquivada',
};

function AdminContactMessages() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-contact-messages'],
    queryFn: () => adminListContactMessages({ data: undefined as never }),
  });
  const [selected, setSelected] = useState<Msg | null>(null);

  const setStatus = useMutation({
    mutationFn: (p: { id: string; status: 'new' | 'read' | 'answered' | 'archived' }) =>
      adminUpdateContactMessageStatus({ data: p }),
    onSuccess: () => { toast.success('Status atualizado'); qc.invalidateQueries({ queryKey: ['admin-contact-messages'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminLayout title="Mensagens de Contato">
      {isLoading ? <div className="text-muted-foreground">Carregando...</div> : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-3 font-medium">Data</th>
                <th className="p-3 font-medium">Nome</th>
                <th className="p-3 font-medium">E-mail</th>
                <th className="p-3 font-medium">Assunto</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(data?.messages as Msg[] | undefined)?.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="p-3 text-muted-foreground text-xs">{new Date(m.created_at).toLocaleString('pt-BR')}</td>
                  <td className="p-3 font-medium">{m.name}</td>
                  <td className="p-3 text-muted-foreground">{m.email}</td>
                  <td className="p-3 text-muted-foreground truncate max-w-[260px]">{m.subject || '—'}</td>
                  <td className="p-3"><Badge variant={m.status === 'new' ? 'default' : 'outline'}>{STATUS_LABEL[m.status] || m.status}</Badge></td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setSelected(m); if (m.status === 'new') setStatus.mutate({ id: m.id, status: 'read' }); }}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!data?.messages?.length && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhuma mensagem.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader><DialogTitle>{selected.subject || 'Mensagem de contato'}</DialogTitle></DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><div className="text-xs text-muted-foreground">Nome</div><div>{selected.name}</div></div>
                  <div><div className="text-xs text-muted-foreground">E-mail</div><div>{selected.email}</div></div>
                  {selected.phone && <div><div className="text-xs text-muted-foreground">Telefone</div><div>{selected.phone}</div></div>}
                  <div><div className="text-xs text-muted-foreground">Recebida</div><div>{new Date(selected.created_at).toLocaleString('pt-BR')}</div></div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Mensagem</div>
                  <div className="rounded-md border border-border p-3 whitespace-pre-wrap bg-muted/30">{selected.message}</div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button asChild size="sm">
                    <a href={`mailto:${selected.email}?subject=${encodeURIComponent('Re: ' + (selected.subject || 'Seu contato'))}`}>
                      <Mail className="w-4 h-4" /> Responder por e-mail
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: selected.id, status: 'answered' })}>
                    <CheckCircle2 className="w-4 h-4" /> Marcar como respondida
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setStatus.mutate({ id: selected.id, status: 'archived' }); setSelected(null); }}>
                    <Archive className="w-4 h-4" /> Arquivar
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
