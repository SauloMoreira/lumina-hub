import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, AlertTriangle, Image as ImageIcon, DollarSign, Search, FileText, Package, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { listProductQuality, type ProductQualityRow } from '@/server/productQuality.functions';
import { qualityClassColor, qualityClassLabel, type QualityClass } from '@/lib/productQuality';

export const Route = createFileRoute('/admin/produtos/qualidade')({ component: ProductQualityPage });

type Filter = 'all' | 'ruim' | 'atencao' | 'active_low' | 'featured_low' | 'no_image' | 'no_cost' | 'no_seo' | 'no_fiscal' | 'no_tech' | 'no_tech_power' | 'no_tech_color_temp' | 'no_tech_voltage' | 'no_tech_ip_rating';

function ProductQualityPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const qc = useQueryClient();

  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['admin-product-quality'],
    queryFn: () => listProductQuality(),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const rows = data?.rows ?? [];
  const counts = data?.counts;

  const handleRefresh = async () => {
    try {
      // Invalida também o feed de operações (contadores do menu + Painel do Dia)
      qc.invalidateQueries({ queryKey: ['admin-operations'] });
      await refetch();
      toast.success('Scores de qualidade atualizados com sucesso.');
    } catch {
      toast.error('Não foi possível atualizar os scores agora. Tente novamente.');
    }
  };

  const filtered = useMemo(() => {
    let arr = rows;
    switch (filter) {
      case 'ruim':         arr = arr.filter((r) => r.quality.classification === 'ruim'); break;
      case 'atencao':      arr = arr.filter((r) => r.quality.classification === 'atencao'); break;
      case 'active_low':   arr = arr.filter((r) => r.active && r.quality.score < 70); break;
      case 'featured_low': arr = arr.filter((r) => r.featured && r.quality.score < 70); break;
      case 'no_image':     arr = arr.filter((r) => r.quality.issues.some((i) => i.code === 'no_image')); break;
      case 'no_cost':      arr = arr.filter((r) => r.quality.issues.some((i) => i.code === 'no_cost')); break;
      case 'no_seo':       arr = arr.filter((r) => r.quality.issues.some((i) => i.code === 'no_seo_title' || i.code === 'no_seo_description')); break;
      case 'no_fiscal':    arr = arr.filter((r) => r.quality.issues.some((i) => ['no_ncm','no_weight','no_dimensions'].includes(i.code))); break;
      case 'no_tech':              arr = arr.filter((r) => r.quality.issues.some((i) => i.code === 'no_tech_attrs')); break;
      case 'no_tech_power':        arr = arr.filter((r) => r.quality.issues.some((i) => i.code === 'no_tech_power')); break;
      case 'no_tech_color_temp':   arr = arr.filter((r) => r.quality.issues.some((i) => i.code === 'no_tech_color_temp')); break;
      case 'no_tech_voltage':      arr = arr.filter((r) => r.quality.issues.some((i) => i.code === 'no_tech_voltage')); break;
      case 'no_tech_ip_rating':    arr = arr.filter((r) => r.quality.issues.some((i) => i.code === 'no_tech_ip_rating')); break;
    }
    const term = q.trim().toLowerCase();
    if (term) arr = arr.filter((r) => r.name.toLowerCase().includes(term) || (r.sku ?? '').toLowerCase().includes(term));
    return arr.slice().sort((a, b) => a.quality.score - b.quality.score);
  }, [rows, filter, q]);

  return (
    <AdminLayout
      title="Qualidade do cadastro"
      action={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Atualizando…' : 'Atualizar scores'}
          </Button>
          <Link to={'/admin/produtos' as any}>
            <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Produtos</Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <p className="text-sm text-muted-foreground max-w-2xl">
            Score de 0 a 100 baseado em mídia, conteúdo, SEO, fiscal/logística e custo. Os avisos são <strong>não-bloqueantes</strong> — o produto continua sendo vendido normalmente.
            Apenas o destaque (vitrines premium, featured) exige score mínimo de <strong>70</strong>.
          </p>
          {dataUpdatedAt > 0 && (
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              Atualizado às {new Date(dataUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <SummaryCard label="Total" value={counts?.total ?? 0} onClick={() => setFilter('all')} active={filter==='all'} />
          <SummaryCard label="Ruins" value={counts?.ruim ?? 0} tone="danger" onClick={() => setFilter('ruim')} active={filter==='ruim'} />
          <SummaryCard label="Atenção" value={counts?.atencao ?? 0} tone="warn" onClick={() => setFilter('atencao')} active={filter==='atencao'} />
          <SummaryCard label="Ativos < 70" value={counts?.activeBelow70 ?? 0} tone="warn" onClick={() => setFilter('active_low')} active={filter==='active_low'} />
          <SummaryCard label="Destaques < 70" value={counts?.featuredBelow70 ?? 0} tone="danger" onClick={() => setFilter('featured_low')} active={filter==='featured_low'} />
          <SummaryCard label="Sem imagem" value={counts?.missingImage ?? 0} tone="warn" onClick={() => setFilter('no_image')} active={filter==='no_image'} />
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterPill icon={<ImageIcon className="w-3.5 h-3.5" />} label="Sem imagem" value="no_image" filter={filter} setFilter={setFilter} />
          <FilterPill icon={<DollarSign className="w-3.5 h-3.5" />} label="Sem custo" value="no_cost" filter={filter} setFilter={setFilter} />
          <FilterPill icon={<Search className="w-3.5 h-3.5" />} label="SEO incompleto" value="no_seo" filter={filter} setFilter={setFilter} />
          <FilterPill icon={<FileText className="w-3.5 h-3.5" />} label="Fiscal/logística" value="no_fiscal" filter={filter} setFilter={setFilter} />
          <FilterPill icon={<Package className="w-3.5 h-3.5" />} label="Sem atributos técnicos" value="no_tech" filter={filter} setFilter={setFilter} />
        </div>

        <div className="bg-card border border-border rounded-xl">
          <div className="p-4 border-b border-border flex items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou SKU…" className="pl-9" />
            </div>
            <span className="text-xs text-muted-foreground">{filtered.length} de {rows.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground bg-muted/40">
                <tr>
                  <th className="px-4 py-3 font-medium">Produto</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Classe</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Pendências</th>
                  <th className="px-4 py-3 font-medium w-24"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>}
                {!isLoading && filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum produto neste filtro.</td></tr>}
                {filtered.map((r) => <Row key={r.id} row={r} />)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function Row({ row }: { row: ProductQualityRow }) {
  const c = qualityClassColor(row.quality.classification);
  const top = row.quality.issues.slice(0, 3);
  return (
    <tr className="border-t border-border hover:bg-muted/20">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Package className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="font-medium truncate">{row.name}</p>
            <p className="text-xs text-muted-foreground truncate">{row.sku ?? '—'} {row.brand ? `· ${row.brand}` : ''}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 font-semibold">{row.quality.score}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
          {qualityClassLabel(row.quality.classification)}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className={`inline-flex w-fit items-center px-2 py-0.5 rounded text-[11px] font-medium ${row.active ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
            {row.active ? 'Ativo' : 'Inativo'}
          </span>
          {row.featured && row.quality.score < 70 && (
            <span className="inline-flex w-fit items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-500/10 text-red-700 dark:text-red-400">
              <AlertTriangle className="w-3 h-3" /> Destaque com score baixo
            </span>
          )}
          {row.featured && row.quality.score >= 70 && (
            <span className="inline-flex w-fit items-center px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary">Destaque</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {top.length === 0 ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <ul className="text-xs space-y-0.5">
            {top.map((i) => <li key={i.code} className="text-muted-foreground">• {i.label}</li>)}
            {row.quality.issues.length > top.length && (
              <li className="text-[11px] text-muted-foreground/70">+ {row.quality.issues.length - top.length} outras</li>
            )}
          </ul>
        )}
      </td>
      <td className="px-4 py-3">
        <Link to={'/admin/produtos/$id' as any} params={{ id: row.id } as any}>
          <Button variant="outline" size="sm">Editar</Button>
        </Link>
      </td>
    </tr>
  );
}

function SummaryCard({ label, value, tone, onClick, active }: { label: string; value: number; tone?: 'warn' | 'danger'; onClick: () => void; active: boolean }) {
  const toneCls = tone === 'danger' ? 'text-red-700 dark:text-red-400' : tone === 'warn' ? 'text-amber-700 dark:text-amber-400' : 'text-foreground';
  return (
    <button
      onClick={onClick}
      className={`text-left bg-card border rounded-xl p-3 transition-colors hover:border-primary/40 ${active ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}
    >
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold ${toneCls}`}>{value}</p>
    </button>
  );
}

function FilterPill({ icon, label, value, filter, setFilter }: { icon: React.ReactNode; label: string; value: Filter; filter: Filter; setFilter: (f: Filter) => void }) {
  const active = filter === value;
  return (
    <button
      onClick={() => setFilter(active ? 'all' : value)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/40'}`}
    >
      {icon}{label}
    </button>
  );
}

// Helper used for type narrowing in callbacks (kept intentionally)
type _C = QualityClass;
