"use client";

import { useState, useTransition } from "react";
import { X, Plus, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CustomerTagBadge } from "@/components/admin/customer-tag-badge";
import { assignTagToUser, removeTagFromUser } from "@/lib/actions/customer-tags";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface TagData {
  id: string;
  name: string;
  color: string;
}

interface CustomerTagAssignProps {
  userId: string;
  assignedTags: TagData[];
  allTags: TagData[];
}

export function CustomerTagAssign({
  userId,
  assignedTags: initialAssigned,
  allTags,
}: CustomerTagAssignProps) {
  const t = useTranslations("admin.customerTags");
  const [assignedTags, setAssignedTags] = useState<TagData[]>(initialAssigned);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const assignedIds = new Set(assignedTags.map((tag) => tag.id));
  const availableTags = allTags.filter((tag) => !assignedIds.has(tag.id));

  const handleAssign = (tag: TagData) => {
    startTransition(async () => {
      const result = await assignTagToUser(userId, tag.id);
      if (result.success) {
        setAssignedTags((prev) => [...prev, tag]);
        toast.success(t("tag_assigned"));
      } else {
        toast.error(result.error || t("assign_error"));
      }
    });
    setOpen(false);
  };

  const handleRemove = (tag: TagData) => {
    startTransition(async () => {
      const result = await removeTagFromUser(userId, tag.id);
      if (result.success) {
        setAssignedTags((prev) => prev.filter((t) => t.id !== tag.id));
        toast.success(t("tag_removed"));
      } else {
        toast.error(result.error || t("remove_error"));
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {assignedTags.length === 0 && (
          <span className="text-sm text-muted-foreground">{t("no_tags")}</span>
        )}
        {assignedTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ backgroundColor: tag.color + "20", color: tag.color }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: tag.color }}
            />
            {tag.name}
            <button
              type="button"
              onClick={() => handleRemove(tag)}
              disabled={isPending}
              className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={isPending || availableTags.length === 0}
          >
            <Plus className="mr-1 h-3 w-3" />
            {t("assign")}
            <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1" align="start">
          {availableTags.length === 0 ? (
            <p className="text-sm text-muted-foreground p-2">{t("no_tags_available")}</p>
          ) : (
            <div className="max-h-48 overflow-auto">
              {availableTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleAssign(tag)}
                  className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                >
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
