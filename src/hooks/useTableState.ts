import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";
import type { SortDirection, SortState } from "@/components/admin/datatable/types";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export type TableSearchState = {
  page: number;
  pageSize: number;
  q: string;
  sort: string; // "column.direction"
};

export function parseSort(raw: string | undefined, fallback: SortState): SortState {
  if (!raw) return fallback;
  const [column, direction] = raw.split(".");
  if (!column || (direction !== "asc" && direction !== "desc")) return fallback;
  return { column, direction };
}

export function formatSort(sort: SortState) {
  return `${sort.column}.${sort.direction}`;
}

/**
 * Generic helper used by admin tables. Reads page/pageSize/q/sort + extra filters
 * from the URL search params (already validated by the route's `validateSearch`)
 * and provides setters that navigate while preserving the rest of the search.
 */
export function useTableState<TSearch extends Partial<TableSearchState> & Record<string, unknown>>(
  routeId: string,
  defaults: { page: number; pageSize: number; sort: SortState },
) {
  const search = useSearch({ from: routeId as never }) as TSearch;
  const navigate = useNavigate();

  const page = (search.page as number) ?? defaults.page;
  const pageSize = (search.pageSize as number) ?? defaults.pageSize;
  const q = (search.q as string) ?? "";
  const sort = parseSort(search.sort as string | undefined, defaults.sort);

  const update = useCallback(
    (patch: Record<string, unknown>) => {
      navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => {
          const next: Record<string, unknown> = { ...prev, ...patch };
          // strip empty strings / undefined / null for clean URLs
          for (const k of Object.keys(next)) {
            const v = next[k];
            if (v === "" || v === undefined || v === null) delete next[k];
          }
          return next;
        },
        replace: true,
      } as never);
    },
    [navigate],
  );

  const setPage = useCallback((p: number) => update({ page: p }), [update]);
  const setPageSize = useCallback(
    (ps: number) => update({ pageSize: ps, page: 1 }),
    [update],
  );
  const setQ = useCallback((value: string) => update({ q: value || undefined, page: 1 }), [update]);
  const setSort = useCallback(
    (column: string, direction?: SortDirection) => {
      const dir: SortDirection =
        direction ?? (sort.column === column && sort.direction === "asc" ? "desc" : "asc");
      update({ sort: `${column}.${dir}`, page: 1 });
    },
    [update, sort],
  );
  const setFilter = useCallback(
    (key: string, value: unknown) => update({ [key]: value, page: 1 }),
    [update],
  );
  const clearAll = useCallback(() => {
    navigate({
      to: ".",
      search: () => ({ pageSize }),
      replace: true,
    } as never);
  }, [navigate, pageSize]);

  return {
    search,
    page,
    pageSize,
    q,
    sort,
    setPage,
    setPageSize,
    setQ,
    setSort,
    setFilter,
    clearAll,
    update,
  };
}
