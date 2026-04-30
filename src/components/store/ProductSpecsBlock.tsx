import { useQuery } from '@tanstack/react-query';
import { getPublicProductAttributes } from '@/server/productAttributes.functions';
import { formatAttributeDisplay } from '@/lib/productAttributes';

type Props = { productId: string };

/**
 * Bloco "Especificações técnicas" da página pública do produto.
 * Mostra apenas atributos visíveis, ordenados. Oculta a seção se vazio.
 */
export function ProductSpecsBlock({ productId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['product-specs-public', productId],
    queryFn: () => getPublicProductAttributes({ data: { productId } }),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !data || data.length === 0) return null;

  return (
    <section className="mt-8 max-w-2xl">
      <h2 className="font-display font-semibold text-lg mb-3">Especificações técnicas</h2>
      <dl className="rounded-lg border bg-card divide-y divide-border overflow-hidden">
        {data.map((attr) => (
          <div
            key={attr.id}
            className="flex items-baseline gap-3 px-4 py-2.5 text-sm sm:grid sm:grid-cols-[1fr_2fr] sm:gap-4"
          >
            <dt className="text-muted-foreground">{attr.attribute_label}</dt>
            <dd className="font-medium text-foreground">
              {formatAttributeDisplay(attr.attribute_value, attr.attribute_unit)}
              {attr.attribute_key === 'color_temperature' && (
                <ColorTempHint kelvin={attr.attribute_value} />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ColorTempHint({ kelvin }: { kelvin: string }) {
  const k = Number(kelvin);
  if (!Number.isFinite(k)) return null;
  let label: string | null = null;
  if (k <= 3500) label = 'Luz quente';
  else if (k <= 5000) label = 'Luz neutra';
  else label = 'Luz fria';
  return <span className="ml-2 text-xs text-muted-foreground font-normal">— {label}</span>;
}
