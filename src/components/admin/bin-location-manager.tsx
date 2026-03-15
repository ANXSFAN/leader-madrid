"use client";

import { useState, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  getBinLocations,
  createBinLocation,
  updateBinLocation,
  deleteBinLocation,
  toggleBinLocationStatus,
  getBinLocationContents,
  assignLotToBin,
} from "@/lib/actions/bin-location";
import { Loader2, Plus, Pencil, Trash2, Package, X, ChevronRight } from "lucide-react";

interface ProductContentJson {
  [locale: string]: { name?: string } | string | undefined;
}

function resolveProductName(content: unknown): string {
  const c = content as ProductContentJson | null;
  if (!c) return "";
  for (const locale of ["en", "es", "de", "fr", "zh"]) {
    const localeData = c[locale];
    if (typeof localeData === "object" && localeData?.name) {
      return localeData.name;
    }
  }
  return "";
}

interface BinLocationData {
  id: string;
  code: string;
  zone: string | null;
  aisle: string | null;
  shelf: string | null;
  description: string | null;
  isActive: boolean;
  _count: { lots: number };
  lots: Array<{ quantity: number }>;
}

interface BinLotData {
  id: string;
  lotNumber: string;
  quantity: number;
  initialQuantity: number;
  expiryDate: Date | null;
  variant: {
    sku: string;
    product: { id: string; slug: string; content: unknown };
  };
}

interface Props {
  warehouses: Array<{ id: string; name: string; code: string; isDefault: boolean }>;
}

export function BinLocationManager({ warehouses }: Props) {
  const t = useTranslations("admin.binLocations");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [bins, setBins] = useState<BinLocationData[]>([]);

  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || ""
  );

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editBin, setEditBin] = useState<BinLocationData | null>(null);
  const [contentsBin, setContentsBin] = useState<BinLocationData | null>(null);
  const [binLots, setBinLots] = useState<BinLotData[]>([]);
  const [loadingContents, setLoadingContents] = useState(false);

  // Form state
  const [formCode, setFormCode] = useState("");
  const [formZone, setFormZone] = useState("");
  const [formAisle, setFormAisle] = useState("");
  const [formShelf, setFormShelf] = useState("");
  const [formDescription, setFormDescription] = useState("");

  function resetForm() {
    setFormCode("");
    setFormZone("");
    setFormAisle("");
    setFormShelf("");
    setFormDescription("");
  }

  function loadBins() {
    if (!warehouseId) return;
    startTransition(async () => {
      const result = await getBinLocations(warehouseId);
      setBins(result as BinLocationData[]);
    });
  }

  useEffect(() => {
    loadBins();
  }, [warehouseId]); // eslint-disable-line react-hooks/exhaustive-deps

  function openEdit(bin: BinLocationData) {
    setEditBin(bin);
    setFormCode(bin.code);
    setFormZone(bin.zone || "");
    setFormAisle(bin.aisle || "");
    setFormShelf(bin.shelf || "");
    setFormDescription(bin.description || "");
  }

  async function openContents(bin: BinLocationData) {
    setContentsBin(bin);
    setLoadingContents(true);
    try {
      const lots = await getBinLocationContents(bin.id);
      setBinLots(lots as BinLotData[]);
    } catch {
      setBinLots([]);
    } finally {
      setLoadingContents(false);
    }
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createBinLocation({
        warehouseId,
        code: formCode,
        zone: formZone || null,
        aisle: formAisle || null,
        shelf: formShelf || null,
        description: formDescription || null,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setShowCreateDialog(false);
        resetForm();
        loadBins();
      }
    });
  }

  function handleUpdate() {
    if (!editBin) return;
    setError(null);
    startTransition(async () => {
      const result = await updateBinLocation(editBin.id, {
        code: formCode,
        zone: formZone || null,
        aisle: formAisle || null,
        shelf: formShelf || null,
        description: formDescription || null,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setEditBin(null);
        resetForm();
        loadBins();
      }
    });
  }

  function handleDelete(binId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteBinLocation(binId);
      if (result.error) {
        setError(result.error);
      } else {
        loadBins();
      }
    });
  }

  function handleToggleStatus(binId: string) {
    setError(null);
    startTransition(async () => {
      const result = await toggleBinLocationStatus(binId);
      if (result.error) {
        setError(result.error);
      } else {
        loadBins();
      }
    });
  }

  function handleUnassignLot(lotId: string) {
    setError(null);
    startTransition(async () => {
      const result = await assignLotToBin(lotId, null);
      if (result.error) {
        setError(result.error);
      } else {
        // Reload contents and bins
        if (contentsBin) {
          const lots = await getBinLocationContents(contentsBin.id);
          setBinLots(lots as BinLotData[]);
        }
        loadBins();
      }
    });
  }

  function getTotalQty(bin: BinLocationData): number {
    return bin.lots.reduce((sum, lot) => sum + lot.quantity, 0);
  }

  const formContent = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("form.code")} *</Label>
          <Input
            value={formCode}
            onChange={(e) => setFormCode(e.target.value)}
            placeholder="A-01-03"
          />
        </div>
        <div className="space-y-2">
          <Label>{t("form.zone")}</Label>
          <Input
            value={formZone}
            onChange={(e) => setFormZone(e.target.value)}
            placeholder="A"
          />
        </div>
        <div className="space-y-2">
          <Label>{t("form.aisle")}</Label>
          <Input
            value={formAisle}
            onChange={(e) => setFormAisle(e.target.value)}
            placeholder="01"
          />
        </div>
        <div className="space-y-2">
          <Label>{t("form.shelf")}</Label>
          <Input
            value={formShelf}
            onChange={(e) => setFormShelf(e.target.value)}
            placeholder="03"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("form.description")}</Label>
        <Input
          value={formDescription}
          onChange={(e) => setFormDescription(e.target.value)}
          placeholder={t("form.description_placeholder")}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 text-red-700 p-3 text-sm">{error}</div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{bins.length}</div>
            <div className="text-sm text-muted-foreground">{t("stats.total_bins")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{bins.filter((b) => b.isActive).length}</div>
            <div className="text-sm text-muted-foreground">{t("stats.active_bins")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{bins.filter((b) => b._count.lots > 0).length}</div>
            <div className="text-sm text-muted-foreground">{t("stats.occupied_bins")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">
              {bins.reduce((sum, b) => sum + getTotalQty(b), 0)}
            </div>
            <div className="text-sm text-muted-foreground">{t("stats.total_items")}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-[300px]">
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger>
              <SelectValue placeholder={t("select_warehouse")} />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((wh) => (
                <SelectItem key={wh.id} value={wh.id}>
                  {wh.name} ({wh.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => { resetForm(); setShowCreateDialog(true); }}
          className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black"
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("actions.create")}
        </Button>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.code")}</TableHead>
              <TableHead>{t("table.zone")}</TableHead>
              <TableHead>{t("table.aisle")}</TableHead>
              <TableHead>{t("table.shelf")}</TableHead>
              <TableHead>{t("table.description")}</TableHead>
              <TableHead className="text-center">{t("table.lots")}</TableHead>
              <TableHead className="text-right">{t("table.total_qty")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead className="text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bins.map((bin) => {
              const totalQty = getTotalQty(bin);
              return (
                <TableRow key={bin.id} className="hover:bg-yellow-50/50">
                  <TableCell className="font-mono font-medium">{bin.code}</TableCell>
                  <TableCell>{bin.zone || "-"}</TableCell>
                  <TableCell>{bin.aisle || "-"}</TableCell>
                  <TableCell>{bin.shelf || "-"}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">{bin.description || "-"}</TableCell>
                  <TableCell className="text-center">
                    {bin._count.lots > 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto py-0.5 px-2 text-sm"
                        onClick={() => openContents(bin)}
                      >
                        <Package className="mr-1 h-3.5 w-3.5" />
                        {bin._count.lots}
                        <ChevronRight className="ml-0.5 h-3 w-3" />
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {totalQty > 0 ? totalQty : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={bin.isActive}
                        onCheckedChange={() => handleToggleStatus(bin.id)}
                        disabled={isPending}
                      />
                      <span className="text-xs text-muted-foreground">
                        {bin.isActive ? t("table.active") : t("table.inactive")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(bin)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("dialog.delete_title")}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("dialog.delete_description")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("dialog.cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(bin.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              {t("dialog.delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {bins.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center h-24 text-muted-foreground">
                  {isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  ) : (
                    t("table.no_bins")
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialog.create_title")}</DialogTitle>
          </DialogHeader>
          {formContent}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              {t("dialog.cancel")}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isPending}
              className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("actions.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editBin} onOpenChange={(open) => !open && setEditBin(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialog.edit_title")}</DialogTitle>
          </DialogHeader>
          {formContent}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBin(null)}>
              {t("dialog.cancel")}
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={isPending}
              className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bin Contents Dialog */}
      <Dialog open={!!contentsBin} onOpenChange={(open) => !open && setContentsBin(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t("contents.title")} — <span className="font-mono">{contentsBin?.code}</span>
            </DialogTitle>
          </DialogHeader>

          {loadingContents ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : binLots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("contents.empty")}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("contents.lot_number")}</TableHead>
                    <TableHead>{t("contents.sku")}</TableHead>
                    <TableHead>{t("contents.product")}</TableHead>
                    <TableHead className="text-right">{t("contents.qty")}</TableHead>
                    <TableHead className="text-right">{t("table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {binLots.map((lot) => (
                    <TableRow key={lot.id}>
                      <TableCell className="font-mono text-sm">{lot.lotNumber}</TableCell>
                      <TableCell className="font-mono text-sm">{lot.variant.sku}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {resolveProductName(lot.variant.product.content)}
                      </TableCell>
                      <TableCell className="text-right font-mono">{lot.quantity}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnassignLot(lot.id)}
                          disabled={isPending}
                          title={t("contents.unassign")}
                        >
                          <X className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
