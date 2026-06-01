# CHANGELOG — Led Maricá (Produção)

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e versionamento [SemVer](https://semver.org/lang/pt-BR/).

> Toda entrada deve referenciar a release em `RELEASES.md` e o item de
> mudança em `CHANGE_CONTROL.md`.

---

## [1.1.0-b] — 2026-06-01

**Tipo:** funcionalidade nova (fase 2/3 de v1.1.0)
**ChangeControl:** CC-2026-005
**Classificação:** Alta (ações sobre contas + guard de login)

### Adicionado
- Server functions de ação em `src/server/users.functions.ts`:
  `adminBlockUser`, `adminUnblockUser`, `adminArchiveUser`,
  `adminRestoreUser`, `adminSendPasswordReset`. Todas exigem
  `requireSupabaseAuth` + `assertAdmin`, registram `admin_audit_log`
  via `logAdminAction` e encerram sessões ativas (signOut global) ao
  bloquear/arquivar.
- Salvaguardas: bloqueio impede ação sobre o próprio usuário e sobre o
  último admin ativo do sistema. Reset de senha só permitido para contas
  ativas (usa `auth.admin.generateLink` tipo recovery com `redirectTo`
  para `/reset-password`).
- Drawer de `/admin/usuarios` agora exibe ações: **Enviar redefinição de
  senha**, **Bloquear**, **Arquivar**, **Desbloquear**, **Restaurar** com
  confirmação e captura de motivo (gravado em auditoria).
- Guard de login (`src/routes/login.tsx`): após `signInWithPassword` e
  antes do redirect, lê `profiles.status`; se `blocked`/`archived`,
  encerra a sessão e exibe mensagem clara ao usuário.

### Segurança
- Nenhuma mudança em RLS, MFA, policies, checkout/MP, webhook, e-mails
  transacionais, importação ou DNS.
- `supabaseAdmin` continua restrito a `*.server.ts`/`*.functions.ts`.
- Alteração de função (admin↔cliente), anonimização LGPD e exclusão
  segura permanecem fora desta fase (planejados em v1.1.0-c com
  exigência de MFA/AAL2).

---

## [1.1.0-a] — 2026-06-01

**Tipo:** funcionalidade nova (fase 1/3 de v1.1.0)
**ChangeControl:** CC-2026-005
**Classificação:** Alta (mexe em estrutura de `profiles` usada por auth)

### Adicionado
- Migration: coluna `profiles.status` (`active`/`blocked`/`archived`, default
  `active`) + trigger de validação `validate_profile_status` + índices
  `profiles_status_idx` e `profiles_role_idx`. Nenhum usuário existente
  afetado (todos `active`).
- Server functions (somente leitura) em `src/server/users.functions.ts`:
  `adminListUsers`, `adminUsersSummary`, `adminGetUserDetail`.
- Helper `src/server/security/assertAdmin.ts` (`assertAdmin`, `assertAal2`)
  para guarda server-side compartilhada nas próximas fases.
- Rota `/admin/usuarios` ("Usuários e Clientes") com cards-resumo, busca,
  filtros (admins / B2C / B2B aprovados / B2B pendentes / ativos /
  bloqueados / com pedido / sem pedido), ordenação, paginação e drawer de
  detalhe (dados, empresa, pedidos, endereços, leads, auditoria).
- Link no `AdminSidebar` em **Clientes & CRM → Usuários e Clientes**.

### Segurança
- Toda chamada exige `requireSupabaseAuth` + `assertAdmin` no servidor.
- `supabaseAdmin` (service_role) só em `*.server.ts` e `*.functions.ts`.
- Nenhuma RLS, MFA, policy ou regra de checkout/MP/webhook foi alterada.
- Nenhuma ação destrutiva exposta nesta fase.

### Pendente (próximas fases)
- **v1.1.0-b** — bloquear/desbloquear/arquivar, reset de senha por e-mail,
  botões inline de aprovar/bloquear B2B, guard de login para `blocked`,
  modais com motivo obrigatório.
- **v1.1.0-c** — alterar `role` admin↔user (com AAL2 + confirmação forte),
  anonimização LGPD, exclusão definitiva condicionada a histórico zero.

### Rollback
`ALTER TABLE public.profiles DROP COLUMN status;` +
`DROP FUNCTION public.validate_profile_status() CASCADE;` + reverter os
arquivos novos (rota, server fn, helper) e o link no sidebar.

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
- Seção "Dados técnicos opcionais" no `EditRowDialog` da tela de revisão
  (edição inline dos campos técnicos pré-importação).
- Indicadores "Dados técnicos preenchidos / com alerta" na grade.

### Concluído nesta versão (atualização de 01/jun/2026)
- **Planilha modelo regenerada** (`public/templates/Cadastro_Minimo_Produtos_Led_Marica_IA.xlsx`):
  agora com 40 colunas (11 base + 29 técnicas opcionais), cabeçalho técnico
  destacado em verde, linha-exemplo preenchida, aba **INSTRUÇÕES** ampliada
  com descrição de cada campo técnico (unidade, formato esperado, aviso de
  revisão humana para certificação/norma) e nova aba **MAPA_IA** explicando
  o que a IA preenche × o que o humano preenche.
- **`downloadRevisedSheet`** agora inclui as 29 colunas técnicas no arquivo
  revisado baixado pelo admin, preservando o que foi digitado/sanitizado por
  linha. Colunas vazias permanecem em branco.


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
