import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-300",
  SUBMITTED: "bg-blue-100 text-blue-700 border-blue-300",
  INSPECTING: "bg-yellow-100 text-yellow-700 border-yellow-300",
  CLEARED: "bg-green-100 text-green-700 border-green-300",
  HELD: "bg-red-100 text-red-700 border-red-300",
  RELEASED: "bg-emerald-100 text-emerald-700 border-emerald-300",
};

export function CustomsStatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", statusStyles[status])}>
      {label}
    </Badge>
  );
}
