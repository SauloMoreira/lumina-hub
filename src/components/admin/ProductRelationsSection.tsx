import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Trash2, Loader2, Plus, GripVertical, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  adminListRelations,
  adminCreateRelation,
  adminDeleteRelation,
  adminUpdateRelation,
  adminSearchProductsForRelation,
  RELATION_TYPES,
  RELATION_TYPE_LABEL,
  type RelationType,
} from '@/server/productRelations.functions';

type Props = { productId: string };

export function ProductRelationsSection({ productId }: Props) {
  const qc = useQueryClient();
  const [type, setType] = useState<RelationType>('frequently_bought_together');
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);

  const relationsQuery = useQuery({
    queryKey: ['admin-product-relations', productId],
    queryFn: () => adminListRelations({ data: { productId } }),
  });

  const searchResults = useQuery({
    queryKey: ['admin-rel-search', productId, searchQuery],
    queryFn: () =>
      adminSearchProductsForRelation({
        data: { query: searchQuery, excludeProductId: productId, limit: 10 },
      }),
    enabled: searchQuery.trim().length >= 2,
    staleTime: 5_000,
  });

  const createMut = useMutation({
    mutationFn: (relatedProductId: string) =>
      adminCreateRelation({
        data: { productId, relatedProductId, relationType: type, sortOrder: relationsQuery.data?.length ?? 0 },
      }),
    onSuccess: () => {
      toast.success('Relação adicionada');
      setSearchQuery('');
      setShowResults(false);
      qc.invalidateQueries({ queryKey: ['admin-product-relations', productId] });
    },
    onError: (err: any) => {
      const msg = String(err?.message ?? '');
      if (msg.includes('relation_already_exists')) {
        toast.error('Esse produto já está relacionado com esse tipo.');
      } else if (msg.includes('cannot_relate_to_self')) {
        toast.error('Você não pode relacionar o produto com ele mesmo.');
      } else {
        toast.error('Não foi possível adicionar a relação.');
      }
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminDeleteRelation({ data: { id } }),
    onSuccess: () => {
      toast.success('Relação removida');
      qc.invalidateQueries({ queryKey: ['admin-product-relations', productId] });
    },
    onError: () => toast.error('Erro ao remover'),
  });

  const updateMut = useMutation({
    mutationFn: (vars: { id: string; isActive?: boolean; relationType?: RelationType; sortOrder?: number }) =>
      adminUpdateRelation({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-product-relations', productId] });
    },
    onError: () => toast.error('Erro ao atualizar'),
  });

  const rows = relationsQuery.data ?? [];
  const grouped = RELATION_TYPES.map((t) => ({
    type: t,
    label: RELATION_TYPE_LABEL[t],
    items: rows.filter((r) => r.relation_type === t),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
            Produtos relacionados
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sugestões que aparecem na página deste produto e no carrinho. Aumenta o ticket médio.
          </p>
        </div>
      </div>

      {/* Adicionar */}
      <div className="space-y-2 rounded-lg border border-dashed border-border p-3 bg-surface/40">
        <div className="grid sm:grid-cols-[180px_1fr] gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as RelationType)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            {RELATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {RELATION_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto por nome, SKU ou EAN…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowResults(true);
                }}
                onFocus={() => setShowResults(true)}
                className="pl-8 h-9"
              />
            </div>
            {showResults && searchQuery.trim().length >= 2 && (
              <div className="absolute z-20 left-0 right-0 mt-1 rounded-md border border-border bg-popover shadow-lg max-h-72 overflow-auto">
                {searchResults.isLoading && (
                  <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> Buscando…
                  </div>
                )}
                {searchResults.data?.length === 0 && !searchResults.isLoading && (
                  <div className="p-3 text-xs text-muted-foreground">Nenhum produto encontrado.</div>
                )}
                {searchResults.data?.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={createMut.isPending}
                    onClick={() => createMut.mutate(p.id)}
                    className="w-full text-left flex items-center gap-2 p-2 hover:bg-accent/40 border-b border-border last:border-b-0"
                  >
                    <div className="w-9 h-9 rounded bg-surface flex-shrink-0 overflow-hidden">
                      {p.image && <img src={p.image} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {p.sku ? `SKU ${p.sku}` : ''} {p.brand ? `· ${p.brand}` : ''}
                        {!p.active && ' · inativo'}
                      </div>
                    </div>
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Use <strong>Compre junto</strong> para o bloco principal na página do produto, <strong>Acessório</strong>{' '}
          para itens complementares e <strong>Recomendação para empresas</strong> para sugestões B2B.
        </p>
      </div>

      {/* Lista */}
      {relationsQuery.isLoading && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" /> Carregando relações…
        </div>
      )}

      {!relationsQuery.isLoading && rows.length === 0 && (
        <div className="rounded-md border border-dashed border-border bg-surface/40 p-4 text-center text-xs text-muted-foreground">
          Nenhum produto relacionado ainda. Adicione sugestões acima para começar.
        </div>
      )}

      {grouped.map((group) => (
        <div key={group.type} className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}{' '}
            <span className="text-muted-foreground/60 font-normal normal-case">({group.items.length})</span>
          </div>
          <div className="border border-border rounded-md divide-y divide-border">
            {group.items.map((row) => {
              const rp = row.related_product;
              return (
                <div key={row.id} className="flex items-center gap-2 p-2">
                  <GripVertical className="w-3 h-3 text-muted-foreground/50" />
                  <div className="w-9 h-9 rounded bg-surface flex-shrink-0 overflow-hidden">
                    {rp?.image && <img src={rp.image} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {rp?.name ?? '(produto removido)'}
                      {rp && !rp.active && (
                        <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-warning">
                          <AlertCircle className="w-3 h-3" /> inativo
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {rp?.sku ? `SKU ${rp.sku}` : ''} {rp?.brand ? `· ${rp.brand}` : ''}
                    </div>
                  </div>
                  <input
                    type="number"
                    value={row.sort_order}
                    min={0}
                    onChange={(e) =>
                      updateMut.mutate({ id: row.id, sortOrder: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className="w-14 h-8 text-xs rounded border border-border bg-background px-2"
                    title="Ordem de exibição"
                  />
                  <Switch
                    checked={row.is_active}
                    onCheckedChange={(v) => updateMut.mutate({ id: row.id, isActive: v })}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm('Remover esta relação?')) deleteMut.mutate(row.id);
                    }}
                    className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
