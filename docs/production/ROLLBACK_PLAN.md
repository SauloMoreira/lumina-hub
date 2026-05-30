# Plano de Rollback — Led Maricá

**Princípio:** toda mudança em produção precisa de um caminho de volta
documentado **antes** do deploy. Sem plano de rollback, a mudança não é
aprovada.

---

## 1. Critérios para acionar rollback

Acionar rollback **imediatamente** se, após deploy, observar:

- Quebra do checkout (qualquer etapa não completa).
- Webhook Mercado Pago parando de receber/processar.
- Estoque sendo decrementado errado ou em duplicidade.
- Login/admin inacessível ou MFA quebrado.
- E-mails transacionais não saindo (pending/failed acumulando).
- Erro 5xx em rotas públicas críticas (`/`, `/catalogo`, `/produto/*`,
  `/checkout`).
- Vazamento de dados (PII, custo, margem) para visitante/cliente.
- Qualquer regressão de segurança (RLS, AAL2, policies).

**Quem aciona:** Saulo Moreira (admin único).
**Tempo alvo (RTO):** ≤ 1h para código, ≤ 4h para banco.

## 2. Procedimentos por escopo

### 2.1 Rollback de código (Lovable)

1. Abrir histórico de versões do Lovable.
2. Selecionar a versão estável anterior (ver `RELEASES.md`).
3. Restaurar para preview.
4. Validar smoke test (home, catálogo, checkout, login admin).
5. Publicar.
6. Registrar em `CHANGELOG.md` como `revertido` e abrir entrada nova
   `vX.Y.Z+1` indicando "rollback de vX.Y.Z".

### 2.2 Rollback de banco (migration)

1. Identificar a migration aplicada (timestamp em
   `supabase/migrations/`).
2. **Não rodar `DROP`** cego — analisar dependências (FK, RLS, triggers).
3. Escrever migration reversa.
4. Restaurar dados a partir do backup pré-deploy quando houver perda.
5. Submeter via tool de migration (com aprovação humana).
6. Validar `admin_audit_log`, `orders`, `products` íntegros.

### 2.3 Rollback de Mercado Pago / Webhook

1. Reverter código que toca `src/routes/api/public/mercadopago.webhook.ts`
   ou `src/server/payment.functions.ts` para versão estável.
2. Verificar variáveis: `MERCADOPAGO_ACCESS_TOKEN`,
   `MERCADOPAGO_WEBHOOK_SECRET` inalteradas.
3. Reenviar webhook de teste (notificação manual no painel MP).
4. Validar pedido de teste end-to-end.
5. Conferir `payment_webhook_events` recebendo `approved`.

### 2.4 Rollback de estoque

1. Reverter código de `src/server/stockOps.functions.ts`.
2. Conferir `stock_decrement_audit` — identificar decrementos errados.
3. Se houve dupla baixa: criar migration de ajuste manual com aprovação
   admin, sempre logando em `admin_audit_log`.

### 2.5 Rollback de RLS / Auth

1. Reverter migration de policy.
2. Confirmar no `supabase--linter` que não sobrou policy permissiva.
3. Validar `RequireAdminMfa` ainda bloqueia AAL1.
4. Conferir que rota pública não expõe `cost_price`, `b2b_price`,
   margens ou dados financeiros.

### 2.6 Rollback de e-mail transacional

1. Reverter código em `src/server/email/*`.
2. Reenviar e-mail de teste para o admin.
3. Conferir `email_events` sem `failed`.

### 2.7 Rollback de DNS / domínio

1. Restaurar registros DNS conforme baseline
   (`PRODUCTION_BASELINE_v1.0.0.md`).
2. Aguardar propagação (TTL).
3. Validar `https://www.ledmarica.com.br` e redirect do apex.

## 3. Itens que **exigem** rollback documentado por release

- Checkout · Mercado Pago · Webhook · Estoque · Banco/migrations ·
  Produtos em massa · Importação IA · Auth/admin · RLS · E-mail
  transacional · DNS/domínio.

## 4. Pós-rollback

1. Atualizar `CHANGELOG.md` e `RELEASES.md` marcando a versão como
   `revertido`.
2. Abrir entrada nova explicando o motivo do rollback.
3. Criar item de melhoria em `CHANGE_CONTROL.md` para a próxima
   tentativa corrigida.
4. Atualizar `BACKUP_LOG.md` se backup foi usado para restauração.
