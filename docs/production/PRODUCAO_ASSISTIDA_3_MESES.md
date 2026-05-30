# Produção Assistida — 3 Meses (v1.0.0)

**Marco oficial:** Led Maricá — Produção Assistida v1.0.0
**Início:** 30/mai/2026
**Término previsto:** 30/ago/2026
**Responsável:** Saulo Moreira (saulocmoreira@gmail.com)
**Status:** ativa

---

## 1. Objetivo

Acompanhar a operação real da plataforma logo após o Go-Live por um período
de 3 meses, monitorando estabilidade, pedidos, pagamentos, webhooks,
estoque, e-mails transacionais, CRM, segurança, performance, GA4, SEO e
experiência do usuário, garantindo correção rápida de incidentes e
evolução controlada.

## 2. Período e ritmo

- **Dias 1–15** (30/mai → 13/jun): monitoramento **diário** completo.
- **Semanas 3–12** (14/jun → 30/ago): monitoramento **semanal** consolidado.
- **Encerramento:** relatório do mês 3 + decisão de contrato de sustentação.

## 3. Governança aplicada

Toda alteração durante a produção assistida segue:

- `docs/production/CHANGE_CONTROL.md` (fluxo de 11 etapas + classificação).
- `docs/production/DEPLOY_CHECKLIST.md` (antes de qualquer publicação).
- `docs/production/ROLLBACK_PLAN.md` (obrigatório em Alta/Crítica).
- `docs/production/BACKUP_POLICY.md` + `BACKUP_LOG.md`.
- `docs/production/CHANGELOG.md` + `RELEASES.md` (SemVer).

Regras absolutas durante a janela:

1. Não publicar sem versão, changelog e responsável aprovado.
2. Não alterar checkout, Mercado Pago, webhook, estoque, pedidos, RLS,
   MFA, DNS, GA4 ou e-mails transacionais sem plano de teste + rollback.
3. Toda alteração Crítica/Alta exige backup manual pré-deploy.
4. Toda correção registra evidência de teste no incidente.
5. Toda melhoria é classificada por prioridade em `MELHORIAS_PRODUCAO.md`.
6. Toda falha vira incidente em `INCIDENTES_PRODUCAO.md`.
7. Nenhum secret, token ou PII aparece em logs ou relatórios.

## 4. Rotina diária (primeiros 15 dias)

### 4.1 Pedidos
- Criados, pendentes, aprovados, cancelados.
- Divergência de status (`orders.status` vs `payment_status`).
- Pedidos sem `payment_status` esperado.

### 4.2 Mercado Pago
- Webhooks recebidos / processados.
- `signature mismatch`, retries, falhas de preferência.
- Pagamentos aprovados / pendentes (`payment_status = approved`).

### 4.3 Estoque
- Baixa automática conferida em `stock_decrement_audit`.
- Estoque negativo, baixa duplicada, venda sem estoque.

### 4.4 E-mails transacionais
- `email_events`: `sent` / `pending` / `failed`.
- Templates monitorados: `payment_approved`, `order_created`,
  `pedido enviado`, `pedido entregue`, `cancelamento`.

### 4.5 CRM / Leads
- Leads criados / convertidos.
- Sync de pedido aprovado via `syncApprovedOrderToLead`.
- Handoff WhatsApp e interações registradas.

### 4.6 Chat Ledinho
- Mensagens, handoff humano, abuso/spam, erro de IA, rate limit.

### 4.7 Admin
- Erros em dashboard, pedidos, produtos, estoque, campanhas.
- Ações administrativas críticas em `admin_audit_log`.

### 4.8 GA4
- Usuários em tempo real, origem do tráfego, páginas mais vistas,
  eventos `view_product`, `add_to_cart`, `begin_checkout`, `purchase`.

### 4.9 Segurança
- Tentativas de acesso admin, falhas MFA/AAL2.
- Uploads rejeitados, bloqueios SVG/data URL, erros de RLS.
- Re-rodar `supabase--linter` quando houver mudança em policies.

### 4.10 Performance
- Lentidão percebida, PageSpeed, 4xx/5xx, console errors,
  imagens pesadas.

## 5. Rotina semanal (semanas 3 a 12)

Consolidar semanalmente:
- Vendas, pedidos, pagamentos, webhooks.
- E-mails, estoque, leads, campanhas.
- GA4, Search Console, performance.
- Erros, melhorias solicitadas, chamados do cliente, sugestões comerciais.

Resumo da semana em `PRODUCAO_ASSISTIDA_SEMANA_NN.md` contendo:
- principais indicadores
- incidentes (link para `INCIDENTES_PRODUCAO.md`)
- correções publicadas (link para `CHANGELOG.md` / `RELEASES.md`)
- melhorias (link para `MELHORIAS_PRODUCAO.md`)
- riscos
- pendências
- recomendações

## 6. Classificação de incidentes

| Severidade | Exemplos                                                                                                                                                              | Resposta            |
|------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------|
| CRÍTICO    | Pagamento aprovado sem confirmação de pedido; pedido sem pagamento; estoque baixa duplicado / não baixa; webhook inválido aceito; vazamento; admin sem MFA; checkout fora | Imediata, 24/7      |
| ALTO       | E-mail transacional essencial falhando; carrinho/checkout com cálculo errado; B2B vazando preço; cupom indevido; venda sem estoque; falha grave no admin                | Mesmo dia útil      |
| MÉDIO      | Erro operacional com contorno; falha em campanha; lead não sincronizado; email pending isolado; lentidão pontual                                                       | 48h úteis           |
| BAIXO      | Texto, layout, ajuste visual, melhoria UX                                                                                                                              | Próxima janela      |
| INFO       | Observação, melhoria futura, oportunidade comercial                                                                                                                    | Backlog             |

Registrar em `INCIDENTES_PRODUCAO.md` com ID `INC-AAAA-NNN`.

## 7. Política de correção em produção

1. Registrar incidente.
2. Classificar severidade.
3. Avaliar impacto.
4. Definir versão (SemVer).
5. Backup pré-mudança quando exigido.
6. Corrigir no menor escopo possível.
7. Testar fluxo afetado.
8. Build / TypeScript sem erros.
9. Security check quando aplicável.
10. Atualizar `CHANGELOG.md` + `RELEASES.md`.
11. Publicar (após `DEPLOY_CHECKLIST.md`).
12. Monitorar pós-publicação na janela da classificação.
13. Fechar incidente com evidência.

Versionamento sugerido:
- `v1.0.x` — hotfix pequeno.
- `v1.x.0` — melhoria funcional / nova feature pequena.
- `v2.0.0` — mudança estrutural.

## 8. Backups

Backup nativo diário do Lovable Cloud cobre o banco. Storage exige
rotina manual mensal. Registro em `BACKUP_LOG.md` para:
- verificação mensal do backup nativo;
- backups manuais pré-deploy;
- testes de restauração trimestrais.

Backup manual **obrigatório** antes de mudar: banco/migrations, checkout,
MP, webhook, estoque, RLS, MFA, importação em massa, e-mails
transacionais, produtos em massa.

## 9. Indicadores mínimos

### Operação
Pedidos criados, pagos, cancelados, pendentes; ticket médio.

### Financeiro / pagamento
Pagamentos aprovados; falhas de pagamento; webhooks processados / com erro.

### Estoque
Produtos com estoque baixo, sem estoque, baixas automáticas no dia.

### Comercial
Leads, leads convertidos, handoffs WhatsApp, origem de tráfego, campanhas.

### Técnico
Erros 4xx/5xx, e-mails pending/failed, tempo de carregamento, security
warnings, incidentes abertos.

## 10. Checklist operacional (rápido)

- [ ] Webhook MP processou os pagamentos do dia.
- [ ] Pedidos aprovados decrementaram estoque.
- [ ] E-mails transacionais sem `failed`.
- [ ] Leads do dia sincronizados.
- [ ] Nenhuma tentativa admin sem MFA bem-sucedida.
- [ ] `admin_audit_log` registrando ações.
- [ ] Painel do Dia sem alertas novos.
- [ ] Sem 5xx em rotas públicas críticas.

## 11. Modelo de relatório semanal

```md
# Semana NN — dd/mm a dd/mm

## Indicadores
- Pedidos: N (pagos: N, cancelados: N) | Ticket médio: R$
- Pagamentos aprovados: N | Webhooks: N processados / N com erro
- Estoque: N decrementos | 0 dupla baixa | N sem estoque
- E-mails: N enviados / N pending / N failed
- Leads: N novos / N convertidos / N handoffs
- GA4: N sessões / N conversões

## Incidentes
- INC-AAAA-NNN — <título> — severidade — status

## Correções publicadas
- vX.Y.Z — <descrição> — link CHANGELOG

## Melhorias
- Aprovadas, em análise, postergadas

## Riscos
- ...

## Pendências
- ...

## Recomendações
- ...
```

## 12. Modelo de relatório mensal

### Mês 1 — Estabilização
- Incidentes (críticos/altos) + correções publicadas.
- Comportamento dos primeiros clientes.
- Melhorias urgentes identificadas.
- Decisão: seguir para mês 2 com plano de evolução.

### Mês 2 — Performance comercial
- Vendas, campanhas, SEO, usabilidade.
- Melhorias funcionais entregues.
- Painel comercial consolidado.

### Mês 3 — Encerramento
- Status final (estável / atenção / em risco).
- Roadmap evolutivo proposto.
- Recomendação de contrato de sustentação.
- Decisão: encerrar produção assistida ou estender.

## 13. Critérios de encerramento

A produção assistida só é encerrada quando:
- Nenhum incidente crítico aberto.
- Nenhum incidente alto sem plano de correção.
- Backup nativo validado (retenção, último backup visível,
  pelo menos um teste de restauração registrado).
- `DEPLOY_CHECKLIST.md` adotado em 100% dos deploys do trimestre.
- Cliente aprovou o relatório do mês 3.
- Contrato de sustentação definido (ou aceite formal de operação sem
  acompanhamento dedicado).

## 14. Documentos relacionados

- `PRODUCTION_BASELINE_v1.0.0.md`
- `CHANGE_CONTROL.md`
- `DEPLOY_CHECKLIST.md`
- `ROLLBACK_PLAN.md`
- `BACKUP_POLICY.md` · `BACKUP_LOG.md`
- `CHANGELOG.md` · `RELEASES.md`
- `INCIDENTES_PRODUCAO.md`
- `MELHORIAS_PRODUCAO.md`
- `PRODUCAO_ASSISTIDA_SEMANA_01..NN.md`
