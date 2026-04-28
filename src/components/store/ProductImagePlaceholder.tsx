import { Lightbulb } from 'lucide-react';

interface Props {
  /** Mostra a frase "Imagem em breve" abaixo da marca. Default true. */
  showCaption?: boolean;
  /** Tamanho do ícone em px. Default 56. */
  iconSize?: number;
  /** Classe extra opcional. */
  className?: string;
}

/**
 * Placeholder visual para produtos sem imagem cadastrada.
 * Aparência premium e neutra, coerente com o segmento Led Maricá.
 * Usa apenas tokens semânticos do design system.
 */
export function ProductImagePlaceholder({
  showCaption = true,
  iconSize = 56,
  className = '',
}: Props) {
  return (
    <div
      role="img"
      aria-label="Imagem do produto em breve — Led Maricá"
      className={`relative w-full h-full overflow-hidden bg-gradient-to-br from-surface via-card to-surface flex flex-col items-center justify-center text-center px-4 ${className}`}
    >
      {/* Glow sutil de fundo */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(circle at 50% 35%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 60%)',
        }}
      />
      {/* Linha decorativa diagonal bem discreta */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg, var(--foreground) 0 1px, transparent 1px 14px)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-2">
        <div
          className="rounded-full bg-primary/10 border border-primary/15 flex items-center justify-center"
          style={{ width: iconSize + 24, height: iconSize + 24 }}
        >
          <Lightbulb
            className="text-primary/70"
            style={{ width: iconSize * 0.55, height: iconSize * 0.55 }}
            strokeWidth={1.4}
          />
        </div>
        <div className="font-display font-bold text-sm tracking-wide text-foreground/80">
          Led Maricá
        </div>
        {showCaption && (
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
            Imagem em breve
          </div>
        )}
      </div>
    </div>
  );
}
