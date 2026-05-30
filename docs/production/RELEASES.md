# RELEASES — Led Maricá

Registro detalhado de cada release publicada em produção.
Resumo curto vai em `CHANGELOG.md`; o dossiê completo fica aqui.

---

## v1.0.0 — Produção Assistida (3 meses)

| Campo               | Valor                                              |
|---------------------|----------------------------------------------------|
| Versão              | 1.0.0 (marco operacional)                          |
| Data                | 30/mai/2026                                        |
| Término previsto    | 30/ago/2026                                        |
| Responsável         | Saulo Moreira (saulocmoreira@gmail.com)            |
| Tipo                | operacional (governança)                           |
| Status              | em andamento                                       |
| ChangeControl       | CC-2026-002                                        |
| Backup pré-deploy   | snapshot diário Lovable Cloud (BACKUP_LOG)         |
| Plano de rollback   | não aplicável (marco operacional)                  |

### Descrição
Início oficial da janela de Produção Assistida de 3 meses. Define cadência
de monitoramento diário (dias 1–15) e semanal (semanas 3–12), regras de
correção em produção, classificação de incidentes, política de backup
reforçada e critérios de encerramento. Documento mestre:
`PRODUCAO_ASSISTIDA_3_MESES.md`.

### Arquivos criados
- `docs/production/PRODUCAO_ASSISTIDA_3_MESES.md`
- `docs/production/PRODUCAO_ASSISTIDA_SEMANA_01..04.md`
- `docs/production/INCIDENTES_PRODUCAO.md`
- `docs/production/MELHORIAS_PRODUCAO.md`

### Impacto esperado
- Operação interna passa a registrar incidentes/melhorias/relatórios
  semanais sistematicamente.
- Nenhum impacto funcional para o cliente final.

### Riscos
- Operacional: equipe precisa adotar a rotina de monitoramento.

### Testes realizados
- N/A (documentação e rotina).

---

## v1.0.0 — Baseline de produção

| Campo               | Valor                                              |
|---------------------|----------------------------------------------------|
| Versão              | 1.0.0                                              |
| Data                | 30/mai/2026                                        |
| Responsável         | Saulo Moreira (saulocmoreira@gmail.com)            |
| Tipo                | operacional (marco)                                |
| Status              | publicado                                          |
| ChangeControl       | CC-2026-001                                        |
| Backup pré-deploy   | snapshot Lovable Cloud do dia (ver BACKUP_LOG)     |
| Plano de rollback   | não aplicável (baseline)                           |

### Descrição
Congelamento do estado atual como referência oficial de produção da
plataforma Led Maricá. A partir desta versão, qualquer alteração entra
no fluxo de `CHANGE_CONTROL.md`.

### Arquivos alterados
- Nenhum (entrada de governança).

### Impacto esperado
- Nenhum impacto funcional para o cliente final.
- Operação interna passa a exigir versão + changelog + checklist.

### Riscos
- Nenhum risco técnico imediato.
- Risco operacional: equipe precisa adotar o fluxo a partir de hoje.

### Testes realizados
- Smoke test manual: home, catálogo, carrinho, login, painel admin.
- Webhook Mercado Pago validado (pedido #14, 06/mai/2026).

---

## Template para próximas releases

```md
## vX.Y.Z — <título curto>

| Campo               | Valor                                              |
|---------------------|----------------------------------------------------|
| Versão              | X.Y.Z                                              |
| Data                | dd/mmm/aaaa                                        |
| Responsável         |                                                    |
| Tipo                | hotfix / melhoria / segurança / visual / ...       |
| Status              | planejado / em teste / aprovado / publicado / revertido |
| ChangeControl       | CC-AAAA-NNN                                        |
| Backup pré-deploy   | BACKUP_LOG#AAAA-MM-DD                              |
| Plano de rollback   | ROLLBACK_PLAN.md#cenário-X                         |

### Descrição
...

### Arquivos alterados
- ...

### Impacto esperado
- ...

### Riscos
- Segurança: ...
- Regressão: ...

### Testes realizados
- ...

### Pós-deploy / monitoramento
- ...
```
