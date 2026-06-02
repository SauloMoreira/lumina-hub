// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// O projeto tem `src/server/*.functions.ts` importados por rotas/componentes (createServerFn).
// O TanStack reescreve esses imports como RPC no bundle do cliente, então é seguro excluí-los
// da regra padrão de import-protection que bloqueia `**/server/**`.
export default defineConfig({
  tanstackStart: {
    importProtection: {
      behavior: "error",
      client: {
        files: ["**/server/**"],
        excludeFiles: [
          "**/*.functions.ts",
          "**/*.functions.tsx",
          "**/node_modules/**",
        ],
        specifiers: ["server-only"],
      },
    },
  },
});
