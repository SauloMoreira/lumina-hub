# Agente de Importação de Produtos via Planilha (IA-assistida)

Funcionalidade nova, isolada, sem tocar em checkout, MP, webhook, pedidos, e-mails, CRM, GA4, RLS, MFA ou estoque de pedidos. Toda escrita acontece via server functions protegidas por `requireAdmin` (AAL2) e nada é importado sem clique explícito do admin.

## Escopo

- Nova rota admin: `/admin/produtos/importacao-ia`
- Upload de `.xlsx` (aba `PRODUTOS_MÍNIMO`), parsing 100% no servidor
- Validação → enriquecimento IA (Lovable AI Gateway) → prévia → simulação (dry-run) → importação aprovada → relatório + auditoria
- Download da planilha revisada com sugestões/erros/avisos
- Link no menu admin de Produtos

## Arquitetura

```text
src/routes/admin.produtos.importacao-ia.tsx        ← UI (RequireAdminMfa)
src/server/productImport.functions.ts              ← server fns (createServerFn + requireAdmin)
src/server/productImport.server.ts                 ← parser xlsx, validação, enrich IA, dry-run, commit
src/lib/productImport.ts                           ← tipos + helpers puros (slugify, parsePrice) compartilhados
```

Dependência nova: `xlsx` (SheetJS) — leitura/escrita server-side, compatível com Worker.

## Server functions (todas com `requireAdmin`)

1. `parseImportSheet({ fileBase64, fileName })` → lê aba `PRODUTOS_MÍNIMO`, devolve linhas normalizadas + erros de parsing. Não grava nada.
2. `validateImportRows({ rows })` → valida campos obrigatórios, dedup SKU planilha + banco, valida categoria (busca por slug/nome), preço, estoque, flags. Retorna `{ row, status, errors[], warnings[] }`.
3. `enrichImportRows({ rows })` → Lovable AI (`google/gemini-3-flash-preview`, structured output via Zod) preenche apenas: `slug_sugerido`, `descricao_curta`, `descricao_longa`, `tags`, `titulo_seo`, `meta_description`, `observacoes_ia`, `nivel_confianca_ia`. Prompt proíbe inventar preço/marca/specs/EAN/NCM/certificação.
4. `simulateImport({ rows })` → dry-run completo: classifica em criar/atualizar/ignorar/erro, mostra diff. Não grava.
5. `commitImport({ approvedRows, fileName, importId })` → executa só linhas com `revisado_humano=sim` E `aprovado_importar=sim` E status válido. Re-valida no servidor. Cria `active=false` se houver warnings. Grava auditoria via `logAdminAction`. Retorna relatório.
6. `downloadRevisedSheet({ rows })` → devolve xlsx em base64 com sugestões + colunas `status_validacao`, `erros`, `avisos`.

## Mapeamento para `products`

| Planilha | Coluna DB |
|---|---|
| sku | sku |
| nome_produto | name |
| slug_sugerido | slug |
| categoria | category_id (resolvido por nome/slug; se não existir → pendência, NUNCA cria automaticamente) |
| preco_venda | price |
| estoque_inicial | stock_qty (só em `criar`; em `atualizar` exige confirmação explícita por linha) |
| ativo | active (default false se houver warning) |
| descricao_curta | (campo equivalente no schema) |
| descricao_longa | description |
| tags | tags |
| titulo_seo / meta_description | campos SEO existentes |

Vou ler o schema real de `products` antes de codar para confirmar nomes exatos (campo de descrição curta, SEO title/description, etc.).

## Regras de segurança

- Toda server fn: `.middleware([requireAdmin])` → exige admin + AAL2 + MFA verificado
- UI envolvida em `<RequireAdminMfa>` (padrão do projeto)
- Re-validação server-side mesmo após validação do frontend
- Upload: limite 5MB, valida extensão `.xlsx` e magic bytes (PK zip)
- Categoria nunca criada automaticamente
- Estoque de produtos existentes nunca sobrescrito sem confirmação por linha
- IA: structured output Zod, sem campos perigosos no schema, temperatura baixa
- Auditoria: `logAdminAction({ action: 'product_import.commit', resourceType: 'products', after: { importId, criados, atualizados, ignorados, errosCount, fileName } })` — não loga conteúdo bruto da planilha

## UI (`/admin/produtos/importacao-ia`)

1. Upload + botão "Ler planilha"
2. Cards de resumo: total / válidos / com erro / pendentes revisão / aprovados
3. Tabela de prévia (shadcn Table) com filtros por status
4. Modal de detalhes por linha (dados originais vs sugestões IA vs o que será gravado)
5. Botões: Validar · Completar com IA · Baixar planilha revisada · **Simular** · **Importar aprovados** (só habilita após simulação) · Cancelar
6. Tela de resultado: criados, atualizados, ignorados, erros, download do log CSV

## Fora de escopo (não vou tocar)

- Checkout, Mercado Pago, webhook, pedidos, e-mails, CRM, GA4, DNS, MFA, RLS, políticas Supabase
- Edição/exclusão de produtos existentes além do mapeamento acima
- Importação de imagens, atributos técnicos, preços B2B, kits, NCM/CEST (planilha mínima não cobre — ficam para fase futura)
- Nenhuma migração de banco
- Nenhuma alteração de permissões públicas

## Validação final

- `bun add xlsx`
- Build + TypeScript devem passar (rodados pelo harness)
- Testes manuais cobrindo os 15 cenários da seção 19 do brief (planilha boa, SKU faltando, preço inválido, duplicidade, etc.) feitos via leitura do código + simulação na UI
- Confirmação: nenhuma rota/policy pública nova, nenhum endpoint sem `requireAdmin`

Posso prosseguir?