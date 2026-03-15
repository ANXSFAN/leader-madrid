"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export const CHART_COLORS = [
  "#1e3a5f", // navy
  "#d4a017", // gold
  "#2563eb", // blue
  "#16a34a", // green
  "#dc2626", // red
  "#9333ea", // purple
  "#ea580c", // orange
  "#0891b2", // cyan
  "#be185d", // pink
  "#65a30d", // lime
];

interface PieDataItem {
  name: string;
  value: number;
  color?: string;
}

export function ReportPieChart({
  data,
  height = 300,
}: {
  data: PieDataItem[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          outerRadius={100}
          innerRadius={50}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
          label={(({ name, percent }: { name: string; percent?: number }) =>
            `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
          ) as any}
          labelLine={{ strokeWidth: 1 }}
        >
          {data.map((entry, index) => (
            <Cell
              key={entry.name}
              fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={((value: number) => value.toLocaleString()) as any}
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

interface HBarDataItem {
  name: string;
  value: number;
}

export function HorizontalBarChart({
  data,
  height = 300,
  color = CHART_COLORS[0],
  formatter,
}: {
  data: HBarDataItem[];
  height?: number;
  color?: string;
  formatter?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatter}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          width={75}
        />
        <Tooltip
          formatter={((value: number) => (formatter ? formatter(value) : value.toLocaleString())) as any}
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface FunnelStep {
  label: string;
  value: number;
  color?: string;
}

export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  if (steps.length === 0) return null;
  const maxValue = Math.max(...steps.map((s) => s.value), 1);

  return (
    <div className="space-y-2">
      {steps.map((step, i) => {
        const widthPct = Math.max((step.value / maxValue) * 100, 8);
        const color = step.color || CHART_COLORS[i % CHART_COLORS.length];
        return (
          <div key={step.label} className="flex items-center gap-3">
            <div className="w-28 text-xs text-right text-muted-foreground truncate">
              {step.label}
            </div>
            <div className="flex-1">
              <div
                className="h-8 rounded flex items-center justify-end px-2 text-xs font-medium text-white transition-all"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: color,
                  minWidth: "40px",
                }}
              >
                {step.value.toLocaleString()}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="w-16 text-xs text-muted-foreground">
                {steps[i + 1].value > 0 && step.value > 0
                  ? `${((steps[i + 1].value / step.value) * 100).toFixed(0)}%`
                  : "—"}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
