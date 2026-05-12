# Plano de Transformação em Produto White-Label — Plataforma Led Maricá

- **Versão:** 1.0
- **Data:** 12/maio/2026
- **Público-alvo:** Estratégia, produto, decisor
- **Objetivo:** Avaliar a transformação da plataforma em produto reutilizável para outros clientes, mudando design e configuração sem reescrever código.

---

## 1. Visão de produto

A plataforma foi construída com módulos coesos, design-system baseado em
tokens (CSS-first, `oklch`), backend gerenciado (Lovable Cloud) e camadas
de configuração já existentes (empresa, frete local, integrações, B2B,
templates). Esses fundamentos a aproximam do modelo **white-label**: uma
mesma base atendendo múltiplos clientes com identidade, regras e conteúdo
próprios.

**Maturidade atual:** **Médio-alta** para reuso técnico, **média** para
multi-tenant verdadeiro (uma única instância, vários tenants).

---

## 2. O que já é reaproveitável

- Catálogo, busca, filtros, produto, kits, carrinho, checkout.
- Mercado Pago integrado com webhook seguro e idempotente.
- Módulo B2B completo (cadastro CNPJ, aprovação automática, preço empresa).
- CRM e funil de leads.
- Campanhas com UTM e integrações de marketing condicionais.
- E-mails transacionais (camada única, fácil troca de provider).
- Painel administrativo modular.
- LGPD com banner e scripts condicionais.
- GA4 e tracking padronizados (`trackEvent`).
- Auditoria administrativa abrangente.
- Design-system via tokens em `src/styles.css`.

---

## 3. Módulos white-label

Os seguintes módulos já são candidatos a reuso direto, com pouca ou
nenhuma alteração:

| Módulo | Reuso | Observação |
|---|---|---|
| Catálogo | Direto | Configuração via categorias/atributos |
| Checkout | Direto | Pagamento configurável por cliente |
| Mercado Pago | Direto | Token e secret por cliente |
| B2B | Direto | Regras configuráveis |
| Kits | Direto | — |
| CRM | Direto | — |
| WhatsApp | Direto | Número e templates por cliente |
| Campanhas | Direto | UTM por cliente |
| E-mails | Direto | Templates e domínio por cliente |
| Admin | Direto | Mesmo painel, dados por cliente |
| LGPD | Direto | Política por cliente |
| GA4 / pixels | Direto | IDs por cliente |

---

## 4. O que precisa virar configuração

Para escalar, os seguintes itens devem deixar de ser código e virar
**configuração por cliente** (banco + admin de marca):

- Nome da loja
- Logo / favicon
- Cores (tokens do design-system)
- Tipografia (família primária)
- Domínio próprio
- E-mail remetente e templates
- Credenciais Mercado Pago (token, secret)
- Regras de frete local
- Número e templates WhatsApp
- Políticas (privacidade, devolução, troca, condições)
- Textos institucionais
- Configurações SEO padrão
- Templates de e-mail por evento
- Módulos ativos/inativos (ex.: B2B desligado para alguns clientes)
- Integrações de marketing (GA4, Meta, etc.)

---

## 5. Segmentos-alvo

- E-commerces de varejo de pequeno e médio porte que precisam de B2B leve.
- Distribuidoras com cadastro de clientes PJ.
- Lojas de iluminação, materiais de construção, autopeças, papelaria.
- Marcas próprias buscando canal direto sem custo de plataforma SaaS
  tradicional.

---

## 6. Modelo comercial sugerido

- **Setup inicial** (configuração visual, domínio, integrações).
- **Mensalidade** por loja ativa, escalonada por volume.
- **Add-ons:** B2B avançado, campanhas com IA, analytics avançado,
  white-label para revendas.

---

## 7. Pacotes

| Pacote | Inclui |
|---|---|
| **Básico** | Catálogo, checkout, MP, e-mails, LGPD, GA4 |
| **Profissional** | + Cupons, kits, campanhas, CRM, WhatsApp |
| **B2B** | + Cadastro PJ, preço empresa, kits B2B, painel comercial |
| **Premium** | + IA (copy, imagem, atendimento), campanhas avançadas, dashboards |

---

## 8. Riscos para escalar

- **Multi-tenant em uma única instância** exige refatoração de RLS para
  considerar `tenant_id` em todas as tabelas — esforço **L/XL**.
- **Versão única vs. customização por cliente** — definir governança para
  evitar fork por cliente.
- **Operação de suporte** cresce com número de tenants — exige
  observabilidade dedicada.
- **Migração de bancos legados** de novos clientes para o modelo padrão.
- **Regulatório:** múltiplos CNPJs/contas MP, conformidade fiscal por
  cliente.

---

## 9. Checklist para clonar nova loja

1. Criar novo projeto / instância (ou registrar tenant).
2. Configurar domínio e SSL.
3. Configurar logo, cores e tipografia.
4. Configurar Mercado Pago (token + webhook secret).
5. Configurar e-mail remetente (Resend/Lovable Emails).
6. Configurar GA4, pixels, GTM (se aplicável).
7. Cadastrar categorias, marcas, atributos.
8. Importar produtos iniciais (CSV).
9. Configurar templates de e-mail e WhatsApp.
10. Configurar políticas e textos institucionais.
11. Configurar B2B (se ativo).
12. Configurar frete local.
13. Habilitar/desabilitar módulos.
14. Validação por checklist Go/No-Go simplificado.
15. Treinamento de equipe.

---

## 10. Roadmap para tornar white-label

**Fase 1 — Configuração (4–6 semanas):**

- Centralizar tokens visuais (cores, logo) em tabela de configuração.
- Mover textos institucionais e políticas para banco.
- Painel "Marca" no admin.
- Toggle de módulos ativos/inativos.

**Fase 2 — Multi-instance (8–12 semanas):**

- Padronizar setup (scripts/templates) para nova instância.
- Migrações idempotentes versionadas.
- Documentação de onboarding técnico.

**Fase 3 — Multi-tenant em instância única (3–6 meses):**

- Adicionar `tenant_id` em todas as tabelas relevantes.
- Atualizar RLS, RPCs, queries, jobs.
- Painel de tenants.
- Faturamento por uso/tenant.

---

## 11. Nota de maturidade atual

| Dimensão | Maturidade |
|---|---|
| Reuso de código | Alta |
| Configurabilidade visual | Média |
| Multi-instance | Média |
| Multi-tenant em instância única | Baixa |
| Operação de múltiplos clientes | Baixa |

---

## 12. Recomendação de próximos passos

1. Validar interesse comercial com pelo menos 2 clientes-piloto.
2. Iniciar Fase 1 (configuração) — alto impacto, baixo risco.
3. Capturar métricas de esforço de onboarding em cada novo cliente.
4. Decidir entre multi-instance (mais simples) e multi-tenant (mais
   escalável) com base no volume real previsto.
5. Tratar white-label como produto, com roadmap próprio e responsável
   dedicado.

---

**Conclusão:** a base técnica é sólida e favorece a transformação em
produto. O esforço inicial é moderado (Fase 1) e os ganhos de escala são
significativos. Recomenda-se começar com **multi-instance** e evoluir para
**multi-tenant** após validação comercial.
