import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

export type IntegrationProvider =
  | 'ga4'
  | 'gtm'
  | 'meta_pixel'
  | 'tiktok_pixel'
  | 'clarity'
  | 'google_ads';

export type ConsentCategory = 'analytics' | 'marketing';

export interface MarketingIntegration {
  id: string;
  provider: IntegrationProvider;
  account_id: string;
  enabled: boolean;
  consent_category: ConsentCategory;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const PROVIDERS = ['ga4', 'gtm', 'meta_pixel', 'tiktok_pixel', 'clarity', 'google_ads'] as const;
const CATEGORIES = ['analytics', 'marketing'] as const;

// Validação por provider para evitar IDs malformados
const ID_PATTERNS: Record<IntegrationProvider, RegExp> = {
  ga4: /^G-[A-Z0-9]{6,}$/i,
  gtm: /^GTM-[A-Z0-9]{4,}$/i,
  meta_pixel: /^[0-9]{6,20}$/,
  tiktok_pixel: /^[A-Z0-9]{15,30}$/i,
  clarity: /^[a-z0-9]{6,20}$/i,
  google_ads: /^AW-[0-9]{6,}$/i,
};

function validateAccountId(provider: IntegrationProvider, accountId: string): string {
  const cleaned = accountId.trim();
  if (!cleaned) throw new Error('ID da conta é obrigatório');
  if (cleaned.length > 80) throw new Error('ID muito longo');
  const pattern = ID_PATTERNS[provider];
  if (!pattern.test(cleaned)) {
    throw new Error(`Formato de ID inválido para ${provider}`);
  }
  return cleaned;
}

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  provider: z.enum(PROVIDERS),
  account_id: z.string().min(1).max(80),
  enabled: z.boolean().default(true),
  consent_category: z.enum(CATEGORIES).default('analytics'),
  notes: z.string().max(500).nullable().optional(),
});

/** Lista pública de integrações ativas (consumida pelo ConditionalScripts no front da loja). */
export const listPublicIntegrations = createServerFn({ method: 'GET' }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from('marketing_integrations')
    .select('id, provider, account_id, consent_category')
    .eq('enabled', true);
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    provider: IntegrationProvider;
    account_id: string;
    consent_category: ConsentCategory;
  }>;
});

/** Lista completa para o admin. */
export const listIntegrations = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from('marketing_integrations')
      .select('*')
      .order('provider', { ascending: true });
    if (error) throw error;
    return (data ?? []) as MarketingIntegration[];
  });

export const upsertIntegration = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const account_id = validateAccountId(data.provider, data.account_id);

    const payload = {
      provider: data.provider,
      account_id,
      enabled: data.enabled,
      consent_category: data.consent_category,
      notes: data.notes ?? null,
    };

    if (data.id) {
      const { data: row, error } = await supabase
        .from('marketing_integrations')
        .update(payload)
        .eq('id', data.id)
        .select('*')
        .single();
      if (error) throw error;
      return row as MarketingIntegration;
    }

    const { data: row, error } = await supabase
      .from('marketing_integrations')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return row as MarketingIntegration;
  });

export const deleteIntegration = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from('marketing_integrations').delete().eq('id', data.id);
    if (error) throw error;
    return { ok: true };
  });
