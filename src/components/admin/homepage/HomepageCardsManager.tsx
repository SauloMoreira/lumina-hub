import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IconPicker } from '@/components/admin/IconPicker';
import { supabase } from '@/integrations/supabase/client';
import {
  adminListHomepageCards,
  type HomepageCard,
  type HomepageCardType,
} from '@/lib/homepageBlocks';

interface Props {
  cardType: HomepageCardType;
  title: string;
  description: string;
  /** sugestões de variantes (gradient tailwind) para o seletor */
  variants?: Array<{ value: string; label: string }>;
  /** placeholder de URL */
  linkPlaceholder?: string;
}

const DEFAULT_VARIANTS = [
  { value: 'from-primary to-primary/70', label: 'Primário' },
  { value: 'from-orange-500 to-red-500', label: 'Quente (laranja/vermelho)' },
  { value: 'from-amber-400 to-yellow-500', label: 'Destaque (âmbar)' },
  { value: 'from-emerald-500 to-teal-500', label: 'Sucesso (verde)' },
  { value: 'from-violet-500 to-indigo-500', label: 'Tecnologia (violeta)' },
  { value: 'from-sky-500 to-blue-500', label: 'Confiança (azul)' },
];

function isHttp(url: string) {
  return /^(https?:)?\/\//i.test(url) || url.startsWith('/') || url.startsWith('#');
}

export function HomepageCardsManager({
  cardType,
  title,
  description,
  variants = DEFAULT_VARIANTS,
  linkPlaceholder = '/catalogo',
}: Props) {
  const qc = useQueryClient();
  const queryKey = ['admin-homepage-cards', cardType];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => adminListHomepageCards(cardType),
  });

  const [draft, setDraft] = useState<HomepageCard[]>([]);
  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const update = (id: string, patch: Partial<HomepageCard>) => {
    setDraft((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const move = (id: string, dir: -1 | 1) => {
    setDraft((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx < 0) return prev;
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[j]] = [copy[j], copy[idx]];
      return copy.map((c, i) => ({ ...c, sort_order: i }));
    });
  };

  const removeLocal = (id: string) => setDraft((p) => p.filter((c) => c.id !== id));

  const createMut = useMutation({
    mutationFn: async () => {
      const { data: row, error } = await (supabase as any)
        .from('homepage_cards')
        .insert({
          card_type: cardType,
          title: cardType === 'benefit' ? 'Novo benefício' : 'Novo card promocional',
          description: '',
          icon: cardType === 'benefit' ? 'Sparkles' : 'Tag',
          visual_variant: variants[0]?.value ?? null,
          sort_order: draft.length,
          is_active: true,
        })
        .select()
        .single();
      if (error) throw error;
      return row as HomepageCard;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['homepage-cards', cardType] });
      setDraft((p) => [...p, row]);
      toast.success('Card criado');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao criar card'),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('homepage_cards').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['homepage-cards', cardType] });
      toast.success('Card removido');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao remover'),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      // valida links
      for (const c of draft) {
        if (c.link_url && !isHttp(c.link_url)) {
          throw new Error(`Link inválido em "${c.title}". Use http(s)://, / ou #.`);
        }
        if (!c.title?.trim()) {
          throw new Error('Todos os cards precisam de título.');
        }
      }
      const updates = draft.map((c, i) =>
        (supabase as any)
          .from('homepage_cards')
          .update({
            title: c.title?.trim().slice(0, 80),
            description: c.description?.trim().slice(0, 240) || null,
            icon: c.icon || null,
            image_url: c.image_url || null,
            link_url: c.link_url || null,
            link_label: c.link_label || null,
            visual_variant: c.visual_variant || null,
            sort_order: i,
            is_active: c.is_active,
            start_date: c.start_date || null,
            end_date: c.end_date || null,
          })
          .eq('id', c.id),
      );
      const results = await Promise.all(updates);
      const firstErr = results.find((r: any) => r.error)?.error;
      if (firstErr) throw firstErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['homepage-cards', cardType] });
      toast.success('Alterações salvas');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao salvar'),
  });

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
            <Plus className="w-4 h-4 mr-1" /> Novo card
          </Button>
          <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Salvar
          </Button>
        </div>
      </div>

      {draft.length === 0 && (
        <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
          Nenhum card cadastrado. Clique em <strong>Novo card</strong> para começar.
        </div>
      )}

      <div className="space-y-3">
        {draft.map((c, i) => (
          <Card key={c.id} className={c.is_active ? '' : 'opacity-60'}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-[10px] uppercase">
                    {cardType === 'benefit' ? 'Benefício' : 'Promo'}
                  </Badge>
                  {!c.is_active && <Badge variant="outline" className="text-[10px]">Inativo</Badge>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => move(c.id, -1)} disabled={i === 0}>
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => move(c.id, 1)} disabled={i === draft.length - 1}>
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                  <div className="flex items-center gap-2 px-2">
                    <Label className="text-xs">Ativo</Label>
                    <Switch checked={c.is_active} onCheckedChange={(v) => update(c.id, { is_active: v })} />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (!confirm('Remover este card?')) return;
                      removeLocal(c.id);
                      deleteMut.mutate(c.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Título *</Label>
                  <Input
                    maxLength={80}
                    value={c.title}
                    onChange={(e) => update(c.id, { title: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Ícone (Lucide)</Label>
                  <IconPicker value={c.icon} onChange={(v) => update(c.id, { icon: v })} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Descrição</Label>
                  <Textarea
                    rows={2}
                    maxLength={240}
                    value={c.description ?? ''}
                    onChange={(e) => update(c.id, { description: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Link (opcional)</Label>
                  <Input
                    value={c.link_url ?? ''}
                    onChange={(e) => update(c.id, { link_url: e.target.value || null })}
                    placeholder={linkPlaceholder}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Rótulo do link (opcional)</Label>
                  <Input
                    value={c.link_label ?? ''}
                    onChange={(e) => update(c.id, { link_label: e.target.value || null })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Variante visual</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={c.visual_variant ?? ''}
                    onChange={(e) => update(c.id, { visual_variant: e.target.value || null })}
                  >
                    <option value="">Padrão</option>
                    {variants.map((v) => (
                      <option key={v.value} value={v.value}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">URL da imagem (opcional)</Label>
                  <Input
                    value={c.image_url ?? ''}
                    onChange={(e) => update(c.id, { image_url: e.target.value || null })}
                    placeholder="https://…"
                  />
                </div>
                {cardType === 'promo' && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Início da exibição (opcional)</Label>
                      <Input
                        type="datetime-local"
                        value={c.start_date ? c.start_date.slice(0, 16) : ''}
                        onChange={(e) =>
                          update(c.id, { start_date: e.target.value ? new Date(e.target.value).toISOString() : null })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Fim da exibição (opcional)</Label>
                      <Input
                        type="datetime-local"
                        value={c.end_date ? c.end_date.slice(0, 16) : ''}
                        onChange={(e) =>
                          update(c.id, { end_date: e.target.value ? new Date(e.target.value).toISOString() : null })
                        }
                      />
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
