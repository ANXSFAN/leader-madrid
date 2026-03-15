"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { createRectificativeInvoice } from "@/lib/actions/invoice";
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
import { FileX2, Loader2 } from "lucide-react";

interface RectificativaButtonProps {
  invoiceId: string;
}

export function RectificativaButton({ invoiceId }: RectificativaButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!reason.trim()) {
      setError("El motivo de rectificación es obligatorio / Rectification reason is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await createRectificativeInvoice(invoiceId, reason);
      if (result.success && result.invoiceId) {
        setOpen(false);
        router.push(`/admin/invoices/${result.invoiceId}`);
        router.refresh();
      } else {
        setError(result.error || "Failed to create rectificative invoice");
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
          <FileX2 className="mr-2 h-4 w-4" />
          Factura Rectificativa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear Factura Rectificativa / Create Credit Note</DialogTitle>
          <DialogDescription>
            Genera una factura rectificativa (Art. 15 RD 1619/2012) que anula o corrige esta factura.
            Se creará con serie RECT- y referenciará la factura original.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">
              Motivo de rectificación / Rectification reason *
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Error en cantidad facturada / Error in invoiced quantity"
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
            onClick={handleCreate}
            disabled={loading || !reason.trim()}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileX2 className="mr-2 h-4 w-4" />
            )}
            Crear Rectificativa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
