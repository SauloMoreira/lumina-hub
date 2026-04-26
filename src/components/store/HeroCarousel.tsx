import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type HeroBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  image_desktop: string;
  image_mobile: string | null;
  cta_label: string | null;
  cta_link: string | null;
  badge: string | null;
  bg_color: string | null;
  text_color: string | null;
};

const AUTOPLAY_MS = 6000;

export function HeroCarousel({ banners }: { banners: HeroBanner[] }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = banners.length;
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (paused || total <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % total), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [paused, total]);

  if (!total) return null;

  const go = (dir: 1 | -1) => setIdx((i) => (i + dir + total) % total);

  const current = banners[idx];
  const isInternal = current.cta_link?.startsWith('/');

  return (
    <section
      className="relative w-full overflow-hidden bg-card border-b border-border"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchStartX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        touchStartX.current = null;
      }}
      aria-roledescription="carousel"
      aria-label="Promoções e destaques"
    >
      <div className="relative h-[320px] sm:h-[380px] md:h-[440px] lg:h-[480px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0"
            style={{ backgroundColor: current.bg_color ?? 'hsl(var(--card))' }}
            role="group"
            aria-roledescription="slide"
            aria-label={`${idx + 1} de ${total}`}
          >
            {/* Imagem de fundo */}
            <picture className="absolute inset-0">
              {current.image_mobile && (
                <source media="(max-width: 640px)" srcSet={current.image_mobile} />
              )}
              <img
                src={current.image_desktop}
                alt={current.title}
                loading={idx === 0 ? 'eager' : 'lazy'}
                fetchPriority={idx === 0 ? 'high' : 'auto'}
                decoding="async"
                className="w-full h-full object-cover"
              />
            </picture>

            {/* Gradiente para legibilidade do texto à esquerda */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(90deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.35) 40%, rgba(0,0,0,0) 70%)',
              }}
            />

            {/* Conteúdo */}
            <div className="relative h-full container mx-auto px-4 md:px-8 flex items-center">
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="max-w-xl"
                style={{ color: current.text_color ?? '#FFFFFF' }}
              >
                {current.badge && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-bold uppercase tracking-wider mb-4 shadow-md">
                    {current.badge}
                  </span>
                )}
                <h2 className="font-display font-extrabold text-3xl md:text-5xl leading-tight tracking-tight mb-3 drop-shadow-lg">
                  {current.title}
                </h2>
                {current.subtitle && (
                  <p className="text-lg md:text-2xl font-medium mb-3 opacity-95 drop-shadow">
                    {current.subtitle}
                  </p>
                )}
                {current.description && (
                  <p className="text-sm md:text-base mb-6 opacity-85 max-w-md leading-relaxed">
                    {current.description}
                  </p>
                )}
                {current.cta_label && current.cta_link && (
                  isInternal ? (
                    <Link
                      to={current.cta_link as any}
                      className="inline-flex items-center gap-2 h-12 px-6 rounded-pill bg-accent text-accent-foreground font-semibold text-sm shadow-elevated hover:brightness-110 transition"
                    >
                      {current.cta_label}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  ) : (
                    <a
                      href={current.cta_link}
                      className="inline-flex items-center gap-2 h-12 px-6 rounded-pill bg-accent text-accent-foreground font-semibold text-sm shadow-elevated hover:brightness-110 transition"
                    >
                      {current.cta_label}
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  )
                )}
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Setas */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Slide anterior"
              className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Próximo slide"
              className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Dots */}
        {total > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setIdx(i)}
                aria-label={`Ir para slide ${i + 1}`}
                aria-current={i === idx}
                className={`h-1.5 rounded-full transition-all ${
                  i === idx ? 'w-8 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
