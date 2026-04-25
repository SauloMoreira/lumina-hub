import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    let timeout: ReturnType<typeof setTimeout>;

    const startTimeout = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (mounted) setIsAdmin(false);
      }, 5000);
    };

    const finish = (value: boolean) => {
      if (!mounted) return;
      clearTimeout(timeout);
      setIsAdmin(value);
    };

    const check = async () => {
      startTimeout();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        finish(false);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', auth.user.id)
        .maybeSingle();
      finish(!error && data?.role === 'admin');
    };

    check().catch(() => finish(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session?.user) {
        finish(false);
        return;
      }
      setIsAdmin(null);
      check().catch(() => finish(false));
    });
    return () => {
      mounted = false;
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  return isAdmin;
}
