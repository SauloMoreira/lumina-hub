# CHANGELOG — Led Maricá (Produção)

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e versionamento [SemVer](https://semver.org/lang/pt-BR/).

> Toda entrada deve referenciar a release em `RELEASES.md` e o item de
> mudança em `CHANGE_CONTROL.md`.

---

## [1.0.0 — Produção Assistida] — 2026-05-30

### Marco
- Início oficial da **Produção Assistida v1.0.0** (30/mai/2026 → 30/ago/2026).
- Governança detalhada em `PRODUCAO_ASSISTIDA_3_MESES.md`.
- Monitoramento diário nos primeiros 15 dias; semanal a partir da semana 03.
- Templates semanais e arquivos de incidentes/melhorias criados.
- ChangeControl: CC-2026-002.

---

## [1.0.0] — 2026-05-30

### Marco
- Entrada oficial em produção da plataforma Led Maricá.
- Baseline congelado em `PRODUCTION_BASELINE_v1.0.0.md`.

### Incluído
- Loja pública B2C (catálogo, busca, kits/combos, checkout Mercado Pago).
- Loja B2B (preço atacado server-side, aprovação automática/manual).
- Painel admin com MFA AAL2 obrigatório (único admin: saulocmoreira@gmail.com).
- CRM/leads, automações WhatsApp, e-mails transacionais via Resend.
- Auditoria admin (triggers + helper semântico).
- LGPD: banner de cookies + carregamento condicional de pixels.
- Integração GA4 `G-7B7PLYJLNP`.
- Webhook Mercado Pago validado em produção (pedido #14, 06/mai/2026).

---

## Convenção de versões

- **MAJOR (x.0.0)** — mudança estrutural ou que quebra contrato.
- **MINOR (1.x.0)** — melhoria funcional sem quebra.
- **PATCH (1.0.x)** — hotfix, correção, ajuste visual.

## Tipos de alteração

`hotfix` · `melhoria` · `segurança` · `visual` · `operacional` ·
`integração` · `performance`

## Template para novas entradas

```md
## [x.y.z] — AAAA-MM-DD
**Tipo:** hotfix | melhoria | segurança | visual | operacional | integração | performance
**Responsável:** <nome>
**ChangeControl:** CC-AAAA-NNN
**Release:** ver RELEASES.md#xyz

### Adicionado
- ...

### Alterado
- ...

### Corrigido
- ...

### Removido
- ...

### Segurança
- ...

### Notas de rollback
- Versão anterior estável: x.y.z
- Backup pré-deploy: BACKUP_LOG#AAAA-MM-DD
```
