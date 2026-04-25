import { useState, type ChangeEvent, type DragEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload, Star, ArrowLeft, ArrowRight, X, Sparkles, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { generateImageSeo } from '@/server/imageSeo.functions';
import { pickUrl, variantUrl, type ProductImageRow } from '@/lib/productImages';

interface Props {
  productId: string;
  productName: string;
  brand?: string | null;
  category?: string | null;
}

const MAX_IMAGES = 10;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function ProductImageManager({ productId, productName, brand, category }: Props) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [optimizingId, setOptimizingId] = useState<string | null>(null);
  const [optimizingAll, setOptimizingAll] = useState(false);

  const { data: images = [], isLoading } = useQuery<ProductImageRow[]>({
    queryKey: ['product-images', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', productId)
        .order('is_primary', { ascending: false })
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProductImageRow[];
    },
    enabled: !!productId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['product-images', productId] });
  const unoptimizedCount = images.filter((i) => !i.optimized).length;

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (!files.length) return;
    if (images.length + files.length > MAX_IMAGES) {
      toast.error(`Máximo de ${MAX_IMAGES} imagens. Você tem ${images.length} e está enviando ${files.length}.`);
      return;
    }
    for (const f of files) {
      if (!f.type.startsWith('image/')) return toast.error(`"${f.name}" não é uma imagem`);
      if (f.size > MAX_FILE_BYTES) return toast.error(`"${f.name}" excede 10MB`);
    }
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${productId}/${Date.now()}-${i}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('product-images')
          .upload(path, f, { contentType: f.type, cacheControl: '31536000' });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path);
        const originalUrl = pub.publicUrl;
        const { error: dbErr } = await supabase.from('product_images').insert({
          product_id: productId,
          sort_order: images.length + i,
          original_url: originalUrl,
          original_size: f.size,
          original_format: ext,
          // URLs transformadas pelo CDN do Supabase Storage (sem processamento server-side)
          url_full: variantUrl(originalUrl, 'full'),
          url_card: variantUrl(originalUrl, 'card'),
          url_thumb: variantUrl(originalUrl, 'thumb'),
          url_og: variantUrl(originalUrl, 'og'),
          optimized: false, // marcado true após gerar SEO via IA
        });
        if (dbErr) throw dbErr;
      }
      toast.success(`${files.length} imagem(ns) enviada(s)`);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro no upload');
    } finally {
      setUploading(false);
    }
  }

  const setPrimary = useMutation({
    mutationFn: async (imageId: string) => {
      const { error } = await supabase.from('product_images').update({ is_primary: true }).eq('id', imageId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Imagem principal atualizada'); invalidate(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erro'),
  });

  const removeImage = useMutation({
    mutationFn: async (img: ProductImageRow) => {
      // Tenta apagar do storage (apenas o original; variantes são geradas on-the-fly)
      const idx = img.original_url.indexOf('/product-images/');
      if (idx >= 0) {
        const path = img.original_url.substring(idx + '/product-images/'.length).split('?')[0];
        await supabase.storage.from('product-images').remove([path]);
      }
      const { error } = await supabase.from('product_images').delete().eq('id', img.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Imagem removida'); invalidate(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erro'),
  });

  async function move(img: ProductImageRow, direction: 'up' | 'down') {
    const idx = images.findIndex((i) => i.id === img.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= images.length) return;
    const a = images[idx];
    const b = images[swapIdx];
    await Promise.all([
      supabase.from('product_images').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('product_images').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    invalidate();
  }

  async function optimizeOne(img: ProductImageRow) {
    setOptimizingId(img.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        toast.error('Sessão expirada. Faça login novamente.');
        return;
      }
      const seo = await generateImageSeo({
        data: {
          productName,
          brand: brand ?? null,
          category: category ?? null,
          index: img.sort_order,
          accessToken: token,
        },
      });
      if (!seo.ok) {
        toast.error(seo.error);
        return;
      }
      const { error } = await supabase
        .from('product_images')
        .update({
          // Garantir que as variantes do CDN estejam preenchidas
          url_full: img.url_full ?? variantUrl(img.original_url, 'full'),
          url_card: img.url_card ?? variantUrl(img.original_url, 'card'),
          url_thumb: img.url_thumb ?? variantUrl(img.original_url, 'thumb'),
          url_og: img.url_og ?? variantUrl(img.original_url, 'og'),
          alt_text: seo.alt,
          title_text: seo.title,
          caption: seo.caption,
          seo_filename: seo.filename,
          optimized: true,
        })
        .eq('id', img.id);
      if (error) throw error;
      toast.success('SEO da imagem gerado');
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setOptimizingId(null);
    }
  }

  async function optimizeAll() {
    const queue = images.filter((i) => !i.optimized);
    if (!queue.length) return;
    setOptimizingAll(true);
    for (const img of queue) {
      await optimizeOne(img);
    }
    setOptimizingAll(false);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files);
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Carregando imagens…</div>;
  }

  const primary = images.find((i) => i.is_primary);
  const others = images.filter((i) => !i.is_primary);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-semibold text-sm">Imagens do produto</h3>
          <p className="text-xs text-muted-foreground">{images.length}/{MAX_IMAGES} • A estrela define a principal</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {unoptimizedCount > 0 && (
            <Button type="button" size="sm" variant="secondary" onClick={optimizeAll} disabled={optimizingAll}>
              {optimizingAll ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
              SEO em todas ({unoptimizedCount})
            </Button>
          )}
          <label className={`inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium px-3 h-8 rounded-md border border-input bg-background hover:bg-accent ${images.length >= MAX_IMAGES ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Adicionar
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={uploading || images.length >= MAX_IMAGES}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>

      {images.length === 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-xl py-12 text-center transition ${dragOver ? 'border-primary bg-primary/5' : 'border-border bg-surface/30'}`}
        >
          <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">{uploading ? 'Enviando…' : 'Arraste imagens aqui ou use "Adicionar"'}</p>
          <p className="text-xs text-muted-foreground mt-1">JPG/PNG/WebP • até 10MB cada • até {MAX_IMAGES} imagens</p>
        </div>
      )}

      {primary && (
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" /> Imagem principal
          </div>
          <div className="grid sm:grid-cols-[160px_1fr] gap-3">
            <div className="aspect-square rounded-lg overflow-hidden border border-border bg-surface">
              <img src={pickUrl(primary, 'card') ?? primary.original_url} alt={primary.alt_text ?? productName} className="w-full h-full object-cover" />
            </div>
            <div className="text-xs space-y-1.5">
              <div className="flex flex-wrap gap-1.5">
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${primary.optimized ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {primary.optimized ? 'SEO ✓' : 'Sem SEO'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-yellow-100 text-yellow-700">Principal</span>
              </div>
              {primary.alt_text && <p><span className="text-muted-foreground">Alt:</span> {primary.alt_text}</p>}
              {primary.title_text && <p><span className="text-muted-foreground">Title:</span> {primary.title_text}</p>}
              {primary.seo_filename && <p className="text-muted-foreground">📁 {primary.seo_filename}</p>}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {!primary.optimized && (
                  <Button type="button" size="sm" variant="secondary" onClick={() => optimizeOne(primary)} disabled={optimizingId === primary.id}>
                    {optimizingId === primary.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                    Gerar SEO
                  </Button>
                )}
                <Button type="button" size="sm" variant="ghost" onClick={() => removeImage.mutate(primary)} className="text-destructive hover:text-destructive">
                  <X className="w-3 h-3 mr-1" /> Remover
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Imagens adicionais ({others.length})</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {others.map((img, i) => (
              <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-surface">
                <img src={pickUrl(img, 'thumb') ?? img.original_url} alt={img.alt_text ?? productName} className="w-full h-full object-cover" />
                <span className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold ${img.optimized ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                  {img.optimized ? 'SEO' : '·'}
                </span>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1 p-1">
                  <button type="button" onClick={() => setPrimary.mutate(img.id)} title="Tornar principal"
                    className="w-7 h-7 rounded bg-white/95 text-yellow-600 hover:bg-white flex items-center justify-center">
                    <Star className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => move(img, 'up')} disabled={i === 0} title="Mover para frente"
                      className="w-7 h-7 rounded bg-white/95 hover:bg-white disabled:opacity-30 flex items-center justify-center">
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => move(img, 'down')} disabled={i === others.length - 1} title="Mover para trás"
                      className="w-7 h-7 rounded bg-white/95 hover:bg-white disabled:opacity-30 flex items-center justify-center">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-1">
                    {!img.optimized && (
                      <button type="button" onClick={() => optimizeOne(img)} disabled={optimizingId === img.id} title="Gerar SEO"
                        className="w-7 h-7 rounded bg-white/95 text-primary hover:bg-white flex items-center justify-center">
                        {optimizingId === img.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <button type="button" onClick={() => removeImage.mutate(img)} title="Remover"
                      className="w-7 h-7 rounded bg-white/95 text-destructive hover:bg-white flex items-center justify-center">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {images.length > 0 && images.length < MAX_IMAGES && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`text-center text-xs py-3 border border-dashed rounded-lg transition ${dragOver ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'}`}
        >
          Arraste mais imagens aqui ({images.length}/{MAX_IMAGES})
        </div>
      )}
    </div>
  );
}
