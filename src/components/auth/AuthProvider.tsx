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
    const withTimeout = <T,>(promise: Promise<T>, ms = 3500) =>
      Promise.race([
        promise,
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), ms)),
      ]);

    const checkAdmin = async (uid: string | null | undefined) => {
      if (!uid) {
        if (mounted) setIsAdmin(false);
        return;
      }
      try {
        const result = await withTimeout(
          supabase.from("profiles").select("role").eq("id", uid).maybeSingle(),
        );
        if (!mounted) return;
        setIsAdmin(Boolean(result && !result.error && result.data?.role === "admin"));
      } catch {
        if (mounted) setIsAdmin(false);
      }
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
        void checkAdmin(newUid);
      }
    });

    withTimeout(supabase.auth.getSession())
      .then((res) => {
        if (!mounted) return;
        const nextSession = res?.data.session ?? null;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setLoading(false);
        lastUid = nextSession?.user?.id ?? null;
        void checkAdmin(lastUid);
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
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
