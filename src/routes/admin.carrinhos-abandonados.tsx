import { createFileRoute, Link } from '@tanstack/react-router';
import { ShoppingCart, Sparkles, Clock, MessageSquareText } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/admin/carrinhos-abandonados')({
  component: CarrinhosAbandonadosPage,
});

function CarrinhosAbandonadosPage() {
  return (
    <AdminLayout title="Carrinhos abandonados">
      <div className="rounded-xl border border-border bg-card p-8 max-w-3xl">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <ShoppingCart className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
              Recuperação de carrinhos
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                Preparado para a próxima fase
              </span>
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Os carrinhos abandonados serão capturados automaticamente na próxima fase. Esta área já está
              preparada para acompanhar oportunidades de recuperação de vendas com botão direto para WhatsApp,
              filtros por valor e status, e marcação automática como recuperado quando o pedido é finalizado.
            </p>

            <div className="grid sm:grid-cols-3 gap-3 mt-6">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <Clock className="w-4 h-4 text-muted-foreground mb-2" />
                <div className="text-xs font-medium mb-0.5">Captura automática</div>
                <div className="text-xs text-muted-foreground">Carrinhos parados há mais de 60 minutos serão registrados aqui.</div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <MessageSquareText className="w-4 h-4 text-muted-foreground mb-2" />
                <div className="text-xs font-medium mb-0.5">Mensagem pronta</div>
                <div className="text-xs text-muted-foreground">Botão de WhatsApp já preenchido com modelo configurável.</div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <Sparkles className="w-4 h-4 text-muted-foreground mb-2" />
                <div className="text-xs font-medium mb-0.5">Recuperação contabilizada</div>
                <div className="text-xs text-muted-foreground">Ao virar pedido, o carrinho marca-se como recuperado.</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-border">
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/whatsapp-templates">Configurar modelo de WhatsApp</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/automacoes">Configurar automações</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
