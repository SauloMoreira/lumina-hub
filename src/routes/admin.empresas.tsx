import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Building2, Search, CheckCircle2, ShieldX, XCircle, Clock } from 'lucide-react';
import { buildSeo } from '@/lib/seo';
import { formatCNPJ } from '@/lib/cnpj';
import {
  adminListCompanies,
  adminUpdateCompanyStatus,
} from '@/server/companies.functions';

type Company = {
  id: string;
  cnpj: string;
  legal_name: string;
  trade_name: string | null;
  status: 'pending' | 'approved' | 'blocked' | 'rejected';
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  created_at: string;
  rejection_reason: string | null;
  admin_notes: string | null;
};

type StatusFilter = '' | 'pending' | 'approved' | 'blocked' | 'rejected';

export const Route = createFileRoute('/admin/empresas')({
  head: () => buildSeo({ title: 'Empresas B2B', url: '/admin/empresas', noindex: true }),
  component: AdminEmpresasPage,
});

function AdminEmpresasPage() {
  const [items, setItems] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Company | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { companies } = await adminListCompanies({
        data: { status: (filter || undefined) as StatusFilter | undefined, search },
      });
      setItems(companies as Company[]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const updateStatus = async (
    company_id: string,
    status: 'approved' | 'rejected' | 'blocked' | 'pending',
    extras?: { rejection_reason?: string; admin_notes?: string },
  ) => {
    try {
      await adminUpdateCompanyStatus({ data: { company_id, status, ...extras } });
      toast.success('Status atualizado');
      setSelected(null);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar';
      toast.error(msg);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-display font-bold text-foreground">Empresas B2B</h1>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(['pending', 'approved', 'blocked', 'rejected', ''] as StatusFilter[]).map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setFilter(s)}
            className={`px-3 h-9 rounded-md text-sm border transition ${
              filter === s
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-foreground border-border hover:bg-muted'
            }`}
          >
            {labelStatus(s) || 'Todas'}
          </button>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
          className="flex-1 min-w-[200px] flex items-center gap-2 ml-auto"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por razão social ou CNPJ"
              className="w-full h-9 pl-9 pr-3 rounded-md border border-border bg-background text-sm"
            />
          </div>
          <button className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium">
            Buscar
          </button>
        </form>
      </div>

      {/* Tabela */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/40">
          <div className="col-span-4">Empresa</div>
          <div className="col-span-3">CNPJ</div>
          <div className="col-span-3">Responsável</div>
          <div className="col-span-2 text-right">Status</div>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Nenhuma empresa encontrada.</div>
        ) : (
          items.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className="w-full grid grid-cols-12 gap-3 px-4 py-3 text-left text-sm border-b border-border last:border-0 hover:bg-muted/40 transition"
            >
              <div className="col-span-4">
                <div className="font-medium text-foreground">
                  {c.trade_name || c.legal_name}
                </div>
                {c.trade_name && (
                  <div className="text-xs text-muted-foreground">{c.legal_name}</div>
                )}
              </div>
              <div className="col-span-3 text-foreground/80">{formatCNPJ(c.cnpj)}</div>
              <div className="col-span-3 text-foreground/80">
                <div>{c.contact_name}</div>
                <div className="text-xs text-muted-foreground">{c.contact_email}</div>
              </div>
              <div className="col-span-2 text-right">
                <StatusBadge status={c.status} />
              </div>
            </button>
          ))
        )}
      </div>

      {/* Drawer simples */}
      {selected && (
        <Drawer
          company={selected}
          onClose={() => setSelected(null)}
          onApprove={() => updateStatus(selected.id, 'approved')}
          onReject={(reason) =>
            updateStatus(selected.id, 'rejected', { rejection_reason: reason })
          }
          onBlock={() => updateStatus(selected.id, 'blocked')}
          onReactivate={() => updateStatus(selected.id, 'approved')}
          onResetPending={() => updateStatus(selected.id, 'pending')}
        />
      )}
    </div>
  );
}

function labelStatus(s: string) {
  return (
    {
      pending: 'Pendentes',
      approved: 'Aprovadas',
      blocked: 'Bloqueadas',
      rejected: 'Recusadas',
    }[s] ?? ''
  );
}

function StatusBadge({ status }: { status: Company['status'] }) {
  const map = {
    pending: { Icon: Clock, cls: 'bg-warning/15 text-warning', label: 'Pendente' },
    approved: { Icon: CheckCircle2, cls: 'bg-success/15 text-success', label: 'Aprovada' },
    blocked: { Icon: ShieldX, cls: 'bg-destructive/15 text-destructive', label: 'Bloqueada' },
    rejected: { Icon: XCircle, cls: 'bg-destructive/15 text-destructive', label: 'Recusada' },
  } as const;
  const info = map[status];
  const Icon = info.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold ${info.cls}`}
    >
      <Icon className="w-3 h-3" /> {info.label}
    </span>
  );
}

function Drawer({
  company,
  onClose,
  onApprove,
  onReject,
  onBlock,
  onReactivate,
  onResetPending,
}: {
  company: Company;
  onClose: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onBlock: () => void;
  onReactivate: () => void;
  onResetPending: () => void;
}) {
  const [reason, setReason] = useState(company.rejection_reason ?? '');
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-lg bg-background border-l border-border h-full overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">{company.trade_name || company.legal_name}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        <div className="space-y-2 text-sm">
          <Info label="Razão social" value={company.legal_name} />
          <Info label="CNPJ" value={formatCNPJ(company.cnpj)} />
          <Info label="Responsável" value={company.contact_name} />
          <Info label="E-mail" value={company.contact_email} />
          <Info label="Telefone" value={company.contact_phone} />
          <Info label="Status atual" value={<StatusBadge status={company.status} />} />
        </div>

        {(company.status === 'rejected' || company.status === 'pending') && (
          <div className="mt-6">
            <label className="text-xs font-medium text-foreground">Motivo (caso recuse)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
            />
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-2">
          {company.status !== 'approved' && (
            <button
              onClick={company.status === 'blocked' ? onReactivate : onApprove}
              className="h-10 rounded-md bg-success text-success-foreground font-semibold"
            >
              {company.status === 'blocked' ? 'Reativar' : 'Aprovar'}
            </button>
          )}
          {company.status !== 'rejected' && company.status !== 'blocked' && (
            <button
              onClick={() => {
                if (!reason.trim()) {
                  toast.error('Informe o motivo da recusa');
                  return;
                }
                onReject(reason);
              }}
              className="h-10 rounded-md bg-destructive text-destructive-foreground font-semibold"
            >
              Recusar
            </button>
          )}
          {company.status === 'approved' && (
            <button
              onClick={onBlock}
              className="h-10 rounded-md bg-destructive text-destructive-foreground font-semibold"
            >
              Bloquear
            </button>
          )}
          {company.status !== 'pending' && (
            <button
              onClick={onResetPending}
              className="h-10 rounded-md border border-border text-foreground font-medium col-span-2"
            >
              Voltar para pendente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm border-b border-border pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground text-right">{value}</span>
    </div>
  );
}
