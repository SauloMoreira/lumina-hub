# Checklist de Produção Assistida — Primeiros 7 dias

- **Versão:** 1.0
- **Data:** 12/maio/2026
- **Público-alvo:** Equipe operacional e técnica
- **Objetivo:** Acompanhamento estruturado dos 7 primeiros dias após o Go-Live.

---

## Como usar

Cada dia traz um conjunto de verificações. Marque status, registre evidência
(prints, IDs, links) e ação corretiva se necessário. Use a tabela ao final de
cada dia para consolidar.

Legenda de status: ✅ ok / ⚠️ atenção / ❌ falha / ⏳ aguardando.

---

## Dia 0 — Publicação

| Item | Verificação | Responsável | Frequência |
|---|---|---|---|
| Domínio www | `https://www.ledmarica.com.br` retorna 200 | Tech | 1× |
| SSL | Certificado válido em www e apex | Tech | 1× |
| Redirect | Apex → www (302/301, sem loop) | Tech | 1× |
| Mercado Pago | Webhook configurado em `https://www.ledmarica.com.br/api/public/mercadopago/webhook` | Tech | 1× |
| E-mail | Disparo de e-mail de teste OK (Resend) | Op | 1× |
| GA4 | Banner LGPD → Aceitar → script `gtag/js` carrega | Tech | 1× |
| Search Console | Propriedade verificada e sitemap enviado | Tech | 1× |
| PageSpeed | Rodar e arquivar baseline (mobile e desktop) | Tech | 1× |
| Pedido teste | Pedido real de baixo valor pago ponta a ponta | Op + Tech | 1× |

---

## Dia 1

| Item | Verificação | Frequência |
|---|---|---|
| Pedidos | Conferir todos os pedidos do dia em `/admin/pedidos` | 3×/dia |
| Webhooks | Conferir `payment_webhook_events` (todos `processed=true`) | 3×/dia |
| E-mails | Conferir `email_events` (sem `failed`) | 3×/dia |
| Estoque | Conferir baixa coerente em `stock_decrement_audit` | 1×/dia |
| Leads | Conferir leads novos em `/admin/leads` | 1×/dia |
| GA4 tempo real | Confirmar visitantes ativos | 2×/dia |
| Erros admin | Conferir Painel do Dia (alertas) | 2×/dia |

---

## Dia 2

- Revisar carrinhos abandonados em `/admin/carrinhos-abandonados`.
- Revisar leads novos e classificar por origem.
- Conferir origem de tráfego (UTMs em GA4).
- Conferir pedidos pendentes (status MP `pending`).
- Tratar e-mails `failed` ou `pending` (reenviar manualmente se necessário).

---

## Dia 3

- Rodar PageSpeed novamente; comparar com baseline do Dia 0.
- Revisar produtos mais vistos (GA4 + Painel).
- Conferir buscas em `/admin/produtos/buscas` (palavras sem resultado).
- Conferir erros do chat Ledinho (sessões com handoff repetido).

---

## Dia 4

- Revisar estoque baixo / esgotado.
- Conferir produtos sem imagem ou SEO incompleto (`/admin/seo`,
  `/admin/produtos/qualidade`).
- Conferir performance de campanhas ativas.
- Revisar cupons (uso, validade, limite).

---

## Dia 5

- Revisar B2B: empresas pendentes em `/admin/empresas`.
- Conferir leads de atacado (origem `b2b`).
- Conferir templates WhatsApp em uso.
- Avaliar campanhas B2B vs B2C.

---

## Dia 6

- Revisar SEO em Search Console (cobertura, indexação, erros).
- Confirmar sitemap acessível em `/sitemap.xml`.
- Conferir páginas 404/erro indexadas.
- Avaliar oportunidades por palavra-chave.

---

## Dia 7

- Consolidar relatório da primeira semana:
  - Total de pedidos / receita / ticket médio.
  - Conversão (visitantes → pedidos).
  - Bugs encontrados e tratados.
  - Melhorias propostas para a próxima semana.
- Decidir se executa o [Prompt de Limpeza](./09-prompt-limpeza-geral-plataforma.md).
- Iniciar planejamento do [Roadmap 30 dias](./07-roadmap-pos-go-live.md).

---

## Tabela consolidada (modelo)

| Item | Responsável | Horário/Frequência | Status | Evidência | Ação corretiva |
|---|---|---|---|---|---|
| | | | | | |

> Recomenda-se uma planilha ou board (Trello/Notion/Linear) baseado nesta
> tabela para acompanhamento diário durante a semana.

---

## Critérios de saída (fim do Dia 7)

- ✅ Nenhum webhook MP `unprocessed` por mais de 1 hora.
- ✅ Nenhum e-mail `failed` sem tratativa.
- ✅ Nenhum pedido pago sem baixa de estoque.
- ✅ GA4 mostra dados consolidados no relatório padrão.
- ✅ Search Console com sitemap aceito.
- ✅ Bugs críticos = 0.

Atendidos os critérios → **encerrar produção assistida** e migrar para
operação regular + roadmap.
