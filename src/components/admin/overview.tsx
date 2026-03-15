"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { formatMoney } from "@/lib/formatters";

interface OverviewProps {
  data: { name: string; total: number }[];
  locale: string;
  currency: string;
}

export function Overview({ data, locale, currency }: OverviewProps) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <XAxis
          dataKey="name"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => formatMoney(value, { locale, currency })}
        />
        <Tooltip
          formatter={((value: number) => [
            formatMoney(value, { locale, currency }),
            "Total",
          ]) as any}
          cursor={{ fill: "transparent" }}
        />
        <Bar
          dataKey="total"
          fill="currentColor"
          radius={[4, 4, 0, 0]}
          className="fill-primary"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
