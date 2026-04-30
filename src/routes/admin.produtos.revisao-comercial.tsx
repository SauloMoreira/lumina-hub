import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Search,
  RefreshCw,
  ExternalLink,
  Pencil,
  Sparkles,
  AlertTriangle,
  AlertOctagon,
  Tag,
  Briefcase,
  CheckCircle2,
  DollarSign,
  Info,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getCommercialReviewReport,
  getCommercialReviewFilterOptions,
  type CommercialFilter,
  type CommercialReviewRow,
} from '@/server/commercialReview.functions';
import {
  STATUS_LABEL,
  STATUS_TONE,
  type CommercialStatus,
} from '@/lib/commercialReview';

export const Route = createFileRoute('/admin/produtos/revisao-comercial')({
  component: CommercialReviewPage,
});

const FILTER_OPTIONS: Array<{ value: CommercialFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'no_cost', label: 'Sem custo' },
  { value: 'no_price', label: 'Sem preço' },
  { value: 'negative_margin', label: 'Margem negativa' },
  { value: 'critical_margin', label: 'Margem crítica' },
  { value: 'attention_margin', label: 'Margem em atenção' },
  { value: 'b2b_critical', label: 'B2B crítico' },
  { value: 'b2b_incomplete', label: 'B2B incompleto' },
  { value: 'healthy', label: 'Saudáveis' },
];

function fmtBRL(v: number | null | undefined): string {
  if (v == null) return '—';
  try {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  } catch {
    return `R$ ${v.toFixed(2)}`;
  }
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v.toFixed(1)}%`;
}

function StatusBadge({ status }: { status: CommercialStatus }) {
  const tone = STATUS_TONE[status];
  const cls =
    tone === 'danger'
      ? 'bg-destructive/15 text-destructive border-destructive/30'
      : tone === 'warn'
        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
        : tone === 'ok'
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
          : 'bg-muted text-muted-foreground border-border';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${cls}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function CommercialReviewPage() {
  const [filter, setFilter] = useState<CommercialFilter>('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [brand, setBrand] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data: filterOptions } = useQuery({
    queryKey: ['commercial-review-filter-options'],
    queryFn: () => getCommercialReviewFilterOptions(),
    staleTime: 5 * 60_000,
  });

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ['commercial-review', filter, search, categoryId, brand, page],
    queryFn: () =>
      getCommercialReviewReport({
        data: {
          filter,
          search: search || undefined,
          categoryId: categoryId !== 'all' ? categoryId : undefined,
          brand: brand !== 'all' ? brand : undefined,
          page,
          pageSize,
        },
      }),
    staleTime: 30_000,
  });

  const summary = data?.summary;
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  return (
    <AdminLayout
      title="Revisão comercial"
      action={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Link to={'/admin/produtos' as any}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" /> Produtos
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground max-w-3xl -mt-2">
          Análise comercial baseada no cadastro do produto: preço, custo, margem mínima e
          condições B2B. <strong>Esta tela não altera nada automaticamente</strong> — apenas
          sinaliza o que merece revisão. Histórico de vendas (produto parado, alto giro)
          chega na próxima onda.
        </p>

        {error && (
          <Card className="p-4 border-destructive/40 bg-destructive/10 text-sm text-destructive">
            Não foi possível carregar a revisão comercial. Tente atualizar.
          </Card>
        )}

        {/* CARDS */}
        <section>
          <h2 className="font-display font-semibold text-base mb-3">Resumo</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <SummaryCard
              icon={DollarSign}
              label="Sem custo"
              value={summary?.noCost}
              loading={isLoading}
              tone="warn"
              onClick={() => {
                setFilter('no_cost');
                setPage(1);
              }}
              active={filter === 'no_cost'}
            />
            <SummaryCard
              icon={Tag}
              label="Sem preço"
              value={summary?.noPrice}
              loading={isLoading}
              tone="danger"
              onClick={() => {
                setFilter('no_price');
                setPage(1);
              }}
              active={filter === 'no_price'}
            />
            <SummaryCard
              icon={AlertOctagon}
              label="Margem negativa"
              value={summary?.negativeMargin}
              loading={isLoading}
              tone="danger"
              onClick={() => {
                setFilter('negative_margin');
                setPage(1);
              }}
              active={filter === 'negative_margin'}
            />
            <SummaryCard
              icon={AlertTriangle}
              label="Margem crítica"
              value={summary?.criticalMargin}
              loading={isLoading}
              tone="danger"
              onClick={() => {
                setFilter('critical_margin');
                setPage(1);
              }}
              active={filter === 'critical_margin'}
            />
            <SummaryCard
              icon={Info}
              label="Margem em atenção"
              value={summary?.attentionMargin}
              loading={isLoading}
              tone="warn"
              onClick={() => {
                setFilter('attention_margin');
                setPage(1);
              }}
              active={filter === 'attention_margin'}
            />
            <SummaryCard
              icon={Briefcase}
              label="B2B crítico"
              value={summary?.b2bCritical}
              loading={isLoading}
              tone="danger"
              onClick={() => {
                setFilter('b2b_critical');
                setPage(1);
              }}
              active={filter === 'b2b_critical'}
            />
            <SummaryCard
              icon={Briefcase}
              label="B2B incompleto"
              value={summary?.b2bIncomplete}
              loading={isLoading}
              tone="warn"
              onClick={() => {
                setFilter('b2b_incomplete');
                setPage(1);
              }}
              active={filter === 'b2b_incomplete'}
            />
            <SummaryCard
              icon={CheckCircle2}
              label="Saudáveis"
              value={summary?.healthy}
              loading={isLoading}
              tone="ok"
              onClick={() => {
                setFilter('healthy');
                setPage(1);
              }}
              active={filter === 'healthy'}
            />
          </div>
          {summary && (
            <p className="text-xs text-muted-foreground mt-2">
              {summary.totalActive} produto(s) ativo(s) analisado(s). Margem mínima padrão:{' '}
              <strong>{summary.defaultMinMarginPercent}%</strong>. Produtos com margem mínima
              própria usam o valor cadastrado no produto.
            </p>
          )}
        </section>

        {/* FILTROS */}
        <section className="flex flex-col lg:flex-row gap-2 lg:items-end">
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou SKU…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-8"
              />
            </div>
          </form>
          <Select
            value={filter}
            onValueChange={(v) => {
              setFilter(v as CommercialFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full lg:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={categoryId}
            onValueChange={(v) => {
              setCategoryId(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full lg:w-[200px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {(filterOptions?.categories ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(filterOptions?.brands?.length ?? 0) > 0 && (
            <Select
              value={brand}
              onValueChange={(v) => {
                setBrand(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Marca" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as marcas</SelectItem>
                {(filterOptions?.brands ?? []).map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </section>

        {/* TABELA */}
        <section>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Produto</th>
                    <th className="text-left px-3 py-2">Categoria</th>
                    <th className="text-right px-3 py-2">Preço</th>
                    <th className="text-right px-3 py-2">Custo</th>
                    <th className="text-right px-3 py-2">Margem</th>
                    <th className="text-right px-3 py-2">Mín.</th>
                    <th className="text-right px-3 py-2">B2B</th>
                    <th className="text-right px-3 py-2">Margem B2B</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Problemas</th>
                    <th className="text-right px-3 py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                        Carregando…
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                        Nenhum produto encontrado para os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => <ReviewRow key={row.id} row={row} />)
                  )}
                </tbody>
              </table>
            </div>
            {/* Paginação */}
            {total > pageSize && (
              <div className="flex items-center justify-between p-3 border-t border-border bg-muted/20">
                <p className="text-xs text-muted-foreground">
                  Página {page} de {totalPages} • {total} produto(s)
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </section>
      </div>
    </AdminLayout>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  loading,
  tone,
  onClick,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | undefined;
  loading: boolean;
  tone: 'ok' | 'warn' | 'danger' | 'info';
  onClick?: () => void;
  active?: boolean;
}) {
  const toneCls =
    tone === 'danger'
      ? 'text-destructive'
      : tone === 'warn'
        ? 'text-amber-600 dark:text-amber-400'
        : tone === 'ok'
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-muted-foreground';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border p-3 transition-colors ${
        active
          ? 'border-primary/60 bg-primary/5'
          : 'border-border bg-card hover:bg-muted/50'
      }`}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={`w-4 h-4 ${toneCls}`} />
        <span>{label}</span>
      </div>
      <div className={`mt-1 text-2xl font-display font-semibold ${toneCls}`}>
        {loading ? '—' : (value ?? 0).toLocaleString('pt-BR')}
      </div>
    </button>
  );
}

function ReviewRow({ row }: { row: CommercialReviewRow }) {
  const r = row.review;
  const marginCls =
    r.marginPercent == null
      ? 'text-muted-foreground'
      : r.marginPercent < 0
        ? 'text-destructive font-medium'
        : r.marginPercent < r.effectiveMinMargin
          ? 'text-destructive'
          : r.marginPercent < r.effectiveMinMargin + 5
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-emerald-600 dark:text-emerald-400';
  const b2bMarginCls =
    r.b2bMarginPercent == null
      ? 'text-muted-foreground'
      : r.b2bMarginPercent < r.effectiveMinMargin
        ? 'text-destructive'
        : 'text-foreground';
  return (
    <tr className="border-t border-border hover:bg-muted/30">
      <td className="px-3 py-2 align-top">
        <div className="font-medium leading-tight">{row.name}</div>
        <div className="text-xs text-muted-foreground">
          {row.sku ? <>SKU: {row.sku}</> : <span className="italic">sem SKU</span>}
          {row.brand ? ` • ${row.brand}` : ''}
        </div>
      </td>
      <td className="px-3 py-2 align-top text-xs text-muted-foreground">
        {row.category_name ?? <span className="italic">sem categoria</span>}
      </td>
      <td className="px-3 py-2 align-top text-right tabular-nums">
        {fmtBRL(r.effectivePrice)}
        {row.sale_price && row.sale_price > 0 && row.price && row.sale_price < row.price && (
          <div className="text-[10px] text-muted-foreground line-through">{fmtBRL(row.price)}</div>
        )}
      </td>
      <td className="px-3 py-2 align-top text-right tabular-nums">{fmtBRL(row.cost_price)}</td>
      <td className={`px-3 py-2 align-top text-right tabular-nums ${marginCls}`}>
        <div>{fmtBRL(r.margin)}</div>
        <div className="text-xs">{fmtPct(r.marginPercent)}</div>
      </td>
      <td className="px-3 py-2 align-top text-right tabular-nums text-xs text-muted-foreground">
        {fmtPct(r.effectiveMinMargin)}
      </td>
      <td className="px-3 py-2 align-top text-right tabular-nums">
        {row.b2b_price ? fmtBRL(row.b2b_price) : <span className="text-muted-foreground">—</span>}
        {row.b2b_min_qty && row.b2b_min_qty > 0 && (
          <div className="text-[10px] text-muted-foreground">mín. {row.b2b_min_qty} un.</div>
        )}
      </td>
      <td className={`px-3 py-2 align-top text-right tabular-nums ${b2bMarginCls}`}>
        {r.b2bMarginPercent != null ? (
          <>
            <div>{fmtBRL(r.b2bMargin)}</div>
            <div className="text-xs">{fmtPct(r.b2bMarginPercent)}</div>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2 align-top">
        <StatusBadge status={r.status} />
      </td>
      <td className="px-3 py-2 align-top">
        {r.issues.length === 0 ? (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">
            Nenhum problema.
          </span>
        ) : (
          <ul className="space-y-1 text-xs">
            {r.issues.slice(0, 4).map((i) => (
              <li key={i.code} className="flex gap-1.5">
                <Sparkles
                  className={`w-3 h-3 flex-shrink-0 mt-0.5 ${
                    i.severity === 'high'
                      ? 'text-destructive'
                      : i.severity === 'medium'
                        ? 'text-amber-500'
                        : 'text-muted-foreground'
                  }`}
                />
                <span>
                  <span className="font-medium">{i.message}</span>{' '}
                  <span className="text-muted-foreground">{i.recommendation}</span>
                </span>
              </li>
            ))}
            {r.issues.length > 4 && (
              <li className="text-muted-foreground">+{r.issues.length - 4} outro(s)…</li>
            )}
          </ul>
        )}
      </td>
      <td className="px-3 py-2 align-top text-right">
        <div className="flex flex-col gap-1 items-end">
          <Link to={'/admin/produtos/$id' as any} params={{ id: row.id } as any}>
            <Badge variant="outline" className="cursor-pointer">
              <Pencil className="w-3 h-3 mr-1" /> Editar
            </Badge>
          </Link>
          <Link to={'/admin/produtos/qualidade' as any}>
            <Badge variant="outline" className="cursor-pointer">
              <Sparkles className="w-3 h-3 mr-1" /> Qualidade
            </Badge>
          </Link>
          <a href={`/produto/${row.id}`} target="_blank" rel="noreferrer">
            <Badge variant="outline" className="cursor-pointer">
              <ExternalLink className="w-3 h-3 mr-1" /> Ver na loja
            </Badge>
          </a>
        </div>
      </td>
    </tr>
  );
}
