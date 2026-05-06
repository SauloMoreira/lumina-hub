import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw, Search } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { getAdminOperations, type OperationsCard } from "@/server/operations.functions";
import { OperationsCardItem } from "@/components/admin/operations/OperationsCardItem";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/pendencias")({ component: PendenciasPage });

const PRIORITY_FILTERS = [
  { id: "all", label: "Todas" },
  { id: "urgent", label: "Urgentes" },
  { id: "attention", label: "Atenção" },
  { id: "low", label: "Baixa prioridade" },
] as const;

type PriorityFilter = (typeof PRIORITY_FILTERS)[number]["id"];

function PendenciasPage() {
  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["admin-operations"],
    queryFn: () => getAdminOperations(),
    staleTime: 60_000,
  });

  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");

  const groups = useMemo(() => {
    const set = new Set<string>();
    (data?.cards ?? []).forEach((c) => set.add(c.group));
    return ["all", ...Array.from(set)];
  }, [data]);

  const filtered = useMemo(() => {
    let list = (data?.cards ?? []).filter((c) => c.qty > 0);
    if (priority === "urgent") list = list.filter((c) => c.status === "danger");
    else if (priority === "attention") list = list.filter((c) => c.status === "warn");
    else if (priority === "low") list = list.filter((c) => c.status === "unknown");
    if (groupFilter !== "all") list = list.filter((c) => c.group === groupFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(
        (c) => c.title.toLowerCase().includes(s) || c.description.toLowerCase().includes(s),
      );
    }
    return list.sort((a, b) => statusWeight(b.status) - statusWeight(a.status));
  }, [data, priority, groupFilter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, OperationsCard[]>();
    filtered.forEach((c) => {
      const arr = map.get(c.group) ?? [];
      arr.push(c);
      map.set(c.group, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <AdminLayout
      title="Pendências"
      action={
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-50"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      }
    >
      <p className="text-sm text-muted-foreground mb-6 -mt-2">
        Tudo que precisa de ação na operação, agrupado por área e priorizado por urgência.
      </p>

      {error && (
        <div className="mb-6 p-4 rounded-lg border border-destructive/40 bg-destructive/10 text-sm text-destructive">
          Erro ao carregar as pendências. Tente atualizar.
        </div>
      )}

      {/* Filtros */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar pendência…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {PRIORITY_FILTERS.map((p) => (
            <FilterChip key={p.id} active={priority === p.id} onClick={() => setPriority(p.id)}>
              {p.label}
            </FilterChip>
          ))}
          <span className="w-px h-6 bg-border mx-1 self-center" />
          {groups.map((g) => (
            <FilterChip key={g} active={groupFilter === g} onClick={() => setGroupFilter(g)}>
              {g === "all" ? "Todos os grupos" : g}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Lista agrupada */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 bg-muted/40 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-xl p-8 text-center">
          <p className="font-medium">Nenhuma pendência encontrada.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Ou sua operação está em dia, ou os filtros aplicados não retornaram resultados.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([groupName, items]) => (
            <section key={groupName}>
              <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">
                {groupName}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {items.map((c) => (
                  <OperationsCardItem key={c.id} card={c} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-xs px-3 py-1.5 rounded-full border transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function statusWeight(s: "ok" | "warn" | "danger" | "unknown") {
  return s === "danger" ? 3 : s === "warn" ? 2 : s === "unknown" ? 1 : 0;
}
