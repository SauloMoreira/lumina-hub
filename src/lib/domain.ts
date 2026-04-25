// Tipos compartilhados do domínio Led Maricá
export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  sale_price: number | null;
  stock_qty: number;
  sku: string | null;
  ncm: string | null;
  brand: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  width_cm: number | null;
  length_cm: number | null;
  category_id: string | null;
  images: string[];
  tags: string[];
  active: boolean;
  featured: boolean;
  specs: Record<string, unknown>;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  sort_order: number;
  active: boolean;
};

export type CartLine = {
  productId: string;
  name: string;
  slug: string;
  price: number;
  image: string | null;
  qty: number;
  stock: number;
};

export const formatBRL = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const FREE_SHIPPING_THRESHOLD = 199;
export const STORE_WHATSAPP = '5521982126467';
export const STORE_NAME = 'Led Maricá';
