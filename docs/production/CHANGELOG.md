# CHANGELOG — Led Maricá (Produção)

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e versionamento [SemVer](https://semver.org/lang/pt-BR/).

> Toda entrada deve referenciar a release em `RELEASES.md` e o item de
> mudança em `CHANGE_CONTROL.md`.

---

## [1.0.2] — 2026-06-01

**Tipo:** melhoria (controlada)
**ChangeControl:** CC-2026-004
**Classificação:** Média

### Adicionado
- Suporte a **dados técnicos opcionais** na importação de produtos via planilha
  (29 campos: marca, modelo, potencia_w, tensao_v, corrente_a, frequencia_hz,
  temperatura_cor_k, fluxo_luminoso_lm, eficiencia_lm_w, soquete,
  grau_protecao_ip, cor_produto, material, dimensoes, peso_kg, comprimento_m,
  bitola_mm, amperagem_a, numero_polos, curva_disjuntor, tipo_instalacao,
  vida_util_horas, certificacao, norma_tecnica, garantia, codigo_fornecedor,
  observacoes_tecnicas, fonte_dados_tecnicos, dados_tecnicos_revisados).
- Catálogo central `TECH_FIELDS` em `src/lib/productImport.ts` com label,
  unidade, validação numérica e padrões (ex.: IP\d{2}).
- Validação leve não-bloqueante (`validateTechValue`):
  números negativos/ inválidos viram erro; campos `certificacao` e
  `norma_tecnica` geram aviso "exige revisão humana com fonte".
- Persistência no commit: `marca → products.brand`, `peso_kg →
  products.weight_kg`, demais campos vão para `product_attributes`
  (label + unidade do catálogo). Campos vazios são ignorados.

### Alterado
- `parseImportSheet` agora lê colunas técnicas além das mínimas — desconhecidas
  são ignoradas; vazias não bloqueiam.
- `validateImportRows` agrega erros/avisos técnicos e devolve `row.tech`
  sanitizado.

### Segurança
- Sem alterações em checkout, Mercado Pago, webhook, estoque de pedidos,
  pedidos, e-mails transacionais, CRM, GA4, DNS, MFA/AAL2, RLS, policies
  ou permissões públicas.
- IA continua proibida de inventar valores técnicos (regra já reforçada no
  `SYSTEM_PROMPT_IA` desde v1.0.0).
- Rota `/admin/produtos/importacao-ia` continua restrita a admin com MFA/AAL2.
- Importação continua exigindo `revisado_humano=sim` + `aprovado_importar=sim`.
- Falha ao inserir atributos técnicos é logada mas não bloqueia o produto
  (best-effort).

### Pendente para v1.0.2.1 (próxima janela)
- Regerar arquivo `public/templates/Cadastro_Minimo_Produtos_Led_Marica_IA.xlsx`
  com as 29 colunas técnicas opcionais, atualizar aba INSTRUÇÕES e adicionar
  aba MAPA_IA. Por ora, administradores podem acrescentar as colunas
  manualmente na planilha — o parser já reconhece os cabeçalhos.
- Seção "Dados técnicos opcionais" no `EditRowDialog` da tela de revisão
  (edição inline dos campos técnicos pré-importação).
- Incluir colunas técnicas no `downloadRevisedSheet`.
- Indicadores "Dados técnicos preenchidos / com alerta" na grade.

### Notas de rollback
- Versão anterior estável: 1.0.1
- Backup pré-deploy: não obrigatório (parser + validação aditivos; persistência
  só roda se houver dado técnico preenchido). Snapshot diário cobre.

### Arquivos alterados
- `src/lib/productImport.ts`
- `src/server/productImport.functions.ts`
- `docs/production/CHANGELOG.md`

---



## [1.0.1] — 2026-05-30

**Tipo:** melhoria (hotfix de UX)
**ChangeControl:** CC-2026-003
**Classificação:** Média (MEL-2026-002)

### Alterado
- Tela `/admin/produtos/importacao-ia`: etapa de revisão agora é editável.
  Cada linha tem botão "Editar" abrindo modal com seções (Dados básicos,
  Comercial, Conteúdo/IA, SEO, Revisão). Checkboxes inline para
  `revisado_humano` e `aprovado_importar` na grade.
- Após salvar uma linha, o sistema revalida automaticamente e invalida a
  simulação anterior, forçando nova simulação antes de importar.

### Segurança
- Sem alterações em checkout, Mercado Pago, webhook, estoque, pedidos,
  e-mails, CRM, GA4, DNS, MFA/AAL2, RLS ou policies.
- Rota continua restrita a admin com MFA/AAL2 (mesma proteção da v1.0.0).
- Validação server-side em `validateImportRows` e `commitImport` permanece
  inalterada — frontend apenas alimenta os mesmos endpoints já homologados.
- IA continua somente sugestão; importação exige aprovação humana explícita.

### Notas de rollback
- Versão anterior estável: 1.0.0
- Backup pré-deploy: não obrigatório (mudança apenas no frontend admin,
  sem schema/dados); ver `BACKUP_LOG.md` para snapshot diário.

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
