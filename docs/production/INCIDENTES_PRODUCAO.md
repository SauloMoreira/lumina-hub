# Incidentes em Produção — Led Maricá

Registro de todos os incidentes detectados durante a Produção Assistida
(30/mai/2026 → 30/ago/2026) e nas fases seguintes.

ID: `INC-AAAA-NNN` (sequencial por ano).

---

## Resumo aberto

| ID | Data       | Severidade | Status   | Título                        | Responsável |
|----|------------|------------|----------|-------------------------------|-------------|
| —  | —          | —          | —        | _nenhum incidente registrado_ | —           |

## Histórico

_Nenhum incidente registrado ainda._

---

## Template

```md
### INC-AAAA-NNN — <título>
- **Data de abertura:** dd/mm/aaaa hh:mm
- **Severidade:** CRÍTICO | ALTO | MÉDIO | BAIXO | INFO
- **Detectado por:** monitoramento diário / cliente / log / GA4 / outro
- **Escopo afetado:** checkout | MP | webhook | estoque | e-mail | admin | ...
- **Impacto:** quem foi afetado e como
- **Detecção:** como foi descoberto + evidência (log, ID de pedido, etc.)
- **Causa raiz:** investigação técnica
- **Ação tomada:** correção aplicada (link ChangeControl + release)
- **Versão de correção:** vX.Y.Z
- **Backup pré-correção:** BACKUP_LOG#dd/mm/aaaa (se aplicável)
- **Evidência de teste:** descrição + screenshots/IDs
- **Pós-monitoramento:** janela observada + resultado
- **Status:** aberto / em correção / corrigido / fechado / reverificado
- **Data de fechamento:** dd/mm/aaaa
- **Lições aprendidas:** o que mudar no processo
```

## Severidades (resumo)

| Severidade | Resposta esperada |
|------------|--------------------|
| CRÍTICO    | Imediata, 24/7     |
| ALTO       | Mesmo dia útil     |
| MÉDIO      | 48h úteis          |
| BAIXO      | Próxima janela     |
| INFO       | Backlog            |

Ver `PRODUCAO_ASSISTIDA_3_MESES.md` §6 para exemplos por categoria.
