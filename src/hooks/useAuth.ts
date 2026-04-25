import { useAuthContext } from '@/components/auth/AuthProvider';

export function useAuth() {
  const { session, user, loading, signOut } = useAuthContext();
  return { session, user, loading, signOut };
}
