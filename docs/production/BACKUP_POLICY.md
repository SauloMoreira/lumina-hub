# Política de Backup — Led Maricá

**Vigência:** a partir de 30/mai/2026 (Produção v1.0.0)
**Responsável:** Saulo Moreira

---

## 1. Objetivo

Garantir que, em caso de falha, ataque, erro humano, regressão ou
indisponibilidade, a plataforma possa ser restaurada com perda mínima de
dados (RPO ≤ 24h) e tempo de retomada controlado (RTO ≤ 4h para banco,
≤ 1h para código).

## 2. Escopo do backup

### 2.1 Banco de dados (Lovable Cloud / Supabase)

Tabelas críticas (lista referencial — o backup nativo cobre **todo o
schema `public`**):

- Catálogo: `products`, `categories`, `product_attributes`,
  `product_bundles`, `product_bundle_items`, `product_relations`,
  `home_banners`, `homepage_*`.
- Comercial: `orders`, `order_items`, `coupons`, `cart_*`,
  `abandoned_carts`.
- Clientes / B2B: `profiles`, `companies`, `addresses`,
  `b2b_settings`, `b2b_negotiations`.
- Estoque / financeiro: `stock_decrement_audit`,
  `finance_settings`, `invoices`, `payment_*`.
- CRM / Marketing: `leads`, `lead_interactions`, `lead_status_history`,
  `automation_rules`, `whatsapp_templates`, `marketing_integrations`,
  `marketing_creatives`, `email_events`.
- Operacional / segurança: `admin_audit_log`, `user_roles`,
  `company_settings`, `local_delivery_zones*`.
- Conteúdo: `institutional_pages`, `homepage_settings`,
  `contact_messages`.

### 2.2 Storage / arquivos

Buckets Lovable Cloud:
- Imagens de produtos
- Banners e carrossel
- Criativos de marketing / campanhas
- Imagens do agente Ledinho
- Assets institucionais (favicon, manifest, ícones)

### 2.3 Código / configuração

- Repositório versionado pelo Lovable (histórico nativo de versões +
  GitHub conectado quando aplicável).
- Migrations em `supabase/migrations/`.
- Server functions em `src/server/*` e rotas em `src/routes/api/public/*`.
- `supabase/config.toml`, `vite.config.ts`, `package.json`.
- Documentação em `docs/`.

### 2.4 Integrações (referência sem valores)

Documentar **apenas o nome** dos secrets, nunca o valor:
- `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LOVABLE_API_KEY`
- Tokens dos pixels/analytics e demais conectores.

Configurações esperadas:
- Domínio: `www.ledmarica.com.br` (apex 302 → www).
- Webhook MP: `https://www.ledmarica.com.br/api/public/mercadopago/webhook`.
- `SITE_URL = https://www.ledmarica.com.br`.
- GA4: `G-7B7PLYJLNP`.

### 2.5 NÃO incluir em backup aberto

- Valores de secrets, tokens, API keys, senhas, chaves privadas.
- Dumps com PII de clientes em locais não criptografados.
- Cópias em e-mail, drive público ou chat.

## 3. Mecanismos de backup

### 3.1 Banco — backup nativo do Lovable Cloud (Supabase)

O Supabase gerenciado faz **backup diário automático** do Postgres com
retenção padrão por tier (7 dias no plano padrão; até 30 dias em planos
pagos). Esse é o backup primário e deve ser preservado.

> **Ação recomendada:** validar em `Project Settings → Database → Backups`
> qual a retenção contratada e, se estiver em 7 dias, avaliar upgrade
> para 30 dias dado o estágio de produção.

### 3.2 Banco — export manual antes de mudança crítica

Antes de qualquer ChangeControl Crítico ou Alto, exportar via
`pg_dump`/`Supabase Studio → Database → Backups → Download` e registrar
em `BACKUP_LOG.md`.

### 3.3 Storage

Storage do Supabase **não é coberto** automaticamente pelo backup do DB.
Para imagens, considerar uma destas alternativas:

1. Manter o original em fonte externa (drive do cliente) para banners e
   criativos antes de subir.
2. Rotina manual mensal: baixar bucket via CLI `supabase storage` para
   uma cópia fria.
3. Futuro: rotina automatizada via server function agendada por
   `pg_cron` que dispara export para storage externo (requer
   infraestrutura — apresentar proposta antes).

### 3.4 Código

- Histórico nativo do Lovable (cada versão é restaurável).
- Sincronização com GitHub (quando ativa) provê backup distribuído.
- Tags de release recomendadas a partir de v1.0.0.

## 4. Frequência e retenção

| Item                    | Frequência         | Retenção mínima | Retenção desejada |
|-------------------------|--------------------|-----------------|-------------------|
| Banco — nativo          | Diário automático  | 7 dias          | 30 dias           |
| Banco — pré-deploy      | Sob demanda        | 30 dias         | 90 dias           |
| Storage                 | Mensal manual      | 30 dias         | 90 dias           |
| Código                  | A cada release     | indefinido      | indefinido        |
| Configuração/secrets    | A cada alteração   | indefinido      | indefinido        |

## 5. Gatilhos de backup manual obrigatório

Antes de qualquer alteração em:
- Checkout / Carrinho
- Mercado Pago / Webhook
- Estoque (decremento/auditoria)
- RLS, MFA, AAL2, policies
- Migrations / schema
- Importação em massa de produtos
- Importação IA de produtos
- Templates de e-mail transacional

## 6. Responsabilidades

- **Saulo Moreira:** disparar backups manuais, validar retenção,
  registrar em `BACKUP_LOG.md`, testar restauração trimestralmente.
- **Lovable Cloud:** garantir backup diário automático conforme tier.

## 7. Testes de restauração

- Periodicidade mínima: **trimestral**.
- Testar restauração em ambiente preview (não tocar produção).
- Registrar resultado em `BACKUP_LOG.md` (seção "Testes de restauração").
- Caso o teste falhe, abrir ChangeControl Crítico imediato.
