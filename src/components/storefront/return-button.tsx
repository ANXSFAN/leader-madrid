"use client";

import { RotateCcw } from "lucide-react";
import { Link } from "@/i18n/navigation";

interface ReturnButtonProps {
  orderId: string;
}

export function ReturnButton({ orderId }: ReturnButtonProps) {
  return (
    <Link
      href={`/profile/orders/${orderId}/return`}
      className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-base font-medium text-amber-800 hover:bg-amber-100 transition-colors"
    >
      <RotateCcw className="h-4 w-4" />
      Solicitar Devolución
    </Link>
  );
}
