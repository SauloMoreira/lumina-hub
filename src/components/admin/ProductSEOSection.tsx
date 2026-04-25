import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { improveProductSeo } from '@/server/seo.functions';
import { toast } from 'sonner';

interface Props {
  productCtx: { name: string; description: string; brand?: string; category?: string; price: number };
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  slug: string;
  onChange: (field: 'seo_title' | 'seo_description' | 'seo_keywords', value: string) => void;
}

export function ProductSEOSection({ productCtx, seoTitle, seoDescription, seoKeywords, slug, onChange }: Props) {
  const [loading, setLoading] = useState(false);

  async function improve() {
    if (!productCtx.name.trim()) {
      toast.error('Preencha o nome do produto antes de gerar o SEO.');
      return;
    }
    setLoading(true);
    try {
      const r = await improveProductSeo({
        data: {
          name: productCtx.name,
          description: productCtx.description || null,
          brand: productCtx.brand || null,
          category: productCtx.category || null,
          price: Number.isFinite(productCtx.price) ? productCtx.price : null,
        },
      });
      if (!r.ok) {
        toast.error(r.error);
      } else {
        onChange('seo_title', r.title);
        onChange('seo_description', r.description);
        onChange('seo_keywords', r.keywords);
        toast.success('SEO gerado com IA');
      }
    } finally {
      setLoading(false);
    }
  }

  const titleLen = seoTitle.length;
  const descLen = seoDescription.length;

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
            Otimização de SEO
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Campos para o Google. Se em branco, usamos o nome e a descrição do produto.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={improve} disabled={loading} className="shrink-0 border-primary/40 text-primary hover:bg-primary-tint hover:text-primary">
          {loading ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Gerando…</> : <><Sparkles className="w-3.5 h-3.5 mr-1.5" />Melhorar com IA</>}
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Título SEO</Label>
        <Input value={seoTitle} maxLength={70} onChange={(e) => onChange('seo_title', e.target.value)} placeholder={`Ex: ${productCtx.name || 'Lâmpada LED 9W'} — Melhor preço | Led Maricá`} />
        <div className={`text-[10px] text-right ${titleLen > 60 ? 'text-destructive' : 'text-muted-foreground'}`}>{titleLen}/60 caracteres</div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Descrição SEO</Label>
        <Textarea rows={3} value={seoDescription} maxLength={200} onChange={(e) => onChange('seo_description', e.target.value)} placeholder="Ex: Compre Lâmpada LED 9W com entrega rápida em Maricá/RJ. Economia de até 80% de energia. Frete grátis acima de R$199." />
        <div className={`text-[10px] text-right ${descLen > 160 ? 'text-destructive' : 'text-muted-foreground'}`}>{descLen}/160 caracteres</div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Palavras-chave <span className="text-muted-foreground">(separadas por vírgula)</span></Label>
        <Input value={seoKeywords} onChange={(e) => onChange('seo_keywords', e.target.value)} placeholder="lâmpada led 9w, led bivolt, led e27, iluminação led maricá" />
      </div>

      {(seoTitle || seoDescription) && (
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Preview no Google</div>
          <div className="text-[15px] text-[#1a0dab] leading-snug">{seoTitle || `${productCtx.name} | Led Maricá`}</div>
          <div className="text-[12px] text-[#006621] mt-0.5">ledmarica.com.br/produto/{slug || 'produto'}</div>
          <div className="text-[12.5px] text-[#545454] leading-snug mt-1">{seoDescription || productCtx.description?.slice(0, 160) || 'Sem descrição'}</div>
        </div>
      )}
    </div>
  );
}
