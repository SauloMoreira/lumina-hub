import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { optimizeBannerUrl } from "@/lib/bannerImages";

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
  title_color: string | null;
};

const AUTOPLAY_MS = 6000;

export function HeroCarousel({ banners }: { banners: HeroBanner[] }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const total = banners.length;
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (paused || total <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % total), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [paused, total]);

  if (!total) return null;

  const go = (dir: 1 | -1) => {
    setInteracted(true);
    setIdx((i) => (i + dir + total) % total);
  };

  return (
    <section
      className="relative w-full overflow-hidden bg-card border-b border-border"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        touchStartX.current = null;
      }}
      aria-roledescription="carousel"
      aria-label="Promoções e destaques"
    >
      <div className="relative h-[260px] xs:h-[300px] sm:h-[380px] md:h-[440px] lg:h-[480px]">
        {banners.map((b, i) => {
          const active = i === idx;
          const isInternal = b.cta_link?.startsWith("/");
          // Só montamos imagens dos demais slides após autoplay/interação
          const shouldRender = i === 0 || interacted || idx !== 0;
          const desktopSrc = optimizeBannerUrl(b.image_desktop, { width: 1280, quality: 75 });
          const desktopSrc2x = optimizeBannerUrl(b.image_desktop, { width: 1920, quality: 72 });
          const tabletSrc = optimizeBannerUrl(b.image_desktop, { width: 1024, quality: 75 });
          const mobileSrc = optimizeBannerUrl(b.image_mobile ?? b.image_desktop, {
            width: 720,
            quality: 72,
          });
          return (
            <div
              key={b.id}
              className="absolute inset-0 transition-opacity duration-500"
              style={{
                opacity: active ? 1 : 0,
                pointerEvents: active ? "auto" : "none",
                backgroundColor: b.bg_color ?? undefined,
              }}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} de ${total}`}
              aria-hidden={!active}
            >
              {shouldRender && (
                <picture className="absolute inset-0">
                  <source media="(max-width: 640px)" srcSet={mobileSrc} />
                  <source media="(max-width: 1024px)" srcSet={tabletSrc} />
                  <img
                    src={desktopSrc}
                    srcSet={`${desktopSrc} 1280w, ${desktopSrc2x} 1920w`}
                    sizes="100vw"
                    alt={b.title}
                    width={1280}
                    height={512}
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : "auto"}
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </picture>
              )}

              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.35) 40%, rgba(0,0,0,0) 70%)",
                }}
              />

              <div className="relative h-full container mx-auto px-4 md:px-8 flex items-center">
                <div
                  className="max-w-full sm:max-w-xl"
                  style={{ color: b.text_color ?? "#FFFFFF" }}
                >
                  {b.badge && (
                    <span className="inline-flex items-center px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-accent text-accent-foreground text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-2 sm:mb-4 shadow-md">
                      {b.badge}
                    </span>
                  )}
                  <h2
                    className="font-display font-extrabold text-xl sm:text-3xl md:text-5xl leading-tight tracking-tight mb-2 sm:mb-3 drop-shadow-lg break-words"
                    style={{ color: b.title_color ?? b.text_color ?? "#FFFFFF" }}
                  >
                    {b.title}
                  </h2>
                  {b.subtitle && (
                    <p className="text-sm sm:text-lg md:text-2xl font-medium mb-2 sm:mb-3 opacity-95 drop-shadow break-words">
                      {b.subtitle}
                    </p>
                  )}
                  {b.description && (
                    <p className="hidden sm:block text-sm md:text-base mb-6 opacity-85 max-w-md leading-relaxed">
                      {b.description}
                    </p>
                  )}
                  {b.cta_label &&
                    b.cta_link &&
                    active &&
                    (isInternal ? (
                      <Link
                        to={b.cta_link as any}
                        className="inline-flex items-center gap-2 h-10 sm:h-12 px-4 sm:px-6 rounded-pill bg-accent text-accent-foreground font-semibold text-xs sm:text-sm shadow-elevated hover:brightness-110 transition"
                      >
                        {b.cta_label}
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    ) : (
                      <a
                        href={b.cta_link}
                        className="inline-flex items-center gap-2 h-10 sm:h-12 px-4 sm:px-6 rounded-pill bg-accent text-accent-foreground font-semibold text-xs sm:text-sm shadow-elevated hover:brightness-110 transition"
                      >
                        {b.cta_label}
                        <ArrowRight className="w-4 h-4" />
                      </a>
                    ))}
                </div>
              </div>
            </div>
          );
        })}

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

        {total > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setInteracted(true);
                  setIdx(i);
                }}
                aria-label={`Ir para slide ${i + 1}`}
                aria-current={i === idx}
                className={`h-1.5 rounded-full transition-all ${
                  i === idx ? "w-8 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
