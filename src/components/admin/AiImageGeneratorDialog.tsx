import { useState } from "react";
import { Sparkles, Loader2, X, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { generateProductImage } from "@/server/aiImage.functions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: "product" | "bundle";
  name: string;
  brand?: string | null;
  category?: string | null;
  attributes?: string | null;
  /** Recebe a data URL (base64) gerada e aprovada pelo admin. */
  onApply: (dataUrl: string) => Promise<void> | void;
}

export function AiImageGeneratorDialog({
  open,
  onOpenChange,
  kind,
  name,
  brand,
  category,
  attributes,
  onApply,
}: Props) {
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  async function generate() {
    if (!name?.trim()) {
      toast.error(
        kind === "bundle"
          ? "Defina o nome do kit antes de gerar."
          : "Preencha o nome do produto antes de gerar.",
      );
      return;
    }
    setLoading(true);
    try {
      const r = await generateProductImage({
        data: { kind, name, brand, category, attributes, hint: hint.trim() || null },
      });
      setDataUrl(r.dataUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar imagem");
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    if (!dataUrl) return;
    setApplying(true);
    try {
      await onApply(dataUrl);
      handleClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao aplicar imagem");
    } finally {
      setApplying(false);
    }
  }

  function handleClose() {
    setHint("");
    setDataUrl(null);
    setLoading(false);
    setApplying(false);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
        else onOpenChange(v);
      }}
    >
      <DialogContent className="left-2 right-2 top-2 bottom-2 h-auto w-auto max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden p-0 sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto sm:h-[min(90dvh,720px)] sm:w-[min(92vw,640px)] sm:max-w-[640px] sm:translate-x-[-50%] sm:translate-y-[-50%] flex flex-col">
        <DialogHeader className="shrink-0 px-4 pt-4 pr-12 sm:px-6 sm:pt-6">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Gerar imagem com IA — {kind === "bundle" ? "Kit" : "Produto"}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:space-y-4 sm:px-6">
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
            <div>
              <strong className="text-foreground">{kind === "bundle" ? "Kit" : "Produto"}:</strong>{" "}
              {name || "—"}
            </div>
            {brand && (
              <div>
                <strong className="text-foreground">Marca:</strong> {brand}
              </div>
            )}
            {category && (
              <div>
                <strong className="text-foreground">Categoria:</strong> {category}
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">Instruções extras (opcional)</Label>
            <Textarea
              rows={2}
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="Ex.: cor branca, vista frontal, base E27 visível…"
              disabled={loading || applying}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              A IA gera com fundo branco/estilo catálogo. Você revisa antes de salvar.
            </p>
          </div>

          {dataUrl ? (
            <div className="rounded-md border border-border overflow-hidden bg-muted flex items-center justify-center">
              <img src={dataUrl} alt="Pré-visualização" className="block max-h-[30dvh] w-auto object-contain sm:max-h-[36dvh]" />
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border h-32 sm:h-40 flex items-center justify-center text-xs text-muted-foreground">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando imagem…
                </span>
              ) : (
                "Nenhuma imagem gerada ainda."
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={generate}
              disabled={loading || applying}
              variant={dataUrl ? "outline" : "default"}
              className="flex-1 min-w-[10rem]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Gerando…
                </>
              ) : dataUrl ? (
                <>
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  Gerar outra
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  Gerar imagem
                </>
              )}
            </Button>
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:gap-2 border-t bg-background px-4 py-3 sm:px-6 sm:py-4">
          <Button variant="outline" onClick={handleClose} disabled={applying}>
            <X className="w-4 h-4 mr-1.5" />
            Cancelar
          </Button>
          <Button onClick={apply} disabled={!dataUrl || applying || loading}>
            {applying ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Adicionando…
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Usar esta imagem
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
