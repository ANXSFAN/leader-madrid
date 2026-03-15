"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
  Bar,
} from "recharts";
import { formatMoney } from "@/lib/formatters";
import { CHART_COLORS, HorizontalBarChart } from "./charts-shared";

interface MonthlyMarginPoint {
  name: string;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
}

export function MarginTrendChart({
  data,
  locale,
  currency,
}: {
  data: MonthlyMarginPoint[];
  locale: string;
  currency: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <ComposedChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="money"
          tick={{ fontSize: 11, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatMoney(v, { locale, currency })}
        />
        <YAxis
          yAxisId="pct"
          orientation="right"
          tick={{ fontSize: 11, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
          domain={[0, 100]}
        />
        <Tooltip
          formatter={((value: number, name: string) => {
            if (name === "marginPct") return [`${value.toFixed(1)}%`, "Margin %"];
            return [formatMoney(value, { locale, currency }), name];
          }) as any}
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Area
          yAxisId="money"
          type="monotone"
          dataKey="profit"
          fill="#16a34a"
          fillOpacity={0.15}
          stroke="#16a34a"
          strokeWidth={2}
          name="Profit"
        />
        <Bar
          yAxisId="money"
          dataKey="revenue"
          fill="#1e3a5f"
          fillOpacity={0.3}
          radius={[4, 4, 0, 0]}
          name="Revenue"
        />
        <Line
          yAxisId="pct"
          type="monotone"
          dataKey="marginPct"
          stroke="#d4a017"
          strokeWidth={2}
          dot={{ r: 3 }}
          name="marginPct"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function MarginByProductChart({
  data,
  locale,
  currency,
}: {
  data: { name: string; value: number }[];
  locale: string;
  currency: string;
}) {
  return (
    <HorizontalBarChart
      data={data}
      height={Math.max(300, data.length * 35)}
      color={CHART_COLORS[2]}
      formatter={(v) => formatMoney(v, { locale, currency })}
    />
  );
}
