"use client";

import React, { useCallback, useOptimistic, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Star, SlidersHorizontal, GripVertical, Pin, PinOff } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { DeleteAttributeButton } from "@/components/admin/delete-attribute-button";
import { updateAttributeSortOrder, toggleAttributePinned } from "@/lib/actions/attributes";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export type SerializedAttribute = {
  id: string;
  key: string;
  name: Record<string, string>;
  type: string;
  unit: string | null;
  scope: string;
  isHighlight: boolean;
  isFilterable: boolean;
  sortOrder: number;
  isPinned: boolean;
  options: { id: string; value: string; color: string | null }[];
};

interface SortableAttributesTableProps {
  highlighted: SerializedAttribute[];
  filterable: SerializedAttribute[];
  regular: SerializedAttribute[];
  locale: string;
}

function SortableAttrRow({
  attr,
  children,
}: {
  attr: SerializedAttribute;
  children: (dragHandleProps: { attributes: any; listeners: any }) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: attr.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <TableRow ref={setNodeRef} style={style} className={attr.isPinned ? "bg-amber-50/60" : undefined}>
      {children({ attributes, listeners })}
    </TableRow>
  );
}

function AttributeGroup({
  groupKey,
  label,
  icon,
  items,
  color,
  locale,
  onReorder,
  onTogglePin,
}: {
  groupKey: string;
  label: string;
  icon: React.ReactNode;
  items: SerializedAttribute[];
  color: string;
  locale: string;
  onReorder: (groupKey: string, reordered: SerializedAttribute[]) => void;
  onTogglePin: (id: string, currentlyPinned: boolean) => void;
}) {
  const t = useTranslations("admin.attributes");
  const tc = useTranslations("admin.common");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = items.findIndex((a) => a.id === active.id);
      const newIndex = items.findIndex((a) => a.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(items, oldIndex, newIndex);
      onReorder(groupKey, reordered);
    },
    [items, groupKey, onReorder]
  );

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        {label}
        <span className="text-xs">({items.length})</span>
      </div>
      <div className="rounded-md border bg-white">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[32px]"></TableHead>
                <TableHead>{t("table.key")}</TableHead>
                <TableHead>{t("table.name")}</TableHead>
                <TableHead>{t("table.type")}</TableHead>
                <TableHead>{t("table.unit")}</TableHead>
                <TableHead>{t("table.scope")}</TableHead>
                <TableHead>{t("table.flags")}</TableHead>
                <TableHead>{t("table.options")}</TableHead>
                <TableHead className="text-right">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <SortableContext
              items={items.map((a) => a.id)}
              strategy={verticalListSortingStrategy}
            >
              <TableBody>
                {items.map((attr) => (
                  <SortableAttrRow key={attr.id} attr={attr}>
                    {({ attributes: dragAttributes, listeners: dragListeners }) => (
                      <>
                        <TableCell className="w-[32px] px-1">
                          <button
                            {...dragAttributes}
                            {...dragListeners}
                            className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600"
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{attr.key}</TableCell>
                        <TableCell>
                          {attr.name?.[locale] || attr.name?.en || attr.name?.es || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{t(`types.${attr.type}`)}</Badge>
                        </TableCell>
                        <TableCell>{attr.unit || "-"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={attr.scope === "PRODUCT" ? "default" : "secondary"}
                          >
                            {t(`scopes.${attr.scope}`)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {attr.isHighlight && (
                              <Badge className="border-amber-200 bg-amber-100 text-amber-700 text-xs">
                                <Star className="mr-1 h-3 w-3" />
                                {t("table.highlight")}
                              </Badge>
                            )}
                            {attr.isFilterable && (
                              <Badge className="border-blue-200 bg-blue-100 text-blue-700 text-xs">
                                <SlidersHorizontal className="mr-1 h-3 w-3" />
                                {t("table.filter")}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {attr.options.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {attr.options.slice(0, 3).map((opt) => (
                                <Badge key={opt.id} variant="secondary" className="text-xs">
                                  {opt.value}
                                </Badge>
                              ))}
                              {attr.options.length > 3 && (
                                <span className="text-xs text-muted-foreground">
                                  +{attr.options.length - 3} {t("table.options_more")}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              {t("table.no_options")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onTogglePin(attr.id, attr.isPinned)}
                              title={attr.isPinned ? tc("actions.unpin") : tc("actions.pin")}
                            >
                              {attr.isPinned ? (
                                <PinOff className="h-4 w-4 text-amber-500" />
                              ) : (
                                <Pin className="h-4 w-4" />
                              )}
                            </Button>
                            <Button variant="ghost" size="icon" asChild>
                              <Link href={`/admin/attributes/${attr.id}`}>
                                <Edit className="h-4 w-4" />
                              </Link>
                            </Button>
                            <DeleteAttributeButton id={attr.id} />
                          </div>
                        </TableCell>
                      </>
                    )}
                  </SortableAttrRow>
                ))}
              </TableBody>
            </SortableContext>
          </Table>
        </DndContext>
      </div>
    </div>
  );
}

export function SortableAttributesTable({
  highlighted,
  filterable,
  regular,
  locale,
}: SortableAttributesTableProps) {
  const t = useTranslations("admin.attributes");
  const [isPending, startTransition] = useTransition();
  const allItems = { highlighted, filterable, regular };
  const [optimistic, setOptimistic] = useOptimistic(allItems);

  const handleTogglePin = useCallback(
    (id: string, currentlyPinned: boolean) => {
      startTransition(async () => {
        const result = await toggleAttributePinned(id, !currentlyPinned);
        if (result.error) {
          toast.error(result.error);
        }
      });
    },
    [startTransition]
  );

  const handleReorder = useCallback(
    (groupKey: string, reordered: SerializedAttribute[]) => {
      // Compute new full order: all groups combined
      const newState = { ...optimistic, [groupKey]: reordered };
      const allOrdered = [
        ...newState.highlighted,
        ...newState.filterable,
        ...newState.regular,
      ];

      startTransition(async () => {
        setOptimistic(newState);
        const result = await updateAttributeSortOrder(allOrdered.map((a) => a.id));
        if (result.error) {
          toast.error(result.error);
        }
      });
    },
    [optimistic, startTransition, setOptimistic]
  );

  return (
    <>
      <AttributeGroup
        groupKey="highlighted"
        label={t("groups.highlight")}
        icon={<Star className="h-4 w-4 text-amber-500" />}
        items={optimistic.highlighted}
        color="border-l-amber-400"
        locale={locale}
        onReorder={handleReorder}
        onTogglePin={handleTogglePin}

      />
      <AttributeGroup
        groupKey="filterable"
        label={t("groups.filterable")}
        icon={<SlidersHorizontal className="h-4 w-4 text-blue-500" />}
        items={optimistic.filterable}
        color="border-l-blue-400"
        locale={locale}
        onReorder={handleReorder}
        onTogglePin={handleTogglePin}

      />
      <AttributeGroup
        groupKey="regular"
        label={t("groups.regular")}
        icon={null}
        items={optimistic.regular}
        color="border-l-transparent"
        locale={locale}
        onReorder={handleReorder}
        onTogglePin={handleTogglePin}

      />
    </>
  );
}
