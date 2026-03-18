"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { approveRequest, rejectRequest } from "@/lib/actions/approval";
import { Check, X } from "lucide-react";

interface ApprovalActionsProps {
  approvalId: string;
  status: string;
}

export function ApprovalActions({ approvalId, status }: ApprovalActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogType, setDialogType] = useState<"approve" | "reject" | null>(null);
  const [comments, setComments] = useState("");

  if (status !== "PENDING") {
    return <span className="text-sm text-muted-foreground">{status}</span>;
  }

  const handleAction = () => {
    startTransition(async () => {
      const action = dialogType === "approve" ? approveRequest : rejectRequest;
      const result = await action(approvalId, comments || undefined);

      if (result && "error" in result) {
        alert(result.error);
      }

      setDialogType(null);
      setComments("");
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          className="text-success border-success/30 hover:bg-success/10"
          onClick={() => setDialogType("approve")}
        >
          <Check className="mr-1 h-3.5 w-3.5" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive border-destructive/30 hover:bg-destructive/10"
          onClick={() => setDialogType("reject")}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Reject
        </Button>
      </div>

      <Dialog open={dialogType !== null} onOpenChange={(open) => !open && setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogType === "approve" ? "Approve Request" : "Reject Request"}
            </DialogTitle>
            <DialogDescription>
              {dialogType === "approve"
                ? "Are you sure you want to approve this request? This may trigger status changes on the related entity."
                : "Are you sure you want to reject this request?"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="comments">Comments (optional)</Label>
            <Textarea
              id="comments"
              placeholder="Add any notes or reasons..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={isPending}
              className={
                dialogType === "approve"
                  ? "bg-success hover:bg-success/90 text-primary-foreground"
                  : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              }
            >
              {isPending
                ? "Processing..."
                : dialogType === "approve"
                  ? "Confirm Approve"
                  : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
