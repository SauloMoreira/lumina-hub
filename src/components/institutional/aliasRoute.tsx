import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { getPublicInstitutionalPage } from "@/server/institutional.functions";
import { SITE_URL } from "@/lib/seo";

const DESC_PAD =
  "Saiba mais sobre as políticas e informações institucionais da Led Maricá — material elétrico e iluminação LED em Maricá/RJ.";

function padDescription(value: string | null | undefined, fallback: string): string {
  const base = (value ?? "").trim() || fallback.trim();
  if (base.length >= 50) return base.slice(0, 160);
  return `${base} ${DESC_PAD}`.trim().slice(0, 160);
}

export function makeInstitutionalAlias(slug: string, aliasPath?: string) {
  const canonical = `${SITE_URL}${aliasPath ?? `/${slug}`}`;
  return {
    loader: async () => {
      const { page } = await getPublicInstitutionalPage({ data: { slug } });
      if (!page) throw notFound();
      return { page };
    },
    head: ({
      loaderData,
    }: {
      loaderData?: {
        page: {
          title: string;
          seo_title: string | null;
          seo_description: string | null;
          excerpt: string | null;
        };
      };
    }) => {
      const p = loaderData?.page;
      if (!p) return { links: [{ rel: "canonical", href: canonical }] };
      const title = p.seo_title || p.title;
      const description = padDescription(p.seo_description || p.excerpt, p.title);
      return {
        meta: [
          { title },
          { name: "description", content: description },
          { property: "og:title", content: title },
          { property: "og:description", content: description },
          { property: "og:url", content: canonical },
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
          <Link to="/" className="text-primary underline">
            Voltar para a loja
          </Link>
        </div>
      </StoreLayout>
    ),
  };
}

export function InstitutionalAliasView({
  loaderData,
}: {
  loaderData: { page: { title: string; excerpt: string | null; content: string } };
}) {
  const { page } = loaderData;
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

// Bare route generators (createFileRoute is called per file because of the route literal)
