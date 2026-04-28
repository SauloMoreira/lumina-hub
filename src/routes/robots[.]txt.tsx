import { createFileRoute } from '@tanstack/react-router';
import { SITE_URL } from '@/lib/seo';

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: async () => {
        const body = `User-agent: *
Allow: /

# Áreas privadas / sensíveis
Disallow: /admin
Disallow: /admin/
Disallow: /api/
Disallow: /conta
Disallow: /conta/
Disallow: /checkout
Disallow: /checkout/
Disallow: /carrinho
Disallow: /pedido/
Disallow: /login
Disallow: /cadastro
Disallow: /esqueci-senha

# Bots agressivos / scrapers — opcional, sem prejudicar Google/Bing
User-agent: GPTBot
Disallow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
        return new Response(body, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
          },
        });
      },
    },
  },
});
