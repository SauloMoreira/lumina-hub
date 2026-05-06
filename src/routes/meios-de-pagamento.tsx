import { createFileRoute } from "@tanstack/react-router";
import {
  makeInstitutionalAlias,
  InstitutionalAliasView,
} from "@/components/institutional/aliasRoute";

export const Route = createFileRoute("/meios-de-pagamento")({
  ...makeInstitutionalAlias("meios-de-pagamento"),
  component: function MeiosDePagamento() {
    return <InstitutionalAliasView loaderData={Route.useLoaderData()} />;
  },
});
