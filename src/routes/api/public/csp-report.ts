import { createFileRoute } from "@tanstack/react-router";
import { logSecurityEvent } from "@/server/security/rateLimit";

/**
 * Endpoint para receber CSP violation reports.
 * O navegador envia POST com Content-Type: application/csp-report ou application/reports+json.
 * Mantemos report-only por enquanto — apenas registramos.
 */
export const Route = createFileRoute("/api/public/csp-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const text = await request.text();
          let parsed: unknown = null;
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = { raw: text.slice(0, 4000) };
          }

          // Reports-API envia array; CSP clássico envia { "csp-report": {...} }
          const body = parsed as { "csp-report"?: Record<string, unknown> } | unknown[];
          const report = Array.isArray(body)
            ? body[0]
            : body && typeof body === "object" && "csp-report" in body
              ? body["csp-report"]
              : body;

          const r = (report ?? {}) as Record<string, unknown>;
          const violatedDirective =
            (r["violated-directive"] as string | undefined) ??
            (r["effectiveDirective"] as string | undefined) ??
            "unknown";
          const blockedUri =
            (r["blocked-uri"] as string | undefined) ??
            (r["blockedURL"] as string | undefined) ??
            null;
          const documentUri =
            (r["document-uri"] as string | undefined) ??
            (r["documentURL"] as string | undefined) ??
            null;

          await logSecurityEvent({
            type: "csp_violation",
            severity: "info",
            identifier: documentUri ?? null,
            message: `${violatedDirective} blocked ${blockedUri ?? "(unknown uri)"}`,
            metadata: r,
          });
        } catch (e) {
          console.error("[csp-report] error", e);
        }
        return new Response(null, { status: 204 });
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }),
    },
  },
});
