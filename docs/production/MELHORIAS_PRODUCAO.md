# Melhorias em Produção — Led Maricá

Backlog de melhorias identificadas durante a Produção Assistida
(30/mai/2026 → 30/ago/2026) e além.

ID: `MEL-AAAA-NNN`.

---

## Priorização

| Prioridade | Critério                                                              |
|------------|-----------------------------------------------------------------------|
| P0         | Risco para operação ou receita; entrar no próximo deploy possível.    |
| P1         | Ganho relevante (conversão, custo, segurança); planejar no mês.       |
| P2         | Melhoria de UX/operação; agendar quando houver janela.                |
| P3         | Ideia / oportunidade; avaliar no roadmap evolutivo (mês 3).           |

## Backlog atual

| ID | Origem            | Prioridade | Escopo                                  | Status     |
|----|-------------------|------------|-----------------------------------------|------------|
| —  | governança/mai-26 | P2         | Backup mensal de storage (rotina manual)| planejada  |
| —  | governança/mai-26 | P2         | Avaliar retenção 30d do backup nativo   | planejada  |
| —  | governança/mai-26 | P3         | Automação export storage via pg_cron    | proposta   |

## Histórico de melhorias aprovadas

_Nenhuma melhoria fechada ainda._

---

## Template

```md
### MEL-AAAA-NNN — <título>
- **Data:** dd/mm/aaaa
- **Origem:** cliente / monitoramento / equipe / GA4 / Search Console
- **Prioridade:** P0 | P1 | P2 | P3
- **Escopo:** loja pública / admin / B2B / e-mail / CRM / SEO / performance / ...
- **Descrição:** o que melhorar e por quê
- **Hipótese de impacto:** conversão, custo, segurança, UX
- **Esforço estimado:** baixo / médio / alto
- **Risco:** baixo / médio / alto (segurança, regressão)
- **Dependências:** ChangeControl Crítico? Backup? Migração?
- **Status:** proposta / aprovada / em execução / publicada / postergada / descartada
- **Versão alvo:** vX.Y.Z
- **Resultado pós-publicação:** indicadores observados
```
