
# Evolução de Kits/Combos — Plano

Hoje o módulo de combos (`product_bundles` / `product_bundle_items`) é puramente estrutural: agrupa produtos, sem desconto, sem preço próprio, sem regra B2B. A loja já tem `/combos` e `/combo/{slug}`, mas os kits não têm precificação real, nem distinção entre varejo/B2B.

Vou evoluir em 4 frentes (DB → server → admin → loja), preservando 100% dos kits existentes (todos viram tipo "combinado", sem desconto — comportamento atual).

---

## 1. Migration (compatível com kits atuais)

Adicionar em `product_bundles` (tudo nullable / com default seguro):

- `kit_type` text default `'combinado'` — `combinado` | `promocional` | `b2b` | `estrutural`
- `pricing_method` text default `'sum'` — `sum` | `percent_discount` | `fixed_discount` | `fixed_price` | `b2b_specific` | `b2b_inherit`
- `fixed_price` numeric null — preço fechado do kit (varejo)
- `discount_percent` numeric null — usado quando `pricing_method='percent_discount'` (substitui o `discount_percent` legado se já existir; reaproveitar coluna se houver)
- `discount_amount` numeric null — desconto fixo em R$
- `available_retail` boolean default true
- `available_b2b` boolean default false
- `b2b_pricing_method` text default `'inherit'` — `inherit` | `fixed_price` | `extra_discount`
- `b2b_fixed_price` numeric null
- `b2b_extra_discount_percent` numeric null
- `b2b_min_quantity` int default 1
- `accepts_coupon` boolean default true
- `stack_with_b2b` boolean default false

Backfill: nada a fazer — defaults preservam comportamento atual (`combinado` + `sum` = soma dos itens, sem desconto, só varejo).

Sem mexer em RLS (já existe admin_all + public_read das ativas).

## 2. Engine de preço (pure module + server)

Criar `src/lib/kitPricing.ts` (puro, testável, client-safe):

```ts
computeKitPrice({
  bundle, items, isB2bApproved
}): {
  retailSum, appliedPrice, discountAmount, discountPercent,
  unitApprox, savings, source: 'retail'|'b2b',
  blocked?: 'not_available_retail'|'not_available_b2b'|'below_min',
  marginWarning?: string
}
```

Regras:
- `combinado` + `sum` → preço = soma dos itens (atual).
- `promocional` aplica `pricing_method` (percent / fixed_discount / fixed_price).
- `b2b` aprovado: usa `b2b_pricing_method` (inherit = soma dos `b2b_price` dos componentes; fixed_price = `b2b_fixed_price`; extra_discount = aplica `% extra` sobre o preço do kit).
- Visitante / não aprovado: só vê preço varejo, e só se `available_retail=true`. Senão bloqueia.
- `unitApprox` = `appliedPrice / total_qty_componentes` (quando faz sentido — kit promocional com produto único ou >= 5 unid).
- `savings` = `retailSum - appliedPrice` quando > 0.

Adicionar wrapper server `src/server/kitPricing.functions.ts` com `getKitPricing({ bundleId })` que faz o cálculo no backend (fonte da verdade) usando o session do usuário p/ checar empresa aprovada (mesmo padrão do `b2bPricing`).

## 3. Estoque / venda

O fluxo atual de combo no carrinho já adiciona os produtos componentes (ver `cartBundleApply.server.ts`). Nada muda na baixa de estoque — continua descendo por componente, mantendo idempotência. Ao adicionar kit promocional ao carrinho, vamos:

1. Chamar `getKitPricing` no servidor.
2. Validar que `available_retail` ou `available_b2b` (conforme usuário) é verdadeiro.
3. Criar uma "linha de kit" no carrinho que internamente expande nos componentes (já existe esse padrão).
4. O preço do kit é aplicado como ajuste/desconto na linha — sem inventar tabela nova de pedido.

(Se o ajuste de carrinho exigir mudança maior, faço numa onda seguinte; nesta entrega o foco é cadastro + visualização correta + cálculo. Marco no código onde o ajuste de checkout precisa ser aplicado.)

## 4. Admin (`/admin/produtos/combos`)

No editor de kit, adicionar seções:
- **Tipo do kit** (radio: combinado / promocional / b2b / estrutural).
- **Disponibilidade** (switches varejo / B2B + qty mínima B2B).
- **Preço** (select de método + campos condicionais; mostra ao lado: soma dos itens, preço aplicado, economia, unitário aproximado, e — se houver `cost_price` em todos os componentes — margem estimada; se algum componente não tem custo, exibe alerta amarelo "Margem não calculada porque um ou mais produtos estão sem custo cadastrado." sem bloquear).
- **Preço B2B** (método + campos).
- **Cupons** (aceita cupom / acumula com B2B).
- Alerta vermelho se `appliedPrice < custoTotalEstimado` (não bloqueia).

Componentes/quantidades já existem.

## 5. Loja pública

- `ProductCard` de combo / página `/combo/{slug}` / showcase `/combos`:
  - Badge dinâmico: "Kit promocional" | "Compre junto" | "Preço empresa".
  - Mostrar preço aplicado, economia ("Você economiza R$ X"), preço unitário aproximado, riscado da soma dos itens.
  - CTA: "Comprar kit" (promocional) / "Adicionar kit" (combinado).
  - Para B2B: respeita aprovação (igual produto). Se não aprovado e `available_retail=false`, mostra "Disponível apenas para empresas".

## 6. Arquivos previstos

- `supabase/migration` — colunas novas em `product_bundles`.
- `src/lib/kitPricing.ts` — engine pura.
- `src/server/kitPricing.functions.ts` — RPC.
- `src/server/productBundles.functions.ts` — passar/persistir novos campos.
- `src/routes/admin.produtos.combos.tsx` — UI dos novos campos + painel de cálculo + alertas.
- `src/routes/combos.tsx` e `src/routes/combo.$slug.tsx` — exibir badge/preço/economia/CTA.
- (Se necessário) `src/components/store/ProductCard.tsx` ou novo `KitCard.tsx`.

## 7. Não mexo em

Mercado Pago, webhook, e-mails, CRM/leads, RLS de outras tabelas, homepage, performance crítica, pedidos confirmados.

## 8. Critérios de aceite cobertos

Todos os 12 itens são atendidos. Kits existentes ficam como `combinado` + `sum` (zero efeito visual).

---

**Próximo passo:** se aprovar, começo pela migration (vou pedir confirmação via tool de migração) e em seguida sigo com engine + admin + loja.
