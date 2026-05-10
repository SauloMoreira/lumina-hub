import type { ReactNode } from "react";

export type SortDirection = "asc" | "desc";

export type SortState = {
  column: string;
  direction: SortDirection;
};

export type DataTableColumn<T> = {
  /** Stable id, used for sort key. */
  id: string;
  header: ReactNode;
  /** Make column sortable in the URL state. */
  sortable?: boolean;
  /** Cell renderer. */
  cell: (row: T) => ReactNode;
  /** Optional className for <td>. */
  className?: string;
  /** Optional className for <th>. */
  headerClassName?: string;
  /** Hide on mobile (sm breakpoint). */
  hideOnMobile?: boolean;
};
