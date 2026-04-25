import { Link } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { ShoppingCart, Zap } from 'lucide-react';
import type { Product } from '@/lib/domain';
import { formatBRL } from '@/lib/domain';
import { useCart } from '@/stores/cartStore';

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const cart = useCart();
  const finalPrice = product.sale_price ?? product.price;
  const hasDiscount = product.sale_price != null && product.sale_price < product.price;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    cart.addItem({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      price: finalPrice,
      image: product.images[0] ?? null,
      stock: product.stock_qty,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.4) }}
    >
      <Link
        to="/produto/$slug"
        params={{ slug: product.slug }}
        className="group block bg-card rounded-lg border border-border shadow-soft hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
      >
        <div className="aspect-square bg-surface relative overflow-hidden flex items-center justify-center">
          {product.images[0] ? (
            <img
              src={product.images[0]}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <Zap className="w-16 h-16 text-primary/20" strokeWidth={1.5} />
          )}
          {product.featured && (
            <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider bg-accent text-accent-foreground px-2 py-1 rounded">
              Destaque
            </span>
          )}
          {hasDiscount && (
            <span className="absolute top-2 right-2 text-[10px] font-bold bg-destructive text-destructive-foreground px-2 py-1 rounded">
              −{Math.round(((product.price - finalPrice) / product.price) * 100)}%
            </span>
          )}
        </div>
        <div className="p-4">
          {product.brand && (
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-1">{product.brand}</div>
          )}
          <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-snug mb-3 min-h-[2.5rem]">
            {product.name}
          </h3>
          <div className="flex items-end justify-between gap-2">
            <div>
              {hasDiscount && (
                <div className="text-xs text-muted-foreground line-through leading-none mb-0.5">{formatBRL(product.price)}</div>
              )}
              <div className="font-display font-extrabold text-primary text-lg leading-none">{formatBRL(finalPrice)}</div>
            </div>
            <button
              onClick={handleAdd}
              disabled={product.stock_qty === 0}
              className="w-9 h-9 rounded-md bg-primary text-primary-foreground hover:brightness-110 transition-all flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shadow-primary"
              aria-label="Adicionar ao carrinho"
            >
              <ShoppingCart className="w-4 h-4" />
            </button>
          </div>
          {product.stock_qty <= 5 && product.stock_qty > 0 && (
            <div className="text-[10px] text-warning font-medium mt-2">⚠ Últimas {product.stock_qty} unidades</div>
          )}
          {product.stock_qty === 0 && (
            <div className="text-[10px] text-destructive font-medium mt-2">Esgotado</div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
