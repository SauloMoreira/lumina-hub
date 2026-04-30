import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Loader2, RotateCcw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  adminListHomepageSections,
  adminResetHomepageSections,
  adminUpdateHomepageSection,
  fetchHomepageCards,
  fetchHomepageFeaturedCategories,
  fetchHomepageShowcasesPublic,
  type HomepageSection,
} from '@/lib/homepageBlocks';
import { fetchHomepageSettings } from '@/lib/homepageContent';

/**
 * Indica para cada section_key se há conteúdo válido para exibir na home pública.
 * Usado apenas para exibir um aviso visual no admin — não bloqueia toggles.
 */
function useSectionContentSignals() {
  const benefitCards = useQuery({ queryKey: ['homepage_cards', 'benefit'], queryFn: () => fetchHomepageCards('benefit') });
  const promoCards = useQuery({ queryKey: ['homepage_cards', 'promo'], queryFn: () => fetchHomepageCards('promo') });
  const featuredCategories = useQuery({ queryKey: ['homepage_featured_categories'], queryFn: fetchHomepageFeaturedCategories });
  const showcases = useQuery({ queryKey: ['homepage-showcases'], queryFn: fetchHomepageShowcasesPublic });
  const settings = useQuery({ queryKey: ['homepage_settings'], queryFn: fetchHomepageSettings });

  return useMemo(() => {
    const validShowcases = (showcases.data ?? []).filter((s) => (s.items?.length ?? 0) > 0);
    const offers = validShowcases.find((s) => s.showcase_type === 'offers');
    const featured = validShowcases.find((s) => s.showcase_type === 'featured');
    const others = validShowcases.filter((s) => s.showcase_type !== 'offers' && s.showcase_type !== 'featured');

    const map: Record<string, { hasContent: boolean; note?: string }> = {
      promo_bar: { hasContent: !!settings.data?.promo_bar_text, note: 'Cadastre o texto na aba “Barra promocional”.' },
      hero: { hasContent: true }, // hero tem fallback hardcoded, sempre seguro
      benefits_cards: {
        hasContent: (benefitCards.data?.length ?? 0) > 0,
        note: 'Sem cards de benefícios ativos — o bloco usa um fallback padrão.',
      },
      promo_cards: {
        hasContent: (promoCards.data?.length ?? 0) > 0,
        note: 'Sem cards promocionais ativos — o bloco usa um fallback padrão.',
      },
      featured_categories: {
        hasContent: (featuredCategories.data?.length ?? 0) > 0,
        note: 'Sem categorias destacadas — o bloco usa as categorias do catálogo como fallback.',
      },
      offers_showcase: {
        hasContent: !!offers || true, // tem fallback (deals)
        note: !offers ? 'Sem vitrine “offers” — o bloco usa as ofertas automáticas como fallback.' : undefined,
      },
      featured_showcase: {
        hasContent: !!featured || true, // tem fallback (featured)
        note: !featured ? 'Sem vitrine “featured” — o bloco usa os destaques automáticos como fallback.' : undefined,
      },
      dynamic_showcases: {
        hasContent: others.length > 0,
        note: others.length === 0 ? 'Nenhuma vitrine configurável adicional ativa no momento.' : undefined,
      },
      combos_showcase: { hasContent: false, note: 'Em breve.' },
      institutional_block: { hasContent: false, note: 'Em breve.' },
      main_cta: { hasContent: true },
    };
    return map;
  }, [benefitCards.data, promoCards.data, featuredCategories.data, showcases.data, settings.data]);
}

export function HomepageSectionsManager() {
  const qc = useQueryClient();
  const { data: sections, isLoading } = useQuery({
    queryKey: ['homepage_sections', 'admin'],
    queryFn: adminListHomepageSections,
  });
  const signals = useSectionContentSignals();
  const [busyId, setBusyId] = useState<string | null>(null);

  const sortedActive = useMemo(
    () => (sections ?? []).filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [sections],
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ['homepage_sections'] });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await adminUpdateHomepageSection(id, { is_active });
    },
    onMutate: ({ id }) => setBusyId(id),
    onSuccess: () => {
      toast.success('Visibilidade atualizada');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao atualizar'),
    onSettled: () => setBusyId(null),
  });

  const reorderMutation = useMutation({
    mutationFn: async (payload: Array<{ id: string; sort_order: number }>) => {
      for (const p of payload) {
        await adminUpdateHomepageSection(p.id, { sort_order: p.sort_order });
      }
    },
    onSuccess: () => {
      toast.success('Ordem atualizada');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao reordenar'),
  });

  const resetMutation = useMutation({
    mutationFn: adminResetHomepageSections,
    onSuccess: () => {
      toast.success('Ordem padrão restaurada');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao restaurar'),
  });

  function move(section: HomepageSection, dir: -1 | 1) {
    if (!sections) return;
    const sorted = [...sections].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((s) => s.id === section.id);
    const targetIdx = idx + dir;
    if (idx < 0 || targetIdx < 0 || targetIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[targetIdx];
    reorderMutation.mutate([
      { id: a.id, sort_order: b.sort_order },
      { id: b.id, sort_order: a.sort_order },
    ]);
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const ordered = (sections ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const activeCount = sortedActive.length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-semibold">Ordem das seções</h2>
          <p className="text-xs text-muted-foreground max-w-xl">
            Controle quais seções aparecem na homepage e em que ordem. As seções inativas
            simplesmente não são renderizadas. Caso a configuração falhe, a home volta à ordem padrão.
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Restaurar padrão
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restaurar ordem padrão?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso volta todas as seções para a ordem e visibilidade originais.
                Suas vitrines, cards e categorias não são afetados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => resetMutation.mutate()}>Restaurar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {activeCount <= 2 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Atenção: você tem apenas {activeCount} {activeCount === 1 ? 'seção ativa' : 'seções ativas'}.
            Desativar muitas seções pode deixar a homepage vazia.
          </span>
        </div>
      )}

      <div className="border rounded-lg divide-y">
        {ordered.map((s, idx) => {
          const sig = signals[s.section_key] ?? { hasContent: true };
          const showEmptyWarning = s.is_active && !sig.hasContent;
          return (
            <div key={s.id} className="p-3 flex items-center gap-3">
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => move(s, -1)}
                  disabled={idx === 0 || reorderMutation.isPending}
                  title="Mover para cima"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => move(s, 1)}
                  disabled={idx === ordered.length - 1 || reorderMutation.isPending}
                  title="Mover para baixo"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">{s.title}</span>
                  <Badge variant="outline" className="text-[10px] uppercase">{s.section_key}</Badge>
                  {showEmptyWarning && (
                    <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 gap-1">
                      <AlertTriangle className="w-3 h-3" /> Sem conteúdo
                    </Badge>
                  )}
                </div>
                {s.description && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{s.description}</p>
                )}
                {showEmptyWarning && sig.note && (
                  <p className="text-[11px] text-amber-700 mt-1">{sig.note}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-muted-foreground">{s.is_active ? 'Visível' : 'Oculta'}</span>
                <Switch
                  checked={s.is_active}
                  disabled={busyId === s.id}
                  onCheckedChange={(v) => toggleMutation.mutate({ id: s.id, is_active: v })}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="border rounded-lg p-4 bg-muted/30">
        <div className="text-xs font-semibold mb-2">Preview da ordem (apenas seções ativas)</div>
        {sortedActive.length === 0 ? (
          <div className="text-xs text-muted-foreground">Nenhuma seção ativa.</div>
        ) : (
          <ol className="text-xs text-foreground/90 space-y-1 list-decimal list-inside">
            {sortedActive.map((s) => (
              <li key={s.id}>{s.title}</li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
