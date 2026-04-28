# Homologação — Notas técnicas

Este documento consolida pontos de homologação e decisões técnicas que **não devem ser
revertidos** sem revisão.

---

## 1. Webhook Mercado Pago

**Endpoint público:** `POST /api/public/mercadopago/webhook`

URL completa em produção:
```
https://<seu-dominio-publicado>/api/public/mercadopago/webhook
```
URL estável Lovable (recomendada para configurar no painel MP):
```
https://project--3f0ae235-0d23-458c-97a5-352d790386aa.lovable.app/api/public/mercadopago/webhook
```

### Configuração no painel Mercado Pago
1. Acesse **Suas integrações → sua aplicação → Webhooks → Configurar notificações**.
2. Modo: **Webhooks (Notificações via HTTP)**.
3. Eventos: marque **Pagamentos** (`payment`).
4. Cole a URL acima.
5. Copie o **segredo do webhook** gerado pelo MP e configure como secret em
   Lovable Cloud com o nome `MERCADOPAGO_WEBHOOK_SECRET`.
6. `MERCADOPAGO_ACCESS_TOKEN` deve ser o token de **produção** (`APP_USR-...`).

### Comportamento implementado
- **Em produção**, secret é obrigatório: ausência → `503` + log em `security_events`.
- Validação `x-signature` (HMAC SHA-256, manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`).
- Sempre faz `GET /v1/payments/{id}` na API oficial antes de aprovar pedido — nunca
  confia no body do webhook.
- Toda requisição é registrada em `payment_webhook_events` (com headers + payload),
  inclusive falhas de assinatura ou processamento.
- Idempotente: pedido já aprovado + novo evento `approved` → apenas marca processado.
- Baixa de estoque transacional via `decrement_stock_for_order` (também idempotente).
- E-mail transacional disparado por status (`payment_approved` / `pending` / `failed`).

### Roteiro de teste (sandbox + produção controlada)
1. **Approved** — pagar com cartão de teste APRO. Conferir:
   - `orders.payment_status = 'approved'`, `paid_at` preenchido.
   - `payment_webhook_events.processed = true`.
   - Estoque decrementado (`stock_decrement_audit` com `result='decremented'`).
   - `email_events` com `status='sent'` para `payment_approved`.
2. **Pending** — cartão `CONT`. Confirmar `payment_status='pending'`, e-mail `payment_pending`.
3. **Rejected** — cartão `OTHE`. Confirmar `payment_status='rejected'`, pedido não confirma.
4. **Webhook duplicado** — reenviar pelo painel MP. Não deve duplicar baixa de estoque
   nem e-mail (idempotência por `email_events` + `stock_decremented_at`).
5. **Assinatura inválida** — POST manual com `x-signature` errada → resposta `401`,
   evento gravado em `security_events` (`webhook_invalid_signature`).

---

## 2. E-mails transacionais (camada única)

### Decisão
- **Provider final:** Lovable Emails (após domínio próprio configurado e validado).
- **Provider atual:** Resend (temporário, mantém envio em produção até a migração).
- **Nenhum fluxo** chama Resend diretamente — toda app envia por
  `src/server/email/transport.ts` → `sendTransactionalEmail()`.

### Como alternar provider
Setar a env `EMAIL_PROVIDER`:
- `resend` (default, atual)
- `lovable_email` (ativar quando o domínio próprio estiver verificado em Cloud → Emails;
  hoje cai automaticamente em Resend como fallback até a integração estar plugada)

A tabela `email_events` é independente de provedor e registra o provider efetivamente usado.

### O que **não** fazer
- Não importar `@/server/email/resend` fora de `transport.ts`.
- Não expor `RESEND_API_KEY` no frontend (já é só server).
- Não remover Resend antes do Lovable Emails estar homologado em produção.

---

## 3. Hydration warning na tela de login

**Causa conhecida:** extensões de gerenciador de senhas (Kaspersky Password Manager,
LastPass, 1Password etc.) injetam atributos como `kpm-field-badge`, `wfd-id`,
`data-lastpass-icon-root` em inputs antes da hidratação do React.

**Decisão:**
- Não alterar a tela de login.
- Não usar `suppressHydrationWarning` global.
- Não desativar SSR.
- Validar fluxo em **navegador limpo / aba anônima sem extensões / mobile**.
- Se houver monitoramento de erros futuro, filtrar por mensagens contendo
  `hydration` + atributos de extensão e reduzir severidade para `info`.

---

## 4. Tailwind v4 — CSS-first

Este projeto adota **Tailwind v4 com configuração CSS-first** via `@import "tailwindcss"`
em `src/styles.css`. Tokens, tema e plugins são declarados em CSS (`@theme`,
`@plugin`, `@custom-variant`) — **não há `tailwind.config.{js,ts}`**, e isso é
intencional.

- Build, layout e responsividade funcionam normalmente.
- Eventuais avisos de ferramentas externas pedindo `tailwind.config` são cosméticos
  e devem ser ignorados.
- **Não migrar para o formato v3.** Não criar config JS para "calar" warning sem
  comprovar impacto real (testes ou build quebrando).
