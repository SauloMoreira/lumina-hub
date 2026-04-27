import { createFileRoute, notFound, Link } from '@tanstack/react-router';
import { StoreLayout } from '@/components/layout/StoreLayout';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import { sanitizeHtml } from '@/lib/sanitizeHtml';
import { getPublicInstitutionalPage } from '@/server/institutional.functions';

export function makeInstitutionalAlias(slug: string) {
  return {
    loader: async () => {
      const { page } = await getPublicInstitutionalPage({ data: { slug } });
      if (!page) throw notFound();
      return { page };
    },
    head: ({ loaderData }: { loaderData?: { page: { title: string; seo_title: string | null; seo_description: string | null; excerpt: string | null } } }) => {
      const p = loaderData?.page;
      if (!p) return {};
      return {
        meta: [
          { title: p.seo_title || p.title },
          { name: 'description', content: p.seo_description || p.excerpt || p.title },
          { property: 'og:title', content: p.seo_title || p.title },
          { property: 'og:description', content: p.seo_description || p.excerpt || p.title },
        ],
      };
    },
    pendingComponent: () => <StoreLayout><PageSkeleton /></StoreLayout>,
    notFoundComponent: () => (
      <StoreLayout>
        <div className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-3xl font-bold mb-3">Página não encontrada</h1>
          <Link to="/" className="text-primary underline">Voltar para a loja</Link>
        </div>
      </StoreLayout>
    ),
  };
}

export function InstitutionalAliasView({ loaderData }: { loaderData: { page: { title: string; excerpt: string | null; content: string } } }) {
  const { page } = loaderData;
  return (
    <StoreLayout>
      <article className="container mx-auto px-4 py-12 lg:py-16 max-w-3xl">
        <header className="mb-8">
          <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tight">{page.title}</h1>
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
