import { createFileRoute } from '@tanstack/react-router';
import { makeInstitutionalAlias, InstitutionalAliasView } from '@/components/institutional/aliasRoute';

export const Route = createFileRoute('/devolucao')({
  ...makeInstitutionalAlias('devolucao'),
  component: function Devolucao() {
    return <InstitutionalAliasView loaderData={Route.useLoaderData()} />;
  },
});
