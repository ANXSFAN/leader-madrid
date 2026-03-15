"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatMoney } from "@/lib/formatters";
import { CHART_COLORS, HorizontalBarChart, FunnelChart } from "./charts-shared";

interface YoYChartPoint {
  name: string;
  current: number;
  previous: number;
}

export function YoYComparisonChart({
  data,
  locale,
  currency,
  currentLabel,
  previousLabel,
}: {
  data: YoYChartPoint[];
  locale: string;
  currency: string;
  currentLabel: string;
  previousLabel: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatMoney(v, { locale, currency })}
        />
        <Tooltip
          formatter={((value: number) => formatMoney(value, { locale, currency })) as any}
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Legend />
        <Bar dataKey="current" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} name={currentLabel} />
        <Bar dataKey="previous" fill="#94a3b8" radius={[4, 4, 0, 0]} name={previousLabel} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CountryDistributionChart({
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
      height={Math.max(250, data.length * 35)}
      color={CHART_COLORS[1]}
      formatter={(v) => formatMoney(v, { locale, currency })}
    />
  );
}

interface FunnelStep {
  label: string;
  value: number;
}

export function SalesFunnelChart({ steps }: { steps: FunnelStep[] }) {
  return <FunnelChart steps={steps} />;
}
