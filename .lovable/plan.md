## Tela administrativa de modelos de e-mail transacional

### Princípio central
Os templates atuais em `src/server/email/templates.ts` (HTML estilizado, blocos de itens/retirada/frete local etc.) **continuam sendo a fonte de verdade visual e o fallback obrigatório**. A tela admin permite **sobrescrever apenas os textos** (assunto, pré-header, headline, intro, CTA label/URL) e flags de controle (auto / reenvio manual). O HTML, layout, bloco de itens e totais permanecem montados pelo `buildOrderEmailTemplate` existente.

Isso evita que o admin quebre o e-mail mexendo em HTML/CSS, atende LGPD (não há campo livre para colar CPF/tokens) e garante que cada template tem sempre uma versão válida.

---

### 1. Banco de dados (1 migração)

Tabela nova `email_templates` (singleton por `type`):

- `type` (text, unique) — chave técnica: `order_created`, `payment_approved`, `payment_pending`, `payment_failed`, `order_processing`, `order_shipped`, `order_delivered`, `order_cancelled`, `order_refunded` (preparado mesmo sem disparo automático ainda)
- `display_name` (text)
- `subject` (text, nullable — quando NULL usa fallback do código)
- `preheader` (text, nullable)
- `headline` (text, nullable)
- `intro_html` (text, nullable) — texto do corpo, suporta `{{variaveis}}` e tags básicas (`<br/>`, `<strong>`)
- `cta_label` (text, nullable)
- `cta_url` (text, nullable) — pode usar `{{site_url}}` / `{{pedido_url}}`
- `secondary_cta_label`, `secondary_cta_url` (text, nullable)
- `is_active` (bool, default true) — se false, **não envia automaticamente**
- `auto_send` (bool, default true)
- `allow_manual_resend` (bool, default true)
- `created_at`, `updated_at`

RLS: admin-only (ALL via `is_admin(auth.uid())`). Public read não é necessário — a leitura é só do servidor admin.

Trigger `audit_table_changes` para registrar mudanças no `admin_audit_log` (padrão já existente em outras tabelas).

Seed: 9 linhas, uma por `type`, todas com `subject=NULL` (significa "usar padrão do código"), `is_active=true`, `auto_send=true`, `allow_manual_resend=true`. `display_name` em português.

### 2. Engine de variáveis (puro)

`src/server/email/templateVars.ts`:
- `AVAILABLE_VARIABLES`: array com `{ key, label, description, types[] }` — define quais variáveis aparecem para quais tipos.
- `buildVariableContext(order, profile, items)`: monta `Record<string, string>` a partir do pedido real com fallbacks amigáveis (ex.: `{{transportadora}}` → "—" se nulo; `{{cliente_nome}}` → primeiro nome do profile/snapshot).
- `interpolate(text, context)`: substitui `{{var}}` → valor, deixa `{{var_desconhecida}}` literal e devolve lista de tokens não reconhecidos.
- `validateTemplate({subject, intro, ...}, type)`: retorna `{unknownVars: string[]}` para o editor avisar antes de salvar.

Variáveis suportadas: `cliente_nome`, `cliente_email`, `pedido_numero`, `pedido_status`, `pagamento_status`, `pedido_total`, `resumo_itens` (string curta), `site_url`, `pedido_url`, `transportadora`, `codigo_rastreio`, `motivo_cancelamento`, `data_pedido`, `data_entrega`.

**LGPD**: nenhuma variável expõe CPF, token, dados de cartão, chaves internas. `resumo_itens` produz texto curto (3 itens + "…"), nunca o snapshot completo de endereço.

### 3. Integração com `orderEmails.ts` / `templates.ts`

Mudança mínima e cirúrgica:

1. `sendOrderEmail` carrega `email_templates` pelo `type` no início.
2. Se a linha existe e `is_active=false` e a chamada **não tem `force=true`** → retorna `{ok:true, skipped:"template_disabled"}` sem enviar (o reenvio manual do admin sempre passa `force=true`, então `allow_manual_resend=false` é validado dentro do `resendOrderEmail`).
3. Constrói `variableContext` e chama o novo `buildOrderEmailTemplate` passando o **override opcional**: `{ subject?, preheader?, headline?, introHtml?, ctaLabel?, ctaUrl?, secondaryCta? }`.
4. Em `templates.ts`, `getContent(p)` continua retornando o conteúdo padrão por tipo; um wrapper aplica o override por cima quando o campo não é null/vazio, e roda `interpolate` em cada string final. **Os blocos visuais (itens, totais, retirada, frete local) continuam idênticos** — admin não mexe neles.

Isso garante que removendo a linha do banco ou zerando os campos, o comportamento atual volta automaticamente.

### 4. Server functions (`src/server/emailTemplates.functions.ts`)

- `listEmailTemplates()` — admin: retorna todas as linhas + os defaults do código (para mostrar "padrão do código" quando o campo está vazio).
- `getEmailTemplate({type})` — admin: linha + defaults + lista de variáveis aplicáveis ao tipo.
- `updateEmailTemplate({type, fields, confirmUnknownVars?})` — admin com MFA. Valida variáveis; se houver desconhecidas e `confirmUnknownVars !== true`, retorna `{ok:false, unknownVars}` para o front pedir confirmação. Auditoria via `logAdminAction`.
- `previewEmailTemplate({type, orderId})` — admin: carrega pedido real, monta contexto, devolve `{subject, html, text}` renderizado (mesma engine do envio). Sem enviar.
- `sendTestEmailTemplate({type, orderId, recipientEmail})` — admin com MFA: renderiza com pedido real + envia via `sendTransactionalEmail` para o e-mail informado. Loga em `email_events` com `type` prefixado `test_<type>` para não confundir com envios reais.
- `listEmailEventsForTemplate({type, limit})` — histórico filtrado.

### 5. Telas (TanStack routes)

**`/admin/comunicacao/emails`** (lista):
- Tabela com: nome exibido, chave técnica, evento/gatilho, status (badge ativo/inativo), envio automático (sim/não), reenvio manual (sim/não), última atualização, ações (Editar / Pré-visualizar / Testar).
- Header com link para `/admin/pedidos` (onde fica o reenvio por pedido) e para histórico geral em `/admin/seguranca/auditoria` filtrado por `email`.

**`/admin/comunicacao/emails/$type`** (editor):
- Coluna esquerda (form): assunto, pré-header, headline, corpo (textarea grande com suporte a `<br/>`/`<strong>`), CTA label, CTA URL, CTA secundário label/URL, switches `is_active`/`auto_send`/`allow_manual_resend`.
- Cada campo tem placeholder mostrando o **padrão do código** (read-only ao lado), com botão "restaurar padrão" que limpa a linha (volta ao fallback).
- Coluna direita (sidebar):
  - Painel "Variáveis disponíveis" — clicável, copia `{{var}}`.
  - Painel "Pré-visualização": select de pedido real (default: pedido mais recente real, descartando #1–#13 conforme regra de testes antigos) + botão "Atualizar preview". Renderiza assunto + iframe sandboxed com o HTML.
  - Painel "Enviar teste": input de e-mail + botão "Enviar teste".
- Ao salvar: se `unknownVars.length > 0`, modal "Variáveis desconhecidas: {{x}}, {{y}}. Salvar mesmo assim?".

### 6. Reuso e compatibilidade

- **Histórico**: reusar `email_events` (já existe). A aba "Histórico" do editor faz query por `type` (e o `test_<type>` aparece marcado como teste).
- **Reenvio manual** já existente em `/admin/pedidos/{id}` continua funcionando — só adiciono uma checagem: se `allow_manual_resend=false` na linha, o botão fica desabilitado com tooltip.
- **Auditoria** via `logAdminAction` em update/test send.
- **`order_refunded`** entra como linha no banco e como `case` em `templates.ts`/`EmailMessageType` apenas com defaults (assunto/corpo prontos). Sem trigger automático nesta fase — fica disponível para reenvio manual e para uma fase futura de fluxo de reembolso.

### 7. Sidebar admin

Adicionar item "Comunicação → Modelos de e-mail" no `AdminSidebar.tsx` (grupo Configurações).

---

### Arquivos novos
- `supabase/migrations/<ts>_email_templates.sql` (tabela + RLS + trigger auditoria + seed das 9 linhas)
- `src/server/email/templateVars.ts`
- `src/server/emailTemplates.functions.ts`
- `src/routes/admin.comunicacao.emails.tsx` (lista)
- `src/routes/admin.comunicacao.emails.$type.tsx` (editor + preview + teste)

### Arquivos alterados
- `src/server/email/templates.ts` — adiciona `order_refunded`, aceita override por parâmetro, roda `interpolate` nas strings finais
- `src/server/email/orderEmails.ts` — busca `email_templates`, aplica override, respeita `is_active`/`auto_send`/`allow_manual_resend`
- `src/server/orderAdmin.functions.ts` — valida `allow_manual_resend` no `resendOrderEmail`; adiciona `order_refunded` na enum
- `src/routes/admin.pedidos.$orderId.tsx` — adiciona `order_refunded` no card de reenvio; desabilita botão quando `allow_manual_resend=false`
- `src/components/admin/AdminSidebar.tsx` — novo item de menu

### O que NÃO muda
- Resend / transport / chaves
- Mercado Pago, webhook, checkout, pedidos, estoque, leads, homepage
- RLS de outras tabelas
- Layout/HTML visual dos e-mails (admin só edita textos)
- Disparos automáticos atuais (delivered/cancelled etc.)

### Critérios de aceite cobertos
1–7 da tela e variáveis ✅ · 8 LGPD via lista fechada de variáveis ✅ · 9 controles por linha ✅ · 10 camada de envio intacta ✅ · Build/TS verificados ao final.

Posso prosseguir com essa abordagem?