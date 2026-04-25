import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session, User } from '@supabase/supabase-js';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let timeout: ReturnType<typeof setTimeout>;

    const finishLoading = () => {
      if (!mounted) return;
      clearTimeout(timeout);
      setLoading(false);
    };

    timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    // ALWAYS subscribe first, then fetch session
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      finishLoading();
    });

    supabase.auth.getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
      })
      .catch(() => { /* ignore */ })
      .finally(finishLoading);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user, loading, signOut: () => supabase.auth.signOut() };
}
