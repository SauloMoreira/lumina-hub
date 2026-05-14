# Relatório de Limpeza Final (v2 — vitrine zerada) — Entrega ao Cliente

- **Data:** 14/maio/2026
- **Escopo:** Higienização operacional pré-entrega da plataforma Led Maricá.
  Após reavaliação do cliente, **todos os produtos cadastrados eram seed
  (não reais)** e devem sair do ar; a vitrine fica zerada e o cliente
  cadastra o catálogo verdadeiro depois.
- **Princípio:** Inativar/arquivar — nunca excluir. Histórico, auditoria,
  pedidos, pagamentos, webhooks, e-mails e estoque permanecem 100% íntegros.

---

## 1. Antes da limpeza (snapshot)

| Categoria | Total | Ativos antes |
|---|---|---|
| Produtos | 20 | 13 (12 seed reais + 1 produto exemplo já renomeado, +5 HOMOLOG já inativos antes da v1) |
| Combos | 3 | 1 (`Kit 10 lâmpadas`) |
| Cupons | 4 | 0 (todos já inativos) |
| Banners | 3 | 3 |
| Showcases | 1 | 0 |
| Empresas B2B | 3 | 1 já bloqueada na v1, demais agora todas blocked |
| Pedidos | 17 | — |

---

## 2. Itens inativados nesta limpeza final (v2)

### Produtos (13 ativos → 0 ativos)
Todos os produtos do catálogo foram inativados:

| # | Produto |
|---|---|
| 1 | Cabo PP 2x1,5mm² Preto 100m |
| 2 | Disjuntor Bipolar 25A Curva C |
| 3 | Disjuntor Monopolar 10A Curva B |
| 4 | Extensão Elétrica 3m 3 Tomadas |
| 5 | Fio Flexível 2,5mm² 100m Preto |
| 6 | Fita LED SMD 5050 RGB 5m + Fonte |
| 7 | Interruptor Simples 10A *(vinculado ao pedido #17/#19 — preservado, apenas inativado)* |
| 8 | Lâmpada LED Bulbo Bivolt 18W Luz Amarela |
| 9 | Lâmpada LED Tubular T8 18W 120cm |
| 10 | Plafon LED 12W Redondo Sobrepor |
| 11 | Quadro Distribuição 12 Disjuntores |
| 12 | Refletor LED 20W Bivolt Externo IP66 |
| 13 | Refletor LED 50W Bivolt Externo IP66 |
| 14 | Spot LED 5W Embutir Dicroica |
| 15 | Tomada 2P+T 20A Padrão NBR 14136 |

Aplicado: `active=false`, `featured=false`, `b2b_enabled=false`,
`b2b_show_in_vitrine=false`.

Produtos HOMOLOG (5) e o `Produto Exemplo — Não Publicado` (1) já estavam
inativos desde a v1.

### Combos
- `Kit 10 lâmpadas` → `is_active=false`, `is_featured=false`.
- `HOMOLOG Kit Promocional`, `HOMOLOG Kit B2B` (já inativos na v1).

### Banners
- Os 3 banners de seed foram desativados (`active=false`).
  Cliente publicará banners reais depois pelo `/admin/banners`.

### Showcases
- Nenhuma vitrine ativa. Mantida a barreira `is_active=false`
  em todas as vitrines e itens, por segurança.

### Cupons
- 4 cupons HOMOLOG/TESTE (já inativos na v1). Nenhum cupom real ativo.

### Empresas B2B
- 3 empresas de teste com `status=blocked` (executado na v1).

---

## 3. Produto exemplo (mantido)

- `Produto Exemplo — Não Publicado`
- Slug: `produto-exemplo-nao-publicado`
- `active=false`, `featured=false`, `b2b_enabled=false`
- Não aparece publicamente; apenas referência administrativa.

---

## 4. Itens preservados por histórico (regra absoluta)

- **Pedidos #14, #17 e #19:** íntegros (3/3) ✅
- `order_items` dos pedidos #14/#17/#19: 3/3 íntegros ✅
- Produtos `Interruptor Simples 10A` e `HOMOLOG Centavo (TESTE PAGAMENTO)`,
  vinculados a esses pedidos, **NÃO foram excluídos** — apenas inativados.
- `payment_webhook_events`, `stock_decrement_audit`, `email_events`,
  `admin_audit_log`, `order_status_events` — **intocados**.
- `email_templates` — inalterados.

---

## 5. Itens não alterados por segurança

Mercado Pago, Resend/Lovable Emails, GA4 (`G-7B7PLYJLNP`), DNS, domínio,
`SITE_URL`, redirect apex→www, LGPD, MFA, RLS, secrets, chat Ledinho,
WhatsApp, configurações fiscais e financeiras — **nenhuma alteração**.

---

## 6. Validações pós-limpeza (consultas executadas)

| Validação | Resultado |
|---|---|
| Produtos com `active=true` | **0** ✅ |
| Produtos com `featured=true` | **0** ✅ |
| Produtos com `b2b_enabled=true` | **0** ✅ |
| Combos com `is_active=true` | **0** ✅ |
| Banners com `active=true` | **0** ✅ |
| Cupons com `active=true` | **0** ✅ |
| Showcases ativas | **0** ✅ |
| Itens de showcase ativos | **0** ✅ |
| Empresas de teste não bloqueadas | **0** ✅ |
| Pedidos #14/#17/#19 íntegros | **3/3** ✅ |
| `order_items` #14/#17/#19 íntegros | **3/3** ✅ |
| `Produto Exemplo — Não Publicado` presente e inativo | ✅ |

### Vitrine pública (esperado pelo cliente)
- **Home:** sem produtos, sem banners, sem combos, sem chamadas falsas.
  Renderizará as seções vazias / com fallback configurável em
  `/admin/conteudo/homepage`.
- **`/catalogo`:** vazio (nenhum produto `active=true`).
- **Busca pública:** não retorna nada.
- **`/combos`:** vazio.
- **Carrinho:** impossível adicionar produto (catálogo público vazio).
- **Cupons:** nenhum aplica.

### Admin (preservado)
- `Produto Exemplo — Não Publicado` visível e inativo.
- 19 demais produtos visíveis e inativos.
- Pedidos #14/#17/#19 visíveis e íntegros em `/admin/pedidos`.
- Logs/auditoria/webhooks/e-mails preservados.

---

## 7. Resumo numérico

| Métrica | Valor |
|---|---|
| Produtos encontrados antes | 20 |
| Produto mantido como exemplo | 1 (`Produto Exemplo — Não Publicado`) |
| Produtos inativados nesta etapa (v2) | 13 |
| Produtos já inativos (v1 + seed HOMOLOG) | 6 |
| Combos inativados (total acumulado) | 3 |
| Cupons inativados (total acumulado) | 4 |
| Banners desativados | 3 |
| Showcases desativadas | 1 (mais itens) |
| Empresas B2B bloqueadas | 3 |
| Pedidos preservados intactos | 17 (incluindo #14, #17, #19) |

---

## 8. Pendências remanescentes

Nenhuma. O cliente publicará o catálogo real, banners e campanhas
quando estiver pronto, pelo painel admin existente.

---

## 9. Status final

> ✅ **Plataforma limpa para entrega, mantendo apenas um produto exemplo
> administrativo inativo.**

- Nenhum hard delete.
- Nenhuma alteração em código, schema, integrações ou secrets.
- Apenas inativação/bloqueio em dados operacionais conforme escopo aprovado.
- Histórico, auditoria, pagamentos, webhooks, e-mails e estoque preservados
  integralmente.

---

**Recomendação:** revisão visual do `/`, `/catalogo`, `/combos`, `/atacado`
e `/admin/painel-do-dia` pelo cliente antes do anúncio público de Go-Live.
Em seguida, cadastrar produtos reais, banners e campanhas pelo admin.
