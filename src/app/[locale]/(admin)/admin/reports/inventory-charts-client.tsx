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
  Cell,
} from "recharts";
import { CHART_COLORS, ReportPieChart } from "./charts-shared";

interface MovementData {
  name: string;
  in: number;
  out: number;
}

export function InventoryMovementChart({ data }: { data: MovementData[] }) {
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
        />
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} />
        <Legend />
        <Bar dataKey="in" fill="#16a34a" radius={[4, 4, 0, 0]} name="Stock In" />
        <Bar dataKey="out" fill="#dc2626" radius={[4, 4, 0, 0]} name="Stock Out" />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface ABCData {
  name: string;
  value: number;
  category: "A" | "B" | "C";
}

const ABC_COLORS = { A: "#16a34a", B: "#d4a017", C: "#dc2626" };

export function ABCClassificationChart({ data }: { data: ABCData[] }) {
  const grouped = {
    A: data.filter((d) => d.category === "A").reduce((s, d) => s + d.value, 0),
    B: data.filter((d) => d.category === "B").reduce((s, d) => s + d.value, 0),
    C: data.filter((d) => d.category === "C").reduce((s, d) => s + d.value, 0),
  };

  const pieData = [
    { name: "A (80%)", value: grouped.A, color: ABC_COLORS.A },
    { name: "B (15%)", value: grouped.B, color: ABC_COLORS.B },
    { name: "C (5%)", value: grouped.C, color: ABC_COLORS.C },
  ].filter((d) => d.value > 0);

  return <ReportPieChart data={pieData} height={280} />;
}
