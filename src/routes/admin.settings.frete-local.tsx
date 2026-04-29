import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, Plus, Trash2, Pencil, Check, X, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatBRL } from '@/lib/domain';
import {
  listLocalDeliveryZones,
  updateLocalDeliveryZone,
  createLocalDeliveryZone,
  createLocalDeliveryAlias,
  deleteLocalDeliveryAlias,
} from '@/server/localDelivery.functions';

export const Route = createFileRoute('/admin/settings/frete-local')({
  component: FreteLocalAdmin,
});

type Zone = {
  id: string;
  district: string;
  name: string;
  display_name: string;
  parent_zone_id: string | null;
  is_alias: boolean;
  inherits_parent_price: boolean;
  shipping_price: number | null;
  estimated_delivery_time: string | null;
  is_active: boolean;
  notes: string | null;
  sort_order: number;
};

type Alias = { id: string; zone_id: string; alias_name: string; alias_normalized: string };

function FreteLocalAdmin() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-local-zones'],
    queryFn: () => listLocalDeliveryZones(),
  });

  const zones = (data?.ok ? (data.zones as Zone[]) : []) ?? [];
  const aliases = (data?.ok ? (data.aliases as Alias[]) : []) ?? [];

  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'no-price'>('all');
  const [editing, setEditing] = useState<Zone | null>(null);
  const [creatingZone, setCreatingZone] = useState(false);
  const [creatingAliasFor, setCreatingAliasFor] = useState<Zone | null>(null);

  const filtered = useMemo(() => {
    const norm = (v: string) =>
      v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const q = norm(search.trim());
    return zones.filter((z) => {
      if (districtFilter !== 'all' && z.district !== districtFilter) return false;
      if (statusFilter === 'active' && !z.is_active) return false;
      if (statusFilter === 'inactive' && z.is_active) return false;
      if (statusFilter === 'no-price' && z.shipping_price !== null) return false;
      if (q && !norm(z.display_name).includes(q) && !norm(z.name).includes(q)) return false;
      return true;
    });
  }, [zones, search, districtFilter, statusFilter]);

  const districts = useMemo(() => Array.from(new Set(zones.map((z) => z.district))).sort(), [zones]);

  const stats = useMemo(() => {
    const active = zones.filter((z) => z.is_active);
    const noPrice = zones.filter((z) => z.shipping_price === null);
    const prices = zones.filter((z) => z.shipping_price !== null).map((z) => Number(z.shipping_price));
    return {
      total: zones.length,
      active: active.length,
      noPrice: noPrice.length,
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
    };
  }, [zones]);

  const updateMut = useMutation({
    mutationFn: (vars: Parameters<typeof updateLocalDeliveryZone>[0]['data']) => updateLocalDeliveryZone({ data: vars }),
    onSuccess: (r) => {
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success('Atualizado');
      qc.invalidateQueries({ queryKey: ['admin-local-zones'] });
    },
  });

  const toggleActive = (z: Zone) => updateMut.mutate({ id: z.id, is_active: !z.is_active });

  const aliasesByZone = useMemo(() => {
    const map = new Map<string, Alias[]>();
    aliases.forEach((a) => {
      const arr = map.get(a.zone_id) ?? [];
      arr.push(a);
      map.set(a.zone_id, arr);
    });
    return map;
  }, [aliases]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display font-bold text-2xl">Frete Local Maricá/RJ</h1>
          <p className="text-sm text-muted-foreground">
            Configure valor e disponibilidade do frete local por bairro/localidade.
          </p>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Cadastrados" value={stats.total} />
          <StatCard label="Ativos" value={stats.active} highlight />
          <StatCard label="Sem valor" value={stats.noPrice} warning />
          <StatCard label="Menor frete" value={stats.min ? formatBRL(stats.min) : '—'} />
          <StatCard label="Maior frete" value={stats.max ? formatBRL(stats.max) : '—'} />
        </div>

        {/* Filtros */}
        <div className="bg-card border border-border rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar bairro ou localidade..."
              className="pl-9"
            />
          </div>
          <Select value={districtFilter} onValueChange={setDistrictFilter}>
            <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os distritos</SelectItem>
              {districts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
              <SelectItem value="no-price">Sem valor</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setCreatingZone(true)} className="shrink-0">
            <Plus className="w-4 h-4 mr-1.5" /> Nova localidade
          </Button>
        </div>

        {/* Tabela */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-3 font-medium">Localidade</th>
                  <th className="text-left px-3 py-3 font-medium hidden md:table-cell">Distrito</th>
                  <th className="text-left px-3 py-3 font-medium hidden lg:table-cell">Aliases</th>
                  <th className="text-right px-3 py-3 font-medium">Frete</th>
                  <th className="text-left px-3 py-3 font-medium hidden md:table-cell">Prazo</th>
                  <th className="text-center px-3 py-3 font-medium">Ativo</th>
                  <th className="text-right px-3 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Carregando…
                  </td></tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhuma localidade encontrada.</td></tr>
                )}
                {filtered.map((z) => {
                  const zAliases = aliasesByZone.get(z.id) ?? [];
                  return (
                    <tr key={z.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-3 py-3">
                        <div className="font-medium">{z.display_name}</div>
                        <div className="text-xs text-muted-foreground md:hidden">{z.district}</div>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell text-muted-foreground">{z.district}</td>
                      <td className="px-3 py-3 hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {zAliases.map((a) => (
                            <span key={a.id} className="inline-flex items-center gap-1 text-xs bg-surface border border-border rounded-full px-2 py-0.5">
                              <Tag className="w-3 h-3" /> {a.alias_name}
                              <button
                                onClick={async () => {
                                  if (!confirm(`Remover alias "${a.alias_name}"?`)) return;
                                  const r = await deleteLocalDeliveryAlias({ data: { id: a.id } });
                                  if (r.ok) {
                                    toast.success('Alias removido');
                                    qc.invalidateQueries({ queryKey: ['admin-local-zones'] });
                                  } else toast.error(r.error);
                                }}
                                className="ml-0.5 text-muted-foreground hover:text-danger"
                              ><X className="w-3 h-3" /></button>
                            </span>
                          ))}
                          <button
                            onClick={() => setCreatingAliasFor(z)}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          ><Plus className="w-3 h-3" /> alias</button>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-medium">
                        {z.shipping_price === null
                          ? <span className="text-warning text-xs">não configurado</span>
                          : formatBRL(Number(z.shipping_price))}
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell text-muted-foreground text-xs">
                        {z.estimated_delivery_time ?? '—'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Switch checked={z.is_active} onCheckedChange={() => toggleActive(z)} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(z)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Editar zona */}
      {editing && (
        <EditZoneDialog zone={editing} onClose={() => setEditing(null)} onSaved={() => qc.invalidateQueries({ queryKey: ['admin-local-zones'] })} />
      )}

      {/* Criar zona */}
      {creatingZone && (
        <CreateZoneDialog
          districts={districts}
          zones={zones}
          onClose={() => setCreatingZone(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['admin-local-zones'] })}
        />
      )}

      {/* Criar alias */}
      {creatingAliasFor && (
        <CreateAliasDialog
          zone={creatingAliasFor}
          onClose={() => setCreatingAliasFor(null)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['admin-local-zones'] })}
        />
      )}
    </AdminLayout>
  );
}

function StatCard({ label, value, highlight, warning }: { label: string; value: number | string; highlight?: boolean; warning?: boolean }) {
  return (
    <div className={`bg-card border rounded-xl p-3 sm:p-4 ${highlight ? 'border-success/40' : warning ? 'border-warning/40' : 'border-border'}`}>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`mt-1 font-display font-bold text-xl ${highlight ? 'text-success' : warning ? 'text-warning' : ''}`}>{value}</div>
    </div>
  );
}

function EditZoneDialog({ zone, onClose, onSaved }: { zone: Zone; onClose: () => void; onSaved: () => void }) {
  const [price, setPrice] = useState(zone.shipping_price?.toString() ?? '');
  const [eta, setEta] = useState(zone.estimated_delivery_time ?? '');
  const [notes, setNotes] = useState(zone.notes ?? '');
  const [active, setActive] = useState(zone.is_active);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const parsed = price.trim() === '' ? null : Number(price.replace(',', '.'));
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      toast.error('Valor de frete inválido');
      setSaving(false);
      return;
    }
    const r = await updateLocalDeliveryZone({
      data: {
        id: zone.id,
        shipping_price: parsed,
        estimated_delivery_time: eta.trim() || null,
        notes: notes.trim() || null,
        is_active: active,
      },
    });
    setSaving(false);
    if (!r.ok) { toast.error(r.error); return; }
    toast.success('Salvo');
    onSaved();
    onClose();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{zone.display_name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Valor do frete (R$)</Label>
            <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ex.: 15.00" inputMode="decimal" />
            <p className="text-xs text-muted-foreground mt-1">Deixe vazio para "não configurado".</p>
          </div>
          <div>
            <Label>Prazo estimado</Label>
            <Input value={eta} onChange={(e) => setEta(e.target.value)} placeholder="Ex.: até 24h úteis" />
          </div>
          <div>
            <Label>Observações</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={active} onCheckedChange={setActive} /> Ativo
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1.5" />Salvar</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateZoneDialog({ districts, zones, onClose, onCreated }: { districts: string[]; zones: Zone[]; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [district, setDistrict] = useState(districts[0] ?? 'Sede');
  const [price, setPrice] = useState('');
  const [eta, setEta] = useState('');
  const [active, setActive] = useState(false);
  const [parentId, setParentId] = useState<string>('none');
  const [inherits, setInherits] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || !displayName.trim()) { toast.error('Preencha nome e nome exibido'); return; }
    setSaving(true);
    const parsed = price.trim() === '' ? null : Number(price.replace(',', '.'));
    const r = await createLocalDeliveryZone({
      data: {
        name: name.trim(),
        display_name: displayName.trim(),
        district,
        is_alias: parentId !== 'none',
        parent_zone_id: parentId === 'none' ? null : parentId,
        inherits_parent_price: inherits,
        shipping_price: inherits ? null : parsed,
        estimated_delivery_time: eta.trim() || null,
        is_active: active,
        sort_order: 999,
      },
    });
    setSaving(false);
    if (!r.ok) { toast.error(r.error); return; }
    toast.success('Localidade criada');
    onCreated();
    onClose();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nova localidade</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Barroco" />
            </div>
            <div>
              <Label>Nome exibido</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ex.: Barroco - Itaipuaçu" />
            </div>
            <div>
              <Label>Distrito</Label>
              <Select value={district} onValueChange={setDistrict}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Sede', 'Ponta Negra', 'Inoã', 'Itaipuaçu', ...districts.filter((d) => !['Sede','Ponta Negra','Inoã','Itaipuaçu'].includes(d))].map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vinculada a (opcional)</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Localidade independente —</SelectItem>
                  {zones.filter((z) => !z.is_alias).map((z) => <SelectItem key={z.id} value={z.id}>{z.display_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {parentId !== 'none' && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={inherits} onCheckedChange={setInherits} /> Herdar valor da localidade principal
            </label>
          )}
          {!inherits && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Valor do frete (R$)</Label>
                <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ex.: 15.00" inputMode="decimal" />
              </div>
              <div>
                <Label>Prazo estimado</Label>
                <Input value={eta} onChange={(e) => setEta(e.target.value)} />
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={active} onCheckedChange={setActive} /> Já ativar
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateAliasDialog({ zone, onClose, onCreated }: { zone: Zone; onClose: () => void; onCreated: () => void }) {
  const [aliasName, setAliasName] = useState('');
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!aliasName.trim()) return;
    setSaving(true);
    const r = await createLocalDeliveryAlias({ data: { zone_id: zone.id, alias_name: aliasName.trim() } });
    setSaving(false);
    if (!r.ok) { toast.error(r.error); return; }
    toast.success('Alias criado');
    onCreated();
    onClose();
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Novo alias para {zone.display_name}</DialogTitle></DialogHeader>
        <div>
          <Label>Variação do nome</Label>
          <Input value={aliasName} onChange={(e) => setAliasName(e.target.value)} placeholder="Ex.: Itaipuacu" />
          <p className="text-xs text-muted-foreground mt-1">Acentos e caixa serão normalizados automaticamente.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
