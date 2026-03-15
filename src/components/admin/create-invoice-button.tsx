"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createInvoiceFromSO } from "@/lib/actions/invoice";
import { Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface CreateInvoiceButtonProps {
  salesOrderId: string;
  disabled?: boolean;
}

export function CreateInvoiceButton({ salesOrderId, disabled }: CreateInvoiceButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCreateInvoice = async () => {
    setLoading(true);
    try {
      const result = await createInvoiceFromSO(salesOrderId);

      if (result.success && result.invoiceId) {
        toast.success("Invoice created successfully");
        router.push(`/admin/invoices/${result.invoiceId}`);
      } else {
        toast.error(result.error || "Failed to create invoice");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      onClick={handleCreateInvoice} 
      disabled={disabled || loading}
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <FileText className="mr-2 h-4 w-4" />
      )}
      Create Invoice
    </Button>
  );
}
