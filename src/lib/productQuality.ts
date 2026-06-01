/**
 * Score de qualidade de cadastro de produto (0-100).
 * Usado em /admin/produtos, /admin/produtos/$id, /admin/produtos/qualidade
 * e Painel do Dia. Apenas leitura — não altera regras de negócio.
 *
 * Distribuição:
 *   Mídia (20)        — imagem 15 + alt text 5
 *   Conteúdo (25)     — descrição 10 + tamanho 5 + specs 10
 *   SEO (20)          — title 7 + meta 7 + slug 3 + limites 3
 *   Fiscal/Custo (35) — NCM 8 + peso 5 + dimensões 7 + cost 10 + categoria 5
 *
 * Score < 70 não pode ser destacado (featured).
 */

export const QUALITY_FEATURED_MIN = 70;

export type QualityClass = "ruim" | "atencao" | "bom" | "excelente";

export type QualityIssueCode =
  | "no_image"
  | "no_alt_text"
  | "no_description"
  | "description_short"
  | "no_specs"
  | "no_seo_title"
  | "no_seo_description"
  | "no_slug"
  | "seo_limits"
  | "no_ncm"
  | "no_weight"
  | "no_dimensions"
  | "no_cost"
  | "no_category"
  // Atributos técnicos (Onda B). Não bloqueantes, peso leve.
  | "no_tech_attrs"
  | "no_tech_power"
  | "no_tech_voltage"
  | "no_tech_color_temp"
  | "no_tech_ip_rating"
  | "tech_attr_hidden"
  | "tech_attr_duplicate";

export interface QualityIssue {
  code: QualityIssueCode;
  group: "media" | "content" | "seo" | "fiscal" | "tech";
  label: string;
  hint: string;
  weight: number;
}

export interface QualityResult {
  score: number; // 0-100
  classification: QualityClass;
  issues: QualityIssue[];
  passed: QualityIssueCode[];
  groups: {
    media: { score: number; max: 20 };
    content: { score: number; max: 25 };
    seo: { score: number; max: 20 };
    fiscal: { score: number; max: 35 };
    tech: { score: number; max: 10 };
  };
  canBeFeatured: boolean;
  /** Resumo do cadastro técnico (para exibição no card). */
  techSummary: {
    total: number; // atributos com valor preenchido
    visible: number; // visíveis na loja
    filterable: number; // marcados como filtro
    ncm: string | null; // NCM detectado (8 dígitos) — coluna fiscal OU atributo
    ncmSource: "column" | "attribute" | null;
  };
}

/** Atributo técnico (subset de product_attributes) usado no cálculo de qualidade. */
export interface QualityAttributeInput {
  attribute_key?: string | null;
  attribute_label?: string | null;
  attribute_value?: string | null;
  attribute_unit?: string | null;
  is_visible?: boolean | null;
  is_filterable?: boolean | null;
}

export interface QualityProductInput {
  description?: string | null;
  specs?: Record<string, unknown> | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
  slug?: string | null;
  ncm?: string | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  width_cm?: number | null;
  length_cm?: number | null;
  cost_price?: number | null;
  category_id?: string | null;
  images?: string[] | null;
  product_images?: Array<{ alt_text?: string | null; original_url?: string | null }> | null;
  product_attributes?: QualityAttributeInput[] | null;
  name?: string | null;
  tags?: string[] | null;
}

/**
 * Normaliza um NCM aceitando "8539.52.00", "85395200", "8539 52 00" etc.
 * Retorna a string só com dígitos quando válida (8 dígitos), ou null.
 */
export function normalizeNcm(raw: unknown): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D+/g, "");
  return digits.length === 8 ? digits : null;
}

// Mapeia chave/label de atributo para um "slot" canônico (heurísticas de iluminação).
const ATTR_SLOT_MAP: Record<
  string,
  "power" | "voltage" | "color_temperature" | "ip_rating" | "ncm"
> = {
  power: "power",
  potencia: "power",
  potencia_w: "power",
  watts: "power",
  voltage: "voltage",
  tensao: "voltage",
  tensao_v: "voltage",
  voltagem: "voltage",
  bivolt: "voltage",
  color_temperature: "color_temperature",
  temperatura_cor: "color_temperature",
  temperatura_cor_k: "color_temperature",
  cct: "color_temperature",
  ip_rating: "ip_rating",
  ip: "ip_rating",
  grau_protecao: "ip_rating",
  grau_protecao_ip: "ip_rating",
  protecao_ip: "ip_rating",
  ncm: "ncm",
};

function normalizeAttrKey(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[\s\-/]+/g, "_");
}

function attrSlot(a: QualityAttributeInput): string | null {
  const k = normalizeAttrKey(a.attribute_key);
  if (ATTR_SLOT_MAP[k]) return ATTR_SLOT_MAP[k];
  const l = normalizeAttrKey(a.attribute_label);
  if (ATTR_SLOT_MAP[l]) return ATTR_SLOT_MAP[l];
  return null;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEO_TITLE_MIN = 30;
const SEO_TITLE_MAX = 65;
const SEO_DESC_MIN = 80;
const SEO_DESC_MAX = 160;
const DESCRIPTION_MIN = 120;

function classify(score: number): QualityClass {
  if (score >= 91) return "excelente";
  if (score >= 71) return "bom";
  if (score >= 41) return "atencao";
  return "ruim";
}

export function computeProductQuality(p: QualityProductInput): QualityResult {
  const issues: QualityIssue[] = [];
  const passed: QualityIssueCode[] = [];
  let media = 0,
    content = 0,
    seo = 0,
    fiscal = 0;

  // ----- MÍDIA (20) -----
  const imgs = (p.product_images ?? []).filter((i) => !!i?.original_url);
  const legacyImgs = (p.images ?? []).filter(Boolean);
  const hasImage = imgs.length > 0 || legacyImgs.length > 0;
  if (hasImage) {
    media += 15;
    passed.push("no_image");
  } else
    issues.push({
      code: "no_image",
      group: "media",
      weight: 15,
      label: "Sem imagem principal",
      hint: "Adicione ao menos uma imagem do produto.",
    });

  const altOk = imgs.length > 0 ? imgs.every((i) => (i.alt_text ?? "").trim().length > 0) : false;
  if (altOk) {
    media += 5;
    passed.push("no_alt_text");
  } else if (hasImage)
    issues.push({
      code: "no_alt_text",
      group: "media",
      weight: 5,
      label: "Imagens sem texto alternativo",
      hint: 'Preencha o "alt" das imagens para SEO e acessibilidade.',
    });

  // ----- CONTEÚDO (25) -----
  const desc = (p.description ?? "").trim();
  if (desc.length > 0) {
    content += 10;
    passed.push("no_description");
  } else
    issues.push({
      code: "no_description",
      group: "content",
      weight: 10,
      label: "Sem descrição",
      hint: "Descreva o produto, suas vantagens e aplicações.",
    });

  if (desc.length >= DESCRIPTION_MIN) {
    content += 5;
    passed.push("description_short");
  } else if (desc.length > 0)
    issues.push({
      code: "description_short",
      group: "content",
      weight: 5,
      label: "Descrição muito curta",
      hint: `Use ao menos ${DESCRIPTION_MIN} caracteres para melhorar o SEO.`,
    });

  const specsCount = p.specs && typeof p.specs === "object" ? Object.keys(p.specs).length : 0;
  if (specsCount >= 2) {
    content += 10;
    passed.push("no_specs");
  } else
    issues.push({
      code: "no_specs",
      group: "content",
      weight: 10,
      label: "Sem especificações técnicas",
      hint: "Adicione ao menos 2 specs (potência, voltagem, dimensões etc.).",
    });

  // ----- SEO (20) -----
  const seoTitle = (p.seo_title ?? "").trim();
  const seoDesc = (p.seo_description ?? "").trim();
  const slug = (p.slug ?? "").trim();

  if (seoTitle.length > 0) {
    seo += 7;
    passed.push("no_seo_title");
  } else
    issues.push({
      code: "no_seo_title",
      group: "seo",
      weight: 7,
      label: "Sem título SEO",
      hint: "Preencha um título SEO entre 30 e 65 caracteres.",
    });

  if (seoDesc.length > 0) {
    seo += 7;
    passed.push("no_seo_description");
  } else
    issues.push({
      code: "no_seo_description",
      group: "seo",
      weight: 7,
      label: "Sem meta description",
      hint: "Preencha uma meta description entre 80 e 160 caracteres.",
    });

  if (slug.length > 0 && SLUG_RE.test(slug)) {
    seo += 3;
    passed.push("no_slug");
  } else
    issues.push({
      code: "no_slug",
      group: "seo",
      weight: 3,
      label: "Slug ausente ou inválido",
      hint: "Use apenas letras minúsculas, números e hífens.",
    });

  const titleOk = seoTitle.length >= SEO_TITLE_MIN && seoTitle.length <= SEO_TITLE_MAX;
  const descOk = seoDesc.length >= SEO_DESC_MIN && seoDesc.length <= SEO_DESC_MAX;
  if (titleOk && descOk) {
    seo += 3;
    passed.push("seo_limits");
  } else if (seoTitle.length > 0 || seoDesc.length > 0) {
    issues.push({
      code: "seo_limits",
      group: "seo",
      weight: 3,
      label: "SEO fora dos limites recomendados",
      hint: `Título: ${SEO_TITLE_MIN}-${SEO_TITLE_MAX} caracteres. Meta: ${SEO_DESC_MIN}-${SEO_DESC_MAX} caracteres.`,
    });
  }

  // ----- FISCAL/LOGÍSTICA + CUSTO (35) -----
  // NCM pode vir como coluna fiscal estruturada OU como atributo técnico
  // (chave/label "ncm"). Aceitar ambos os formatos (com ou sem pontos).
  const ncmFromColumn = normalizeNcm(p.ncm);
  let ncmFromAttribute: string | null = null;
  if (!ncmFromColumn) {
    for (const a of p.product_attributes ?? []) {
      if (attrSlot(a) === "ncm") {
        const candidate = normalizeNcm(a.attribute_value);
        if (candidate) {
          ncmFromAttribute = candidate;
          break;
        }
      }
    }
  }
  const ncmDetected = ncmFromColumn ?? ncmFromAttribute;
  if (ncmDetected) {
    fiscal += 8;
    passed.push("no_ncm");
  } else
    issues.push({
      code: "no_ncm",
      group: "fiscal",
      weight: 8,
      label: "NCM não informado",
      hint: "Campo recomendado para organização fiscal, mas não bloqueia a venda — a emissão fiscal é feita fora da plataforma.",
    });

  if (typeof p.weight_kg === "number" && p.weight_kg > 0) {
    fiscal += 5;
    passed.push("no_weight");
  } else
    issues.push({
      code: "no_weight",
      group: "fiscal",
      weight: 5,
      label: "Sem peso",
      hint: "Informe o peso em kg para cálculo correto de frete.",
    });

  const hasDims = [p.height_cm, p.width_cm, p.length_cm].every(
    (v) => typeof v === "number" && v! > 0,
  );
  if (hasDims) {
    fiscal += 7;
    passed.push("no_dimensions");
  } else
    issues.push({
      code: "no_dimensions",
      group: "fiscal",
      weight: 7,
      label: "Sem dimensões completas",
      hint: "Preencha altura, largura e comprimento em cm.",
    });

  if (typeof p.cost_price === "number" && p.cost_price > 0) {
    fiscal += 10;
    passed.push("no_cost");
  } else
    issues.push({
      code: "no_cost",
      group: "fiscal",
      weight: 10,
      label: "Sem custo cadastrado",
      hint: "Informe o custo (uso interno) para calcular margem.",
    });

  if (p.category_id && p.category_id.length > 0) {
    fiscal += 5;
    passed.push("no_category");
  } else
    issues.push({
      code: "no_category",
      group: "fiscal",
      weight: 5,
      label: "Sem categoria",
      hint: "Vincule o produto a uma categoria.",
    });

  // ----- ATRIBUTOS TÉCNICOS (10, bônus aditivo) -----
  // Modelo intencionalmente leve: a ausência de atributos NÃO derruba o score
  // (apenas não soma os 10 pts extras). Assim produtos antigos sem cadastro
  // técnico não são penalizados retroativamente.
  const techAttrs = (p.product_attributes ?? []).filter(
    (a) => a && (a.attribute_value ?? "").toString().trim().length > 0,
  );
  const visibleAttrs = techAttrs.filter((a) => a.is_visible !== false);
  const filterableAttrs = techAttrs.filter((a) => a.is_filterable === true);
  const keysSeen = new Map<string, number>();
  for (const a of techAttrs) {
    const k = normalizeAttrKey(a.attribute_key);
    if (k) keysSeen.set(k, (keysSeen.get(k) ?? 0) + 1);
  }
  // Aceita variações PT-BR e legadas em inglês via attrSlot().
  const hasSlot = (slot: string) => techAttrs.some((a) => attrSlot(a) === slot);

  const ctx = `${(p.name ?? "").toString()} ${(p.tags ?? []).join(" ")}`.toLowerCase();
  // Heurística simples para inferir contexto (sem mexer em RPC ou DB).
  const looksLightingProduct =
    /led|lampada|lâmpada|refletor|holofote|painel|plafon|spot|luminaria|lumin[áa]ria|fita\s*led|bulbo/.test(
      ctx,
    );
  const looksOutdoor =
    /externo|outdoor|jardim|piscina|fachada|poste|garagem|área externa|area externa/.test(ctx);

  let tech = 0;
  if (visibleAttrs.length >= 1) {
    tech += 3;
    passed.push("no_tech_attrs");
  } else {
    issues.push({
      code: "no_tech_attrs",
      group: "tech",
      weight: 3,
      label: "Sem atributos técnicos",
      hint: "Adicione atributos técnicos para melhorar a ficha do produto e facilitar a busca.",
    });
  }

  if (looksLightingProduct) {
    if (hasSlot("power")) {
      tech += 2;
      passed.push("no_tech_power");
    } else
      issues.push({
        code: "no_tech_power",
        group: "tech",
        weight: 2,
        label: "Sem potência (W)",
        hint: "Produtos de iluminação devem informar a potência em watts.",
      });

    if (hasSlot("voltage")) {
      tech += 2;
      passed.push("no_tech_voltage");
    } else
      issues.push({
        code: "no_tech_voltage",
        group: "tech",
        weight: 2,
        label: "Sem voltagem",
        hint: "Informe 127V, 220V ou Bivolt.",
      });

    if (hasSlot("color_temperature")) {
      tech += 2;
      passed.push("no_tech_color_temp");
    } else
      issues.push({
        code: "no_tech_color_temp",
        group: "tech",
        weight: 2,
        label: "Sem temperatura de cor",
        hint: "Use 3000K (quente), 4000K (neutra) ou 6500K (fria).",
      });
  }

  if (looksOutdoor) {
    if (hasSlot("ip_rating")) {
      tech += 1;
      passed.push("no_tech_ip_rating");
    } else
      issues.push({
        code: "no_tech_ip_rating",
        group: "tech",
        weight: 1,
        label: "Sem proteção IP",
        hint: "Produtos de uso externo devem informar a proteção IP (ex.: IP65, IP66).",
      });
  }

  // Avisos qualitativos (não somam pontos)
  if (techAttrs.length > 0 && visibleAttrs.length === 0) {
    issues.push({
      code: "tech_attr_hidden",
      group: "tech",
      weight: 0,
      label: "Atributos técnicos invisíveis",
      hint: "Todos os atributos cadastrados estão ocultos. Marque ao menos um como visível para aparecer na ficha.",
    });
  }
  for (const [, count] of keysSeen) {
    if (count > 1) {
      issues.push({
        code: "tech_attr_duplicate",
        group: "tech",
        weight: 0,
        label: "Atributos duplicados",
        hint: "Existem atributos com a mesma chave. Consolide os duplicados.",
      });
      break;
    }
  }

  tech = Math.min(10, tech);

  const baseScore = media + content + seo + fiscal;
  const score = Math.max(0, Math.min(100, baseScore + tech));
  return {
    score,
    classification: classify(score),
    issues,
    passed,
    groups: {
      media: { score: media, max: 20 },
      content: { score: content, max: 25 },
      seo: { score: seo, max: 20 },
      fiscal: { score: fiscal, max: 35 },
      tech: { score: tech, max: 10 },
    },
    canBeFeatured: score >= QUALITY_FEATURED_MIN,
  };
}

export function qualityClassLabel(c: QualityClass): string {
  switch (c) {
    case "excelente":
      return "Excelente";
    case "bom":
      return "Bom";
    case "atencao":
      return "Atenção";
    case "ruim":
      return "Ruim";
  }
}

export function qualityClassColor(c: QualityClass): { bg: string; text: string; ring: string } {
  switch (c) {
    case "excelente":
      return {
        bg: "bg-emerald-500/10",
        text: "text-emerald-700 dark:text-emerald-400",
        ring: "ring-emerald-500/30",
      };
    case "bom":
      return {
        bg: "bg-sky-500/10",
        text: "text-sky-700 dark:text-sky-400",
        ring: "ring-sky-500/30",
      };
    case "atencao":
      return {
        bg: "bg-amber-500/10",
        text: "text-amber-700 dark:text-amber-400",
        ring: "ring-amber-500/30",
      };
    case "ruim":
      return {
        bg: "bg-red-500/10",
        text: "text-red-700 dark:text-red-400",
        ring: "ring-red-500/30",
      };
  }
}

export const QUALITY_FEATURED_BLOCK_MESSAGE =
  "Este produto ainda não possui qualidade suficiente para destaque. Corrija imagem, descrição, SEO, custo, fiscal ou logística antes de colocá-lo em uma vitrine premium.";
