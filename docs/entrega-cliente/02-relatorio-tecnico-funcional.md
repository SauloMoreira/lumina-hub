# Relatório Técnico e Funcional Geral — Plataforma Led Maricá

- **Versão:** 1.0
- **Data:** 12/maio/2026
- **Público-alvo:** Cliente (Led Maricá), área de TI e equipe técnica de continuidade
- **Objetivo:** Apresentar a solução entregue, com escopo, arquitetura, módulos, integrações e fluxos.

---

## Sumário

1. Sumário executivo
2. Objetivo da plataforma
3. Escopo funcional
4. Arquitetura geral
5. Tecnologias utilizadas
6. Módulos públicos
7. Módulos administrativos
8. Integrações
9. Fluxo de pedido
10. Fluxo de pagamento
11. Fluxo de estoque
12. Fluxo de e-mail
13. Fluxo de CRM/lead
14. Regras B2B
15. Regras de kits, cupons e frete
16. LGPD e cookies
17. SEO e analytics
18. Situação atual
19. Limitações conhecidas
20. Recomendações operacionais

---

## 1. Sumário executivo

A plataforma Led Maricá é um e-commerce **B2C + B2B** completo, com pagamento
integrado ao Mercado Pago, CRM próprio, módulo de kits/combos, campanhas com
UTM, integrações de marketing (GA4, Meta Pixel, GTM, TikTok, Clarity, Google
Ads), chat assistido (Ledinho), envio transacional de e-mails, conformidade
LGPD e painel administrativo com MFA obrigatório.

A solução está **homologada e pronta para Go-Live**, com todos os gates
técnicos fechados (G6, G7, G9, G14 e webhook MP validado em produção real).

---

## 2. Objetivo da plataforma

- Vender produtos de iluminação (LED) ao consumidor final.
- Atender empresas com **preço de atacado** e regras próprias.
- Centralizar operação (pedidos, estoque, financeiro, CRM, marketing).
- Oferecer experiência de compra rápida, segura e mobile-first.

---

## 3. Escopo funcional

| Área | Escopo |
|---|---|
| Loja pública | Home, catálogo, produto, kits, combos, busca, carrinho, checkout, conta |
| B2B | Cadastro de empresa, aprovação automática/manual, preço atacado, kit B2B |
| Admin | Produtos, estoque, kits, cupons, pedidos, leads, campanhas, e-mails, integrações, segurança |
| Pagamento | Mercado Pago (cartão, pix, boleto), webhook validado, idempotência |
| Comunicação | E-mails transacionais, WhatsApp, chat Ledinho |
| Marketing | Campanhas, UTM, GA4, Meta Pixel, Google Ads, IA copy/imagem |
| LGPD | Banner de consentimento, scripts condicionais, política |
| Segurança | MFA AAL2 admin, RLS, auditoria, scan periódico |

---

## 4. Arquitetura geral

```text
[ Browser cliente ]
        │
        ▼
[ TanStack Start v1 (SSR) ] ──► HTML/SSR + hydration
        │
        ├─► Server Functions (createServerFn) ─► Lovable Cloud (Supabase)
        │                                          ├─ PostgreSQL + RLS
        │                                          ├─ Auth + MFA TOTP
        │                                          └─ Storage de imagens
        │
        ├─► /api/public/* ─► Webhooks (Mercado Pago, CSP report, health)
        │
        └─► Cloudflare Worker (Edge runtime) ─► SSR + Server Functions
```

- **Frontend:** React 19 + TanStack Router/Start, Tailwind v4 (CSS-first).
- **Backend:** Lovable Cloud (Supabase gerenciado), com RLS em todas as tabelas
  sensíveis e funções `SECURITY DEFINER` para validações críticas.
- **Edge:** deploy em Cloudflare Worker com `nodejs_compat`.

---

## 5. Tecnologias utilizadas

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript 5 (strict) |
| Framework | TanStack Start v1 + React 19 |
| Build | Vite 7 |
| Estilização | Tailwind CSS v4 (CSS-first, tokens em `oklch`) |
| Componentes | shadcn/ui (Radix) |
| Estado | Zustand (carrinho, cookies) + React Query |
| Backend | Lovable Cloud (Supabase) |
| Auth | Supabase Auth + MFA TOTP (AAL2 obrigatório no admin) |
| Pagamento | Mercado Pago (produção) |
| E-mail | Resend (atual) → Lovable Emails (planejado) |
| AI | Lovable AI Gateway (Gemini 2.5, GPT-5) |
| Analytics | GA4 + (opcional) GTM, Meta Pixel, TikTok, Clarity, Google Ads |
| Hosting | Lovable / Cloudflare Workers |

---

## 6. Módulos públicos

### Home
Banners (carrossel), categorias em destaque, seções dinâmicas, vitrines de
produtos, cards promocionais, CTA principal — todos administráveis.

### Catálogo
Filtros por categoria, marca, preço, atributos técnicos. Ordenação,
paginação, busca textual com normalização (acentos, plural).

### Produto
Galeria, descrição rica, especificações técnicas, atributos, kits que o
contêm, produtos relacionados, "compre junto", SEO completo, JSON-LD.

### Kits / Combos
Lista de kits, página individual, regras de preço fechado/desconto.

### Carrinho e Checkout
Cálculo em tempo real, frete grátis condicional (≥ R$ 199 em itens
elegíveis), aplicação de cupom, integração MP.

### Atacado / B2B
`/atacado` com filtros próprios, preço empresa, mínimos e múltiplos por
produto.

### Conta
Pedidos, dados, endereços, empresa B2B (quando aplicável).

### Chat Ledinho
Atendimento assistido por IA com handoff para WhatsApp.

---

## 7. Módulos administrativos

`/admin` (com MFA obrigatório):

- **Painel do Dia** — visão consolidada com alertas e atalhos.
- **Produtos** — CRUD, qualidade, atributos, IA, SEO, fiscal.
- **Estoque** — listagem, ajuste manual auditado, movimentações.
- **Combos** — kits/bundles com regras próprias.
- **Cupons** — criação e gestão.
- **Categorias** — árvore de categorias.
- **Pedidos** — listagem, detalhe, status operacional, reconsulta MP.
- **CRM / Leads / Funil** — pipeline e interações.
- **Campanhas / Performance** — UTM e métricas.
- **B2B / Empresas / Configurações B2B** — aprovação, regras.
- **Comunicação / E-mails** — templates e histórico.
- **WhatsApp Templates** — modelos de mensagem.
- **Integrações** — GA4, GTM, Meta Pixel, etc.
- **SEO** — score por página e recomendações.
- **Banners / Conteúdo / Homepage** — administração visual da home.
- **Financeiro** — resumo, margem, impostos, MP, notas, relatórios.
- **Segurança / Auditoria** — log com diff e exportação CSV.
- **Configurações** — empresa, frete local.

---

## 8. Integrações

### Mercado Pago
Checkout Pro + webhook em `/api/public/mercadopago/webhook`, com:
- Validação HMAC SHA-256 da assinatura.
- Consulta obrigatória à API oficial antes de aprovar.
- Idempotência por pedido e por evento.
- Registro completo em `payment_webhook_events`.

### Resend (e-mail transacional)
Camada única em `src/server/email/transport.ts`. Envio por status do pedido.
Histórico em `email_events` (independente de provider).

### GA4
ID `G-7B7PLYJLNP`, validado em produção. Carrega após consentimento LGPD.

### WhatsApp
Templates internos + handoff manual via número de suporte.

### Lovable AI Gateway
Modelos Gemini 2.5 e GPT-5 para descrições, copy, imagens e atendimento.

### Lovable Cloud (Supabase)
Banco PostgreSQL com RLS, Auth com MFA, Storage de imagens, Edge Functions.

### Outros (administráveis em `/admin/integracoes`)
GTM, Meta Pixel, TikTok Pixel, Microsoft Clarity, Google Ads — todos
condicionados a consentimento.

---

## 9. Fluxo de pedido

```text
Cliente adiciona ao carrinho
  → Aplica cupom / valida frete
  → Vai para checkout
  → Sistema cria order (status pending) + reserva intencional
  → Redireciona para Mercado Pago
  → Cliente paga
  → MP envia webhook
  → Sistema valida assinatura
  → Sistema consulta API oficial do MP
  → Atualiza order.payment_status = approved
  → Decrementa estoque (transacional, idempotente)
  → Envia e-mail "pagamento aprovado"
  → Cria/atualiza lead no CRM
  → Cliente vê confirmação em /pedido/:id/confirmacao
```

---

## 10. Fluxo de pagamento

- Aprovação real só ocorre após validação na API do MP.
- `payment_status = "approved"` (não "paid") — filtros financeiros usam
  `["paid", "approved"]`.
- Webhook valida assinatura; sem assinatura em produção → 503 + log de
  segurança.
- Reenvio do mesmo evento → idempotente (não duplica baixa nem e-mail).

---

## 11. Fluxo de estoque

- Baixa **somente após aprovação real** do pagamento.
- Operação transacional via RPC `decrement_stock_for_order`.
- Idempotente por `stock_decremented_at`.
- Auditoria em `stock_decrement_audit`.
- Ajuste manual no admin é registrado com responsável e motivo.

---

## 12. Fluxo de e-mail

- Camada única (`sendTransactionalEmail`).
- Provider atual: **Resend**. Migração planejada para **Lovable Emails**.
- Histórico completo em `email_events` com status (`sent`, `failed`,
  `pending`).
- Reenvio manual com lock anti-duplicidade.

---

## 13. Fluxo de CRM / lead

- Lead criado por: chat, formulário, captação de marketing, pedido aprovado.
- Pedido aprovado → `syncApprovedOrderToLead` cria/atualiza lead.
- Cada lead tem origem, status, interações e histórico.
- Funil visual em `/admin/funil`.

---

## 14. Regras B2B

- **Mesmo cadastro/estoque/carrinho/checkout** que o B2C.
- Aprovação automática se: ReceitaWS retorna `ATIVA`, sem situação especial,
  abertura > 6 meses. Demais casos → manual em `/admin/empresas`.
- Preço atacado **nunca visível para visitante**.
- Backend recalcula sempre via RPC `validate_b2b_pricing`.
- Empresa pendente compra como B2C.
- Carrinho misto B2B + B2C suportado por linha.
- Cupom em B2B controlado por `b2b_settings.allow_coupon_in_b2b`.

---

## 15. Regras de kits, cupons e frete

- **Kits** podem ser preço fechado ou desconto sobre soma.
- **Kit B2B** restrito a empresas aprovadas.
- **Cupons**: percentual ou valor fixo, com validade, limite, valor mínimo
  e produtos/categorias elegíveis.
- **Frete grátis**: subtotal de itens elegíveis ≥ R$ 199 ativa a regra.

---

## 16. LGPD e cookies

- Banner com 4 categorias (essenciais, analytics, marketing, personalização).
- Scripts condicionais — não carregam sem consentimento.
- Política em `/privacidade`.
- Validação CSP + cookies seguros (`SameSite=None; Secure`).

---

## 17. SEO e analytics

- Cada rota com `head()` próprio (title, description, canonical, og, twitter).
- Sitemap dinâmico em `/sitemap.xml`, `robots.txt` configurado.
- JSON-LD para produto, organização, breadcrumbs.
- GA4 com `anonymize_ip`, eventos: `view_product`, `add_to_cart`,
  `begin_checkout`, `purchase`, `search`, `lead_captured`.
- Painel SEO interno com score 0–100.

---

## 18. Situação atual

| Módulo | Status |
|---|---|
| Loja pública | ✅ Pronto |
| Admin completo | ✅ Pronto |
| MFA admin | ✅ Obrigatório (AAL2) |
| Mercado Pago | ✅ Validado em produção |
| E-mails (Resend) | ✅ Em uso |
| Lovable Emails | ⏳ Planejado (depende de domínio próprio) |
| GA4 | ✅ Configurado e validado |
| LGPD | ✅ Banner ativo, scripts condicionais |
| Auditoria admin | ✅ Cobertura ampla (Onda 1 + 2) |
| B2B | ✅ Aprovação auto + manual, preço backend |
| Kits/Cupons | ✅ Em uso |
| CRM/Leads | ✅ Sincronizado com pedidos |
| Chat Ledinho | ✅ Anônimo + handoff |
| Domínio www | ✅ Primary, SSL, 200 OK |
| Domínio apex | ✅ Redirect 302 → www |
| Webhook MP | ✅ Validado com pedidos #14, #17, #19 |

---

## 19. Limitações conhecidas

- **Lovable Emails** ainda não está ativo — depende de domínio próprio
  configurado em Cloud → Emails.
- **CSP com nonce/hash** ainda não foi aplicada (planejada para 90 dias).
- **Roles administrativos granulares** não foram implementados; modelo atual
  é binário (admin x cliente). Decisão consciente.
- **Suíte e2e completa** ainda não existe; testes foram majoritariamente
  manuais e exploratórios na homologação.
- **Search Console** depende de verificação pós-Go-Live.

---

## 20. Recomendações operacionais

- Acompanhar Painel do Dia diariamente.
- Tratar imediatamente alertas de e-mail `failed` e webhook MP fora do padrão.
- Revisar SEO de produtos novos antes da publicação.
- Validar campanhas (UTM, cupom, estoque) antes de divulgar.
- Manter backups e auditoria intactos — não apagar registros históricos.
- Treinar a equipe com o [Manual do Usuário](./01-manual-do-usuario.md).

---

## Conclusão

A plataforma está tecnicamente pronta para Go-Live, com módulos críticos
homologados e validados em produção. A continuidade operacional depende de
disciplina diária (Painel do Dia + auditoria) e da execução do roadmap
30/60/90 descrito no documento [07](./07-roadmap-pos-go-live.md).

**Próximos passos:**

1. Executar [Checklist de Produção Assistida](./06-checklist-producao-assistida-7-dias.md).
2. Após estabilização, rodar o [Prompt de Limpeza](./09-prompt-limpeza-geral-plataforma.md).
3. Iniciar roadmap 30 dias.
