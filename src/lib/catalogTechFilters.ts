/**
 * Mapeamento dos filtros técnicos do catálogo público.
 * Define quais filtros aparecem, como traduzir os search-params da URL
 * em payload para a RPC `search_products_public`, e os rótulos amigáveis.
 *
 * Fonte da verdade: tabela `product_attributes` com is_visible=true e
 * is_filterable=true.
 */

export type TechFilterKey = 'power' | 'color_temperature' | 'voltage' | 'ip_rating';

export type TechRangeOption = {
  /** id curto que vai pra URL — ex.: "0-20" */
  id: string;
  label: string;
  min?: number;
  max?: number;
};

export type TechValueOption = {
  /** id curto que vai pra URL — ex.: "127v" */
  id: string;
  label: string;
  /** Lista de valores aceitos no banco (apos normalização). */
  values: string[];
};

export type TechFilterDef =
  | {
      key: 'power';
      label: string;
      hint?: string;
      kind: 'range';
      options: TechRangeOption[];
    }
  | {
      key: Exclude<TechFilterKey, 'power'>;
      label: string;
      hint?: string;
      kind: 'value';
      options: TechValueOption[];
    };

export const POWER_OPTIONS: TechRangeOption[] = [
  { id: '0-20', label: 'Até 20W', min: 0, max: 20 },
  { id: '21-50', label: '21W a 50W', min: 21, max: 50 },
  { id: '51-100', label: '51W a 100W', min: 51, max: 100 },
  { id: '101-9999', label: 'Acima de 100W', min: 101, max: 99999 },
];

export const COLOR_TEMP_OPTIONS: TechValueOption[] = [
  { id: '3000k', label: '3000K — Luz quente', values: ['3000'] },
  { id: '4000k', label: '4000K — Luz neutra', values: ['4000'] },
  { id: '6500k', label: '6500K — Luz fria', values: ['6500', '6000'] },
];

export const VOLTAGE_OPTIONS: TechValueOption[] = [
  { id: '127v', label: '127V', values: ['127V', '110V'] },
  { id: '220v', label: '220V', values: ['220V', '240V'] },
  { id: 'bivolt', label: 'Bivolt', values: ['Bivolt'] },
];

export const IP_OPTIONS: TechValueOption[] = [
  { id: 'ip20', label: 'IP20 — Uso interno', values: ['IP20'] },
  { id: 'ip44', label: 'IP44 — Proteção moderada', values: ['IP44'] },
  { id: 'ip65', label: 'IP65 — Área externa', values: ['IP65'] },
  { id: 'ip66', label: 'IP66 — Área externa reforçada', values: ['IP66'] },
];

export const TECH_FILTERS: TechFilterDef[] = [
  {
    key: 'power',
    label: 'Potência',
    hint: 'Filtra por faixa de watts.',
    kind: 'range',
    options: POWER_OPTIONS,
  },
  {
    key: 'color_temperature',
    label: 'Temperatura de cor',
    hint: 'Cor da luz emitida.',
    kind: 'value',
    options: COLOR_TEMP_OPTIONS,
  },
  {
    key: 'voltage',
    label: 'Voltagem',
    hint: 'Tensão de operação.',
    kind: 'value',
    options: VOLTAGE_OPTIONS,
  },
  {
    key: 'ip_rating',
    label: 'Proteção IP',
    hint: 'Resistência a poeira e água.',
    kind: 'value',
    options: IP_OPTIONS,
  },
];

export type SelectedTechFilters = {
  power?: string[];          // ids dos ranges selecionados
  color_temperature?: string[];
  voltage?: string[];
  ip_rating?: string[];
};

export type AttrFilterPayload =
  | { key: string; values: string[] }
  | { key: string; min?: number; max?: number };

/**
 * Converte os ids selecionados em payloads para a RPC.
 * Múltiplas faixas de potência viram min/max separados.
 */
export function toAttrFilterPayload(sel: SelectedTechFilters): AttrFilterPayload[] {
  const out: AttrFilterPayload[] = [];

  // Potência: cada range vira um filtro independente; precisamos OR — então
  // mandamos como um único filtro com values vazios não funciona, mas a RPC
  // é AND entre filtros. Portanto, agrupamos potência em UM filtro com min/max
  // de envelope mínimo/máximo se houver múltiplos ranges. Para preservar a
  // semântica "ou 0-20 ou 51-100", convertemos em values[] discretos quando
  // possível — mas como potência é numérica contínua, optamos por apenas o
  // envelope (mais permissivo) quando múltiplos selecionados.
  const powerIds = sel.power ?? [];
  if (powerIds.length > 0) {
    const ranges = POWER_OPTIONS.filter((o) => powerIds.includes(o.id));
    if (ranges.length === 1) {
      const r = ranges[0];
      out.push({ key: 'power', min: r.min, max: r.max });
    } else if (ranges.length > 1) {
      // Envelope min/max do conjunto selecionado
      const min = Math.min(...ranges.map((r) => r.min ?? 0));
      const max = Math.max(...ranges.map((r) => r.max ?? 99999));
      out.push({ key: 'power', min, max });
    }
  }

  const valueGroups: Array<{ key: string; opts: TechValueOption[]; ids: string[] }> = [
    { key: 'color_temperature', opts: COLOR_TEMP_OPTIONS, ids: sel.color_temperature ?? [] },
    { key: 'voltage', opts: VOLTAGE_OPTIONS, ids: sel.voltage ?? [] },
    { key: 'ip_rating', opts: IP_OPTIONS, ids: sel.ip_rating ?? [] },
  ];

  for (const g of valueGroups) {
    if (g.ids.length === 0) continue;
    const values = g.opts
      .filter((o) => g.ids.includes(o.id))
      .flatMap((o) => o.values);
    if (values.length > 0) out.push({ key: g.key, values });
  }

  return out;
}

/** Parse de um search-param string (ex.: "127v,bivolt") em ids. */
export function parseFilterCsv(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 10);
}

export function joinFilterCsv(ids: string[]): string | undefined {
  return ids.length > 0 ? ids.join(',') : undefined;
}
