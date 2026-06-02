# CHANGELOG — Led Maricá (Produção)

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e versionamento [SemVer](https://semver.org/lang/pt-BR/).

> Toda entrada deve referenciar a release em `RELEASES.md` e o item de
> mudança em `CHANGE_CONTROL.md`.

---

## [1.0.4] — 2026-06-02

**Tipo:** correção (exclusão de produtos com pedidos vinculados)
**ChangeControl:** CC-2026-008
**Classificação:** Baixa (apenas UI de exclusão; sem migration, sem mudança em RLS/checkout/MP)

### Corrigido
- **Erro ao excluir produtos de homologação** (`update or delete on table
  "products" violates foreign key constraint "order_items_product_id_fkey"`).
  Produtos com itens em pedidos não podem ser apagados fisicamente
  (preserva histórico fiscal/financeiro). O botão Excluir em
  `/admin/produtos` agora:
  1. Verifica antes se existem `order_items` vinculados;
  2. Se existir, oferece **arquivamento** (active=false, SKU/slug com
     sufixo `-arq-<ts>` para liberar reuso) em vez de exclusão;
  3. Se não existir, mantém exclusão definitiva;
  4. Em caso de FK residual (combos/estoque), exibe mensagem em
     português em vez do erro técnico do Postgres.

## [1.0.3] — 2026-06-01

**Tipo:** correção (qualidade do cadastro + contexto de SEO/IA)
**ChangeControl:** CC-2026-007
**Classificação:** Baixa (somente leitura/avaliação e prompt de IA; nada de DB, RLS, checkout, MP, webhook, estoque, pedidos, e-mail)

### Corrigido
- **Card "Qualidade do Cadastro"** no editor de produto não recebia
  `product_attributes`, então sempre exibia "Sem atributos técnicos" mesmo
  com vários atributos cadastrados. Passou a buscar a mesma query usada
  por `ProductAttributesSection` (cache compartilhado) e a passar a lista
  para `computeProductQuality`.
- **Detecção de NCM**: além da coluna fiscal `products.ncm`, agora aceita
  NCM cadastrado como atributo técnico (chave/label normalizada para
  `ncm`). Normalização aceita formatos `8539.52.00`, `85395200` ou com
  espaços — só os 8 dígitos importam. Função pura `normalizeNcm()`.
- **Reconhecimento de chaves PT-BR**: heurísticas de iluminação
  (potência/voltagem/temperatura de cor/IP) passaram a usar um mapa de
  "slots" (`attrSlot`) que aceita `potencia`/`potencia_w`/`watts`,
  `tensao`/`tensao_v`/`voltagem`/`bivolt`, `temperatura_cor`/`cct`,
  `grau_protecao_ip`/`ip`. Antes só reconhecia as chaves em inglês.
- **"Sem atributos técnicos"** agora considera `attribute_value` preenchido
  (qualquer atributo cadastrado), independentemente de `is_visible` ou
  `is_filterable`. Bônus extra a partir de 3 atributos.
- **Texto do aviso de NCM** suavizado: "NCM não informado. Campo
  recomendado para organização fiscal, mas não bloqueia a venda — a
  emissão fiscal é feita fora da plataforma."

### Adicionado
- `QualityResult.techSummary` com `total`, `visible`, `filterable`,
  `ncm` (8 dígitos detectado) e `ncmSource` (`column` | `attribute`).
  Exibido no card como "N atributo(s) técnico(s) cadastrado(s) · K
  usado(s) como filtro" + "NCM: 8539.52.00 (detectado nos atributos)".
- IA de SEO (`improveProductSeo` e `boostProductSeoAuto`) passou a
  receber atributos técnicos, NCM e tags do produto no prompt do
  usuário. Adicionada instrução anti-alucinação no system prompt:
  "use apenas os dados técnicos fornecidos no cadastro. NÃO invente
  potência, tensão, certificação, garantia, NCM, fluxo luminoso,
  soquete, IP, dimensões ou qualquer especificação técnica."
- `boostProductSeoAuto` agora carrega `product_attributes`, `ncm` e
  `tags` da própria tabela de produtos antes de chamar a IA.

### Segurança
- Sem mudança de RLS, policies, MFA, AAL2 ou rotas públicas.
- Sem alteração em checkout, Mercado Pago, webhook, estoque, pedidos,
  e-mails transacionais, CRM, GA4 ou DNS.
- Nenhuma migration nesta release.

### Arquivos
- `src/lib/productQuality.ts` — `normalizeNcm`, `attrSlot`,
  `QualityAttributeInput.is_filterable/attribute_label`,
  `QualityResult.techSummary`, NCM via coluna OU atributo, heurísticas
  PT-BR, "Sem atributos técnicos" baseado em `techAttrs`.
- `src/routes/admin.produtos.$id.tsx` — `useQuery` de
  `adminListProductAttributes`, `product_attributes` no
  `computeProductQuality`, bloco de resumo técnico + NCM detectado no
  `QualityPanel`, contexto adicional repassado ao `ProductSEOSection`.
- `src/components/admin/ProductSEOSection.tsx` — `productCtx` aceita
  `ncm`, `tags`, `attributes`; repasse para `improveProductSeo`.
- `src/server/seo.functions.ts` — `InputSchema` com `ncm/tags/attributes`,
  `buildUserPrompt` lista atributos e NCM, system prompt com regra
  anti-alucinação, `boostProductSeoAuto` carrega atributos do DB.

### Rollback
- Reverter o commit. Sem migration, sem dado mutado em produção.

---

## [1.1.0-c] — 2026-06-01

**Tipo:** funcionalidade nova (fase 3/3 de v1.1.0) + correção crítica + i18n de auth
**ChangeControl:** CC-2026-006
**Classificação:** Crítica (mudança de role + LGPD + exclusão definitiva)

### Adicionado
- **Ações sensíveis** em `src/server/users.functions.ts` (todas exigem
  `requireSupabaseAuth` + `assertAdmin` + `assertAal2` e gravam
  `admin_audit_log`):
  - `adminPromoteToAdmin` / `adminDemoteToUser` — alteração de função
    `admin ↔ user`. Bloqueia mudar a própria função e despromover o
    último admin ativo. Encerra sessões do alvo (signOut global) para
    forçar reavaliação de claims.
  - `adminAnonymizeUser` — anonimização LGPD: substitui `name`/`email`/
    `phone`/`avatar_url` por valores genéricos, marca `status=archived`,
    atualiza `auth.users` com e-mail neutro e aplica `ban_duration`
    longo. Mantém o registro para integridade de pedidos/notas/auditoria.
  - `adminDeleteUser` — exclusão definitiva. **Bloqueia** se houver
    qualquer pedido vinculado e instrui a usar anonimização. Remove
    `company_users`, `addresses`, `auth.users` (cascata para `profiles`).
- Validações de input com Zod: motivo mín. 3 caracteres + string de
  confirmação literal (`CONFIRMAR` / `ANONIMIZAR` / `EXCLUIR`).
- Drawer `/admin/usuarios`: nova seção **Ações sensíveis · exigem MFA**
  com botões Promover/Remover admin, Anonimizar (LGPD), Excluir.
  Cada botão valida AAL2 no client (`mfa.getAuthenticatorAssuranceLevel`)
  antes de chamar a server fn, e exige dois prompts (motivo + confirmação
  literal).

### Corrigido (crítico)
- **Rota `/reset-password` ausente** (404). Tanto o e-mail enviado por
  `esqueci-senha` quanto `adminSendPasswordReset` redirecionavam para
  uma URL inexistente — usuários ficavam sem como concluir a redefinição.
  Criado `src/routes/reset-password.tsx` com validação do token de
  recovery via `onAuthStateChange`, formulário de nova senha (mín. 6 +
  confirmação) e `supabase.auth.updateUser({ password })`.

### Internacionalizado (mensagens de erro de auth)
- Novo `src/lib/authErrors.ts` com `translateAuthError()` mapeando ~25
  padrões do Supabase Auth (credenciais inválidas, e-mail não confirmado,
  rate limit, senha fraca, token expirado, captcha, rede, etc.) para
  PT-BR. Quando não há match, devolve fallback amigável (nunca vaza
  string em inglês).
- Aplicado em `src/routes/login.tsx`, `src/routes/cadastro.tsx`,
  `src/routes/esqueci-senha.tsx` e `src/routes/reset-password.tsx`.

### Segurança
- Promoção/demoção/anonimização/exclusão exigem AAL2 (claim `aal=aal2`
  validada no server). Sem MFA cadastrado a ação é rejeitada com
  "MFA obrigatório para esta ação".
- Toda operação sensível registra `before`/`after` em
  `admin_audit_log` (PII mascarada pelo `logAdminAction`).
- Exclusão definitiva é defensiva: bloqueada se houver pedidos.

### Risco residual
- Nenhuma migration de DB nesta fase — apenas server fns + UI + i18n.
- Anonimização não toca em `orders.shipping_address` ou snapshots de
  endereço dentro de pedidos (decisão consciente: nota fiscal exige
  histórico). Para apagamento total exigir processo manual com fiscal.

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
