import React from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from "lucide-react";

type StatCardColor = "yellow" | "green" | "blue" | "red" | "purple" | "amber";

interface TrendInfo {
  value: number;
  label: string;
}

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string | null;
  changeType?: "up" | "down" | "neutral";
  changeLabel?: string;
  icon: React.ElementType;
  color?: StatCardColor;
  footer?: React.ReactNode;
  className?: string;
  trend?: TrendInfo;
}

const COLOR_MAP: Record<StatCardColor, { bg: string; icon: string; text: string }> = {
  yellow: {
    bg: "bg-accent/10",
    icon: "bg-accent/15 text-accent",
    text: "text-accent",
  },
  green: {
    bg: "bg-green-50",
    icon: "bg-green-500/15 text-green-600",
    text: "text-green-600",
  },
  blue: {
    bg: "bg-blue-50",
    icon: "bg-blue-500/15 text-blue-600",
    text: "text-blue-600",
  },
  red: {
    bg: "bg-red-50",
    icon: "bg-red-500/15 text-red-600",
    text: "text-red-600",
  },
  purple: {
    bg: "bg-purple-50",
    icon: "bg-purple-500/15 text-purple-600",
    text: "text-purple-600",
  },
  amber: {
    bg: "bg-amber-50",
    icon: "bg-amber-500/15 text-amber-600",
    text: "text-amber-600",
  },
};

export function StatCard({
  title,
  value,
  change,
  changeType = "neutral",
  changeLabel,
  icon: Icon,
  color = "yellow",
  footer,
  className,
  trend,
}: StatCardProps) {
  const colors = COLOR_MAP[color];

  const ChangeIcon =
    changeType === "up"
      ? TrendingUp
      : changeType === "down"
        ? TrendingDown
        : Minus;

  const changeColor =
    changeType === "up"
      ? "text-green-600"
      : changeType === "down"
        ? "text-red-500"
        : "text-slate-400";

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-all duration-200",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {title}
          </p>
          <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
          {change !== undefined && change !== null ? (
            <div className={cn("mt-1 flex items-center gap-1 text-xs font-medium", changeColor)}>
              <ChangeIcon className="h-3.5 w-3.5" />
              <span>
                {changeType === "up" && "+"}
                {change}%{changeLabel ? ` ${changeLabel}` : ""}
              </span>
            </div>
          ) : changeLabel ? (
            <p className="mt-1 text-xs text-slate-400">{changeLabel}</p>
          ) : null}
        </div>
        <div className={cn("rounded-xl p-2.5 shrink-0", colors.icon)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend && (
        <div className={cn(
          "mt-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
          trend.value >= 0
            ? "bg-green-50 text-green-700"
            : "bg-red-50 text-red-700"
        )}>
          {trend.value >= 0 ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          <span>
            {trend.value >= 0 ? "+" : ""}
            {trend.value.toFixed(1)}% {trend.label}
          </span>
        </div>
      )}
      {footer && <div className="mt-3 border-t border-slate-100 pt-3">{footer}</div>}
    </div>
  );
}
