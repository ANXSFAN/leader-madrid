import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface RecentSaleItem {
  id: string;
  orderNumber: string;
  name: string;
  email: string;
  amount: number;
  status: string;
  createdAt: string; // ISO date string
  avatar?: string;
}

interface RecentSalesProps {
  sales: RecentSaleItem[];
  locale: string;
  currency: string;
  statusLabels: Record<string, string>;
  timeAgoLabel: (ms: number) => string;
}

const STATUS_VARIANT_MAP: Record<string, "status-pending" | "status-active" | "status-processing" | "status-cancelled" | "default" | "secondary"> = {
  PENDING: "status-pending",
  CONFIRMED: "status-active",
  PROCESSING: "status-processing",
  SHIPPED: "secondary",
  DELIVERED: "status-active",
  CANCELLED: "status-cancelled",
  DRAFT: "status-pending",
  RETURNED: "status-cancelled",
};

export function RecentSales({ sales, locale, currency, statusLabels, timeAgoLabel }: RecentSalesProps) {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  });

  return (
    <div className="space-y-4">
      {sales.map((sale) => {
        const elapsed = Date.now() - new Date(sale.createdAt).getTime();
        const variant = STATUS_VARIANT_MAP[sale.status] || "default";

        return (
          <div key={sale.id} className="flex items-center gap-3 py-1">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={sale.avatar} alt="Avatar" />
              <AvatarFallback className="text-xs">{sale.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium leading-none truncate">{sale.name}</p>
                <Badge variant={variant} className="text-[10px] px-1.5 py-0 shrink-0">
                  {statusLabels[sale.status] || sale.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {sale.orderNumber} &middot; {timeAgoLabel(elapsed)}
              </p>
            </div>
            <div className="ml-auto font-semibold text-sm shrink-0 tabular-nums">
              {formatter.format(sale.amount)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
