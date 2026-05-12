# Relatório Completo de Homologação — Plataforma Led Maricá

- **Versão:** 1.0
- **Data:** 12/maio/2026
- **Público-alvo:** Cliente, QA, equipe técnica
- **Objetivo:** Consolidar o que foi testado, evidências e resultado final.

---

## Sumário

1. Sumário executivo
2. Metodologia
3. Ambientes
4. Massa de teste
5. Fase 0 — Massa de homologação
6. Fase 1 — Acesso, MFA, perfis
7. Fase 2 — Home, catálogo, produto, kits
8. Fase 3 — Carrinho, cupom, frete, checkout
9. Fase 4 — Mercado Pago, pedido, estoque, e-mails
10. Fase 5 — Admin operacional
11. Fase 6 — SEO, performance, mobile, pré-Go-Live
12. Codex read-only
13. P0 pós-Codex
14. Go/No-Go técnico
15. Gates finais
16. Pedido real Mercado Pago em produção
17. GA4 / LGPD
18. DNS / e-mail
19. Limpeza HOMOLOG (planejada)
20. Resultado final
21. Itens pós-Go-Live
22. Evidências resumidas

---

## 1. Sumário executivo

A homologação foi conduzida em **6 fases**, complementada por revisão
externa **Codex read-only**, correções **P0** e checklist **Go/No-Go**.
Resultado: **todos os gates fechados** (G6, G7, G9, G14 e webhook MP),
**0 erros** no scan final de segurança, e **3 pedidos reais validados em
produção** (#14, #17, #19).

**Resultado:** ✅ **GO-LIVE LIBERADO**.

---

## 2. Metodologia

- Testes manuais exploratórios + roteiros estruturados.
- Validação em browser real (desktop e mobile) e em aba anônima.
- Revisão de logs (`payment_webhook_events`, `email_events`,
  `stock_decrement_audit`, `admin_audit_log`).
- Revisão externa Codex (read-only) em código e fluxos críticos.
- Validação em produção controlada com pagamentos reais.

---

## 3. Ambientes

| Ambiente | URL | Uso |
|---|---|---|
| Preview | `id-preview--<id>.lovable.app` | Desenvolvimento |
| Stable preview | `project--<id>-dev.lovable.app` | Webhooks/cron de teste |
| Stable produção | `project--<id>.lovable.app` | Webhooks de produção |
| Produção (custom) | `https://www.ledmarica.com.br` | Cliente final |
| Apex | `https://ledmarica.com.br` | Redirect 302 → www |

---

## 4. Massa de teste

- Produtos exemplares por categoria.
- Kits B2C e B2B.
- Cupons percentual e valor fixo.
- Empresas B2B em estados: pendente, aprovada automaticamente, aprovada
  manualmente, rejeitada.
- Cartões de teste do Mercado Pago (APRO, CONT, OTHE).

---

## 5. Fase 0 — Massa de homologação

- Cadastro de produtos, categorias, kits, cupons.
- Configuração inicial de empresa, frete local, integrações.
- Validação de templates de e-mail.

✅ Concluída.

---

## 6. Fase 1 — Acesso, MFA, perfis

- Cadastro e login de cliente.
- Cadastro de empresa B2B (auto e manual).
- MFA TOTP do admin (enroll + challenge + AAL2).
- Sessão AAL1 bloqueada nas rotas admin.
- Recuperação de senha.

✅ Concluída.

---

## 7. Fase 2 — Home, catálogo, produto, kits

- Renderização SSR + hidratação.
- Filtros, ordenação, paginação, busca normalizada.
- Galeria, especificações, atributos, relacionados, "compre junto".
- Kits com preço fechado e desconto.
- Visibilidade B2B (preço empresa nunca visível para visitante).

✅ Concluída.

---

## 8. Fase 3 — Carrinho, cupom, frete, checkout

- Adição/remoção/ajuste de quantidade (com `snapQty` para mínimo/múltiplo).
- Cupom percentual e fixo, com validação de regras.
- Frete grátis condicional (≥ R$ 199 em itens elegíveis).
- Checkout B2C e B2B (carrinho misto suportado).
- Bloqueio de checkout sem estoque.

✅ Concluída.

---

## 9. Fase 4 — Mercado Pago, pedido, estoque, e-mails

- Pagamento aprovado (APRO).
- Pagamento pendente (CONT).
- Pagamento recusado (OTHE).
- Webhook reenviado (idempotência confirmada).
- Webhook com assinatura inválida → 401 + log.
- Baixa de estoque transacional, idempotente, auditada.
- E-mails enviados conforme status (`approved`, `pending`, `failed`).
- Reenvio manual com lock anti-duplicidade.

✅ Concluída.

---

## 10. Fase 5 — Admin operacional

- CRUD completo de produtos, kits, cupons, categorias, banners.
- Gestão de pedidos (status operacional, rastreio, reenvio, reconsulta MP).
- Aprovação/rejeição de empresas B2B.
- Edição de templates de e-mail e WhatsApp.
- Configuração de integrações de marketing.
- Auditoria com diff e exportação CSV.

✅ Concluída.

---

## 11. Fase 6 — SEO, performance, mobile, pré-Go-Live

- Title, meta description, canonical, og, twitter por rota.
- Sitemap dinâmico + robots.txt.
- JSON-LD para produto e organização.
- Validação mobile (viewport ≤ 400px e ≥ 1024px).
- PageSpeed em níveis aceitáveis para a fase.
- Painel SEO interno com score 0–100.

✅ Concluída.

---

## 12. Codex read-only

Revisão externa cobriu fluxos críticos (pedido, MP, admin, RLS, upload,
B2B, e-mail, LGPD). Resultado: **sem vulnerabilidade crítica aberta**.
Recomendações foram triadas em P0 (pré-Go-Live) e P1+ (pós).

---

## 13. P0 pós-Codex

Resolvidos:

- Endurecimento de RPCs B2B auxiliares.
- Lock de reenvio manual de e-mail.
- Bloqueio de upload SVG e data URL.
- Bloqueio estrito de AAL1 no admin.
- Webhook MP exige secret em produção.
- Sanitização de logs (tokens/secrets/PII).

---

## 14. Go/No-Go técnico

Checklist Go/No-Go (12/maio/2026): **TODOS os gates FECHADOS**.

| Gate | Descrição | Status |
|---|---|---|
| G6 | E-mail transacional | ✅ |
| G7 | Domínio www / SSL / 200 OK | ✅ |
| G9 | Apex → www (302) | ✅ |
| G14 | GA4 validado em produção | ✅ |
| MP webhook | Validado com pagamento real | ✅ |

---

## 15. Gates finais

- Domínio apex `ledmarica.com.br` resolve com SSL válido.
- Apex redireciona para `https://www.ledmarica.com.br/` (302, sem loop).
- `www.ledmarica.com.br` responde 200 OK.
- Canonical aponta para `https://www.ledmarica.com.br/`.
- `SITE_URL = https://www.ledmarica.com.br`.
- Webhook MP em `https://www.ledmarica.com.br/api/public/mercadopago/webhook`.

---

## 16. Pedido real Mercado Pago em produção

- **Pedido #14** (06/mai/2026): primeiro pagamento real validado — webhook
  recebido, assinatura validada, API consultada, status `approved`,
  estoque baixado, e-mail enviado, lead criado.
- **Pedidos #17 e #19**: validações adicionais (#19 com fluxo completo
  ponta a ponta confirmando idempotência e CRM).

> Pedidos preservados como evidência histórica — **não excluir**.

---

## 17. GA4 / LGPD

- ID `G-7B7PLYJLNP` em `marketing_integrations`.
- `gtag/js` retorna **HTTP 200** em produção.
- Carregamento condicionado a consentimento.
- CSP não bloqueia GA4.
- Validação manual em aba anônima: script só carrega após **Aceitar todos**.

---

## 18. DNS / e-mail

- DNS 100% propagado (A apex + www → IP Lovable).
- SPF, DKIM, DMARC publicados.
- HTTPS www: 200 OK; apex: 302 → www.
- E-mail transacional ativo via Resend.

---

## 19. Limpeza HOMOLOG (planejada)

Massa de homologação ainda **presente** no banco. Limpeza segura está
descrita no [Prompt de Limpeza Geral](./09-prompt-limpeza-geral-plataforma.md)
e deve ser executada em momento separado, preservando pedidos #14, #17, #19,
auditoria e histórico.

---

## 20. Resultado final

✅ **HOMOLOGAÇÃO APROVADA — GO-LIVE LIBERADO**.

- 6 fases concluídas.
- Codex read-only sem item crítico aberto.
- P0 pós-Codex todos resolvidos.
- Gates Go/No-Go fechados.
- Webhook MP validado em produção.
- Scan de segurança final: 0 ERROR.

---

## 21. Itens pós-Go-Live

- Limpeza HOMOLOG (prompt 09).
- Search Console (verificação + sitemap).
- Acompanhar GA4 nas primeiras 48h.
- Migração para Lovable Emails (após domínio próprio).
- Roadmap 30/60/90 (documento 07).

---

## 22. Evidências resumidas

- `payment_webhook_events`: assinaturas validadas, idempotência aplicada.
- `stock_decrement_audit`: `decremented` para pedidos pagos; `already`
  para reenvios.
- `email_events`: status `sent` para confirmações.
- `admin_audit_log`: rastreio completo de ações administrativas.
- Curl manual em apex e www: SSL, redirect e canonical OK.

---

**Próximos passos:**

1. Iniciar [Produção Assistida 7 dias](./06-checklist-producao-assistida-7-dias.md).
2. Após estabilização, executar [Prompt de Limpeza](./09-prompt-limpeza-geral-plataforma.md).
3. Iniciar roadmap 30 dias.
