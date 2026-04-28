import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { pickUrl, type ProductImageRow } from '@/lib/productImages';
import { ProductImagePlaceholder } from '@/components/store/ProductImagePlaceholder';

interface Props {
  images: ProductImageRow[];
  productName: string;
}

export function ProductImageCarousel({ images, productName }: Props) {
  const sorted = [...images].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return a.sort_order - b.sort_order;
  });
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') setActiveIndex((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setActiveIndex((i) => Math.min(sorted.length - 1, i + 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sorted.length]);

  if (!sorted.length) {
    return (
      <div className="border border-border rounded-xl aspect-square overflow-hidden">
        <ProductImagePlaceholder iconSize={88} />
      </div>
    );
  }

  const current = sorted[Math.min(activeIndex, sorted.length - 1)];
  const mainSrc = pickUrl(current, 'full') ?? current.original_url;
  const mainAlt = current.alt_text || `${productName} — Led Maricá`;
  const mainTitle = current.title_text || productName;

  return (
    <div className="space-y-3">
      <div className="relative bg-card border border-border rounded-xl aspect-square overflow-hidden group">
        <img src={mainSrc} alt={mainAlt} title={mainTitle} className="w-full h-full object-cover" loading="eager" />
        {sorted.length > 1 && (
          <>
            <span className="absolute top-3 right-3 bg-black/60 text-white text-[11px] font-medium px-2 py-0.5 rounded-full">
              {activeIndex + 1} / {sorted.length}
            </span>
            {activeIndex > 0 && (
              <button
                type="button"
                onClick={() => setActiveIndex((i) => i - 1)}
                aria-label="Imagem anterior"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            {activeIndex < sorted.length - 1 && (
              <button
                type="button"
                onClick={() => setActiveIndex((i) => i + 1)}
                aria-label="Próxima imagem"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </>
        )}
      </div>

      {current.caption && (
        <p className="text-xs text-muted-foreground italic px-1">{current.caption}</p>
      )}

      {sorted.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sorted.map((img, i) => {
            const thumb = pickUrl(img, 'thumb') ?? img.original_url;
            const active = i === activeIndex;
            return (
              <button
                key={img.id}
                type="button"
                onClick={() => setActiveIndex(i)}
                aria-label={`Ver imagem ${i + 1}`}
                className={`flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition ${active ? 'border-primary opacity-100' : 'border-transparent opacity-70 hover:opacity-100'}`}
              >
                <img src={thumb} alt={img.alt_text || `${productName} ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
