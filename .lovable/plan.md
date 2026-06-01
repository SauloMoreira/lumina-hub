
# v1.1.0 — Administração de Usuários e Clientes

Plataforma em produção assistida. Esta entrega é grande e mexe em
permissões/autenticação. Por governança proponho dividir em **3 sub-versões
incrementais (1.1.0-a → 1.1.0-c)**, cada uma com backup, changelog, teste e
rollback claros. Confirmação antes de cada fase.

## Princípios não-negociáveis

- Nada de mudança em checkout, MP, webhook, estoque, pedidos, e-mails
  transacionais, GA4, DNS, LGPD, RLS, MFA/AAL2.
- Toda ação crítica passa por server function com `requireSupabaseAuth` +
  checagem `is_admin` + (quando aplicável) AAL2, nunca por client.
- `service_role` só em `*.server.ts` / server functions, jamais no bundle do
  cliente.
- Toda ação grava em `admin_audit_log` via `logAdminAction`, sem expor senha,
  token, link de reset, secret. CPF/CNPJ mascarado.
- Último admin ativo nunca pode ser bloqueado, removido, rebaixado ou
  arquivado. Admin não pode bloquear/rebaixar a si próprio sem confirmação
  forte.

## Estado atual relevante

- `profiles(id, name, email, phone, role, avatar_url, created_at, updated_at)`
  — não tem `status`. Roles em uso: `admin`, `user` (regra Core: só 2 perfis).
- `companies` já tem `status` (pending/approved/blocked/rejected) e fluxo de
  aprovação em `/admin/empresas` + `companies.functions.ts`
  (`adminUpdateCompanyStatus` já audita).
- Auditoria pronta: `admin_audit_log` + helper `logAdminAction`.
- Padrão admin: `AdminLayout`, `DataTable`, `useTableState`, rotas
  `admin.*.tsx`, server fns em `src/server/*.functions.ts`.
- Memória Core: **somente 2 perfis (admin / cliente)**. NÃO criar
  finance/marketing/etc. NÃO criar tela de "perfis e permissões avançadas".
  Portanto a ação "alterar função" desta tela = alternar entre `admin` ↔
  `user`, nada mais.

## Escopo ajustado à regra dos 2 perfis

A spec do usuário fala em `cliente_b2c` / `cliente_b2b` como "perfil". Na
nossa arquitetura isso **não é role** — B2B é definido pelo vínculo com
`companies` aprovada. Portanto a tela mostra **tipo derivado** (admin /
cliente B2B aprovado / cliente B2B pendente / cliente B2C / bloqueado), mas
o que se altera no banco é apenas:
- `profiles.role` (admin ↔ user) — exige AAL2 + confirmação forte.
- `companies.status` (já existe, reaproveitar `adminUpdateCompanyStatus`).
- `profiles.status` novo (active / blocked / archived) — bloqueio operacional.

## Fase 1.1.0-a — Leitura + estrutura base (sem risco)

Backup: não necessário (sem migration destrutiva).
Migration mínima:

```sql
alter table public.profiles
  add column if not exists status text not null default 'active'
    check (status in ('active','blocked','archived'));
alter table public.profiles
  add column if not exists last_sign_in_at timestamptz; -- espelhado do auth on demand
create index if not exists profiles_status_idx on public.profiles(status);
create index if not exists profiles_role_idx on public.profiles(role);
```

Entregas:
- Rota `/admin/usuarios` (página + `AdminLayout`, search params via Zod).
- Cards-resumo (total, B2C, B2B aprovados, B2B pendentes, bloqueados, admins).
- Tabela com busca (nome, e-mail, telefone, empresa), filtros (todos /
  admins / B2C / B2B aprov / B2B pend / bloqueados / com pedido / sem
  pedido), ordenação, paginação. Coluna "tipo" derivada.
- Server fn `adminListUsers` (paginada, joins com `company_users` +
  `companies` + count de `orders`).
- Server fn `adminGetUserDetail` (perfil + empresa + últimos pedidos +
  leads + últimas linhas do `admin_audit_log` para o alvo + endereços).
- Página/painel de detalhe somente-leitura.
- Link no menu `AdminLayout` (perto de Empresas).

Sem ações destrutivas nesta fase. Apenas listar e ver.

## Fase 1.1.0-b — Ações operacionais (com confirmação + auditoria)

Server fns novas (todas com `requireSupabaseAuth` + `assertAdmin` +
`logAdminAction`):
- `adminBlockUser` / `adminUnblockUser` — `profiles.status`.
  Efeito operacional já existente nas guards atuais: estender
  `requireSupabaseAuth`/checkout/conta para barrar `status='blocked'`
  retornando 403 amigável. Pedidos antigos preservados.
- `adminArchiveUser` — `status='archived'` (bloqueia login operacional, mas
  mantém histórico). Bloqueia se for último admin.
- `adminRequestPasswordReset` — usa
  `supabaseAdmin.auth.admin.generateLink({type:'recovery'})` e dispara
  e-mail via `src/server/email/transport.ts` (Lovable Emails / Resend
  atual). Nunca retorna link/senha. Auditoria registra
  `password_reset_requested`. Mensagem fixa ao admin.
- `adminApproveCompany` / `adminBlockCompany` / `adminRejectCompany` —
  reaproveita `adminUpdateCompanyStatus` (já implementado, já audita).
  Apenas expor botões na tela de usuário quando aplicável.

UI:
- Modal de confirmação com **motivo obrigatório** para todas as ações
  críticas.
- Botões na linha + no detalhe.

Sem mudança em RLS/MFA. Reuso do guarda admin já existente.

## Fase 1.1.0-c — Alteração de role + arquivar/anonimizar

Mais sensível, separada para reduzir blast radius.

- `adminChangeUserRole(targetId, newRole, reason, confirmation)`
  - Valida `assertAdminAal2(context)` (helper novo que checa
    `context.claims.aal === 'aal2'`, igual a `RequireAdminMfa` no front).
  - Exige string `confirmation === 'CONFIRMAR ADMIN'` quando promove a admin.
  - Garante regra do "último admin ativo" via `select count(*) from profiles
    where role='admin' and status='active'`.
  - Impede actor === target em rebaixamento sem confirmação extra.
  - Audita `user_role_changed` com before/after.
- `adminAnonymizeUser(targetId, reason)` — preserva pedidos/valores,
  mascara `name='Usuário anonimizado'`, `phone=null`, `email='anon+<id>@…'`,
  marca `status='archived'`. Texto LGPD no modal. Auditoria
  `user_anonymized`.
- `adminDeleteUser(targetId, confirmation)` — só roda se:
  zero pedidos, zero leads convertidos, zero `admin_audit_log` como actor,
  não é admin, não é último admin, e `confirmation === 'EXCLUIR DEFINITIVAMENTE'`.
  Caso contrário retorna erro orientando arquivar/anonimizar e audita
  `user_delete_attempt_blocked`. Quando permitido, exclui via
  `supabaseAdmin.auth.admin.deleteUser` (cascade já cuida de profiles).

## Detalhes técnicos transversais

- Helper `src/server/security/assertAdmin.ts`:
  ```ts
  export async function assertAdmin(ctx) {
    const { data } = await supabaseAdmin
      .from('profiles').select('role').eq('id', ctx.userId).single();
    if (data?.role !== 'admin') throw new Response('Forbidden',{status:403});
  }
  export function assertAal2(ctx) {
    if (ctx.claims?.aal !== 'aal2')
      throw new Response('MFA required',{status:401});
  }
  ```
- Guard de login operacional para usuário `blocked`/`archived`:
  adicionar checagem em `src/server/auth.functions.ts` /
  `src/integrations/supabase/auth-middleware.ts`-consumers que ler
  `profiles.status` e retornar 403 com mensagem:
  "Sua conta está bloqueada. Entre em contato com o suporte."
  Aplicar em checkout/conta sem tocar nas regras de pagamento.
- Tipo derivado no listing calculado no SQL (`case` com join em
  `companies.status`), não no client.
- Nenhuma alteração em `src/integrations/supabase/*` (arquivos
  auto-gerados).

## Governança (em cada fase)

- `docs/production/CHANGELOG.md` + `RELEASES.md` atualizado.
- Classificação: **Alta** (mexe em auth/roles) → backup do banco antes da
  fase -c, plano de rollback (`alter table profiles drop column status`,
  reverter server fns, remover rota).
- `DEPLOY_CHECKLIST.md` rodado.
- Auditoria validada em pedido de teste.

## Testes (executados em cada fase antes do encerramento)

Lista completa do item 17 do brief, focando em:
visitante/B2C/B2B bloqueados na rota; admin acessa; CRUD de status;
último admin protegido; exclusão bloqueada com histórico; B2B pendente não
vê preço (regra já em `b2bPricing`); auditoria gerada; build + tsc OK;
linter Supabase sem novo ERROR.

## Itens fora desta entrega

- Múltiplos perfis (finance/marketing/fiscal). Bloqueado por memória Core.
- Self-service de MFA por usuário comum. Já existe `RequireAdminMfa` para
  admin, suficiente.
- Tela separada de empresas B2B (já existe `/admin/empresas`). Esta tela
  só linka e expõe ações de aprovação inline.

## Próximo passo

Confirmar:
1. Tudo bem dividir em três fases (a → b → c) com aprovação entre cada uma?
2. Ok confirmar que "alterar função" se limita a `admin ↔ user` (regra
   Core)? Tipos B2B/B2C continuam derivados de `companies`, não roles.
3. Posso iniciar pela **Fase 1.1.0-a** (somente leitura + migration do
   campo `status`)?
