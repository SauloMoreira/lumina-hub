import { createFileRoute } from '@tanstack/react-router';
import { makeInstitutionalAlias, InstitutionalAliasView } from '@/components/institutional/aliasRoute';

export const Route = createFileRoute('/condicoes-de-uso')({
  ...makeInstitutionalAlias('condicoes-de-uso'),
  component: function CondicoesDeUso() {
    return <InstitutionalAliasView loaderData={Route.useLoaderData()} />;
  },
});
