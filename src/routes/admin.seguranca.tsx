import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Shield, ShieldAlert, ShieldCheck, AlertTriangle, Activity,
  Webhook, KeyRound, Users, RefreshCw,
} from 'lucide-react';

import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getSecurityOverview } from '@/server/security.functions';

export const Route = createFileRoute('/admin/seguranca')({
  component: AdminSecurityPage,
});

function AdminSecurityPage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['security-overview'],
    queryFn: () => getSecurityOverview({ data: undefined as never }),
    refetchInterval: 60_000,
  });

  return (
    <AdminLayout
      title="Central de Segurança"
      action={
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      }
    >
      {isLoading || !data ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : (
        <div className="space-y-6 max-w-6xl">
          {/* KPIs */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi
              icon={<Webhook className="w-5 h-5" />}
              label="Webhooks (7d)"
              value={data.webhookStats.total}
              hint={`${data.webhookStats.processed} processados`}
              tone="default"
            />
            <Kpi
              icon={<ShieldAlert className="w-5 h-5" />}
              label="Assinaturas inválidas"
              value={data.webhookStats.invalidSignature}
              hint="MP webhook"
              tone={data.webhookStats.invalidSignature > 0 ? 'warn' : 'good'}
            />
            <Kpi
              icon={<Activity className="w-5 h-5" />}
              label="Eventos segurança (7d)"
              value={data.secStats.total}
              hint={`${data.secStats.bySeverity.error ?? 0} críticos`}
              tone={(data.secStats.bySeverity.error ?? 0) > 0 ? 'warn' : 'default'}
            />
            <Kpi
              icon={<AlertTriangle className="w-5 h-5" />}
              label="Rate limit (24h)"
              value={data.rlStats.total}
              hint="tentativas registradas"
              tone="default"
            />
          </div>

          {/* MFA admins */}
          <Card>
            <CardContent className="p-6">
              <SectionTitle icon={<KeyRound className="w-4 h-4" />} title="MFA dos administradores" />
              <p className="text-sm text-muted-foreground mb-4">
                Recomendado: todos os admins com MFA (TOTP) ativado. Ative em <code>/conta</code> &rsaquo; Segurança.
              </p>
              <div className="space-y-2">
                {data.adminMfa.length === 0 && (
                  <div className="text-sm text-muted-foreground">Nenhum admin encontrado.</div>
                )}
                {data.adminMfa.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <div className="font-medium text-sm">{a.name ?? a.email}</div>
                      <div className="text-xs text-muted-foreground">{a.email}</div>
                    </div>
                    {a.hasMfa ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 border-emerald-500/20">
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        MFA ativo ({a.factors})
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <ShieldAlert className="w-3 h-3 mr-1" />
                        Sem MFA
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Eventos de segurança */}
          <Card>
            <CardContent className="p-6">
              <SectionTitle icon={<Shield className="w-4 h-4" />} title="Eventos de segurança recentes" />
              {data.secRecent.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  Nenhum evento de segurança nos últimos 7 dias 🎉
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b">
                        <th className="py-2 pr-3">Quando</th>
                        <th className="py-2 pr-3">Tipo</th>
                        <th className="py-2 pr-3">Sev.</th>
                        <th className="py-2 pr-3">Identificador</th>
                        <th className="py-2">Mensagem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.secRecent.map((e) => (
                        <tr key={e.id} className="border-b last:border-0">
                          <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">
                            {fmt(e.created_at)}
                          </td>
                          <td className="py-2 pr-3 font-mono text-xs">{e.type}</td>
                          <td className="py-2 pr-3"><SeverityPill s={e.severity} /></td>
                          <td className="py-2 pr-3 text-xs truncate max-w-[200px]">{e.identifier ?? '—'}</td>
                          <td className="py-2 text-xs">{e.message ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Webhooks recentes */}
          <Card>
            <CardContent className="p-6">
              <SectionTitle icon={<Webhook className="w-4 h-4" />} title="Webhooks Mercado Pago" />
              {data.webhookRecent.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  Nenhum webhook nos últimos 7 dias.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b">
                        <th className="py-2 pr-3">Quando</th>
                        <th className="py-2 pr-3">Tipo</th>
                        <th className="py-2 pr-3">Live</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2">Erro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.webhookRecent.map((w) => (
                        <tr key={w.id} className="border-b last:border-0">
                          <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">
                            {fmt(w.created_at)}
                          </td>
                          <td className="py-2 pr-3 font-mono text-xs">{w.type ?? '—'}</td>
                          <td className="py-2 pr-3 text-xs">{w.live_mode ? 'sim' : 'não'}</td>
                          <td className="py-2 pr-3">
                            {w.processed ? (
                              <Badge variant="secondary" className="text-xs">processado</Badge>
                            ) : w.processing_error ? (
                              <Badge variant="destructive" className="text-xs">falha</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">pendente</Badge>
                            )}
                          </td>
                          <td className="py-2 text-xs text-destructive">{w.processing_error ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rate limit por ação */}
          <Card>
            <CardContent className="p-6">
              <SectionTitle icon={<Users className="w-4 h-4" />} title="Rate limit (últimas 24h)" />
              {Object.keys(data.rlStats.byAction).length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  Nenhuma tentativa registrada.
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(data.rlStats.byAction).map(([action, count]) => (
                    <div key={action} className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="text-sm font-medium">{action}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AdminLayout>
  );
}

function Kpi({
  icon, label, value, hint, tone,
}: {
  icon: React.ReactNode; label: string; value: number; hint?: string;
  tone?: 'default' | 'good' | 'warn';
}) {
  const toneClass =
    tone === 'good' ? 'text-emerald-600 bg-emerald-500/10'
    : tone === 'warn' ? 'text-amber-600 bg-amber-500/10'
    : 'text-primary bg-primary/10';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${toneClass}`}>
            {icon}
          </div>
        </div>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="font-semibold mb-3 flex items-center gap-2">
      <span className="text-primary">{icon}</span>
      {title}
    </h2>
  );
}

function SeverityPill({ s }: { s: string }) {
  const map: Record<string, string> = {
    error: 'bg-red-500/15 text-red-700 border-red-500/20',
    warn: 'bg-amber-500/15 text-amber-700 border-amber-500/20',
    info: 'bg-sky-500/15 text-sky-700 border-sky-500/20',
  };
  return (
    <Badge variant="outline" className={`text-[10px] uppercase ${map[s] ?? ''}`}>
      {s}
    </Badge>
  );
}

function fmt(d: string) {
  try {
    return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return d;
  }
}
