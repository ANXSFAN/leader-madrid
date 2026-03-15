"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  confirmDeliveryOrder,
  startPicking,
  markPacked,
  shipDeliveryOrder,
  markDelivered,
  cancelDeliveryOrder,
} from "@/lib/actions/delivery-order";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Loader2,
  CheckCircle,
  PackageSearch,
  PackageCheck,
  Truck,
  CircleCheck,
  XCircle,
} from "lucide-react";

interface DeliveryOrderActionsProps {
  deliveryOrder: {
    id: string;
    status: string;
    deliveryNumber: string;
  };
}

export function DeliveryOrderActions({ deliveryOrder }: DeliveryOrderActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrierName, setCarrierName] = useState("");
  const [shipDialogOpen, setShipDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const handleAction = (
    action: () => Promise<{ error?: string; success?: boolean }>,
    successMessage: string
  ) => {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(successMessage);
        router.refresh();
      }
    });
  };

  const handleShip = () => {
    startTransition(async () => {
      const result = await shipDeliveryOrder(deliveryOrder.id, {
        trackingNumber: trackingNumber || undefined,
        carrierName: carrierName || undefined,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Delivery order shipped successfully");
        setShipDialogOpen(false);
        router.refresh();
      }
    });
  };

  const handleCancel = () => {
    startTransition(async () => {
      const result = await cancelDeliveryOrder(deliveryOrder.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Delivery order cancelled");
        setCancelDialogOpen(false);
        router.refresh();
      }
    });
  };

  const { status } = deliveryOrder;

  // No actions for terminal states
  if (status === "DELIVERED" || status === "CANCELLED") {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Confirm - from DRAFT */}
      {status === "DRAFT" && (
        <Button
          size="sm"
          onClick={() =>
            handleAction(
              () => confirmDeliveryOrder(deliveryOrder.id),
              "Delivery order confirmed"
            )
          }
          disabled={isPending}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-1 h-4 w-4" />
          )}
          Confirm
        </Button>
      )}

      {/* Start Picking - from CONFIRMED */}
      {status === "CONFIRMED" && (
        <Button
          size="sm"
          onClick={() =>
            handleAction(
              () => startPicking(deliveryOrder.id),
              "Picking started"
            )
          }
          disabled={isPending}
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          {isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <PackageSearch className="mr-1 h-4 w-4" />
          )}
          Start Picking
        </Button>
      )}

      {/* Mark Packed - from PICKING */}
      {status === "PICKING" && (
        <Button
          size="sm"
          onClick={() =>
            handleAction(
              () => markPacked(deliveryOrder.id),
              "Marked as packed"
            )
          }
          disabled={isPending}
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          {isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <PackageCheck className="mr-1 h-4 w-4" />
          )}
          Mark Packed
        </Button>
      )}

      {/* Ship - from PACKED (with tracking dialog) */}
      {status === "PACKED" && (
        <Dialog open={shipDialogOpen} onOpenChange={setShipDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Truck className="mr-1 h-4 w-4" />
              Ship
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ship Delivery Order</DialogTitle>
              <DialogDescription>
                Enter shipping details for {deliveryOrder.deliveryNumber}. This action will deduct stock from the warehouse.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="trackingNumber">Tracking Number (optional)</Label>
                <Input
                  id="trackingNumber"
                  placeholder="e.g. 1Z999AA10123456784"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="carrierName">Carrier Name (optional)</Label>
                <Input
                  id="carrierName"
                  placeholder="e.g. UPS, DHL, FedEx"
                  value={carrierName}
                  onChange={(e) => setCarrierName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShipDialogOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleShip}
                disabled={isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Truck className="mr-1 h-4 w-4" />
                )}
                Confirm Shipment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Mark Delivered - from SHIPPED */}
      {status === "SHIPPED" && (
        <Button
          size="sm"
          onClick={() =>
            handleAction(
              () => markDelivered(deliveryOrder.id),
              "Marked as delivered"
            )
          }
          disabled={isPending}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <CircleCheck className="mr-1 h-4 w-4" />
          )}
          Mark Delivered
        </Button>
      )}

      {/* Cancel - available for DRAFT, CONFIRMED, PICKING, PACKED */}
      {["DRAFT", "CONFIRMED", "PICKING", "PACKED"].includes(status) && (
        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={isPending}>
              <XCircle className="mr-1 h-4 w-4" />
              Cancel
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Delivery Order</DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel delivery order{" "}
                <span className="font-mono font-medium">{deliveryOrder.deliveryNumber}</span>?
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCancelDialogOpen(false)}
                disabled={isPending}
              >
                No, keep it
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : null}
                Yes, cancel it
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
