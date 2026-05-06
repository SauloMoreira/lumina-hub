import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { DashboardData } from "@/server/dashboard.functions";
import { fmtBRL, fmtDayShort, fmtInt } from "./format";
import { EmptyChart } from "./EmptyChart";

export function SalesChart({ data }: { data: DashboardData["salesByDay"] }) {
  const hasAny = data.some((d) => d.revenue > 0 || d.paidOrders > 0);
  if (!hasAny) {
    return <EmptyChart message="Ainda não há vendas neste período." />;
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tickFormatter={fmtDayShort}
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
          />
          <YAxis
            yAxisId="left"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(l) => `Dia ${fmtDayShort(String(l))}`}
            formatter={(value: number, name: string) => {
              if (name === "Receita") return [fmtBRL(value), name];
              return [fmtInt(value), name];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            yAxisId="left"
            dataKey="revenue"
            name="Receita"
            fill="hsl(var(--primary))"
            radius={[4, 4, 0, 0]}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="paidOrders"
            name="Pedidos pagos"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
