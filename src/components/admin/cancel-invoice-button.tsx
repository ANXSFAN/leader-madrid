"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { cancelInvoice } from "@/lib/actions/invoice";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Ban, Loader2 } from "lucide-react";

interface CancelInvoiceButtonProps {
  invoiceId: string;
}

export function CancelInvoiceButton({ invoiceId }: CancelInvoiceButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    if (!reason.trim()) {
      setError("Cancellation reason is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await cancelInvoice(invoiceId, reason);
      if (result.success) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error || "Failed to cancel invoice");
      }
    } catch (e: any) {
      setError(e.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-50">
          <Ban className="mr-2 h-4 w-4" />
          Anular / Cancel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anular Factura / Cancel Invoice</DialogTitle>
          <DialogDescription>
            Las facturas anuladas se conservan en la secuencia (RD 1619/2012).
            Esta acción no se puede deshacer. Para facturas pagadas, use Factura Rectificativa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Motivo de anulación / Cancellation reason *</Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Datos incorrectos / Incorrect data"
              rows={3}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleCancel}
            disabled={loading || !reason.trim()}
            variant="destructive"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Anulación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
