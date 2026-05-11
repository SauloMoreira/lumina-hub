/**
 * Engine de cotação de frete — server-only.
 * Usado tanto pelo `calculateShipping` (preview ao cliente) quanto pelo
 * `createOrder` (revalidação autoritativa do valor escolhido).
 *
 * Hoje é um STUB local determinístico baseado no DDD do CEP.
 * Quando integrarmos Melhor Envio, este módulo passa a chamar a API real e
 * o `createOrder` continua usando este mesmo helper para validar o `cost`
 * enviado pelo cliente — nenhum lugar do código deve confiar em valor de
 * frete vindo do client sem passar por aqui.
 */

export type ShippingService = {
  id: string;
  name: string;
  carrier: string;
  price: number;
  days: number;
};

export function quoteShippingServices(args: {
  zipCode: string;
  weightKg?: number;
  /** Subtotal somado APENAS dos itens elegíveis a frete grátis. */
  eligibleSubtotal?: number;
}): ShippingService[] {
  const zip = (args.zipCode || "").replace(/\D/g, "");
  if (!/^\d{8}$/.test(zip)) return [];

  const prefix = parseInt(zip.slice(0, 2), 10);
  let basePac = 22;
  let baseSedex = 38;
  let daysPac = 7;
  let daysSedex = 3;

  if (prefix >= 20 && prefix <= 28) {
    basePac = 14;
    baseSedex = 24;
    daysPac = 3;
    daysSedex = 1;
  } else if (prefix >= 1 && prefix <= 19) {
    basePac = 22;
    baseSedex = 36;
    daysPac = 5;
    daysSedex = 2;
  } else if (prefix >= 80 && prefix <= 99) {
    basePac = 32;
    baseSedex = 52;
    daysPac = 8;
    daysSedex = 4;
  } else if (prefix >= 40 && prefix <= 65) {
    basePac = 38;
    baseSedex = 64;
    daysPac = 10;
    daysSedex = 5;
  }

  const weightFactor = Math.max(1, args.weightKg ?? 1);
  const services: ShippingService[] = [
    {
      id: "pac",
      name: "PAC",
      carrier: "Correios",
      price: Number((basePac * weightFactor).toFixed(2)),
      days: daysPac,
    },
    {
      id: "sedex",
      name: "SEDEX",
      carrier: "Correios",
      price: Number((baseSedex * weightFactor).toFixed(2)),
      days: daysSedex,
    },
  ];

  const eligibleSubtotal = args.eligibleSubtotal ?? 0;
  if (prefix >= 24 && prefix <= 25 && eligibleSubtotal >= 199) {
    services.unshift({
      id: "local",
      name: "Entrega local Maricá",
      carrier: "Led Maricá",
      price: 0,
      days: 1,
    });
  }

  return services;
}

/**
 * Valida que o (carrier, service, cost) enviado pelo cliente corresponde a uma
 * cotação válida server-side. Tolerância de R$ 0,05 para arredondamento.
 *
 * Retorna `{ ok: true, service }` quando válido, ou `{ ok: false, reason }`
 * em caso de divergência. NUNCA confia no valor `cost` do client.
 */
export function validateChosenShipping(args: {
  zipCode: string;
  weightKg?: number;
  eligibleSubtotal?: number;
  chosen: { carrier?: string | null; service?: string | null; cost: number };
}): { ok: true; service: ShippingService } | { ok: false; reason: string } {
  const services = quoteShippingServices({
    zipCode: args.zipCode,
    weightKg: args.weightKg,
    eligibleSubtotal: args.eligibleSubtotal,
  });
  if (!services.length) return { ok: false, reason: "Sem opções de frete para este CEP." };

  const wantedName = (args.chosen.service ?? "").trim().toLowerCase();
  const wantedCarrier = (args.chosen.carrier ?? "").trim().toLowerCase();
  const candidates = services.filter((s) => {
    const matchService =
      !wantedName ||
      s.id.toLowerCase() === wantedName ||
      s.name.toLowerCase() === wantedName;
    const matchCarrier = !wantedCarrier || s.carrier.toLowerCase() === wantedCarrier;
    return matchService && matchCarrier;
  });
  const list = candidates.length ? candidates : services;

  // Match exato pelo preço (com tolerância) — bloqueia client tentando enviar 0.
  const match = list.find((s) => Math.abs(s.price - Number(args.chosen.cost ?? -1)) <= 0.05);
  if (!match) {
    return {
      ok: false,
      reason: `Valor de frete inválido para a opção selecionada. Recotize o frete e tente novamente.`,
    };
  }
  return { ok: true, service: match };
}
