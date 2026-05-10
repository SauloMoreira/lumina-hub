import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableHeader } from "./SortableHeader";
import { TableSkeleton } from "./TableSkeleton";
import { EmptyState } from "./EmptyState";
import type { DataTableColumn, SortState } from "./types";

export function DataTable<T>({
  columns,
  rows,
  loading,
  sort,
  onSort,
  emptyTitle,
  emptyDescription,
  emptyAction,
  rowKey,
  onRowClick,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  loading?: boolean;
  sort?: SortState;
  onSort?: (column: string) => void;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  rowKey: (row: T, idx: number) => string;
  onRowClick?: (row: T) => void;
}) {
  if (loading) return <TableSkeleton rows={6} cols={columns.length} />;

  if (!rows.length) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead
                key={c.id}
                className={cn(c.hideOnMobile && "hidden sm:table-cell", c.headerClassName)}
              >
                {c.sortable && sort && onSort ? (
                  <SortableHeader
                    column={c.id}
                    label={c.header}
                    sort={sort}
                    onSort={onSort}
                  />
                ) : (
                  c.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, idx) => (
            <TableRow
              key={rowKey(row, idx)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(onRowClick && "cursor-pointer")}
            >
              {columns.map((c) => (
                <TableCell
                  key={c.id}
                  className={cn(c.hideOnMobile && "hidden sm:table-cell", c.className)}
                >
                  {c.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
