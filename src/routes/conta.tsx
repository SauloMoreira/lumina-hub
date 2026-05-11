import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { buildSeo } from "@/lib/seo";

export const Route = createFileRoute("/conta")({
  head: () => buildSeo({ title: "Minha conta", url: "/conta", noindex: true }),
  component: AccountLayout,
});

function AccountLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return <PageSkeleton />;
  }

  return <Outlet />;
}
