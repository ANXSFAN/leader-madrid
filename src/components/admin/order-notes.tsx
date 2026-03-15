"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { updateOrderNotes } from "@/lib/actions/order";
import { useTranslations } from "next-intl";
import { Loader2, StickyNote } from "lucide-react";

interface OrderNotesProps {
  orderId: string;
  initialNotes: string;
}

export function OrderNotes({ orderId, initialNotes }: OrderNotesProps) {
  const t = useTranslations("admin.orders.detail");
  const [notes, setNotes] = useState(initialNotes);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateOrderNotes(orderId, notes);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(t("notes_saved"));
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StickyNote className="h-4 w-4" />
          {t("notes_title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("notes_placeholder")}
          rows={4}
          className="resize-none"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            {t("notes_save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
