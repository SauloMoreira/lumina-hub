# Manual do Usuário — Plataforma Led Maricá

- **Versão:** 1.0
- **Data:** 12/maio/2026
- **Público-alvo:** Equipe operacional e administradores da loja
- **Objetivo:** Guia prático e didático para uso da plataforma no dia a dia

---

## Sumário

1. [Introdução](#1-introdução)
2. [Acesso ao sistema](#2-acesso-ao-sistema)
3. [Dashboard / Painel do Dia](#3-dashboard--painel-do-dia)
4. [Produtos](#4-produtos)
5. [Categorias](#5-categorias)
6. [Estoque](#6-estoque)
7. [Kits e Combos](#7-kits-e-combos)
8. [Cupons](#8-cupons)
9. [Pedidos](#9-pedidos)
10. [Operação](#10-operação)
11. [Mercado Pago](#11-mercado-pago)
12. [E-mails transacionais](#12-e-mails-transacionais)
13. [Clientes / Minha Conta](#13-clientes--minha-conta)
14. [B2B / Atacado](#14-b2b--atacado)
15. [CRM / Leads](#15-crm--leads)
16. [WhatsApp](#16-whatsapp)
17. [Ledinho — Chat](#17-ledinho--chat)
18. [Campanhas e UTM](#18-campanhas-e-utm)
19. [Imagens e banners](#19-imagens-e-banners)
20. [LGPD e cookies](#20-lgpd-e-cookies)
21. [Google Analytics](#21-google-analytics)
22. [SEO](#22-seo)
23. [Auditoria e segurança](#23-auditoria-e-segurança)
24. [Boas práticas operacionais](#24-boas-práticas-operacionais)
25. [Dúvidas frequentes](#25-dúvidas-frequentes)

---

## 1. Introdução

A plataforma **Led Maricá** é uma loja online completa, com:

- **Loja pública** para clientes finais (B2C) — em `https://www.ledmarica.com.br`.
- **Atacado / B2B** para empresas com CNPJ aprovadas.
- **Painel administrativo** para a equipe da loja, em `/admin`.
- **CRM, campanhas, cupons, kits, e-mails e chat** integrados.
- **Pagamento** via Mercado Pago.
- **Analytics** via Google Analytics 4 com consentimento LGPD.

O administrador consegue gerenciar produtos, categorias, estoque, kits,
cupons, campanhas, pedidos, clientes, empresas B2B, e-mails, leads,
banners, conteúdos da home, integrações e segurança.

---

## 2. Acesso ao sistema

### Como entrar

1. Acesse `https://www.ledmarica.com.br/login`.
2. Informe e-mail e senha.
3. Será solicitado o código MFA (autenticação em dois fatores).
4. Insira o código de 6 dígitos do seu aplicativo autenticador.

### MFA — autenticação em dois fatores

- **Obrigatória** para acessar qualquer tela do `/admin`.
- Use Google Authenticator, Microsoft Authenticator, 1Password ou similar.
- O QR Code para configurar é exibido ao acessar **Minha Conta**.

### Se perder o acesso

- Use a opção **Esqueci minha senha** na tela de login.
- Se perder o aplicativo MFA, contate outro administrador para que faça o
  reset do fator pelo backend (Lovable Cloud).
- **Nunca compartilhe sua senha ou código MFA** com outra pessoa.

### Boas práticas de senha

- Mínimo 12 caracteres, com letras, números e símbolos.
- Não reutilize senhas de outros sistemas.
- Cada administrador deve ter conta própria — auditoria registra cada ação.

---

## 3. Dashboard / Painel do Dia

Em `/admin/painel-do-dia` você verá:

- **Cards de pedidos do dia, semana e mês.**
- **Alertas** sobre catálogo, SEO, integrações, B2B, e-mails pendentes.
- **Card "SEO com pendências"** — produtos/categorias sem SEO completo.
- **Card "Catálogo"** — qualidade do cadastro de produtos.
- **Atalhos** para tarefas rápidas (cadastrar produto, ver pedidos, etc.).

> **Dica:** revise o painel todo dia pela manhã. Se houver alerta vermelho,
> trate antes de iniciar campanhas ou divulgação.

---

## 4. Produtos

Acesso: `/admin/produtos`.

### Cadastrar um produto

1. Clique em **Novo produto**.
2. Preencha:
   - **Nome** — visível ao cliente.
   - **Slug** — URL amigável (gerado automaticamente, pode ajustar).
   - **SKU** — código interno único.
   - **Marca** e **Categoria**.
   - **Preço de venda** e, se houver, **preço promocional**.
   - **Estoque** (quantidade disponível).
3. Adicione **imagens** (mínimo uma; ideal 3 a 6).
4. Preencha **descrição curta** e **descrição longa**.
5. Configure **SEO** (título, meta description, imagem).
6. Marque se o produto:
   - É **ativo** (aparece na loja).
   - Tem **frete grátis**.
   - Aceita **B2B/atacado** (e o preço B2B, mínimo e múltiplo).
7. Clique em **Salvar**.

### IA para descrição

Se aparecer o botão **Assistente IA**, você pode gerar título/descrição/SEO
automaticamente. **Sempre revise** antes de salvar.

### Cuidados

- Não desative produtos com pedidos em andamento sem antes verificar.
- Sempre revise SEO antes de publicar.
- Mantenha o estoque correto — o sistema bloqueia venda sem estoque.

---

## 5. Categorias

Acesso: `/admin/categorias`.

- Cadastre nome, slug, ícone e descrição.
- Defina ordem de exibição.
- Inative categorias vazias para não aparecerem no menu.
- **Cuidado:** alterar slug afeta SEO e links já indexados.

---

## 6. Estoque

Acesso: `/admin/produtos/estoque`.

- Veja todos os produtos com quantidade atual.
- Use **Ajuste manual** apenas quando necessário (ex: contagem física,
  perda, devolução).
- Toda alteração fica registrada em auditoria.
- A baixa por venda é **automática** após pagamento aprovado.

> **Não altere estoque manualmente para "corrigir" pedido pago.** Isso
> quebra o histórico e a auditoria.

---

## 7. Kits e Combos

Acesso: `/admin/produtos/combos`.

- **Kit** = conjunto de produtos vendidos juntos.
- Cadastre nome, imagem, descrição.
- Defina **itens** e **quantidades** de cada produto do kit.
- Defina **preço fechado** ou **desconto sobre a soma**.
- Marque se aceita cupom.
- Marque se é kit **B2B** (somente para empresas aprovadas).
- Ative/inative o kit conforme necessidade.

---

## 8. Cupons

Acesso: `/admin/cupons`.

- Crie cupom **percentual** (%) ou **valor fixo** (R$).
- Defina:
  - Código (ex: `BEMVINDO10`).
  - Validade.
  - Limite de uso total e por cliente.
  - Valor mínimo de carrinho.
  - Produtos/kits/categorias elegíveis.
- Inative o cupom em vez de excluir.

> **Importante:** cupons em B2B só funcionam se a configuração
> `b2b_settings.allow_coupon_in_b2b` estiver ativa.

---

## 9. Pedidos

Acesso: `/admin/pedidos`.

- Lista todos os pedidos com filtros por status, data, cliente.
- Clique em um pedido para ver detalhes completos.
- **Status do pagamento** — gerenciado automaticamente pelo Mercado Pago.
- **Status operacional** — você define (preparação, enviado, entregue, etc.).
- Pode informar código de **rastreio**.
- Pode **reenviar e-mail** ao cliente.
- Pode **reconsultar Mercado Pago** se desconfiar de inconsistência.

> **Nunca altere o status de pagamento manualmente.** Use **reconsultar MP**.

---

## 10. Operação

Acesso: `/admin/pedidos` com filtros operacionais.

Acompanhe:

- Pedidos **aprovados** (prontos para preparar).
- Pedidos **em preparação**.
- Pedidos **enviados** (com rastreio).
- Pedidos **entregues / cancelados**.

Use o filtro de status para focar no que precisa de ação.

---

## 11. Mercado Pago

- Pagamentos são processados no checkout do Mercado Pago.
- O **webhook** é a notificação automática que o MP envia quando o status
  muda (aprovado, pendente, recusado).
- O sistema **valida assinatura** e **consulta a API oficial** antes de
  confirmar — não confia cegamente no webhook.
- Após aprovado: estoque baixa, e-mail é enviado, lead é gerado no CRM.

### Se um pagamento não atualizar

1. Aguarde alguns minutos (o webhook pode demorar).
2. Abra o pedido no admin e clique em **Reconsultar Mercado Pago**.
3. Se persistir, verifique em `/admin/financeiro/mercadopago` o histórico.
4. **Não altere status financeiro manualmente.**

---

## 12. E-mails transacionais

Acesso: `/admin/comunicacao/emails`.

Modelos disponíveis:

- Pedido recebido
- Pagamento aprovado
- Pagamento pendente
- Pagamento recusado
- Pedido em preparação
- Pedido enviado (com rastreio)
- Pedido entregue
- Pedido cancelado

Você pode:

- Visualizar histórico de envios (`email_events`).
- Reenviar manualmente um e-mail (com bloqueio anti-duplicidade).
- Editar templates (com cuidado — sempre testar antes).

---

## 13. Clientes / Minha Conta

- O cliente acessa `/conta` e vê pedidos, dados, endereços.
- Empresas B2B veem `/conta/empresa`.
- O admin pode visualizar pedidos do cliente em `/admin/pedidos`.
- Dados pessoais são protegidos por LGPD — não compartilhe externamente.

---

## 14. B2B / Atacado

Acesso: `/admin/empresas` e `/admin/configuracoes-b2b`.

### Cadastro de empresa

1. Empresa se cadastra em `/cadastro-empresa` informando CNPJ.
2. Sistema consulta ReceitaWS:
   - **ATIVA + sem situação especial + abertura > 6 meses** → **aprovação automática**.
   - Demais casos → **aprovação manual** em `/admin/empresas`.

### Preço B2B

- **Nunca visível para visitante.**
- Backend recalcula preço B2B a cada operação (carrinho, checkout).
- Empresa **pendente** compra como B2C.
- Carrinho misto B2B + B2C suportado por linha.

---

## 15. CRM / Leads

Acesso: `/admin/leads`.

- Lead = potencial cliente (do chat, formulário, pedido, etc.).
- Cada lead tem **origem**, **status**, **interações**, **funil**.
- Pedido aprovado **gera lead automático** (vínculo via `syncApprovedOrderToLead`).
- Use `/admin/funil` para ver visão de pipeline.

---

## 16. WhatsApp

Acesso: `/admin/whatsapp-templates`.

- Modelos pré-definidos para envio rápido.
- **Handoff** = transferir conversa do chat para atendente humano.
- Número de suporte: `5521982126467`.
- **Cuidado:** não envie dados pessoais de clientes em grupos.

---

## 17. Ledinho — Chat

- Chat público no canto inferior direito do site.
- Cliente pode interagir anonimamente (sem login).
- Quando o atendimento exige humano, há **handoff** para o WhatsApp.
- Conversas anônimas usam `session_id` UUIDv4 e **não são listadas
  publicamente**.

---

## 18. Campanhas e UTM

Acesso: `/admin/campanhas` e `/admin/campanhas-performance`.

- Crie campanhas com nome, período, canal e link UTM.
- Vincule produto/kit/cupom à campanha.
- Use IA de marketing para sugerir copy.
- Sempre **valide o link** antes de divulgar (clique e confira).

---

## 19. Imagens e banners

Acesso: `/admin/banners` e dentro de cada produto/categoria.

- Formatos aceitos: **JPG, PNG, WebP**.
- **SVG e data URLs estão bloqueados por segurança.**
- Tamanho ideal: até 500 KB por imagem.
- Resolução recomendada: 1200×1200 px para produtos, 1920×800 px para banners.
- Sempre adicione **texto alternativo** (alt) para SEO e acessibilidade.

---

## 20. LGPD e cookies

- Banner de cookies aparece na primeira visita.
- Cliente escolhe entre: **Essenciais**, **Analytics**, **Marketing**, **Personalização**.
- Scripts de analytics e marketing **só carregam após consentimento**.
- Política em `/privacidade`.

---

## 21. Google Analytics

Acesso: `/admin/integracoes`.

- ID configurado: `G-7B7PLYJLNP` (validado em produção).
- Carrega somente após o cliente aceitar cookies.
- Dados em **Tempo Real** podem demorar até 24–48h após o primeiro acesso.
- Eventos rastreados: `view_product`, `add_to_cart`, `begin_checkout`,
  `purchase`, `search`, `lead_captured`.

---

## 22. SEO

Acesso: `/admin/seo`.

Boas práticas:

- **Título SEO:** até 60 caracteres, com palavra-chave principal.
- **Meta description:** até 160 caracteres, atrativa e descritiva.
- **Imagem:** representativa, com bom contraste.
- **Slug:** curto, com hífen, sem acentos.
- Cada página deve ter **um único H1**.

A tela de SEO mostra **score 0–100** por página, com classificação
*ruim / atenção / bom* e recomendações.

---

## 23. Auditoria e segurança

Acesso: `/admin/seguranca/auditoria`.

- Toda ação relevante de admin fica registrada (criar, editar, excluir,
  aprovar empresa, alterar pedido, etc.).
- Logs incluem **diff antes/depois** e **resumo semântico**.
- Dados sensíveis (tokens, senhas) são **mascarados**.
- **Por que não compartilhar senhas?** — qualquer ação fica gravada com
  o seu usuário; se outro fizer algo errado com sua senha, a culpa será
  registrada como sua.

---

## 24. Boas práticas operacionais

### Rotina diária

- Conferir Painel do Dia.
- Tratar pedidos aprovados.
- Responder leads / chat / WhatsApp.
- Verificar e-mails com falha (`email_events` com status `failed`).

### Rotina semanal

- Revisar estoque baixo.
- Revisar produtos sem imagem ou SEO incompleto.
- Conferir performance de campanhas.
- Conferir leads convertidos.

### Antes de uma promoção

- Validar cupons (validade, limite, produtos elegíveis).
- Validar estoque dos produtos da campanha.
- Validar links UTM.
- Avisar a equipe de atendimento.

### Após pedido pago

- Confirmar baixa de estoque.
- Confirmar e-mail enviado.
- Iniciar preparação.
- Atualizar rastreio.

---

## 25. Dúvidas frequentes

**Pedido pago não atualizou.**
→ Aguarde 5 min. Se persistir, abra o pedido e clique em **Reconsultar
Mercado Pago**.

**Cliente não recebeu e-mail.**
→ Confira `/admin/comunicacao/emails`. Verifique pasta de spam do cliente.
Reenvie manualmente se necessário.

**Produto não aparece no catálogo.**
→ Verifique se está **ativo**, com **estoque > 0** e **categoria ativa**.

**Cupom não aplica.**
→ Confira validade, limite, valor mínimo do carrinho e produtos elegíveis.
Em B2B, confira `allow_coupon_in_b2b`.

**B2B não vê preço atacado.**
→ Empresa precisa estar **aprovada**. Empresa pendente compra como B2C.

**Imagem não sobe.**
→ Use JPG/PNG/WebP, até 500 KB. SVG é bloqueado.

**GA4 não mostra dados ainda.**
→ Normal nas primeiras 24–48h. Confira em **Tempo Real** se há acessos
após aceitar cookies.

---

## Conclusão

Este manual cobre o uso operacional completo. Em caso de dúvida, consulte
o [Relatório Técnico](./02-relatorio-tecnico-funcional.md) ou contate a
equipe técnica de continuidade.

**Próximos passos:**

- Treinar a equipe operacional com este manual.
- Marcar como favorito o `/admin/painel-do-dia`.
- Configurar MFA em todos os usuários administradores.
