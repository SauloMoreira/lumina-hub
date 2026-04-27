import { createFileRoute } from '@tanstack/react-router';
import { makeInstitutionalAlias, InstitutionalAliasView } from '@/components/institutional/aliasRoute';

export const Route = createFileRoute('/troca')({
  ...makeInstitutionalAlias('troca'),
  component: function Troca() {
    return <InstitutionalAliasView loaderData={Route.useLoaderData()} />;
  },
});
