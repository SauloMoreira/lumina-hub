import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Healthcheck público — útil para monitor externo (UptimeRobot etc).
 * Não expõe dado sensível: só sinaliza se a app e o banco estão respondendo.
 */
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const startedAt = Date.now();
        let dbOk = false;
        try {
          const { error } = await supabaseAdmin
            .from("products")
            .select("id", { count: "exact", head: true })
            .limit(1);
          dbOk = !error;
        } catch {
          dbOk = false;
        }
        const latencyMs = Date.now() - startedAt;

        const body = {
          ok: dbOk,
          db: dbOk,
          latency_ms: latencyMs,
          timestamp: new Date().toISOString(),
        };

        return new Response(JSON.stringify(body), {
          status: dbOk ? 200 : 503,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
