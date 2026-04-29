import type { Database } from '@/integrations/supabase/types';

export type WhatsappTemplate = Database['public']['Tables']['whatsapp_templates']['Row'];

export type TemplateContext = {
  nome_cliente?: string | null;
  nome_empresa?: string | null;
  cnpj?: string | null;
  produto?: string | null;
  valor_carrinho?: string | number | null;
  link_carrinho?: string | null;
  numero_pedido?: string | number | null;
  status_pedido?: string | null;
  nome_loja?: string | null;
  whatsapp_loja?: string | null;
  [key: string]: string | number | null | undefined;
};

export const TEMPLATE_VARIABLES = [
  'nome_cliente',
  'nome_empresa',
  'cnpj',
  'produto',
  'valor_carrinho',
  'link_carrinho',
  'numero_pedido',
  'status_pedido',
  'nome_loja',
  'whatsapp_loja',
] as const;

export const TEMPLATE_VARIABLE_LABELS: Record<string, string> = {
  nome_cliente: 'Nome do cliente',
  nome_empresa: 'Nome da empresa',
  cnpj: 'CNPJ',
  produto: 'Produto',
  valor_carrinho: 'Valor do carrinho',
  link_carrinho: 'Link do carrinho',
  numero_pedido: 'Número do pedido',
  status_pedido: 'Status do pedido',
  nome_loja: 'Nome da loja',
  whatsapp_loja: 'WhatsApp da loja',
};

export const TEMPLATE_CATEGORIES = [
  { value: 'lead', label: 'Lead' },
  { value: 'carrinho', label: 'Carrinho' },
  { value: 'produto', label: 'Produto' },
  { value: 'pedido', label: 'Pedido' },
  { value: 'b2b', label: 'B2B' },
  { value: 'relacionamento', label: 'Relacionamento' },
  { value: 'geral', label: 'Geral' },
];

/** Substitui {{var}} pelos valores. Mantém placeholders desconhecidos. */
export function renderTemplate(body: string, ctx: TemplateContext): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const v = ctx[key];
    if (v === undefined || v === null || v === '') return `{{${key}}}`;
    return String(v);
  });
}

/** Lista variáveis encontradas no corpo. */
export function extractVariables(body: string): string[] {
  const out = new Set<string>();
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) out.add(m[1]);
  return Array.from(out);
}

function digitsOnly(v?: string | null) {
  return (v ?? '').replace(/\D+/g, '');
}

/** Monta URL do WhatsApp pronto para enviar. */
export function buildWhatsappUrl(
  phone: string | null | undefined,
  message: string,
): string | null {
  const d = digitsOnly(phone);
  if (!d || d.length < 10) return null;
  const withCountry = d.startsWith('55') ? d : `55${d}`;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}
