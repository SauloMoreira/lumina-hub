## Padronização das tabelas administrativas

Escopo enorme (15+ telas). Vou propor uma execução em 3 fases para evitar regressões em áreas sensíveis (checkout, pedidos, MP, webhook, estoque, CRM).

### Estratégia geral

Criar uma **camada reutilizável** primeiro e só depois aplicar tela a tela. Não vou reescrever lógica de negócio — apenas a camada de listagem (queries de SELECT, filtros, paginação, ordenação).

### Fase 0 — Fundação (1 entrega)

Criar componentes/hook compartilhados em `src/components/admin/datatable/`:

- `DataTable.tsx` — wrapper sobre `@/components/ui/table` com colunas tipadas, slots de toolbar/paginação, suporte a estado vazio e skeleton.
- `DataTableToolbar.tsx` — busca com debounce (300ms) + slot de filtros + botão "Limpar filtros".
- `DataTablePagination.tsx` — seletor de page size (10/25/50/100), contador "X–Y de Z", botões primeira/anterior/próxima/última.
- `SortableHeader.tsx` — cabeçalho clicável com ícone asc/desc.
- `EmptyState.tsx` e `TableSkeleton.tsx`.
- `useTableState.ts` — hook que sincroniza `page`, `pageSize`, `sort`, `q` e filtros com URL via `validateSearch` + `useNavigate` (TanStack Router). Aceita schema Zod por tela.
- Helper `buildSupabaseQuery` para aplicar `range()`, `order()`, `ilike()`/`eq()` server-side de forma consistente.

Exemplo de URL: `?page=2&pageSize=25&q=joao&sort=created_at.desc&status=confirmed`.

### Fase 1 — Telas prioritárias (server-side)

Aplicar o padrão em:

1. **Pedidos** (`/admin/pedidos`) — server-side: paginação real (usar `count: 'exact'`), filtros: status pedido, status pagamento, período, método entrega, busca por nº/cliente/e-mail. Ordenação: data, total, status.
2. **Produtos** (`/admin/produtos`) — server-side: filtros status, categoria, B2B, destaque, sem imagem/custo/descrição, estoque baixo. Busca por nome/SKU/EAN. Ordenação: nome, atualização, preço, estoque.
3. **Leads/CRM** (`/admin/leads`) — server-side: status, origem, responsável, período, etapa funil, UTM. Busca por nome/telefone/e-mail.
4. **Modelos de e-mail** (`/admin/comunicacao/emails`) — client-side (poucos registros): filtros status/auto/manual/tipo. Busca por nome/chave.
5. **Histórico de e-mails** (`email_events`) — server-side, se existir tela; caso contrário criar listagem mínima dentro do escopo.

### Fase 2 — Operacionais

6. Estoque (`/admin/produtos/estoque`)
7. Kits/Combos (`/admin/produtos/combos`)
8. Cupons (`/admin/cupons`)
9. Campanhas/UTM (`/admin/campanhas`, `/admin/campanhas-performance`)
10. Carrinhos abandonados (`/admin/carrinhos-abandonados`)

### Fase 3 — Logs e financeiro

11. Webhooks Mercado Pago (apenas leitura/listagem — **não tocar no handler do webhook**)
12. Auditoria (`/admin/seguranca/auditoria`) — já tem boa parte; padronizar ao novo componente.
13. Financeiro/fiscal/notas (`/admin/financeiro/*`)
14. Configurações com listagens (empresas B2B, frete local, etc.)

### Garantias técnicas

- **Não alterar**: webhook MP, checkout, criação/atualização de pedidos, regras de estoque, RLS, migrations (a menos que falte índice óbvio para ordenar — nesse caso pergunto antes), templates transacionais, homepage pública.
- **Apenas**: queries SELECT das listagens admin.
- Cada tela mantém suas ações e colunas atuais; só ganha toolbar/paginação/sort padronizados.
- TypeScript estrito, build passando, mobile responsivo (toolbar empilha, tabela com scroll horizontal).

### Como entregar

Por causa do tamanho, proponho **entregar a Fase 0 + Fase 1 nesta resposta** e aguardar seu OK para seguir com Fase 2 e Fase 3 nas mensagens seguintes. Se preferir outra ordem (ex.: começar só por Pedidos para validar o padrão), é só dizer.

### Pergunta antes de começar

Você prefere:
- **(A)** Eu já começar Fase 0 + Fase 1 completa agora (5 telas + fundação numa entrega só — mensagem grande, mais risco de revisão demorada).
- **(B)** Eu entregar **Fase 0 + apenas Pedidos** primeiro como prova do padrão, e depois aplicar nas outras 4 telas da Fase 1.
- **(C)** Outra ordem que você indicar.

Recomendo **(B)** — valida o padrão visual/UX em uma tela crítica antes de propagar.
