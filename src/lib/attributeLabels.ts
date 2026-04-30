/**
 * Lookup helpers para rótulos amigáveis de atributos técnicos.
 * Engine pura — sem I/O. Recebe a lista de rótulos já carregada.
 */

export type AttributeLabelLite = {
  attribute_key: string;
  raw_value: string;
  display_label: string;
  helper_text?: string | null;
};

export type LabelLookup = {
  find: (attributeKey: string, rawValue: string) => AttributeLabelLite | undefined;
};

export function buildLabelLookup(rows: AttributeLabelLite[] | null | undefined): LabelLookup {
  const map = new Map<string, AttributeLabelLite>();
  for (const r of rows ?? []) {
    if (!r?.attribute_key || !r?.raw_value) continue;
    map.set(`${r.attribute_key.toLowerCase()}::${r.raw_value.toLowerCase()}`, r);
  }
  return {
    find(attributeKey: string, rawValue: string) {
      if (!attributeKey || rawValue == null) return undefined;
      return map.get(`${attributeKey.toLowerCase()}::${String(rawValue).toLowerCase()}`);
    },
  };
}
