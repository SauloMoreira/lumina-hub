import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Loader2, AlertTriangle, CheckCircle2, ExternalLink, MapPin, Search, RefreshCw, Globe, FileText, Tags, Home as HomeIcon } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { getSeoInsights, type SeoInsights, type SeoSeverity, type SeoIssue } from '@/server/seoInsights.functions';

export const Route = createFileRoute('/admin/seo')({
  component: SeoPage,
  head: () => ({ meta: [{ title: 'SEO Insights | Admin' }] }),
});

function severityColor(sev: SeoSeverity): string {
  if (sev === 'danger') return 'bg-destructive/10 text-destructive border-destructive/30';
  if (sev === 'warn') return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30';
  return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-destructive';
  return (
    <div className="flex items-center gap-2 w-full max-w-[140px]">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs tabular-nums w-8 text-right">{score}</span>
    </div>
  );
}

function IssueList({ issues }: { issues: SeoIssue[] }) {
  if (issues.length === 0) {
    return (
      <span className="text-xs text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3" /> Tudo certo
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      {issues.map((i) => (
        <Badge key={i.code} variant="outline" className={`text-[10px] ${severityColor(i.severity)}`}>
          {i.label}
        </Badge>
      ))}
    </div>
  );
}

function SeoPage() {
  const [data, setData] = useState<SeoInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await getSeoInsights();
      setData(res);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  if (loading || !data) {
    return (
      <AdminLayout title="SEO Insights">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  const s = data.summary;
  const f = filter.trim().toLowerCase();
  const filteredProducts = f
    ? data.products.filter((p) => p.name.toLowerCase().includes(f) || p.slug.toLowerCase().includes(f))
    : data.products;
  const filteredCategories = f
    ? data.categories.filter((c) => c.name.toLowerCase().includes(f))
    : data.categories;
  const filteredPages = f
    ? data.pages.filter((p) => p.title.toLowerCase().includes(f) || p.slug.toLowerCase().includes(f))
    : data.pages;

  return (
    <AdminLayout
      title="SEO Insights"
      action={
        <Button onClick={() => void load()} size="sm" variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" /> Reanalisar
        </Button>
      }
    >
      <div className="space-y-6 p-4 md:p-6">
        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="pb-2"><CardDescription>Score médio (produtos)</CardDescription></CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{s.averageProductScore}</div>
              <Progress value={s.averageProductScore} className="mt-2 h-1.5" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Score da Homepage</CardDescription></CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{s.homepageScore}</div>
              <Progress value={s.homepageScore} className="mt-2 h-1.5" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Produtos críticos</CardDescription></CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">{s.productsCritical}</div>
              <p className="text-xs text-muted-foreground">de {s.productsTotal} ativos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Páginas com problemas</CardDescription></CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{s.pagesWithIssues}</div>
              <p className="text-xs text-muted-foreground">de {s.pagesTotal}</p>
            </CardContent>
          </Card>
        </div>

        {/* SEO Local Maricá */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="w-4 h-4 text-primary" /> SEO Local — Maricá / RJ
            </CardTitle>
            <CardDescription>
              Sinais que ajudam clientes da região a encontrar a loja em buscas locais.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <LocalCheck label='"Maricá" no título da home' ok={data.local.hasMaricaInTitle} />
              <LocalCheck label='"Maricá" na meta description' ok={data.local.hasMaricaInDescription} />
              <LocalCheck label="Bairros de entrega cadastrados" ok={data.local.hasLocalDeliveryZones} />
              <LocalCheck label="Endereço da empresa preenchido" ok={data.local.hasCompanyAddress} />
              <LocalCheck label="Dados estruturados (geo) na home" ok={data.local.hasGeoStructuredData} />
            </div>
            {data.local.notes.length > 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                <strong className="text-amber-700 dark:text-amber-400 block mb-1">Recomendações</strong>
                <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                  {data.local.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filtro */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filtrar por nome ou slug…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9"
          />
        </div>

        <Tabs defaultValue="produtos" className="w-full">
          <TabsList className="w-full justify-start flex-wrap h-auto">
            <TabsTrigger value="produtos">
              Produtos <Badge variant="secondary" className="ml-2">{s.productsWithIssues}/{s.productsTotal}</Badge>
            </TabsTrigger>
            <TabsTrigger value="categorias">
              <Tags className="w-3.5 h-3.5 mr-1" />
              Categorias <Badge variant="secondary" className="ml-2">{s.categoriesWithIssues}/{s.categoriesTotal}</Badge>
            </TabsTrigger>
            <TabsTrigger value="paginas">
              <FileText className="w-3.5 h-3.5 mr-1" />
              Páginas <Badge variant="secondary" className="ml-2">{s.pagesWithIssues}/{s.pagesTotal}</Badge>
            </TabsTrigger>
            <TabsTrigger value="homepage">
              <HomeIcon className="w-3.5 h-3.5 mr-1" />
              Homepage
            </TabsTrigger>
          </TabsList>

          {/* Produtos */}
          <TabsContent value="produtos" className="mt-4">
            <Card>
              <CardContent className="pt-4 space-y-2">
                {filteredProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum produto encontrado.</p>
                ) : (
                  filteredProducts.slice(0, 100).map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-sm truncate">{p.name}</span>
                          <Badge variant="outline" className={`text-[10px] ${severityColor(p.severity)}`}>
                            {p.severity === 'ok' ? 'OK' : p.severity === 'warn' ? 'Atenção' : 'Crítico'}
                          </Badge>
                        </div>
                        <IssueList issues={p.issues} />
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <ScoreBar score={p.score} />
                        <Link to="/admin/produtos/$id" params={{ id: p.id }}>
                          <Button size="sm" variant="ghost"><ExternalLink className="w-3.5 h-3.5" /></Button>
                        </Link>
                      </div>
                    </div>
                  ))
                )}
                {filteredProducts.length > 100 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    Mostrando 100 de {filteredProducts.length}. Use o filtro para refinar.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Categorias */}
          <TabsContent value="categorias" className="mt-4">
            <Card>
              <CardContent className="pt-4 space-y-2">
                {filteredCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhuma categoria.</p>
                ) : (
                  filteredCategories.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{c.name}</span>
                          <Badge variant="outline" className={`text-[10px] ${severityColor(c.severity)}`}>
                            {c.severity === 'ok' ? 'OK' : c.severity === 'warn' ? 'Atenção' : 'Crítico'}
                          </Badge>
                        </div>
                        <IssueList issues={c.issues} />
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <ScoreBar score={c.score} />
                        <Link to="/admin/categorias">
                          <Button size="sm" variant="ghost"><ExternalLink className="w-3.5 h-3.5" /></Button>
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Páginas */}
          <TabsContent value="paginas" className="mt-4">
            <Card>
              <CardContent className="pt-4 space-y-2">
                {filteredPages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhuma página institucional.</p>
                ) : (
                  filteredPages.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-sm truncate">{p.title}</span>
                          <code className="text-[11px] text-muted-foreground">/{p.slug}</code>
                          <Badge variant="outline" className={`text-[10px] ${severityColor(p.severity)}`}>
                            {p.severity === 'ok' ? 'OK' : p.severity === 'warn' ? 'Atenção' : 'Crítico'}
                          </Badge>
                        </div>
                        <IssueList issues={p.issues} />
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <ScoreBar score={p.score} />
                        <Link to="/admin/institutional-pages/$id" params={{ id: p.id }}>
                          <Button size="sm" variant="ghost"><ExternalLink className="w-3.5 h-3.5" /></Button>
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Homepage */}
          <TabsContent value="homepage" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" /> Homepage
                  </CardTitle>
                  <Link to="/admin/conteudo/homepage">
                    <Button size="sm" variant="outline">Editar homepage</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <ScoreBar score={s.homepageScore} />
                </div>
                <IssueList issues={s.homepageIssues} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground text-center">
          Análise baseada em campos cadastrados — não realiza crawling externo. Atualizada em{' '}
          {new Date(data.generatedAt).toLocaleString('pt-BR')}.
        </p>
      </div>
    </AdminLayout>
  );
}

function LocalCheck({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      ) : (
        <AlertTriangle className="w-4 h-4 text-amber-500" />
      )}
      <span className={ok ? '' : 'text-muted-foreground'}>{label}</span>
    </div>
  );
}
