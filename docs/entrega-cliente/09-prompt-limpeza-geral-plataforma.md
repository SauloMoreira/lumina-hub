# Prompt de Limpeza Geral da Plataforma — Led Maricá

- **Versão:** 1.0
- **Data:** 12/maio/2026
- **Público-alvo:** Equipe técnica (executor) + cliente (aprovador)
- **Objetivo:** Prompt operacional para execução posterior de limpeza segura da massa de homologação.

> **Importante:** este documento é apenas um **prompt** — nada deve ser
> executado agora. Só rodar após autorização explícita do cliente e
> preferencialmente após o **Dia 7 da Produção Assistida**.

---

## Como usar

Copie o bloco abaixo e envie ao agente de execução (Lovable) em **uma
única mensagem**, em sessão separada, com aprovação prévia do cliente.

---

## PROMPT (copiar a partir daqui)

```
Executar limpeza geral da plataforma Led Maricá após Go-Live e produção
assistida.

OBJETIVO
- Remover/inativar toda a massa de homologação.
- Deixar a loja com aparência de produção real.
- Preservar 100% do histórico financeiro, fiscal, de estoque, e-mails,
  auditoria e leads convertidos por pedido pago.

REGRAS OBRIGATÓRIAS (NÃO VIOLAR)
1. NÃO excluir os pedidos #14, #17 e #19 (validações reais Mercado Pago).
2. NÃO excluir nenhum registro de order_items.
3. NÃO excluir nenhum registro de payment_webhook_events.
4. NÃO excluir nenhum registro de stock_decrement_audit.
5. NÃO excluir nenhum registro de email_events.
6. NÃO excluir nenhum registro de admin_audit_log.
7. NÃO excluir leads convertidos por pedido real OU teste pago.
8. NÃO fazer hard delete de registros com vínculo histórico
   (pedidos, pagamentos, estoque, e-mails, auditoria).
9. SEMPRE preferir inativar/arquivar em vez de excluir.
10. Manter apenas UM produto exemplo (preferencialmente inativo/rascunho).
11. Remover da vitrine pública qualquer item de teste (banners, cards,
    showcases, categorias, kits, cupons, campanhas).
12. Validar ao final: catálogo, busca, combos, cupons, campanhas, admin.
13. Entregar relatório antes/depois (contagens por tabela e amostras).

PASSO A PASSO
A. Backup lógico
   - Listar contagens (SELECT count) das tabelas: products, categories,
     product_bundles, coupons, leads, lead_interactions, campaigns,
     home_banners, homepage_*, marketing_integrations, companies, orders,
     order_items, payment_webhook_events, stock_decrement_audit,
     email_events, admin_audit_log.
   - Salvar contagens em "antes".

B. Produtos
   - Identificar produtos de teste (slug contendo "teste", "homolog",
     "exemplo", criados antes de 12/mai/2026 sem venda real).
   - Inativar todos (active=false). NÃO excluir.
   - Marcar 1 produto como exemplo "Produto Exemplo" (active=false,
     featured=false).
   - Preservar produtos comprados em pedidos #14/#17/#19.

C. Categorias
   - Inativar categorias vazias ou marcadas como teste. NÃO excluir.

D. Kits / Combos
   - Inativar (active=false) todos os kits de teste. NÃO excluir.

E. Cupons
   - Inativar (active=false) todos os cupons de teste. NÃO excluir.

F. Campanhas
   - Arquivar (status arquivado) todas as campanhas de teste.

G. Banners e Homepage
   - Desativar banners de teste (visible=false).
   - Limpar/zerar conteúdos de teste em homepage_settings, homepage_cards,
     homepage_featured_categories, homepage_product_showcases,
     homepage_showcase_items, homepage_sections.
   - Manter pelo menos um conteúdo padrão neutro em cada seção pública.

H. Leads e CRM
   - Arquivar leads de teste sem pedido pago vinculado (status=arquivado).
   - NÃO excluir leads convertidos.
   - Preservar lead_interactions e lead_status_history.

I. Empresas B2B
   - Arquivar/inativar empresas claramente de teste sem pedido real.
   - Preservar empresas vinculadas a qualquer pedido pago.

J. WhatsApp e e-mail
   - NÃO mexer em templates ativos de produção.
   - Apenas remover rascunhos claramente de teste.

K. Avisos de homologação
   - Remover/ocultar quaisquer avisos visuais de "homologação",
     "ambiente de teste" da loja pública e do admin.
   - Garantir cor/badge de produção.

L. Validação final
   - /catalogo abre sem produtos de teste visíveis.
   - /combos sem kits de teste.
   - /atacado vazio ou só com itens reais.
   - Busca não retorna itens de teste.
   - Cupons de teste não aplicam.
   - Painel do Dia sem alertas de teste.
   - Pedidos #14/#17/#19 ainda visíveis em /admin/pedidos.
   - admin_audit_log mantém histórico íntegro.

M. Relatório final
   - Contagens "depois" por tabela.
   - Lista de IDs inativados/arquivados.
   - Confirmação explícita de que NENHUM hard delete foi feito em
     pedidos, order_items, payment_webhook_events, stock_decrement_audit,
     email_events e admin_audit_log.
   - Print/sumário do catálogo público pós-limpeza.

EM CASO DE DÚVIDA: parar e perguntar. NÃO excluir.
```

---

## Critérios de aceite da limpeza

- ✅ Loja pública com aparência de produção real.
- ✅ Pedidos históricos preservados (#14, #17, #19).
- ✅ Tabelas de auditoria/financeiro/estoque/e-mail intocadas.
- ✅ Relatório antes/depois entregue.
- ✅ Cliente valida visualmente a loja após a execução.

---

## Conclusão

Este prompt foi desenhado para ser **seguro por padrão**: prefere inativar
a excluir, lista regras imutáveis e exige relatório de comprovação. Ainda
assim, **executar somente com autorização** e em sessão técnica dedicada.
