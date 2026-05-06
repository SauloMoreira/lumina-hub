ALTER TABLE public.leads DROP CONSTRAINT leads_origin_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_origin_check CHECK (
  origin = ANY (ARRAY[
    'site','chat','ai_chat','whatsapp','instagram','indicacao',
    'contact_form','cadastro_empresa','b2b_showcase','b2b_negotiation',
    'checkout','abandoned_cart','produto','campanha','outro'
  ])
);