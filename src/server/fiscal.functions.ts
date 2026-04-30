import { createServerFn } from '@tanstack/react-start';
import { requireAdmin } from '@/integrations/supabase/admin-middleware';

/**
 * Server functions de leitura para a área Financeiro & Fiscal > Impostos.
 * A tela completa virá na sub-onda 4b. Por enquanto exportamos apenas o
 * resumo de pendências, que já é consumido pela sidebar e pelo Painel do Dia.
 */

export const getFiscalQuickCounts = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .handler(async () => {
    const { fetchFiscalQuickCounts } = await import('./fiscalInsights.server');
    return fetchFiscalQuickCounts();
  });
