import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Sparkles, X, Boxes } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { computeProductQuality, qualityClassColor, qualityClassLabel } from '@/lib/productQuality';
import { normalizeSearch } from '@/lib/searchNormalize';

export const Route = createFileRoute('/admin/produtos/')({ component: ProdutosList });

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  sale_price: number | null;
  stock_qty: number;
  stock_min_alert: number | null;
  stock_alert_enabled?: boolean;
  allow_out_of_stock_sales?: boolean;
  active: boolean;
  brand: string | null;
  sku: string | null;
  ncm: string | null;
  gtin_ean: string | null;
  cost_price: number | null;
  images: string[] | null;
  b2b_enabled: boolean;
  b2b_price: number | null;
  b2b_min_qty: number | null;
  /** Conjunto de attribute_keys (lowercase) cadastrados pra esse produto. */
  tech_attr_keys?: Set<string>;
  quality?: ReturnType<typeof computeProductQuality>;
}

type QuickFilter =
  | 'all'
  | 'no_image'
  | 'no_cost'
  | 'no_ncm'
  | 'b2b_incomplete'
  | 'low_stock'
  | 'zero_stock'
  | 'no_min_stock'
  | 'allow_oos'
  | 'block_oos'
  | 'bad_quality'
  | 'no_tech_attrs'
  | 'no_power'
  | 'no_color_temp'
  | 'no_voltage'
  | 'no_ip_rating';

const FILTERS: Array<{ id: QuickFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'no_image', label: 'Sem imagem' },
  { id: 'no_cost', label: 'Sem custo' },
  { id: 'no_ncm', label: 'Sem NCM' },
  { id: 'b2b_incomplete', label: 'B2B incompleto' },
  { id: 'low_stock', label: 'Estoque baixo' },
  { id: 'zero_stock', label: 'Estoque zerado' },
  { id: 'no_min_stock', label: 'Sem estoque mínimo' },
  { id: 'allow_oos', label: 'Permite venda sem estoque' },
  { id: 'block_oos', label: 'Não permite venda sem estoque' },
  { id: 'bad_quality', label: 'Qualidade ruim' },
  { id: 'no_tech_attrs', label: 'Sem atributos técnicos' },
  { id: 'no_power', label: 'Sem potência' },
  { id: 'no_color_temp', label: 'Sem temperatura' },
  { id: 'no_voltage', label: 'Sem voltagem' },
  { id: 'no_ip_rating', label: 'Sem IP' },
];

function ProdutosList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<QuickFilter>('all');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data }, { data: attrs }] = await Promise.all([
      supabase
        .from('products')
        .select('*, product_images(url_thumb, url_card, original_url, is_primary, sort_order, alt_text)')
        .order('created_at', { ascending: false }),
      supabase
        .from('product_attributes')
        .select('product_id, attribute_key, attribute_value')
        .limit(20000),
    ]);
    const attrMap = new Map<string, Set<string>>();
    (attrs ?? []).forEach((a: any) => {
      const v = (a.attribute_value ?? '').toString().trim();
      if (!v) return;
      const k = (a.attribute_key ?? '').toString().toLowerCase();
      if (!k) return;
      if (!attrMap.has(a.product_id)) attrMap.set(a.product_id, new Set());
      attrMap.get(a.product_id)!.add(k);
    });
    const mapped = (data ?? []).map((p: any) => {
      const imgs = (p.product_images ?? []).slice().sort((a: any, b: any) => {
        if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });
      const fromTable = imgs.map((i: any) => i.url_thumb ?? i.url_card ?? i.original_url).filter(Boolean);
      const merged = fromTable.length ? fromTable : (p.images ?? []);
      const quality = computeProductQuality(p);
      const tech_attr_keys = attrMap.get(p.id) ?? new Set<string>();
      return { ...p, images: merged, quality, tech_attr_keys };
    });
    setProducts(mapped as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este produto?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Produto excluído');
    load();
  };

  const filtered = useMemo(() => {
    const term = normalizeSearch(q);
    return products.filter((p) => {
      // Busca em vários campos
      if (term) {
        const haystack = normalizeSearch([
          p.name, p.sku, p.gtin_ean, p.ncm, p.brand,
        ].filter(Boolean).join(' '));
        if (!haystack.includes(term)) return false;
      }
      // Filtros rápidos
      switch (filter) {
        case 'no_image':
          return !p.images || p.images.length === 0;
        case 'no_cost':
          return p.cost_price == null || Number(p.cost_price) <= 0;
        case 'no_ncm':
          return !p.ncm || p.ncm.trim().length === 0;
        case 'b2b_incomplete':
          return p.b2b_enabled && (p.b2b_price == null || Number(p.b2b_price) <= 0 || (p.b2b_min_qty ?? 0) <= 0);
        case 'low_stock': {
          const min = p.stock_min_alert ?? 5;
          return p.stock_qty > 0 && p.stock_qty <= min;
        }
        case 'zero_stock':
          return p.stock_qty <= 0;
        case 'no_min_stock':
          return p.stock_min_alert == null;
        case 'allow_oos':
          return p.allow_out_of_stock_sales === true;
        case 'block_oos':
          return p.allow_out_of_stock_sales !== true;
        case 'bad_quality':
          return p.quality?.classification === 'ruim';
        case 'no_tech_attrs':
          return !p.tech_attr_keys || p.tech_attr_keys.size === 0;
        case 'no_power':
          return !p.tech_attr_keys?.has('power');
        case 'no_color_temp':
          return !p.tech_attr_keys?.has('color_temperature');
        case 'no_voltage':
          return !p.tech_attr_keys?.has('voltage');
        case 'no_ip_rating':
          return !p.tech_attr_keys?.has('ip_rating');
        case 'all':
        default:
          return true;
      }
    });
  }, [products, q, filter]);

  const counts = useMemo(() => {
    const c: Record<QuickFilter, number> = {
      all: products.length,
      no_image: 0, no_cost: 0, no_ncm: 0,
      b2b_incomplete: 0, low_stock: 0, zero_stock: 0,
      no_min_stock: 0, allow_oos: 0, block_oos: 0,
      bad_quality: 0,
      no_tech_attrs: 0, no_power: 0, no_color_temp: 0, no_voltage: 0, no_ip_rating: 0,
    };
    for (const p of products) {
      if (!p.images || p.images.length === 0) c.no_image += 1;
      if (p.cost_price == null || Number(p.cost_price) <= 0) c.no_cost += 1;
      if (!p.ncm || p.ncm.trim().length === 0) c.no_ncm += 1;
      if (p.b2b_enabled && (p.b2b_price == null || Number(p.b2b_price) <= 0 || (p.b2b_min_qty ?? 0) <= 0)) c.b2b_incomplete += 1;
      const min = p.stock_min_alert ?? 5;
      if (p.stock_qty > 0 && p.stock_qty <= min) c.low_stock += 1;
      if (p.stock_qty <= 0) c.zero_stock += 1;
      if (p.stock_min_alert == null) c.no_min_stock += 1;
      if (p.allow_out_of_stock_sales) c.allow_oos += 1;
      else c.block_oos += 1;
      if (p.quality?.classification === 'ruim') c.bad_quality += 1;
      const keys = p.tech_attr_keys;
      if (!keys || keys.size === 0) c.no_tech_attrs += 1;
      if (!keys?.has('power')) c.no_power += 1;
      if (!keys?.has('color_temperature')) c.no_color_temp += 1;
      if (!keys?.has('voltage')) c.no_voltage += 1;
      if (!keys?.has('ip_rating')) c.no_ip_rating += 1;
    }
    return c;
  }, [products]);

  return (
    <AdminLayout
      title="Produtos"
      action={
        <div className="flex items-center gap-2">
          <Link to={'/admin/produtos/qualidade' as any}>
            <Button variant="outline" size="sm"><Sparkles className="w-4 h-4 mr-1" /> Qualidade</Button>
          </Link>
          <Link to={'/admin/produtos/novo' as any}>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Novo produto</Button>
          </Link>
        </div>
      }
    >
      <div className="bg-card border border-border rounded-xl">
        <div className="p-4 border-b border-border space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, SKU, EAN, NCM ou marca…"
              className="pl-9 pr-9"
            />
            {q && (
              <button
                onClick={() => setQ('')}
                aria-label="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = filter === f.id;
              const count = counts[f.id];
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground border-border hover:bg-surface'
                  }`}
                >
                  {f.label}
                  <span className={`tabular-nums ${active ? 'opacity-90' : 'text-muted-foreground/70'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground bg-muted/40">
              <tr>
                <th className="px-4 py-3 font-medium">Produto</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Preço</th>
                <th className="px-4 py-3 font-medium">Atacado</th>
                <th className="px-4 py-3 font-medium">Estoque</th>
                <th className="px-4 py-3 font-medium">Qualidade</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium w-24"></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>}
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.images?.[0] ? (
                        <img src={p.images[0]} alt={p.name} className="w-10 h-10 object-cover rounded border border-border" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{p.name}</p>
                        {p.brand && <p className="text-xs text-muted-foreground">{p.brand}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{p.sku ?? '—'}</td>
                  <td className="px-4 py-3">
                    {p.sale_price ? (
                      <div>
                        <span className="text-primary font-semibold">R$ {Number(p.sale_price).toFixed(2)}</span>
                        <span className="text-xs text-muted-foreground line-through ml-2">R$ {Number(p.price).toFixed(2)}</span>
                      </div>
                    ) : (
                      <span>R$ {Number(p.price).toFixed(2)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.b2b_enabled && p.b2b_price ? (
                      <div>
                        <span className="font-semibold text-foreground">R$ {Number(p.b2b_price).toFixed(2)}</span>
                        {p.b2b_min_qty ? (
                          <span className="text-xs text-muted-foreground block">a partir de {p.b2b_min_qty} un</span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={p.stock_qty < 10 ? 'text-destructive font-medium' : ''}>{p.stock_qty}</span>
                  </td>
                  <td className="px-4 py-3">
                    {p.quality ? (() => {
                      const c = qualityClassColor(p.quality.classification);
                      return (
                        <Link to={'/admin/produtos/$id' as any} params={{ id: p.id } as any} className="inline-flex items-center gap-1.5 group">
                          <span className="font-semibold text-xs tabular-nums">{p.quality.score}</span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${c.bg} ${c.text} group-hover:opacity-80`}>
                            {qualityClassLabel(p.quality.classification)}
                          </span>
                        </Link>
                      );
                    })() : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${p.active ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                      {p.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Link to={'/admin/produtos/$id' as any} params={{ id: p.id } as any}>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="w-4 h-4" /></Button>
                      </Link>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(p.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
