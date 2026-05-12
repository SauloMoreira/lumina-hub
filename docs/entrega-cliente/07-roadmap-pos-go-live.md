# Roadmap Pós-Go-Live — 30 / 60 / 90 dias

- **Versão:** 1.0
- **Data:** 12/maio/2026
- **Público-alvo:** Cliente, produto, equipe técnica
- **Objetivo:** Plano de evolução técnica e funcional após o Go-Live, baseado em recomendações Codex e homologação.

---

## Como ler

Cada item traz: **prioridade**, **esforço**, **impacto**, **risco** e
**responsável sugerido**.

- Prioridade: **alta / média / baixa**.
- Esforço: **S** (≤ 1 dia), **M** (2–5 dias), **L** (1–2 semanas), **XL** (> 2 semanas).
- Impacto: **alto / médio / baixo**.
- Risco: **alto / médio / baixo**.

---

## 30 dias — Estabilização e observabilidade

| Item | Prioridade | Esforço | Impacto | Risco | Responsável |
|---|---|---|---|---|---|
| Monitoramento ativo de webhooks MP (alertas em falhas) | Alta | M | Alto | Baixo | Tech |
| Monitoramento ativo de e-mails `failed` / `pending` | Alta | S | Alto | Baixo | Tech |
| Job de retry automático para e-mails `pending` | Alta | M | Alto | Médio | Tech |
| Verificar Search Console + indexação | Alta | S | Alto | Baixo | SEO |
| Otimizar PageSpeed (imagens, code splitting básico) | Média | M | Médio | Baixo | Tech |
| Política de retenção / purge do chat anônimo | Média | M | Médio | Baixo | Tech + Legal |
| Relatórios operacionais semanais consolidados | Média | M | Médio | Baixo | Op + Tech |
| Melhoria de grids do admin (filtros salvos, exportações) | Média | M | Médio | Baixo | Tech |
| Avaliar inclusão de kits no `sitemap.xml` | Baixa | S | Baixo | Baixo | SEO |
| Documentação operacional contínua (atualizar manual) | Média | M | Médio | Baixo | Op |

---

## 60 dias — Robustez e automação

| Item | Prioridade | Esforço | Impacto | Risco | Responsável |
|---|---|---|---|---|---|
| Criação de pedido em RPC transacional única (atomicidade) | Alta | L | Alto | Médio | Tech |
| Fila / worker para envio de e-mails e sync CRM | Alta | L | Alto | Médio | Tech |
| Testes automatizados de webhook MP e checkout (e2e parcial) | Alta | L | Alto | Médio | Tech / QA |
| Dashboards de observabilidade (latência, erros, taxa de sucesso) | Média | M | Médio | Baixo | Tech |
| Melhorias em B2B (negociações, propostas, histórico) | Média | L | Alto | Médio | Tech + Comercial |
| Relatórios avançados de campanhas (ROAS, atribuição) | Média | L | Médio | Baixo | Marketing |
| Migração para Lovable Emails (após domínio próprio em Cloud) | Alta | M | Médio | Baixo | Tech |
| Auditoria periódica de RLS e roles | Média | S | Médio | Baixo | Tech / Sec |

---

## 90 dias — Maturidade e escala

| Item | Prioridade | Esforço | Impacto | Risco | Responsável |
|---|---|---|---|---|---|
| CSP estrita com nonce/hash em header | Alta | L | Alto | Médio | Tech |
| Code splitting completo + bundle analysis | Média | L | Médio | Baixo | Tech |
| Suíte e2e completa (Playwright/Cypress) | Alta | XL | Alto | Médio | QA |
| Política formal LGPD: retenção, anonimização, DSR | Alta | L | Alto | Médio | Legal + Tech |
| Roles administrativos granulares (se demanda real) | Média | XL | Alto | Médio | Tech + Op |
| Homepage 100% administrável (cards de benefício, promo, etc.) | Média | L | Médio | Baixo | Tech |
| Início do projeto White-Label (ver doc 08) | Média | XL | Alto | Médio | Produto + Tech |
| Revisão de SEO técnico aprofundada | Média | L | Médio | Baixo | SEO |
| Avaliação de PWA / app nativo wrapper | Baixa | L | Médio | Médio | Tech |

---

## Riscos transversais

- **Mudança de provider de e-mail (Resend → Lovable Emails)** — exige
  validação completa antes do switch; risco de quebra silenciosa de
  templates.
- **Refatoração de criação de pedido em RPC única** — afeta caminho
  crítico; exige feature flag e rollback rápido.
- **CSP estrita** — pode quebrar scripts legítimos; iniciar em
  `Report-Only`, depois enforce.
- **Roles granulares** — aumenta complexidade operacional; só implementar
  com demanda real validada.

---

## Critérios de revisão

A cada marco (30/60/90), revisar:

- O que foi entregue (vs. previsto).
- Métricas operacionais (pedidos, conversão, ticket, NPS interno).
- Bugs em aberto.
- Próximos itens promovidos do backlog.

---

## Conclusão

O roadmap prioriza **estabilização** nos primeiros 30 dias, **robustez e
automação** entre 30 e 60 dias, e **maturidade técnica e escala** entre 60
e 90 dias. O projeto White-Label entra como evolução estratégica, descrita
em separado no documento [08](./08-plano-white-label.md).

**Próximos passos:**

1. Validar prioridades com cliente.
2. Definir responsáveis nominais.
3. Iniciar entregas de 30 dias logo após a produção assistida.
