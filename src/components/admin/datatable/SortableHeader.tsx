import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortState } from "./types";

export function SortableHeader({
  column,
  label,
  sort,
  onSort,
  className,
}: {
  column: string;
  label: React.ReactNode;
  sort: SortState;
  onSort: (column: string) => void;
  className?: string;
}) {
  const active = sort.column === column;
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={cn(
        "inline-flex items-center gap-1 hover:text-foreground transition-colors",
        active && "text-foreground font-semibold",
        className,
      )}
    >
      {label}
      <Icon className="h-3.5 w-3.5 opacity-70" />
    </button>
  );
}
