INSERT INTO public.homepage_sections (section_key, title, description, sort_order, is_active)
VALUES (
  'newsletter_signup',
  'Cadastro de e-mail (newsletter)',
  'Captura de e-mail com cupom de boas-vindas, no rodapé da home.',
  120,
  true
)
ON CONFLICT (section_key) DO NOTHING;