# Checklist de Deploy — Led Maricá

Use este checklist **antes de publicar qualquer versão** em produção.
Não publicar com itens em vermelho.

---

## Pré-deploy

- [ ] Versão definida (`vX.Y.Z`) seguindo SemVer.
- [ ] ChangeControl aberto (`CC-AAAA-NNN`) e classificado.
- [ ] Changelog preenchido em `CHANGELOG.md`.
- [ ] Entrada criada em `RELEASES.md` com responsável + plano de rollback.
- [ ] Backup feito quando exigido pela classificação (registrar em
      `BACKUP_LOG.md`).
- [ ] Build local/preview aprovado sem erros.
- [ ] TypeScript sem erros (`tsc` rodando como parte do build do Lovable).
- [ ] Lint Supabase (`supabase--linter`) sem novos avisos críticos.
- [ ] Security review concluída se a mudança for Alta/Crítica.
- [ ] Plano de rollback definido (`ROLLBACK_PLAN.md`).
- [ ] Responsável aprovou (admin único nesta fase).

## Testes funcionais por escopo afetado

- [ ] **Loja pública:** home, catálogo, produto, busca, carrinho.
- [ ] **Checkout B2C:** criar pedido, redirecionar MP, confirmar
      retorno (success/failure/pending).
- [ ] **Checkout B2B:** preço atacado server-side, empresa aprovada vê
      desconto, visitante NÃO vê.
- [ ] **Mercado Pago / Webhook:** notificação processada,
      `payment_webhook_events` registrado, `orders` atualizado para
      `approved`, estoque decrementado, lead sincronizado.
- [ ] **Estoque:** `stock_decrement_audit` consistente; sem dupla baixa.
- [ ] **Admin:** login com MFA AAL2 funcionando; nenhuma rota admin
      acessível sem AAL2.
- [ ] **E-mail transacional:** envio de teste para o admin OK.
- [ ] **CRM / leads / WhatsApp:** automações disparando conforme regra.
- [ ] **SEO:** `robots.txt`, `sitemap.xml`, meta tags inalterados sem
      necessidade.
- [ ] **GA4:** evento em tempo real recebido.
- [ ] **LGPD:** banner de cookies + scripts condicionais respeitando
      consentimento.

## Deploy

- [ ] Publicado via Lovable.
- [ ] URL produção respondendo `200`: https://www.ledmarica.com.br
- [ ] Apex redireciona 302 → www.

## Pós-deploy (janela conforme classificação)

- [ ] Smoke test em produção (incognito).
- [ ] Painel do Dia sem alertas novos.
- [ ] `admin_audit_log` recebendo entradas conforme operações.
- [ ] `email_events` sem acumulado de `failed`.
- [ ] `payment_webhook_events` sem erros.
- [ ] Logs sem 5xx novos em rotas críticas.
- [ ] Atualizar status da release para `publicado`.
- [ ] Encerrar ChangeControl ou abrir rollback.

## Janelas mínimas de monitoramento

| Classificação | Tempo |
|---------------|-------|
| Baixa         | 1h    |
| Média         | 4h    |
| Alta          | 24h   |
| Crítica       | 72h   |
