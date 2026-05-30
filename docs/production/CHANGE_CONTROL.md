# Controle de Mudanças (Change Control) — Led Maricá

**Vigência:** Produção v1.0.0 (30/mai/2026)

Toda alteração em produção — código, banco, configuração, conteúdo
sensível, integração — passa por este fluxo.

---

## 1. Fluxo obrigatório

1. **Solicitação** — descrever o que mudar e por quê.
2. **Classificação** — baixa / média / alta / crítica.
3. **Avaliação de risco** — segurança, regressão, dados, performance.
4. **Aprovação** — admin responsável aprova explicitamente.
5. **Backup pré-mudança** — quando exigido pela classificação.
6. **Implementação** — em preview, nunca direto em produção.
7. **Teste** — funcional + smoke + cenários de borda.
8. **Publicação** — após `DEPLOY_CHECKLIST.md` 100% verde.
9. **Monitoramento pós-deploy** — janela de observação obrigatória.
10. **Changelog** — registrar em `CHANGELOG.md` + `RELEASES.md`.
11. **Encerramento** — fechar o item ou abrir rollback.

## 2. Classificação

### Baixa
- Texto, copy, imagem, favicon.
- Ajuste visual puramente cosmético, sem lógica.
- Janela de monitoramento: 1h.
- Backup: não obrigatório.

### Média
- Tela admin sem efeito em produção pública.
- Campanha de marketing, template de e-mail (sem mudança transacional).
- Importação de produtos por planilha.
- Mudanças de SEO (meta, sitemap, robots).
- Janela de monitoramento: 4h.
- Backup: recomendado (snapshot diário automático cobre).

### Alta
- Checkout, carrinho, frete.
- Estoque (qualquer função que escreva em `stock_decrement_audit`).
- B2B (preço, aprovação, RPCs).
- Cupons.
- E-mails transacionais.
- Janela de monitoramento: 24h.
- Backup: **obrigatório manual** antes do deploy.

### Crítica
- Mercado Pago, webhook de pagamento.
- RLS, MFA, AAL2, policies, server middleware admin.
- Banco / migrations com `ALTER`, `DROP`, mudança de tipo.
- Secrets (rotação inclusive).
- Autenticação (signup, login, recuperação de senha).
- DNS, domínio, certificado.
- Janela de monitoramento: 72h.
- Backup: **obrigatório manual** + security review documentada.

## 3. Regras absolutas

- ❌ Não alterar checkout sem teste end-to-end de pagamento real
  (sandbox + 1 transação aprovada).
- ❌ Não alterar Mercado Pago sem teste controlado (sandbox + replay
  de webhook).
- ❌ Não alterar webhook sem reenvio de notificação simulada.
- ❌ Não alterar estoque sem validar `stock_decrement_audit`.
- ❌ Não alterar RLS/MFA/AAL2/policies/server functions admin sem
  security review e re-execução do `supabase--linter`.
- ❌ Não alterar DNS/SEO/GA4 sem checklist específico.
- ❌ Não alterar templates de e-mail transacional sem envio de teste
  para o admin.
- ❌ Não publicar automaticamente — sempre validação humana.
- ❌ Não criar novos roles ou permissões granulares (modelo é
  admin único + cliente/visitante).

## 4. Registro

Cada item de mudança deve ter um ID `CC-AAAA-NNN` e ficar registrado
neste arquivo na seção "Histórico" abaixo.

### Template

```md
### CC-AAAA-NNN — <título>
- **Solicitante:**
- **Classificação:** baixa | média | alta | crítica
- **Data abertura:**
- **Risco segurança:**
- **Risco regressão:**
- **Backup necessário:** sim/não — referência em BACKUP_LOG
- **Arquivos alterados:**
- **Plano de teste:**
- **Plano de rollback:** ROLLBACK_PLAN.md#seção
- **Aprovador:**
- **Versão alvo:** vX.Y.Z
- **Status:** planejado / em teste / aprovado / publicado / revertido
- **Data fechamento:**
- **Observações pós-deploy:**
```

## 5. Histórico

### CC-2026-001 — Marco de produção v1.0.0
- **Solicitante:** Saulo Moreira
- **Classificação:** operacional (governança, sem código)
- **Data abertura:** 30/mai/2026
- **Risco segurança:** nenhum
- **Risco regressão:** nenhum
- **Backup necessário:** snapshot diário automático
- **Arquivos alterados:** somente `docs/production/*`
- **Plano de teste:** N/A (documentação)
- **Plano de rollback:** N/A (baseline)
- **Aprovador:** Saulo Moreira
- **Versão alvo:** v1.0.0
- **Status:** publicado
- **Data fechamento:** 30/mai/2026

### CC-2026-002 — Produção Assistida v1.0.0 (3 meses)
- **Solicitante:** Saulo Moreira
- **Classificação:** operacional (governança, sem código)
- **Data abertura:** 30/mai/2026
- **Risco segurança:** nenhum
- **Risco regressão:** nenhum
- **Backup necessário:** snapshot diário automático (sem deploy)
- **Arquivos alterados:** somente `docs/production/*`
- **Plano de teste:** N/A (documentação)
- **Plano de rollback:** N/A (marco operacional)
- **Aprovador:** Saulo Moreira
- **Versão alvo:** v1.0.0 (marco)
- **Status:** publicado
- **Data fechamento:** 30/mai/2026
- **Observações:** janela ativa 30/mai/2026 → 30/ago/2026

