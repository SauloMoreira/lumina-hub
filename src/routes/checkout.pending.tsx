import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { Clock, ArrowRight } from "lucide-react";
import { z } from "zod";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Button } from "@/components/ui/button";
import { buildSeo } from "@/lib/seo";

const searchSchema = z.object({
  order_id: z.string().uuid().optional(),
  payment_id: z.string().optional(),
  status: z.string().optional(),
});

export const Route = createFileRoute("/checkout/pending")({
  head: () => buildSeo({ title: "Pagamento pendente", url: "/checkout/pending", noindex: true }),
  validateSearch: (s) => searchSchema.parse(s),
  component: PendingPage,
});

function PendingPage() {
  const { order_id } = useSearch({ from: "/checkout/pending" });
  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-12 max-w-xl text-center">
        <div className="w-16 h-16 rounded-full bg-warning/15 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-9 h-9 text-warning" />
        </div>
        <h1 className="font-display font-bold text-3xl mb-2">Pagamento em análise</h1>
        <p className="text-muted-foreground mb-2">
          Seu pagamento está em processamento. Isso é normal para boleto, Pix com aprovação manual
          ou análise antifraude. Assim que for aprovado, atualizaremos o status do seu pedido
          automaticamente.
        </p>
        <p className="text-xs text-muted-foreground mb-6">
          Enviamos as atualizações do pedido para o seu e-mail cadastrado.
        </p>
        <div className="flex gap-3 justify-center">
          {order_id && (
            <Button asChild className="h-11">
              <Link to="/pedido/$id/confirmacao" params={{ id: order_id }}>
                Acompanhar pedido <ArrowRight className="w-4 h-4 ml-1.5" />
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" className="h-11">
            <Link to="/catalogo">Continuar comprando</Link>
          </Button>
        </div>
      </div>
    </StoreLayout>
  );
}
