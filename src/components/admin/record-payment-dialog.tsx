"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { recordPayment } from "@/lib/actions/invoice";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface RecordPaymentDialogProps {
  invoiceId: string;
  remainingAmount: number;
}

export function RecordPaymentDialog({ invoiceId, remainingAmount }: RecordPaymentDialogProps) {
  const t = useTranslations("admin.invoices");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(remainingAmount.toString());
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [note, setNote] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await recordPayment(invoiceId, parseFloat(amount), method, note);

      if (result.success) {
        toast.success(t("payment.toast.success"));
        setOpen(false);
        setNote("");
        setAmount("0");
      } else {
        toast.error(result.error || t("payment.toast.error"));
      }
    } catch {
      toast.error(t("payment.toast.unexpected"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">{t("payment.trigger")}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="border-l-4 border-[#A7144C] pl-3">{t("payment.title")}</DialogTitle>
          <DialogDescription>
            {t("payment.description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                {t("payment.amount")}
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="method" className="text-right">
                {t("payment.method")}
              </Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder={t("payment.select_method")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK_TRANSFER">{t("payment.methods.BANK_TRANSFER")}</SelectItem>
                  <SelectItem value="CASH">{t("payment.methods.CASH")}</SelectItem>
                  <SelectItem value="CECABANK">{t("payment.methods.CECABANK")}</SelectItem>
                  <SelectItem value="PAYPAL">{t("payment.methods.PAYPAL")}</SelectItem>
                  <SelectItem value="CHECK">{t("payment.methods.CHECK")}</SelectItem>
                  <SelectItem value="OTHER">{t("payment.methods.OTHER")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="note" className="text-right">
                {t("payment.note")}
              </Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="col-span-3"
                placeholder={t("payment.note_placeholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("payment.cancel")}
            </Button>
            <Button type="submit" disabled={loading} className="bg-[#A7144C] hover:bg-[#8a103f] text-white font-black">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("payment.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
