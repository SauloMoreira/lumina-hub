// Intercepta window.fetch e injeta o Authorization header do Supabase
// em chamadas para server functions (/_serverFn/), permitindo que o
// middleware requireSupabaseAuth no servidor reconheça o usuário.
import { supabase } from './client';

let installed = false;

export function installAuthFetch() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      const isServerFn = url.includes('/_serverFn/');
      if (isServerFn) {
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        if (!headers.has('authorization')) {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (token) headers.set('authorization', `Bearer ${token}`);
        }
        return originalFetch(input, { ...init, headers });
      }
    } catch (e) {
      // Falha silenciosa — segue o fetch original
      console.warn('[auth-fetch] erro ao injetar token', e);
    }
    return originalFetch(input, init);
  };
}
