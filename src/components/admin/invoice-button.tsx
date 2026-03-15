"use client";

import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { generateInvoiceHtml } from "@/lib/actions/invoice";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface InvoiceButtonProps {
  orderId: string;
}

export function InvoiceButton({ orderId }: InvoiceButtonProps) {
  const t = useTranslations("admin.invoices");

  const handlePrint = async () => {
    try {
      const result = await generateInvoiceHtml(orderId);
      const { error } = result;
      const html = 'html' in result ? (result as any).html : undefined;

      if (error) {
        toast.error(error);
        return;
      }

      if (html) {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
        } else {
          toast.error(t("button.popup_blocked"));
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(t("button.generate_error"));
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={handlePrint} title={t("button.title")}>
      <FileText className="h-4 w-4" />
    </Button>
  );
}
