import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle, CheckCircle2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  generateProductCopy,
  type ProductCopyResult,
} from "@/server/productCopy.functions";

interface ProductSnapshot {
  name: string;
  brand?: string | null;
  category?: string | null;
  sku?: string | null;
  description?: string | null;
  tags?: string[] | null;
  barcode?: string | null;
  ncm?: string | null;
  attributes?: Record<string, unknown> | null;
  price?: number | null;
  stock?: number | null;
  imageAlts?: string[] | null;
}

export interface ProductCopyApply {
  description?: string;
  shortDescription?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  tags?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: ProductSnapshot;
  onApply: (patch: ProductCopyApply) => void;
}

export function ProductAiAssistantDialog({ open, onOpenChange, product, onApply }: Props) {
  const [loading, setLoading] = useState(false);
  const [s, setS] = useState<ProductCopyResult | null>(null);

  async function generate() {
    if (!product.name?.trim()) {
      toast.error("Preencha o nome do produto antes de gerar.");
      return;
    }
    setLoading(true);
    setS(null);
    try {
      const r = await generateProductCopy({
        data: {
          name: product.name,
          brand: product.brand ?? null,
          category: product.category ?? null,
          sku: product.sku ?? null,
          description: product.description ?? null,
          tags: product.tags ?? null,
          barcode: product.barcode ?? null,
          ncm: product.ncm ?? null,
          attributes: product.attributes ?? null,
          price: product.price ?? null,
          stock: product.stock ?? null,
          imageAlts: product.imageAlts ?? null,
        },
      });
      if (!r.ok) {
        toast.error(r.error);
      } else {
        setS(r.suggestion);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar sugestões");
    } finally {
      setLoading(false);
    }
  }

  function applyDescription() {
    if (!s) return;
    onApply({ description: s.descricao_longa });
    toast.success("Descrição aplicada");
  }
  function applyShort() {
    if (!s) return;
    onApply({ shortDescription: s.descricao_curta });
    toast.success("Descrição curta aplicada");
  }
  function applySeo() {
    if (!s) return;
    onApply({
      seoTitle: s.titulo_seo,
      seoDescription: s.meta_description,
      seoKeywords: [...s.palavras_chave_principais, ...s.palavras_chave_secundarias].join(", "),
    });
    toast.success("SEO aplicado");
  }
  function applyTags() {
    if (!s) return;
    onApply({ tags: s.tags_sugeridas.join(", ") });
    toast.success("Tags aplicadas");
  }
  function applyAll() {
    if (!s) return;
    onApply({
      description: s.descricao_longa,
      shortDescription: s.descricao_curta,
      seoTitle: s.titulo_seo,
      seoDescription: s.meta_description,
      seoKeywords: [...s.palavras_chave_principais, ...s.palavras_chave_secundarias].join(", "),
      tags: s.tags_sugeridas.join(", "),
    });
    toast.success("Todas as sugestões aplicadas");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Otimizar com IA — {product.name || "Produto"}
          </DialogTitle>
        </DialogHeader>

        {!s && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              A IA vai gerar descrição comercial, SEO, tags, alt text e FAQ usando os dados do produto.
              Nada é salvo automaticamente — você revisa e escolhe o que aplicar.
            </p>
            <Button onClick={generate} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando sugestões…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Gerar sugestões
                </>
              )}
            </Button>
          </div>
        )}

        {s && (
          <div className="space-y-5 py-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Confiança da IA:</span>
                <span
                  className={
                    s.confianca === "alta"
                      ? "text-emerald-600 font-medium"
                      : s.confianca === "media"
                        ? "text-amber-600 font-medium"
                        : "text-destructive font-medium"
                  }
                >
                  {s.confianca}
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Gerar de novo"}
              </Button>
            </div>

            {s.pontos_de_atencao.length > 0 && (
              <div className="rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-3">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-sm font-medium mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  Pontos de atenção
                </div>
                <ul className="list-disc pl-5 text-sm text-amber-900 dark:text-amber-100 space-y-0.5">
                  {s.pontos_de_atencao.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}

            <Section title="Descrição longa" onApply={applyDescription}>
              <Textarea rows={8} value={s.descricao_longa} readOnly />
            </Section>

            <Section title="Descrição curta (vitrine)" onApply={applyShort}>
              <Textarea rows={3} value={s.descricao_curta} readOnly />
            </Section>

            <Section title="SEO" onApply={applySeo}>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Título SEO ({s.titulo_seo.length}/60)</Label>
                  <Input value={s.titulo_seo} readOnly />
                </div>
                <div>
                  <Label className="text-xs">Meta description ({s.meta_description.length}/160)</Label>
                  <Textarea rows={2} value={s.meta_description} readOnly />
                </div>
                <div>
                  <Label className="text-xs">Palavras-chave principais</Label>
                  <Chips items={s.palavras_chave_principais} />
                </div>
                {s.palavras_chave_secundarias.length > 0 && (
                  <div>
                    <Label className="text-xs">Palavras-chave secundárias</Label>
                    <Chips items={s.palavras_chave_secundarias} muted />
                  </div>
                )}
              </div>
            </Section>

            {s.tags_sugeridas.length > 0 && (
              <Section title="Tags sugeridas" onApply={applyTags}>
                <Chips items={s.tags_sugeridas} />
              </Section>
            )}

            <Section title="Alt text para imagem principal">
              <Input
                value={s.alt_text_imagem}
                readOnly
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Copie e cole no campo de alt text das imagens.
              </p>
            </Section>

            {s.faq.length > 0 && (
              <Section title="FAQ sugerido">
                <div className="space-y-2">
                  {s.faq.map((f, i) => (
                    <div key={i} className="rounded-md border border-border p-2 text-sm">
                      <div className="font-medium">{f.pergunta}</div>
                      <div className="text-muted-foreground">{f.resposta}</div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {s.fontes_consultadas.length > 0 && (
              <div className="text-[11px] text-muted-foreground">
                Fontes/observações: {s.fontes_consultadas.join(" • ")}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-1.5" />
            Fechar
          </Button>
          {s && (
            <Button onClick={applyAll}>
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Aplicar tudo
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  onApply,
  children,
}: {
  title: string;
  onApply?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {onApply && (
          <Button size="sm" variant="outline" onClick={onApply}>
            Aplicar
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

function Chips({ items, muted }: { items: string[]; muted?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {items.map((t, i) => (
        <span
          key={i}
          className={
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs " +
            (muted
              ? "bg-muted text-muted-foreground"
              : "bg-primary-tint text-primary border border-primary/20")
          }
        >
          {t}
        </span>
      ))}
    </div>
  );
}
