# Led Maricá — Produção v1.0.0 (Baseline Oficial)

**Data de corte:** 30/mai/2026
**Responsável técnico:** Saulo Moreira (saulocmoreira@gmail.com — único admin com MFA/AAL2)
**Status:** Em produção
**URL produção:** https://www.ledmarica.com.br (apex 302 → www)
**URL preview:** https://id-preview--3f0ae235-0d23-458c-97a5-352d790386aa.lovable.app

---

## 1. Escopo do baseline

Este documento congela o estado atual da plataforma como referência oficial
de produção. Qualquer mudança a partir deste ponto deve obedecer à
governança descrita em `CHANGE_CONTROL.md`, `DEPLOY_CHECKLIST.md` e
`ROLLBACK_PLAN.md`.

## 2. Stack

- **Frontend / Backend app:** TanStack Start (React 19, Vite 7) — server
  functions (`createServerFn`) + server routes em `src/routes/api/public/*`.
- **Banco / Auth / Storage:** Lovable Cloud (Supabase gerenciado).
- **Pagamentos:** Mercado Pago (Checkout Pro) — webhook validado em
  produção (pedido #14, 06/mai/2026), `payment_status = "approved"`.
- **E-mail transacional:** Resend (transição para Lovable Emails prevista
  após configuração de domínio próprio).
- **Analytics:** GA4 `G-7B7PLYJLNP`.
- **Hospedagem:** Cloudflare Workers (workerd) via Lovable.

## 3. Domínios e DNS

- `www.ledmarica.com.br` — produção (canônico).
- `ledmarica.com.br` — redireciona 302 → www.
- DNS gerenciado pelo cliente; alteração exige ChangeControl Crítico.

## 4. Funcionalidades em produção

- Catálogo público, busca, categorias, kits/combos, recomendações.
- Carrinho, checkout B2C, checkout B2B (preço atacado server-side).
- Autenticação cliente (e-mail/senha + Google).
- Painel admin (`/admin/*`) protegido por `profiles.role='admin'` + MFA AAL2.
- CRM/leads, automações WhatsApp, e-mails transacionais.
- Auditoria admin (`admin_audit_log`) com triggers + helper semântico.
- LGPD: banner de cookies + carregamento condicional de pixels.

## 5. Configurações críticas (referência por nome, sem valores)

Secrets armazenados em Lovable Cloud (não versionar valores):
- `SUPABASE_SERVICE_ROLE_KEY`
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `LOVABLE_API_KEY`
- demais tokens de integração (ver `Project Settings → Secrets`).

Variáveis públicas (`VITE_*`) presentes em `.env`:
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
  `VITE_SUPABASE_PROJECT_ID`.

## 6. Administradores

| Email                     | Role  | MFA  | Observação                |
|---------------------------|-------|------|---------------------------|
| saulocmoreira@gmail.com   | admin | TOTP | Único admin de produção   |

Política: **um único admin** nesta fase. Qualquer adição passa por
ChangeControl Crítico + memória de projeto.

## 7. Versão de código

- Commit publicado: registrar SHA na primeira release oficial.
- Branch protegida: produção é a branch publicada via Lovable.
- Não há ambiente de staging separado — `id-preview` funciona como
  preview/QA.

## 8. Linha-base de saúde

Indicadores observados no momento do corte:
- Webhook Mercado Pago: OK (pedido #14 validado).
- Auditoria admin: gravando (RPC + triggers).
- E-mail transacional: enviando via Resend.
- GA4: recebendo eventos.
- Linter Supabase: pendências conhecidas em
  `mem://pending/auditoria-profunda-mai-2026.md` (não bloqueantes).

## 9. Próximas referências

- Mudanças → `CHANGE_CONTROL.md`
- Versões → `CHANGELOG.md` + `RELEASES.md`
- Backup → `BACKUP_POLICY.md` + `BACKUP_LOG.md`
- Reversão → `ROLLBACK_PLAN.md`
- Deploy → `DEPLOY_CHECKLIST.md`
- Acompanhamento inicial → `PRODUCAO_ASSISTIDA_7_DIAS.md`
