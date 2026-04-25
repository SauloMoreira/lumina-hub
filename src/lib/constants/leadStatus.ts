export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: 'Novo',
  contacted: 'Contatado',
  qualified: 'Qualificado',
  proposal: 'Proposta enviada',
  won: 'Ganho',
  lost: 'Perdido',
};

export const LEAD_STATUS_OPTIONS = [
  { value: 'all', label: 'Todos os status' },
  { value: 'new', label: 'Novo' },
  { value: 'contacted', label: 'Contatado' },
  { value: 'qualified', label: 'Qualificado' },
  { value: 'proposal', label: 'Proposta enviada' },
  { value: 'won', label: 'Ganho' },
  { value: 'lost', label: 'Perdido' },
];

export const LEAD_ORIGIN_LABELS: Record<string, string> = {
  site: 'Site',
  chat: 'Chat IA',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  indicacao: 'Indicação',
  outro: 'Outro',
};

export const LEAD_INTERACTION_LABELS: Record<string, string> = {
  note: 'Anotação',
  call: 'Ligação',
  email: 'E-mail',
  whatsapp: 'WhatsApp',
  chat: 'Chat',
  meeting: 'Reunião',
};

export const leadStatusLabel = (s?: string | null) =>
  (s && LEAD_STATUS_LABELS[s]) || s || '—';

export const leadOriginLabel = (s?: string | null) =>
  (s && LEAD_ORIGIN_LABELS[s]) || s || '—';

export const leadInteractionLabel = (s?: string | null) =>
  (s && LEAD_INTERACTION_LABELS[s]) || s || '—';
