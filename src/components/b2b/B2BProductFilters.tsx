import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

export type B2bSortKey =
  | "relevance"
  | "b2b_discount_desc"
  | "b2b_min_qty_asc"
  | "price_asc"
  | "price_desc"
  | "stock_first"
  | "newest"
  | "name_asc";

export type B2bFiltersState = {
  q: string;
  categoryId: string;
  brand: string;
  priceMin: string;
  priceMax: string;
  b2bOnly: boolean;
  inStock: boolean;
  onSale: boolean;
  sort: B2bSortKey;
};

export const DEFAULT_B2B_FILTERS: B2bFiltersState = {
  q: "",
  categoryId: "",
  brand: "",
  priceMin: "",
  priceMax: "",
  b2bOnly: false,
  inStock: true,
  onSale: false,
  sort: "relevance",
};

type CategoryOption = { id: string; name: string };

type Props = {
  state: B2bFiltersState;
  onChange: (next: B2bFiltersState) => void;
  onReset: () => void;
  categories: CategoryOption[];
  brands: string[];
  /** Quando true, exibe filtros e ordenações específicos B2B (apenas empresa aprovada). */
  showB2bOnly: boolean;
  totalCount: number | null;
  isFetching?: boolean;
};

export function B2BProductFilters({
  state,
  onChange,
  onReset,
  categories,
  brands,
  showB2bOnly,
  totalCount,
  isFetching,
}: Props) {
  const set = <K extends keyof B2bFiltersState>(key: K, value: B2bFiltersState[K]) =>
    onChange({ ...state, [key]: value });

  const hasAnyFilter =
    state.q.trim().length > 0 ||
    state.categoryId !== "" ||
    state.brand !== "" ||
    state.priceMin !== "" ||
    state.priceMax !== "" ||
    state.b2bOnly ||
    state.onSale ||
    !state.inStock; // padrão é estoque ligado

  return (
    <div className="bg-card border border-border rounded-xl p-3 sm:p-4 flex flex-col gap-3">
      {/* Linha 1: busca + ordenação */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            inputMode="search"
            placeholder="Buscar por nome, SKU, marca, 18W, 6500K, IP66..."
            value={state.q}
            onChange={(e) => set("q", e.target.value)}
            className="pl-9 h-10"
            aria-label="Buscar produtos no atacado"
          />
          {state.q && (
            <button
              type="button"
              onClick={() => set("q", "")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
              aria-label="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="b2b-sort" className="text-xs text-muted-foreground whitespace-nowrap">
            Ordenar:
          </label>
          <select
            id="b2b-sort"
            value={state.sort}
            onChange={(e) => set("sort", e.target.value as B2bSortKey)}
            className="h-10 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="relevance">Mais relevantes</option>
            {showB2bOnly && <option value="b2b_discount_desc">Maior desconto B2B</option>}
            {showB2bOnly && <option value="b2b_min_qty_asc">Menor mín. B2B</option>}
            <option value="price_asc">Menor preço</option>
            <option value="price_desc">Maior preço</option>
            <option value="stock_first">Em estoque primeiro</option>
            <option value="newest">Mais recentes</option>
            <option value="name_asc">Nome A–Z</option>
          </select>
        </div>
      </div>

      {/* Linha 2: chips */}
      <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1">
        <Chip
          active={state.categoryId === ""}
          onClick={() => set("categoryId", "")}
          label="Todas as categorias"
        />
        {categories.map((c) => (
          <Chip
            key={c.id}
            active={state.categoryId === c.id}
            onClick={() => set("categoryId", c.id)}
            label={c.name}
          />
        ))}
      </div>

      {/* Linha 3: marca + preço + toggles */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={state.brand}
          onChange={(e) => set("brand", e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-xs min-w-[140px]"
          aria-label="Filtrar por marca"
        >
          <option value="">Todas as marcas</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <Input
          type="number"
          inputMode="decimal"
          placeholder="Preço mín."
          value={state.priceMin}
          onChange={(e) => set("priceMin", e.target.value)}
          className="h-9 w-28 text-xs"
          min={0}
        />
        <Input
          type="number"
          inputMode="decimal"
          placeholder="Preço máx."
          value={state.priceMax}
          onChange={(e) => set("priceMax", e.target.value)}
          className="h-9 w-28 text-xs"
          min={0}
        />
        <Toggle
          active={state.inStock}
          onClick={() => set("inStock", !state.inStock)}
          label="Em estoque"
        />
        <Toggle
          active={state.onSale}
          onClick={() => set("onSale", !state.onSale)}
          label="Em promoção"
        />
        {showB2bOnly && (
          <Toggle
            active={state.b2bOnly}
            onClick={() => set("b2bOnly", !state.b2bOnly)}
            label="Apenas com preço empresa"
          />
        )}

        {hasAnyFilter && (
          <button
            type="button"
            onClick={onReset}
            className="ml-auto inline-flex items-center gap-1 h-9 px-3 rounded-md border border-border bg-background text-xs font-medium text-foreground hover:bg-muted"
          >
            <X className="w-3.5 h-3.5" /> Limpar filtros
          </button>
        )}
      </div>

      {totalCount !== null && (
        <div className="text-xs text-muted-foreground">
          {isFetching
            ? "Buscando..."
            : `${totalCount} produto${totalCount === 1 ? "" : "s"} encontrado${totalCount === 1 ? "" : "s"}`}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 h-8 px-3 rounded-full text-xs font-medium border transition ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-foreground border-border hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}

function Toggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 h-9 px-3 rounded-md text-xs font-medium border transition ${
        active
          ? "bg-primary/10 text-primary border-primary/40"
          : "bg-background text-foreground border-border hover:bg-muted"
      }`}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}
