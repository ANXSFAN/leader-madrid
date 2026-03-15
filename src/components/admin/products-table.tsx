"use client";

import React, { useState, useTransition, useMemo, useOptimistic, useCallback } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Edit,
  Trash,
  Eye,
  EyeOff,
  X,
  ExternalLink,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Pin,
  PinOff,
} from "lucide-react";
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
import { Link, useRouter } from "@/i18n/navigation";
import { StockAdjustmentDialog } from "@/components/admin/stock-adjustment-dialog";
import { ProductStatusSwitch } from "@/components/admin/product-status-switch";
import { ProductFeaturedSwitch } from "@/components/admin/product-featured-switch";
import { getLocalized } from "@/lib/content";
import { Product, ProductVariant, Category, Supplier } from "@prisma/client";
import { cn } from "@/lib/utils";
import { deleteProduct, bulkToggleProductStatus, bulkDeleteProducts, updateProductSortOrder, toggleProductPinned } from "@/lib/actions/product";
import { toast } from "sonner";
import { ProductThumbnail } from "@/components/ui/product-thumbnail";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { formatMoney } from "@/lib/formatters";

type ProductWithRelations = Product & {
  category: Category | null;
  variants: ProductVariant[];
  supplier: Supplier | null;
};

type SortOption = "newest" | "oldest" | "price_asc" | "price_desc" | "stock_asc" | "stock_desc";

interface ProductsTableProps {
  products: ProductWithRelations[];
  currency?: string;
  warehouses?: { id: string; name: string; code: string; isDefault: boolean }[];
}

function SortableHeader({
  label,
  sortKey,
  currentSort,
  onSort,
}: {
  label: string;
  sortKey: string;
  currentSort: string | null;
  onSort: (key: string) => void;
}) {
  const isAsc = currentSort === `${sortKey}_asc`;
  const isDesc = currentSort === `${sortKey}_desc`;

  return (
    <button
      className="flex items-center gap-1 hover:text-slate-900 transition-colors text-[11px] font-black uppercase tracking-widest"
      onClick={() => onSort(sortKey)}
    >
      {label}
      {isAsc ? (
        <ArrowUp className="h-3 w-3" />
      ) : isDesc ? (
        <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

function SortableProductRow({
  product,
  children,
}: {
  product: ProductWithRelations;
  children: (dragHandleProps: { attributes: any; listeners: any }) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <TableRow ref={setNodeRef} style={style} className={product.isPinned ? "bg-amber-50/60" : undefined}>
      {children({ attributes, listeners })}
    </TableRow>
  );
}

export function ProductsTable({ products, currency = "EUR", warehouses = [] }: ProductsTableProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("admin");
  const searchParams = useSearchParams();
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [optimisticProducts, setOptimisticProducts] = useOptimistic(products);

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

      const oldIndex = optimisticProducts.findIndex((p) => p.id === active.id);
      const newIndex = optimisticProducts.findIndex((p) => p.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(optimisticProducts, oldIndex, newIndex);
      const page = Number(searchParams.get("page")) || 1;
      const pageSize = 20;
      const pageOffset = (page - 1) * pageSize;
      startTransition(async () => {
        setOptimisticProducts(reordered);
        const result = await updateProductSortOrder(reordered.map((p) => p.id), pageOffset);
        if (result.error) {
          toast.error(result.error);
        }
      });
    },
    [optimisticProducts, startTransition, setOptimisticProducts, searchParams]
  );

  const currentSort = searchParams.get("sort") as SortOption | null;

  const allIds = products.map((p) => p.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleRow = (productId: string) => {
    setExpandedRows((prev) => ({ ...prev, [productId]: !prev[productId] }));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(allIds));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleSort = (sortKey: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const currentAsc = `${sortKey}_asc`;
    const currentDesc = `${sortKey}_desc`;

    if (currentSort === currentAsc) {
      params.set("sort", currentDesc);
    } else if (currentSort === currentDesc) {
      params.delete("sort");
    } else {
      params.set("sort", currentAsc);
    }
    router.push(`?${params.toString()}`);
  };

  // Client-side sort for price and stock (aggregated values not in DB)
  const sortedProducts = useMemo(() => {
    if (!currentSort || currentSort === "newest" || currentSort === "oldest") {
      return optimisticProducts; // Server already sorted these
    }

    const sorted = [...optimisticProducts];
    switch (currentSort) {
      case "price_asc":
        sorted.sort((a, b) => {
          const aMin = a.variants.length ? Math.min(...a.variants.map(v => Number(v.price))) : 0;
          const bMin = b.variants.length ? Math.min(...b.variants.map(v => Number(v.price))) : 0;
          return aMin - bMin;
        });
        break;
      case "price_desc":
        sorted.sort((a, b) => {
          const aMax = a.variants.length ? Math.max(...a.variants.map(v => Number(v.price))) : 0;
          const bMax = b.variants.length ? Math.max(...b.variants.map(v => Number(v.price))) : 0;
          return bMax - aMax;
        });
        break;
      case "stock_asc":
        sorted.sort((a, b) => {
          const aStock = a.variants.reduce((acc, v) => acc + v.physicalStock, 0);
          const bStock = b.variants.reduce((acc, v) => acc + v.physicalStock, 0);
          return aStock - bStock;
        });
        break;
      case "stock_desc":
        sorted.sort((a, b) => {
          const aStock = a.variants.reduce((acc, v) => acc + v.physicalStock, 0);
          const bStock = b.variants.reduce((acc, v) => acc + v.physicalStock, 0);
          return bStock - aStock;
        });
        break;
    }
    return sorted;
  }, [optimisticProducts, currentSort]);

  const handleDelete = async (id: string) => {
    if (confirm(t("common.messages.confirm_delete"))) {
      startTransition(async () => {
        try {
          const result = await deleteProduct(id);
          if (result.success) {
            toast.success(t("common.messages.delete_success"));
          } else {
            toast.error(result.error || t("common.messages.delete_error"));
          }
        } catch (error) {
          toast.error(error instanceof Error ? error.message : t("common.messages.something_went_wrong"));
        }
      });
    }
  };

  const handleTogglePin = (id: string, currentlyPinned: boolean) => {
    startTransition(async () => {
      const result = await toggleProductPinned(id, !currentlyPinned);
      if (result.error) {
        toast.error(result.error);
      }
    });
  };

  const handleBulkPublish = (isActive: boolean) => {
    const ids = Array.from(selectedIds);
    if (!isActive && !confirm(t("products.bulk.confirm_deactivate", { count: ids.length }))) return;
    startTransition(async () => {
      const result = await bulkToggleProductStatus(ids, isActive);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(
          isActive
            ? t("products.bulk.published_count", { count: result.count })
            : t("products.bulk.unpublished_count", { count: result.count })
        );
        clearSelection();
      }
    });
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (!confirm(t("products.bulk.confirm_delete", { count: ids.length }))) return;
    startTransition(async () => {
      const result = await bulkDeleteProducts(ids);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(t("products.bulk.deleted_count", { count: result.count }));
        clearSelection();
      }
    });
  };

  return (
    <div className="space-y-2">
      {/* Bulk action toolbar */}
      {selectedIds.size > 0 ? (
        <div className="flex items-center gap-3 px-4 py-2 bg-slate-900 text-white rounded-lg sticky top-0 z-20 shadow-lg">
          <span className="text-sm font-medium">{t("products.bulk.selected", { count: selectedIds.size })}</span>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs"
              onClick={() => handleBulkPublish(true)}
              disabled={isPending}
            >
              <Eye className="h-3 w-3 mr-1" />
              {t("products.bulk.publish")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs"
              onClick={() => handleBulkPublish(false)}
              disabled={isPending}
            >
              <EyeOff className="h-3 w-3 mr-1" />
              {t("products.bulk.unpublish")}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs"
              onClick={handleBulkDelete}
              disabled={isPending}
            >
              <Trash className="h-3 w-3 mr-1" />
              {t("products.bulk.delete")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-white hover:text-white hover:bg-slate-700"
              onClick={clearSelection}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-2 text-xs text-slate-400">
          {t("products.bulk.hint")}
        </div>
      )}

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
              <TableHead className="w-[40px]">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleSelectAll}
                    aria-label={t("products.bulk.select_all")}
                  />
                  {selectedIds.size > 0 && (
                    <Badge variant="secondary" className="h-5 min-w-[20px] px-1 text-[10px]">
                      {selectedIds.size}
                    </Badge>
                  )}
                </div>
              </TableHead>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="w-[80px] text-[11px] font-black uppercase tracking-widest text-slate-500">{t("products.table.image")}</TableHead>
              <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">{t("products.table.name")}</TableHead>
              <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">{t("products.table.sku")}</TableHead>
              <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">{t("products.table.category")}</TableHead>
              <TableHead className="text-slate-500">
                <SortableHeader
                  label={t("products.table.price")}
                  sortKey="price"
                  currentSort={currentSort}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="text-slate-500">
                <SortableHeader
                  label={t("products.table.stock")}
                  sortKey="stock"
                  currentSort={currentSort}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">{t("products.table.status")}</TableHead>
              <TableHead className="text-right text-[11px] font-black uppercase tracking-widest text-slate-500">{t("products.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <SortableContext items={sortedProducts.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <TableBody>
            {sortedProducts.map((product) => {
              const content = getLocalized(product.content, locale);
              const categoryName = product.category
                ? getLocalized(product.category.content, locale).name
                : t("products.table.uncategorized");

              const totalStock = product.variants.reduce((acc, v) => acc + v.physicalStock, 0);
              const prices = product.variants.map((v) => Number(v.price));
              const minPrice = prices.length ? Math.min(...prices).toFixed(2) : "0.00";
              const maxPrice = prices.length ? Math.max(...prices).toFixed(2) : "0.00";
              const priceDisplay =
                minPrice === maxPrice
                  ? formatMoney(parseFloat(minPrice), { locale, currency })
                  : `${formatMoney(parseFloat(minPrice), { locale, currency })} - ${formatMoney(parseFloat(maxPrice), { locale, currency })}`;

              const imageUrl = (product.content as any)?.images?.[0] || `/images/${product.slug}.jpg`;
              const isExpanded = expandedRows[product.id];
              const isSelected = selectedIds.has(product.id);

              // Feature 4: Low stock warning based on minStock
              const lowStockVariants = product.variants.filter(
                (v) => v.physicalStock <= v.minStock && v.minStock > 0
              );
              const hasLowStock = lowStockVariants.length > 0;

              return (
                <React.Fragment key={product.id}>
                  <SortableProductRow product={product}>
                    {({ attributes: dragAttributes, listeners: dragListeners }) => (
                    <>
                    <TableCell className="w-[32px] px-1">
                      <div className="flex items-center">
                        <button
                          {...dragAttributes}
                          {...dragListeners}
                          className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600"
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>
                        {product.isPinned && (
                          <Pin className="h-3 w-3 text-amber-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(product.id)}
                        aria-label={t("products.bulk.select_item", { name: content.name })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => toggleRow(product.id)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="sr-only">{t("products.table.toggle_variants")}</span>
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="relative h-10 w-10 rounded-md border bg-slate-50 overflow-hidden">
                        <ProductThumbnail src={imageUrl} alt={content.name} />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1">
                        <ProductFeaturedSwitch
                          productId={product.id}
                          initialFeatured={product.isFeatured}
                        />
                        <span>{content.name}</span>
                      </div>
                      <div className="text-xs text-slate-500 truncate max-w-[200px]">
                        {content.description}
                      </div>
                    </TableCell>
                    <TableCell>{product.sku}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {categoryName}
                      </Badge>
                    </TableCell>
                    <TableCell>{priceDisplay}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className={hasLowStock ? "text-red-600 font-bold" : ""}>
                          {totalStock}
                        </span>
                        {hasLowStock && (
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              <button className="text-amber-500 hover:text-amber-600">
                                <AlertTriangle className="h-4 w-4" />
                              </button>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-72 text-sm">
                              <div className="font-semibold mb-2 text-amber-600">
                                {t("products.stock.low_stock_warning")}
                              </div>
                              <div className="space-y-1.5">
                                {lowStockVariants.map((v) => (
                                  <div key={v.id} className="flex justify-between text-xs">
                                    <span className="font-mono">{v.sku}</span>
                                    <span className="text-red-600">
                                      {v.physicalStock} / {t("products.stock.min")} {v.minStock}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ProductStatusSwitch
                          productId={product.id}
                          initialStatus={product.isActive}
                        />
                        <Badge variant={product.isActive ? "status-active" : "status-inactive"}>
                          {product.isActive ? t("common.status.active") : t("common.status.draft")}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">{t("common.actions.view")}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>{t("products.table.actions")}</DropdownMenuLabel>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/products/${product.id}`}>
                              <Edit className="mr-2 h-4 w-4" />
                              {t("common.actions.edit")}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleTogglePin(product.id, product.isPinned)}
                          >
                            {product.isPinned ? (
                              <>
                                <PinOff className="mr-2 h-4 w-4" />
                                {t("common.actions.unpin")}
                              </>
                            ) : (
                              <>
                                <Pin className="mr-2 h-4 w-4" />
                                {t("common.actions.pin")}
                              </>
                            )}
                          </DropdownMenuItem>
                          {/* Feature 6: Preview in store */}
                          <DropdownMenuItem asChild>
                            <a
                              href={`/${locale}/product/${product.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              {t("products.actions.preview")}
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDelete(product.id)}
                          >
                            <Trash className="mr-2 h-4 w-4" />
                            {t("common.actions.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    </>
                    )}
                  </SortableProductRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={11} className="p-0 bg-slate-50/50">
                        <div className="p-4 pl-16">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{t("products.table.variant_sku")}</TableHead>
                                <TableHead>{t("products.table.specs")}</TableHead>
                                <TableHead>{t("products.table.price")}</TableHead>
                                <TableHead>{t("products.table.stock")}</TableHead>
                                <TableHead>{t("products.table.actions")}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {product.variants.map((variant) => {
                                const isVariantLowStock = variant.physicalStock <= variant.minStock && variant.minStock > 0;
                                return (
                                  <TableRow key={variant.id}>
                                    <TableCell className="font-mono text-xs">{variant.sku}</TableCell>
                                    <TableCell className="text-xs text-slate-500">
                                      {JSON.stringify(variant.specs)}
                                    </TableCell>
                                    <TableCell>
                                      {formatMoney(Number(variant.price), { locale, currency })}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-1.5">
                                        <StockAdjustmentDialog
                                          variantId={variant.id}
                                          currentStock={variant.physicalStock}
                                          sku={variant.sku}
                                          warehouses={warehouses}
                                        />
                                        {isVariantLowStock && (
                                          <span className="flex items-center gap-1 text-amber-500 text-xs">
                                            <AlertTriangle className="h-3 w-3" />
                                            {t("products.stock.min")} {variant.minStock}
                                          </span>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Button variant="ghost" size="sm" asChild>
                                        <Link href={`/admin/products/${product.id}`}>
                                          {t("common.actions.edit")}
                                        </Link>
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
          </SortableContext>
        </Table>
        </DndContext>
      </div>
    </div>
  );
}
