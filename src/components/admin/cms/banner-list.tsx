"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { deleteBanner, reorderBanners } from "@/lib/actions/cms";
import { toast } from "sonner";
import Image from "next/image";
import { Link } from "@/i18n/navigation";

interface BannerListProps {
  banners: any[];
}

export function BannerList({ banners }: BannerListProps) {
  const t = useTranslations("admin.cms.banners");

  const handleDelete = async (id: string) => {
    if (confirm(t("confirm_delete"))) {
      await deleteBanner(id);
      toast.success(t("banner_deleted"));
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === banners.length - 1)
    ) {
      return;
    }

    const newBanners = [...banners];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    // Swap
    [newBanners[index], newBanners[targetIndex]] = [
      newBanners[targetIndex],
      newBanners[index],
    ];

    // Prepare update payload
    const updates = newBanners.map((b, i) => ({
      id: b.id,
      order: i + 1,
    }));

    await reorderBanners(updates);
    toast.success(t("order_updated"));
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">{t("col_image")}</TableHead>
            <TableHead>{t("col_title")}</TableHead>
            <TableHead>{t("col_status")}</TableHead>
            <TableHead className="text-right">{t("col_actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {banners.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-10">
                {t("empty")}
              </TableCell>
            </TableRow>
          ) : (
            banners.map((banner, index) => (
              <TableRow key={banner.id}>
                <TableCell>
                  <div className="relative h-12 w-20 overflow-hidden rounded bg-slate-100">
                    {banner.imageUrl ? (
                      <Image
                        src={banner.imageUrl}
                        alt={banner.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                        {t("no_image")}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{banner.title}</div>
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      banner.isActive
                        ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20"
                        : "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10"
                    }`}
                  >
                    {banner.isActive ? t("status_active") : t("status_inactive")}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMove(index, "up")}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMove(index, "down")}
                      disabled={index === banners.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Link href={`/admin/cms/banners/${banner.id}`}>
                      <Button variant="ghost" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(banner.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
