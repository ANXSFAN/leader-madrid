"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatMoney } from "@/lib/formatters";
import { ReportPieChart, CHART_COLORS } from "./charts-shared";

interface MonthlySpendData {
  name: string;
  amount: number;
}

export function ProcurementSpendChart({
  data,
  locale,
  currency,
}: {
  data: MonthlySpendData[];
  locale: string;
  currency: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
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
        <Bar dataKey="amount" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface POStatusData {
  name: string;
  value: number;
}

export function POStatusChart({ data }: { data: POStatusData[] }) {
  return <ReportPieChart data={data} height={280} />;
}
