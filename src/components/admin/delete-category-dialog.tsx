"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteCategory } from "@/lib/actions/category";

interface DeleteCategoryDialogProps {
  category: {
    id: string;
    slug: string;
    content: any;
  };
}

export function DeleteCategoryDialog({ category }: DeleteCategoryDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const categoryName = category.content?.es?.name || category.slug;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteCategory(category.id);
      router.refresh();
      setOpen(false);
    } catch (error) {
      console.error("Error deleting:", error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="text-red-500 hover:text-red-600"
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{categoryName}&quot;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
