# RELEASES — Led Maricá

Registro detalhado de cada release publicada em produção.
Resumo curto vai em `CHANGELOG.md`; o dossiê completo fica aqui.

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
