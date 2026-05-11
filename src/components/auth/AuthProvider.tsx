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

    let lastUid: string | null | undefined = undefined;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      const newUid = s?.user?.id ?? null;
      // Só re-checa admin quando o usuário muda (evita resetar isAdmin a null
      // em TOKEN_REFRESHED, o que prendia o painel admin no PageSkeleton).
      if (newUid !== lastUid) {
        lastUid = newUid;
        setIsAdmin(null);
        setTimeout(() => checkAdmin(newUid), 0);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
      lastUid = data.session?.user?.id ?? null;
      checkAdmin(lastUid);
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
