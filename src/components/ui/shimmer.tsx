import { cn } from "@/lib/utils";

interface ShimmerProps {
  w?: string | number;
  h?: string | number;
  r?: string | number;
  className?: string;
}

export function Shimmer({ w = "100%", h = 16, r = 8, className }: ShimmerProps) {
  return (
    <div
      className={cn("shimmer-block", className)}
      style={{
        width: typeof w === "number" ? `${w}px` : w,
        height: typeof h === "number" ? `${h}px` : h,
        borderRadius: typeof r === "number" ? `${r}px` : r,
      }}
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="shimmer-block aspect-square" style={{ borderRadius: 0 }} />
      <div className="p-4 space-y-2">
        <Shimmer w="60%" h={10} />
        <Shimmer w="90%" h={14} />
        <Shimmer w="40%" h={20} />
      </div>
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  const widths = ["20%", "30%", "15%", "20%", "15%"];
  return (
    <tr className="border-t border-border">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Shimmer w={widths[i % widths.length]} h={14} />
        </td>
      ))}
    </tr>
  );
}

export function KPICardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-2">
      <Shimmer w="50%" h={10} />
      <Shimmer w="70%" h={22} />
    </div>
  );
}
