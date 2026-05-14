# Relatório de Limpeza Final — Entrega ao Cliente

- **Data:** 14/maio/2026
- **Escopo:** Higienização operacional pré-entrega da plataforma Led Maricá.
- **Princípio:** Inativar/arquivar — nunca excluir. Histórico, auditoria,
  pedidos, pagamentos, webhooks, e-mails e estoque permanecem 100% íntegros.

---

## 1. Itens encontrados antes da limpeza

| Categoria | Encontrados | Detalhe |
|---|---|---|
| Produtos HOMOLOG/TESTE | 5 | já inativos, mas com `featured=true` e/ou `b2b_show_in_vitrine=true` |
| Combos HOMOLOG | 2 | `HOMOLOG Kit Promocional`, `HOMOLOG Kit B2B` (já inativos) |
| Cupons HOMOLOG/TESTE | 4 | `HOMOLOG10`, `HOMOLOGEXP`, `HOMOLOGLIMIT`, `TESTESAULO` (já inativos) |
| Empresas B2B de teste | 3 | `teste` (approved), `HOMOLOG B2B Pendente LTDA`, `HOMOLOG B2B Aprovada LTDA` |
| Banners de teste | 0 | banners atuais são reais |
| Cards de homepage de teste | 0 | — |
| Showcases de teste ativos | 0 | "Nova vitrine 1" já inativa |
| Leads de teste | 0 | único lead é real (Saulo C Moreira) |
| Carrinhos abandonados de teste | 0 | — |

---

## 2. Itens inativados / arquivados nesta limpeza

### Produtos (5)
- `HOMOLOG Centavo (TESTE PAGAMENTO)`
- `HOMOLOG Produto B2B`
- `HOMOLOG Produto Estoque Zero`
- `HOMOLOG Produto Frete Gratis`
- `HOMOLOG Produto Comum` → **renomeado** para `Produto Exemplo — Não Publicado`
  (slug `produto-exemplo-nao-publicado`) — mantido como referência administrativa.

Aplicado em todos: `active=false`, `featured=false`, `b2b_enabled=false`,
`b2b_show_in_vitrine=false`. Resultado: invisíveis no catálogo público,
busca, vitrine, B2B e home.

### Combos (2)
- `HOMOLOG Kit Promocional`
- `HOMOLOG Kit B2B`

Aplicado: `is_active=false`, `is_featured=false`.

### Cupons (4)
- `HOMOLOG10`, `HOMOLOGEXP`, `HOMOLOGLIMIT`, `TESTESAULO` → `active=false`.

### Empresas B2B (3)
- `teste` (CNPJ teste)
- `HOMOLOG B2B Pendente LTDA`
- `HOMOLOG B2B Aprovada LTDA`

Aplicado: `status=blocked`, `blocked_at=now()`, nota administrativa
registrada. **Validado previamente:** nenhuma destas empresas possui pedido
vinculado (`orders.company_id` = 0 ocorrências).

---

## 3. Itens preservados por histórico (regra absoluta)

- **Pedidos:** 17 pedidos no total. Todos preservados, incluindo:
  - `#14` — delivered/paid (validação real Mercado Pago)
  - `#17` — confirmed/approved (validação real)
  - `#19` — confirmed/approved (validação real)
  - `#1`–`#13`, `#18` — preservados (cancelados/pendentes; histórico intacto).
- `order_items`, `payment_webhook_events`, `stock_decrement_audit`,
  `email_events`, `admin_audit_log`, `order_status_events` — **intocados**.
- `email_templates` — nenhum template foi inativado ou removido.
- Lead único real (`Saulo C Moreira`, status `ganhou`) — preservado.

---

## 4. Itens não alterados por segurança

- Mercado Pago (chaves, webhook, `notification_url`).
- Resend / Lovable Emails.
- GA4 (`G-7B7PLYJLNP`).
- Domínio, DNS, `SITE_URL`, redirect apex → www.
- LGPD, MFA, RLS, policies do Supabase, secrets.
- Chat Ledinho, WhatsApp, templates de e-mail reais.
- Banners ativos de produção (3 banners reais mantidos).
- Configurações fiscais e financeiras.

---

## 5. Produto exemplo

✅ Mantido **um único** produto exemplo:
- Nome: `Produto Exemplo — Não Publicado`
- Slug: `produto-exemplo-nao-publicado`
- `active=false`, `featured=false`, `b2b_enabled=false`
- Não aparece publicamente. Disponível apenas no admin, como referência.

---

## 6. Validações pós-limpeza (executadas via consulta SQL)

| Validação | Resultado |
|---|---|
| Produtos HOMOLOG ativos no catálogo | **0** ✅ |
| Produtos HOMOLOG/Exemplo em destaque | **0** ✅ |
| Combos HOMOLOG ativos | **0** ✅ |
| Cupons de teste ativos | **0** ✅ |
| Empresas de teste com status diferente de `blocked` | **0** ✅ |
| Pedidos #14, #17, #19 íntegros | **3/3** ✅ |
| `email_events`, `admin_audit_log`, `payment_webhook_events` | **intocados** ✅ |
| Banners reais ativos | **3** (preservados) ✅ |
| Showcase "Nova vitrine 1" | inativa (já estava) ✅ |
| Templates de e-mail | **inalterados** ✅ |

### Catálogo público
Nenhum produto HOMOLOG/TESTE aparece em `/catalogo`, busca pública,
home, vitrines ou B2B (todos `active=false`).

### Home
Banners reais preservados. Nenhum banner/card/campanha de teste.

### Combos
`/combos` exibe apenas o kit real `Kit 10 lâmpadas` (ativo).

### Cupons
Cupons HOMOLOG/TESTE não aplicam (inativos). Não há cupom real ativo.

### Admin
Pedidos #14/#17/#19 visíveis e preservados em `/admin/pedidos`.
Logs/auditoria/webhooks/e-mails preservados.

---

## 7. Pendências remanescentes

Nenhuma pendência crítica. Sugestões opcionais para o cliente após
operação real:

- Eventual remoção definitiva do `Produto Exemplo — Não Publicado`
  quando o catálogo real estiver maduro (continuar inativo é
  perfeitamente seguro).
- Revisar periodicamente cupons/combos arquivados.

---

## 8. Status final

> ✅ **Plataforma limpa para entrega ao cliente, preservando histórico
> e auditoria.**

- Nenhum hard delete executado.
- Nenhuma alteração em código, schema, integrações ou secrets.
- Apenas operações de inativação/bloqueio/renomeação em dados
  operacionais conforme escopo aprovado.

---

**Recomendação:** revisão visual do `/`, `/catalogo`, `/combos`,
`/atacado` e `/admin/painel-do-dia` pelo cliente antes do anúncio
público de Go-Live.
