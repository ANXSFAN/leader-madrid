"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomerTagBadge } from "@/components/admin/customer-tag-badge";
import {
  createCustomerTag,
  updateCustomerTag,
  deleteCustomerTag,
  type CustomerTagWithCount,
} from "@/lib/actions/customer-tags";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

const PRESET_COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#22c55e", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#6366f1", // indigo
  "#14b8a6", // teal
];

interface CustomerTagsManagerProps {
  tags: CustomerTagWithCount[];
}

export function CustomerTagsManager({ tags }: CustomerTagsManagerProps) {
  const t = useTranslations("admin.customerTags");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createColor, setCreateColor] = useState("#3b82f6");

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#3b82f6");

  const handleCreate = () => {
    if (!createName.trim()) return;
    startTransition(async () => {
      const result = await createCustomerTag({
        name: createName.trim(),
        color: createColor,
      });
      if (result.success) {
        toast.success(t("tag_created"));
        setCreateOpen(false);
        setCreateName("");
        setCreateColor("#3b82f6");
        router.refresh();
      } else {
        toast.error(result.error || t("create_error"));
      }
    });
  };

  const handleUpdate = () => {
    if (!editName.trim()) return;
    startTransition(async () => {
      const result = await updateCustomerTag(editId, {
        name: editName.trim(),
        color: editColor,
      });
      if (result.success) {
        toast.success(t("tag_updated"));
        setEditOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || t("update_error"));
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteCustomerTag(id);
      if (result.success) {
        toast.success(t("tag_deleted"));
        router.refresh();
      } else {
        toast.error(result.error || t("delete_error"));
      }
    });
  };

  const openEdit = (tag: CustomerTagWithCount) => {
    setEditId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
    setEditOpen(true);
  };

  return (
    <>
      {/* Create Button */}
      <div className="flex justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black">
              <Plus className="mr-2 h-4 w-4" />
              {t("create")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("create")}</DialogTitle>
              <DialogDescription>{t("create_description")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t("name")}</Label>
                <Input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder={t("name_placeholder")}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("color")}</Label>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5 flex-wrap">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setCreateColor(color)}
                        className="h-7 w-7 rounded-full border-2 transition-all"
                        style={{
                          backgroundColor: color,
                          borderColor:
                            createColor === color ? "#1e293b" : "transparent",
                          transform:
                            createColor === color ? "scale(1.15)" : "scale(1)",
                        }}
                      />
                    ))}
                  </div>
                  <Input
                    type="color"
                    value={createColor}
                    onChange={(e) => setCreateColor(e.target.value)}
                    className="h-8 w-12 p-0.5 cursor-pointer"
                  />
                </div>
                <div className="mt-2">
                  <span className="text-sm text-muted-foreground mr-2">{t("preview")}:</span>
                  <CustomerTagBadge
                    name={createName || t("name_placeholder")}
                    color={createColor}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={isPending}
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isPending || !createName.trim()}
                className="bg-yellow-500 hover:bg-yellow-600 text-gray-900"
              >
                {t("create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tags Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                  {t("color")}
                </TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                  {t("name")}
                </TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                  {t("user_count")}
                </TableHead>
                <TableHead className="text-right text-[11px] font-black uppercase tracking-widest text-slate-500">
                  {t("actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center h-24 text-muted-foreground"
                  >
                    {t("no_tags")}
                  </TableCell>
                </TableRow>
              ) : (
                tags.map((tag) => (
                  <TableRow
                    key={tag.id}
                    className="hover:bg-yellow-50/40 transition-colors"
                  >
                    <TableCell>
                      <span
                        className="inline-block h-5 w-5 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                    </TableCell>
                    <TableCell>
                      <CustomerTagBadge name={tag.name} color={tag.color} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {tag._count.users}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(tag)}
                          disabled={isPending}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isPending}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {t("confirm_delete")}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("confirm_delete_description", {
                                  name: tag.name,
                                  count: tag._count.users,
                                })}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(tag.id)}
                                className="bg-red-500 hover:bg-red-600"
                              >
                                {t("delete")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("edit")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("name")}</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t("name_placeholder")}
                onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("color")}</Label>
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5 flex-wrap">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setEditColor(color)}
                      className="h-7 w-7 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: color,
                        borderColor:
                          editColor === color ? "#1e293b" : "transparent",
                        transform:
                          editColor === color ? "scale(1.15)" : "scale(1)",
                      }}
                    />
                  ))}
                </div>
                <Input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="h-8 w-12 p-0.5 cursor-pointer"
                />
              </div>
              <div className="mt-2">
                <span className="text-sm text-muted-foreground mr-2">{t("preview")}:</span>
                <CustomerTagBadge
                  name={editName || t("name_placeholder")}
                  color={editColor}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={isPending}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={isPending || !editName.trim()}
              className="bg-yellow-500 hover:bg-yellow-600 text-gray-900"
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
