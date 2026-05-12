UPDATE public.products
SET active = false, updated_at = now()
WHERE slug IN (
  'homolog-centavo-teste-pagamento',
  'homolog-produto-comum',
  'homolog-produto-b2b',
  'homolog-produto-estoque-zero',
  'homolog-produto-frete-gratis'
);

UPDATE public.coupons
SET active = false
WHERE code IN ('HOMOLOG10','HOMOLOGEXP','HOMOLOGLIMIT','TESTESAULO');