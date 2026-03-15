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
  LineChart,
  Line,
} from "recharts";
import { formatMoney } from "@/lib/formatters";
import { CHART_COLORS } from "./charts-shared";

interface AgingData {
  name: string;
  "0-30": number;
  "31-60": number;
  "61-90": number;
  "90+": number;
}

export function AgingChart({
  data,
  locale,
  currency,
}: {
  data: AgingData[];
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
        <Legend />
        <Bar dataKey="0-30" stackId="a" fill="#16a34a" name="0-30 days" />
        <Bar dataKey="31-60" stackId="a" fill="#d4a017" name="31-60 days" />
        <Bar dataKey="61-90" stackId="a" fill="#ea580c" name="61-90 days" />
        <Bar dataKey="90+" stackId="a" fill="#dc2626" name="90+ days" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface CollectionRateData {
  name: string;
  rate: number;
}

export function CollectionRateChart({ data }: { data: CollectionRateData[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
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
          tickFormatter={(v) => `${v}%`}
          domain={[0, 100]}
        />
        <Tooltip
          formatter={((value: number) => `${value.toFixed(1)}%`) as any}
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Line
          type="monotone"
          dataKey="rate"
          stroke={CHART_COLORS[2]}
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
