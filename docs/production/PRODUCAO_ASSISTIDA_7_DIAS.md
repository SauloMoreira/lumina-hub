# Produção Assistida — 7 dias

**Janela:** 30/mai/2026 → 05/jun/2026
**Responsável:** Saulo Moreira
**Objetivo:** acompanhar de perto a operação logo após o Go-Live,
detectar regressões silenciosas e validar que os fluxos críticos seguem
saudáveis em condição real de uso.

---

## Itens monitorados diariamente

- Pedidos criados (loja pública).
- Pagamentos aprovados (Mercado Pago).
- Webhooks Mercado Pago (`payment_webhook_events`).
- Baixa de estoque (`stock_decrement_audit`).
- `email_events` — quantidade em `pending` / `failed`.
- Leads / CRM — novos leads + interações.
- GA4 em tempo real — sessões, eventos, conversões.
- Erros do admin — qualquer 4xx/5xx em rotas `/admin/*`.
- Chat Ledinho — conversas iniciadas + handoff.
- WhatsApp / handoff de leads.
- Logs de segurança — tentativas de acesso admin sem MFA, falhas AAL2.
- Falhas de upload (imagens de produtos/banners).
- Carrinhos abandonados — volume e taxa.

## Critérios para escalar (abrir incidente)

- Qualquer pedido com pagamento aprovado e estoque não decrementado.
- Qualquer webhook MP em erro persistente.
- Qualquer e-mail transacional `failed` recorrente (>3 em 1h).
- Qualquer tentativa de acesso admin sem MFA bem-sucedida.
- Erro 5xx em rota pública crítica por mais de 5min.
- Vazamento aparente de dado sensível (`cost_price`, `b2b_price`,
  margem) para visitante.

## Relatórios diários

Cada dia gera um arquivo:

- `PRODUCAO_ASSISTIDA_DIA_01.md`
- `PRODUCAO_ASSISTIDA_DIA_02.md`
- `PRODUCAO_ASSISTIDA_DIA_03.md`
- `PRODUCAO_ASSISTIDA_DIA_04.md`
- `PRODUCAO_ASSISTIDA_DIA_05.md`
- `PRODUCAO_ASSISTIDA_DIA_06.md`
- `PRODUCAO_ASSISTIDA_DIA_07.md`

### Template diário

```md
# Produção Assistida — Dia NN — dd/mm/aaaa

## Resumo
- Pedidos: N
- Pagamentos aprovados: N
- Webhooks MP: N processados, N erros
- Estoque: N decrementos, 0 dupla baixa
- E-mails: N enviados, N pending, N failed
- Leads: N novos, N interações
- GA4: N sessões, N conversões
- Erros admin: N
- Tentativas admin sem MFA: 0
- Incidentes abertos: N

## Observações
- ...

## Ações tomadas
- ...

## Pendências para o dia seguinte
- ...
```

## Encerramento

Ao final dos 7 dias, gerar `PRODUCAO_ASSISTIDA_RESUMO.md` consolidando:
- Total de pedidos / receita aprovada.
- Total de incidentes (por severidade).
- Lições aprendidas.
- Itens de melhoria abertos como ChangeControl.
- Recomendação: encerrar produção assistida ou estender por mais 7 dias.
