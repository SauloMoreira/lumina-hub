import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

interface AuthCtx {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean | null;
  signOut: () => Promise<{ error: any }>;
}

const Ctx = createContext<AuthCtx>({
  session: null,
  user: null,
  loading: true,
  isAdmin: null,
  signOut: async () => ({ error: null }),
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    const checkAdmin = async (uid: string | null | undefined) => {
      if (!uid) {
        if (mounted) setIsAdmin(false);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", uid)
        .maybeSingle();
      if (mounted) setIsAdmin(!error && data?.role === "admin");
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      // defer admin check to avoid blocking the auth callback
      setIsAdmin(null);
      setTimeout(() => checkAdmin(s?.user?.id), 0);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
      checkAdmin(data.session?.user?.id);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <Ctx.Provider
      value={{ session, user, loading, isAdmin, signOut: () => supabase.auth.signOut() }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuthContext() {
  return useContext(Ctx);
}
