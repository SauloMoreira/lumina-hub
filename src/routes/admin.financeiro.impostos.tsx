import { createFileRoute, Link } from '@tanstack/react-router';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { FileText } from 'lucide-react';

export const Route = createFileRoute('/admin/financeiro/impostos')({
  component: ImpostosPage,
});

function ImpostosPage() {
  return (
    <AdminLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Impostos e dados fiscais</h1>
          <p className="text-muted-foreground">
            Prepare seus produtos e pedidos para emissão fiscal e futura integração com ERP ou
            emissor de NF-e.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 mt-0.5 text-muted-foreground" />
            <div className="space-y-2 text-sm">
              <p className="font-medium">Estrutura fiscal pronta. Tela completa em breve.</p>
              <p className="text-muted-foreground">
                A base de dados fiscais por produto (NCM, CEST, CFOP, origem, unidade, peso e
                dimensões) e os campos fiscais da empresa (regime tributário, série de NF-e,
                CFOPs padrão, ambiente) já estão ativos. Os contadores e alertas no Painel do
                Dia já refletem as pendências fiscais.
              </p>
              <p className="text-muted-foreground">
                A próxima entrega traz a tabela de produtos com filtros, edição rápida fiscal e
                exportação CSV.
              </p>
              <div className="pt-2 flex gap-3">
                <Link to="/admin/painel-do-dia" className="text-primary text-sm hover:underline">
                  Ver Painel do Dia
                </Link>
                <Link to="/admin/produtos" className="text-primary text-sm hover:underline">
                  Ir para produtos
                </Link>
              </div>
            </div>
          </div>
        </div>
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 mt-0.5 text-muted-foreground" />
            <div className="space-y-2 text-sm">
              <p className="font-medium">Estrutura fiscal pronta. Tela completa em breve.</p>
              <p className="text-muted-foreground">
                A base de dados fiscais por produto (NCM, CEST, CFOP, origem, unidade, peso e
                dimensões) e os campos fiscais da empresa (regime tributário, série de NF-e,
                CFOPs padrão, ambiente) já estão ativos. Os contadores e alertas no Painel do
                Dia já refletem as pendências fiscais.
              </p>
              <p className="text-muted-foreground">
                A próxima entrega traz a tabela de produtos com filtros, edição rápida fiscal e
                exportação CSV.
              </p>
              <div className="pt-2 flex gap-3">
                <Link
                  to="/admin/painel-do-dia"
                  className="text-primary text-sm hover:underline"
                >
                  Ver Painel do Dia
                </Link>
                <Link
                  to="/admin/produtos"
                  className="text-primary text-sm hover:underline"
                >
                  Ir para produtos
                </Link>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
