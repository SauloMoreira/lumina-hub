import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { getPublicInstitutionalPage } from "@/server/institutional.functions";
import { SITE_URL, SITE_NAME } from "@/lib/seo";

const DESC_PAD =
  "Saiba mais sobre as políticas e informações institucionais da Led Maricá — material elétrico e iluminação LED em Maricá/RJ.";

function padDescription(value: string | null | undefined, fallback: string): string {
  const base = (value ?? "").trim() || fallback.trim();
  if (base.length >= 50) return base.slice(0, 160);
  return `${base} ${DESC_PAD}`.trim().slice(0, 160);
}

export const Route = createFileRoute("/institucional/$slug")({
  loader: async ({ params }) => {
    const { page } = await getPublicInstitutionalPage({ data: { slug: params.slug } });
    if (!page) throw notFound();
    return { page };
  },
  head: ({ params, loaderData }) => {
    const p = loaderData?.page;
    const canonical = `${SITE_URL}/institucional/${params.slug}`;
    if (!p) return { links: [{ rel: "canonical", href: canonical }] };
    const title = p.seo_title || p.title;
    const description = padDescription(p.seo_description || p.excerpt, p.title);
    const ogImage = `${SITE_URL}/og-default.png`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: canonical },
        { property: "og:type", content: "article" },
        { property: "og:image", content: ogImage },
        { property: "og:site_name", content: SITE_NAME },
        { property: "og:locale", content: "pt_BR" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: ogImage },
      ],
      links: [{ rel: "canonical", href: canonical }],
    };
  },
  pendingComponent: () => (
    <StoreLayout>
      <PageSkeleton />
    </StoreLayout>
  ),
  notFoundComponent: () => (
    <StoreLayout>
      <div className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-3xl font-bold mb-3">Página não encontrada</h1>
        <p className="text-muted-foreground mb-6">
          A página que você procura não existe ou foi removida.
        </p>
        <Link to="/" className="text-primary underline">
          Voltar para a loja
        </Link>
      </div>
    </StoreLayout>
  ),
  component: InstitutionalPage,
});

function InstitutionalPage() {
  const { page } = Route.useLoaderData();
  return (
    <StoreLayout>
      <article className="container mx-auto px-4 py-12 lg:py-16 max-w-3xl">
        <header className="mb-8">
          <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tight">
            {page.title}
          </h1>
          {page.excerpt && <p className="mt-3 text-muted-foreground">{page.excerpt}</p>}
        </header>
        <div
          className="prose prose-sm sm:prose-base max-w-none prose-headings:font-display prose-a:text-primary"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.content) }}
        />
      </article>
    </StoreLayout>
  );
}
