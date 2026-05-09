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
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Gerar imagem com IA — {kind === "bundle" ? "Kit" : "Produto"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 px-6 overflow-y-auto flex-1 min-h-0">
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
              <img src={dataUrl} alt="Pré-visualização" className="max-h-[40vh] w-auto object-contain block" />
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border h-48 flex items-center justify-center text-xs text-muted-foreground">
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

        <DialogFooter className="gap-2 sm:gap-2 px-6 pb-6 border-t pt-4 bg-background">
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
