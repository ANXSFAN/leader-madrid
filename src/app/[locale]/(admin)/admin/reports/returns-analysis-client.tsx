"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ReportPieChart, CHART_COLORS } from "./charts-shared";

interface ReasonData {
  name: string;
  value: number;
}

export function ReturnsByReasonChart({ data }: { data: ReasonData[] }) {
  return <ReportPieChart data={data} height={280} />;
}

interface MonthlyReturnData {
  name: string;
  returnRate: number;
  returns: number;
}

export function MonthlyReturnRateChart({ data }: { data: MonthlyReturnData[] }) {
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
        />
        <Tooltip
          formatter={((value: number, name: string) => {
            if (name === "returnRate") return [`${value.toFixed(1)}%`, "Return Rate"];
            return [value, name];
          }) as any}
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Line
          type="monotone"
          dataKey="returnRate"
          stroke={CHART_COLORS[4]}
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
