import { createFileRoute } from '@tanstack/react-router';
import { SITE_URL } from '@/lib/seo';

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: async () => {
        const body = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /conta
Disallow: /conta/
Disallow: /checkout
Disallow: /carrinho
Disallow: /pedido/

Sitemap: ${SITE_URL}/sitemap.xml
`;
        return new Response(body, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      },
    },
  },
});
