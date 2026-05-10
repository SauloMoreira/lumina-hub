import { Search, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DataTableToolbar({
  q,
  onQChange,
  searchPlaceholder = "Buscar…",
  filters,
  hasActiveFilters,
  onClearFilters,
  rightSlot,
}: {
  q: string;
  onQChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  rightSlot?: ReactNode;
}) {
  const [local, setLocal] = useState(q);

  // Keep local input in sync with external (e.g. clear filters)
  useEffect(() => {
    setLocal(q);
  }, [q]);

  // Debounce 300ms
  useEffect(() => {
    if (local === q) return;
    const t = setTimeout(() => onQChange(local), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  return (
    <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9"
        />
      </div>
      {filters}
      {hasActiveFilters && onClearFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters} className="gap-1">
          <X className="w-3.5 h-3.5" /> Limpar filtros
        </Button>
      )}
      {rightSlot && <div className="ml-auto">{rightSlot}</div>}
    </div>
  );
}
