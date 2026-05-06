import { useAuthContext } from "@/components/auth/AuthProvider";

export function useIsAdmin() {
  return useAuthContext().isAdmin;
}
