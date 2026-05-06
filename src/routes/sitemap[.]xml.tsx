import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SITE_URL } from "@/lib/seo";

type SitemapRoute = { url: string; priority: string; changefreq: string; lastmod?: string };

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const escape = (s: string) =>
          s
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");

        const staticRoutes: SitemapRoute[] = [
          { url: "/", priority: "1.0", changefreq: "daily" },
          { url: "/catalogo", priority: "0.9", changefreq: "daily" },
        ];

        let productRoutes: SitemapRoute[] = [];
        let categoryRoutes: SitemapRoute[] = [];
        let institutionalRoutes: SitemapRoute[] = [];

        try {
          const [{ data: products }, { data: categories }, { data: institutional }] =
            await Promise.all([
              supabaseAdmin
                .from("products")
                .select("slug, updated_at")
                .eq("active", true)
                .limit(5000),
              supabaseAdmin.from("categories").select("slug").eq("active", true).limit(500),
              supabaseAdmin
                .from("institutional_pages")
                .select("slug, updated_at")
                .not("published_at", "is", null)
                .limit(200),
            ]);

          productRoutes = (products ?? []).map((p) => ({
            url: `/produto/${p.slug}`,
            priority: "0.8",
            changefreq: "weekly",
            lastmod: p.updated_at?.split("T")[0],
          }));

          categoryRoutes = (categories ?? []).map((c) => ({
            url: `/catalogo?cat=${encodeURIComponent(c.slug)}`,
            priority: "0.7",
            changefreq: "weekly",
          }));

          institutionalRoutes = (institutional ?? []).map((p) => ({
            url: `/institucional/${p.slug}`,
            priority: "0.5",
            changefreq: "monthly",
            lastmod: p.updated_at?.split("T")[0],
          }));
        } catch (e) {
          console.error("sitemap: failed to load db rows", e);
        }

        const all = [...staticRoutes, ...categoryRoutes, ...institutionalRoutes, ...productRoutes];

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all
  .map(
    (r) => `  <url>
    <loc>${escape(SITE_URL + r.url)}</loc>${r.lastmod ? `\n    <lastmod>${r.lastmod}</lastmod>` : ""}
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=600, s-maxage=3600",
          },
        });
      },
    },
  },
});
