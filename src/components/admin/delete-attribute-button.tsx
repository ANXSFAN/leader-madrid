"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteAttribute } from "@/lib/actions/attributes";
import { toast } from "sonner";
import { useTransition } from "react";

interface DeleteAttributeButtonProps {
  id: string;
}

export function DeleteAttributeButton({ id }: DeleteAttributeButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this attribute?")) {
      startTransition(async () => {
        try {
          await deleteAttribute(id);
          toast.success("Attribute deleted");
        } catch (error) {
          toast.error("Failed to delete attribute");
        }
      });
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-red-500 hover:text-red-600 hover:bg-red-50"
      onClick={handleDelete}
      disabled={isPending}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
