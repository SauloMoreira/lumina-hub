import { useState } from 'react';
import { Loader2, Search, Sparkles, ImageIcon, AlertCircle, CheckCircle2, Wand2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { lookupBarcode, generateProductImage, type BarcodeLookupResult } from '@/server/barcodeLookup.functions';

interface Cat {
  id: string;
  name: string;
}

export interface BarcodeApplyChoice {
  fields: {
    name: boolean;
    brand: boolean;
    description: boolean;
    tags: boolean;
    seo_title: boolean;
    seo_description: boolean;
    seo_keywords: boolean;
    category_id?: string | null; // já resolvido para id (ou null)
  };
  images: string[]; // URLs externas selecionadas
  mode: 'fill_empty' | 'replace';
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Cat[];
  /** Snapshot dos campos atuais — para decidir o que está vazio */
  currentForm: {
    name: string;
    brand: string;
    description: string;
    tags: string;
    category_id: string;
    seo_title: string;
    seo_description: string;
    seo_keywords: string;
  };
  onApply: (choice: BarcodeApplyChoice, suggested: BarcodeLookupResult['suggested']) => void;
}

function matchCategoryId(hint: string | null, categories: Cat[]): string | null {
  if (!hint) return null;
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const h = norm(hint);
  // exato
  const exact = categories.find((c) => norm(c.name) === h);
  if (exact) return exact.id;
  // contém
  const partial = categories.find((c) => h.includes(norm(c.name)) || norm(c.name).includes(h));
  return partial?.id ?? null;
}

export function BarcodeLookupDialog({ open, onOpenChange, categories, currentForm, onApply }: Props) {
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BarcodeLookupResult | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [resolvedCategoryId, setResolvedCategoryId] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState('');
  const [imageChoice, setImageChoice] = useState<'pending' | 'ai' | 'manual'>('pending');
  const [generatingImage, setGeneratingImage] = useState(false);

  function addManualUrl() {
    const url = manualUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      toast.error('URL inválida. Deve começar com http:// ou https://');
      return;
    }
    setSelectedImages((prev) => new Set(prev).add(url));
    // também acrescenta na lista visível, se ainda não estiver
    setResult((prev) => {
      if (!prev || !prev.ok) return prev;
      if (prev.suggested.images.includes(url)) return prev;
      return { ...prev, suggested: { ...prev.suggested, images: [...prev.suggested.images, url] } };
    });
    setManualUrl('');
  }

  const reset = () => {
    setBarcode('');
    setResult(null);
    setSelectedImages(new Set());
    setResolvedCategoryId(null);
    setImageChoice('pending');
    setGeneratingImage(false);
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  async function search() {
    const code = barcode.replace(/\D+/g, '');
    if (code.length < 8 || code.length > 14) {
      toast.error('Código deve ter entre 8 e 14 dígitos.');
      return;
    }
    setLoading(true);
    setResult(null);
    setSelectedImages(new Set());
    setImageChoice('pending');
    try {
      const r = await lookupBarcode({
        data: { barcode: code, categoriesAvailable: categories.map((c) => c.name) },
      });
      setResult(r);
      if (r.ok) {
        setSelectedImages(new Set(r.suggested.images.slice(0, 6)));
        setResolvedCategoryId(matchCategoryId(r.suggested.categoryHint, categories));
        // Se já veio imagem da Cosmos, considera resolvido
        if (r.suggested.images.length > 0) setImageChoice('manual');
      } else if (r.error) {
        toast.error(r.error);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao buscar produto');
    } finally {
      setLoading(false);
    }
  }

  async function generateAiImage() {
    if (!result?.ok) return;
    const s = result.suggested;
    if (!s.name) {
      toast.error('Sem nome do produto para gerar imagem.');
      return;
    }
    setGeneratingImage(true);
    try {
      const { dataUrl } = await generateProductImage({
        data: { name: s.name, brand: s.brand, category: s.categoryHint },
      });
      setSelectedImages((prev) => new Set(prev).add(dataUrl));
      setResult((prev) => {
        if (!prev || !prev.ok) return prev;
        return { ...prev, suggested: { ...prev.suggested, images: [...prev.suggested.images, dataUrl] } };
      });
      setImageChoice('ai');
      toast.success('Imagem gerada com IA. Revise antes de aplicar.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao gerar imagem');
    } finally {
      setGeneratingImage(false);
    }
  }

  function toggleImage(url: string) {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  function apply(mode: 'fill_empty' | 'replace') {
    if (!result?.ok) return;
    const s = result.suggested;
    const fillEmpty = mode === 'fill_empty';
    const choice: BarcodeApplyChoice = {
      mode,
      images: Array.from(selectedImages),
      fields: {
        name: !!s.name && (!fillEmpty || !currentForm.name.trim()),
        brand: !!s.brand && (!fillEmpty || !currentForm.brand.trim()),
        description: !!s.description && (!fillEmpty || !currentForm.description.trim()),
        tags: s.tags.length > 0 && (!fillEmpty || !currentForm.tags.trim()),
        seo_title: !!s.seo_title && (!fillEmpty || !currentForm.seo_title.trim()),
        seo_description: !!s.seo_description && (!fillEmpty || !currentForm.seo_description.trim()),
        seo_keywords: !!s.seo_keywords && (!fillEmpty || !currentForm.seo_keywords.trim()),
        category_id:
          resolvedCategoryId && (!fillEmpty || !currentForm.category_id.trim()) ? resolvedCategoryId : undefined,
      },
    };
    onApply(choice, s);
    close();
  }

  const confidenceLabel =
    result?.confidence === 'high' ? 'Alta confiança' : result?.confidence === 'medium' ? 'Média confiança' : 'Baixa confiança';
  const confidenceColor =
    result?.confidence === 'high'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : result?.confidence === 'medium'
        ? 'bg-amber-100 text-amber-700 border-amber-200'
        : 'bg-muted text-muted-foreground border-border';

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Buscar produto por código de barras
          </DialogTitle>
          <DialogDescription>
            Informe o EAN/GTIN. Buscamos em base oficial de produtos e padronizamos com IA.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="barcode-input">EAN / GTIN</Label>
            <div className="flex gap-2">
              <Input
                id="barcode-input"
                inputMode="numeric"
                placeholder="Ex: 7891234567890"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    search();
                  }
                }}
                disabled={loading}
              />
              <Button type="button" onClick={search} disabled={loading || !barcode.trim()}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                Buscar produto
              </Button>
            </div>
          </div>

          {loading && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Buscando informações do produto…
            </div>
          )}

          {result && !result.ok && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-200">
                    {result.notFoundMessage ?? 'Não foi possível buscar o produto.'}
                  </p>
                  {result.error && <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">{result.error}</p>}
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                    Você pode continuar preenchendo manualmente.
                  </p>
                </div>
              </div>
            </div>
          )}

          {result?.ok && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${confidenceColor}`}>
                  {confidenceLabel}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded border border-border bg-muted text-muted-foreground font-medium">
                  Fonte: {result.source === 'cosmos+ai' ? 'Cosmos GTIN + IA' : result.source === 'cosmos' ? 'Cosmos GTIN' : 'IA'}
                </span>
                {result.suggested.referencePrice ? (
                  <span className="text-[11px] px-2 py-0.5 rounded border border-border bg-muted text-muted-foreground">
                    Preço de referência (mercado): R$ {result.suggested.referencePrice.toFixed(2)}
                  </span>
                ) : null}
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <Field label="Nome" value={result.suggested.name} />
                <Field label="Marca" value={result.suggested.brand} />
                <Field
                  label="Categoria sugerida"
                  value={result.suggested.categoryHint}
                  hint={resolvedCategoryId ? '✓ Categoria existente encontrada' : 'Sem categoria correspondente — selecione manualmente depois'}
                />
                <Field label="Tags" value={result.suggested.tags.join(', ') || null} />
              </div>
              <Field label="Descrição" value={result.suggested.description} multiline />
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <Field label="SEO Title" value={result.suggested.seo_title} />
                <Field label="SEO Description" value={result.suggested.seo_description} multiline />
              </div>
              <Field label="SEO Keywords" value={result.suggested.seo_keywords} />

              <div>
                <Label className="text-xs flex items-center gap-1.5 mb-2">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Imagens encontradas ({selectedImages.size}/{result.suggested.images.length} selecionadas)
                </Label>
                {result.imagesNote && result.suggested.images.length === 0 && (
                  <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200">
                    {result.imagesNote}
                  </div>
                )}
                {result.suggested.images.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {result.suggested.images.map((url) => {
                      const selected = selectedImages.has(url);
                      return (
                        <button
                          type="button"
                          key={url}
                          onClick={() => toggleImage(url)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition ${
                            selected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-muted-foreground/50'
                          }`}
                        >
                          <img
                            src={url}
                            alt="sugestão"
                            className="w-full h-full object-cover bg-surface"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.opacity = '0.3';
                            }}
                          />
                          {selected && (
                            <span className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                    Nenhuma imagem encontrada na base GTIN nem no fallback de busca. Você pode colar URLs de imagens manualmente abaixo, ou fazer upload depois pelo gerenciador de imagens do produto.
                  </div>
                )}

                {/* Adicionar URL manual */}
                <div className="mt-2 flex gap-2">
                  <Input
                    placeholder="Cole uma URL de imagem (https://...) e pressione Enter"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addManualUrl();
                      }
                    }}
                    className="text-xs h-8"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addManualUrl} disabled={!manualUrl.trim()}>
                    Adicionar
                  </Button>
                </div>

                <p className="text-[11px] text-muted-foreground mt-2">
                  As imagens selecionadas serão baixadas e adicionadas como pendentes. Você poderá otimizá-las antes de salvar.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                <strong className="text-foreground">Importante:</strong> preço de venda, custo interno e estoque
                <em> nunca</em> são preenchidos automaticamente. Você decide.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={close}>
            Cancelar
          </Button>
          {result?.ok && (
            <>
              <Button type="button" variant="outline" onClick={() => apply('fill_empty')}>
                Preencher apenas vazios
              </Button>
              <Button type="button" onClick={() => apply('replace')}>
                Substituir dados
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  multiline,
  hint,
}: {
  label: string;
  value: string | null;
  multiline?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div
        className={`rounded-md border border-border bg-background px-3 py-2 text-sm ${
          multiline ? 'whitespace-pre-wrap min-h-[60px]' : ''
        } ${!value ? 'text-muted-foreground italic' : ''}`}
      >
        {value || '(não encontrado)'}
      </div>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
