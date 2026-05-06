ALTER TABLE public.lead_interactions DROP CONSTRAINT lead_interactions_type_check;
ALTER TABLE public.lead_interactions ADD CONSTRAINT lead_interactions_type_check CHECK (
  type = ANY (ARRAY['note','call','email','whatsapp','chat','meeting','status_change','order_confirmed'])
);