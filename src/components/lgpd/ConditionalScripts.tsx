import { useEffect } from 'react';
import { useCookieStore } from '@/stores/cookieStore';

// IDs reais devem ser configurados pelo usuário/admin.
const GA_ID = ''; // ex.: 'G-XXXXXXXXXX'
const CLARITY_ID = ''; // ex.: 'XXXXXXXXXX'
const META_PIXEL_ID = ''; // ex.: 'XXXXXXXXXX'
const GOOGLE_ADS_ID = ''; // ex.: 'AW-XXXXXXXXXX'

function inject(id: string, build: () => HTMLScriptElement) {
  if (document.getElementById(id)) return;
  const el = build();
  el.id = id;
  document.head.appendChild(el);
}

export function ConditionalScripts() {
  const { consented, preferences } = useCookieStore();

  useEffect(() => {
    if (!consented || typeof document === 'undefined') return;

    // Analytics
    if (preferences.analytics) {
      if (GA_ID) {
        inject('lm-ga-script', () => {
          const s = document.createElement('script');
          s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
          s.async = true;
          s.onload = () => {
            window.dataLayer = window.dataLayer || [];
            const gtag = (...args: any[]) => {
              window.dataLayer!.push(args);
            };
            gtag('js', new Date());
            gtag('config', GA_ID, { anonymize_ip: true, cookie_flags: 'SameSite=None;Secure' });
            window.gtag = gtag;
          };
          return s;
        });
      }
      if (CLARITY_ID) {
        inject('lm-clarity-script', () => {
          const s = document.createElement('script');
          s.innerHTML = `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/${CLARITY_ID}";y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script");`;
          return s;
        });
      }
    }

    // Marketing
    if (preferences.marketing) {
      if (META_PIXEL_ID) {
        inject('lm-meta-pixel', () => {
          const s = document.createElement('script');
          s.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`;
          return s;
        });
      }
      if (GOOGLE_ADS_ID) {
        inject('lm-gads-script', () => {
          const s = document.createElement('script');
          s.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`;
          s.async = true;
          return s;
        });
      }
    }

    if (preferences.personalization) {
      window.__LM_PERSONALIZATION = true;
    }
  }, [consented, preferences]);

  return null;
}
