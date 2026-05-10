import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Mail, Pencil, ScrollText } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listEmailTemplates } from "@/server/emailTemplates.functions";

export const Route = createFileRoute("/admin/comunicacao/emails/")({
  component: EmailTemplatesListPage,
});

type Row = {
  id: string;
  type: string;
  display_name: string;
  subject: string | null;
  is_active: boolean;
  auto_send: boolean;
  allow_manual_resend: boolean;
  updated_at: string;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EmailTemplatesListPage() {
  const fetchList = useServerFn(listEmailTemplates);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchList({ data: undefined as never })
      .then((r) => {
        if (r.ok) setRows(r.templates as Row[]);
        else setError(r.error);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro"));
  }, [fetchList]);

  return (
    <AdminLayout title="Modelos de e-mail transacional">
      <p className="text-sm text-muted-foreground mb-4">
        Edite assunto, textos e CTA dos e-mails enviados ao cliente. O layout e blocos visuais permanecem padronizados.
      </p>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Mail className="w-4 h-4" /> {rows?.length ?? 0} modelos
        </div>
        <Button asChild variant="outline" size="sm">
          <Link
            to={"/admin/seguranca/auditoria" as any}
            search={{ resourceType: "email_template" } as any}
          >
            <ScrollText className="w-4 h-4 mr-1" /> Histórico de alterações
          </Link>
        </Button>
      </div>

      {error && (
        <div className="text-sm text-destructive mb-3">Erro ao carregar: {error}</div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Modelo</TableHead>
              <TableHead>Chave técnica</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Envio automático</TableHead>
              <TableHead>Reenvio manual</TableHead>
              <TableHead>Atualizado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rows ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.display_name}</TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">{r.type}</TableCell>
                <TableCell>
                  <Badge variant={r.is_active ? "default" : "secondary"}>
                    {r.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={r.auto_send ? "default" : "outline"}>
                    {r.auto_send ? "Sim" : "Não"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={r.allow_manual_resend ? "default" : "outline"}>
                    {r.allow_manual_resend ? "Sim" : "Não"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmt(r.updated_at)}</TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to={"/admin/comunicacao/emails/$type" as any}
                      params={{ type: r.type } as any}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhum modelo cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
}
