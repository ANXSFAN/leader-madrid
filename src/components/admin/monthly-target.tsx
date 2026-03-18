"use client";

import { Target } from "lucide-react";

interface MonthlyTargetProps {
  actual: number;
  target: number;
  actualFormatted: string;
  targetFormatted: string;
  label: string;
  ofLabel: string;
}

export function MonthlyTarget({
  actual,
  target,
  actualFormatted,
  targetFormatted,
  label,
  ofLabel,
}: MonthlyTargetProps) {
  const percentage = target > 0 ? Math.min((actual / target) * 100, 100) : 0;
  const overTarget = target > 0 && actual > target;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-accent" />
          <span className="text-sm font-semibold text-slate-700">{label}</span>
        </div>
        <div className="text-right">
          <span className="text-lg font-bold text-slate-900">
            {actualFormatted}
          </span>
          <span className="text-sm text-slate-400 ml-1">
            {ofLabel} {targetFormatted}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative">
        <div className="h-4 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              overTarget
                ? "bg-green-500"
                : percentage >= 75
                  ? "bg-yellow-500"
                  : percentage >= 50
                    ? "bg-amber-400"
                    : "bg-red-400"
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
          <span>0%</span>
          <span
            className={`font-semibold ${
              overTarget
                ? "text-green-600"
                : percentage >= 75
                  ? "text-yellow-600"
                  : "text-slate-600"
            }`}
          >
            {percentage.toFixed(1)}%
          </span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}
