import { createFileRoute } from "@tanstack/react-router";
import {
  makeInstitutionalAlias,
  InstitutionalAliasView,
} from "@/components/institutional/aliasRoute";

export const Route = createFileRoute("/reembolso")({
  ...makeInstitutionalAlias("reembolso"),
  component: function Reembolso() {
    return <InstitutionalAliasView loaderData={Route.useLoaderData()} />;
  },
});
