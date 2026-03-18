"use client";

import { signOut } from "next-auth/react";
import { Link } from "@/i18n/navigation";
import { User } from "next-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  LogOut,
  Package,
  User as UserIcon,
  Briefcase,
  Heart,
  CheckCircle2,
} from "lucide-react";
import { useTranslations } from "next-intl";

interface UserNavProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
    b2bStatus?: string;
  };
}

export function UserNav({ user }: UserNavProps) {
  const t = useTranslations("account");
  // Sync with middleware logic: only these roles can access admin panel
  const isAdmin = ["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER"].includes(
    user.role || ""
  );
  console.log("[UserNav] Debug Role:", user.role, "| IsAdmin:", isAdmin);

  const showB2BLink = !isAdmin && user.b2bStatus !== "APPROVED";
  const showB2BApproved = !isAdmin && user.b2bStatus === "APPROVED";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image || ""} alt={user.name || ""} />
            <AvatarFallback>
              {user.name?.charAt(0).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56 bg-card/80 backdrop-blur-md border-border shadow-xl"
        align="end"
        forceMount
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-base font-medium leading-none">{user.name}</p>
            <p className="text-sm leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link href="/admin" className="cursor-pointer">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>{t("admin_panel")}</span>
            </Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem asChild>
            <Link href="/orders" className="cursor-pointer">
              <Package className="mr-2 h-4 w-4" />
              <span>{t("my_orders")}</span>
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/profile" className="cursor-pointer">
            <UserIcon className="mr-2 h-4 w-4" />
            <span>{t("profile")}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/profile/wishlist" className="cursor-pointer">
            <Heart className="mr-2 h-4 w-4" />
            <span>{t("wishlist")}</span>
          </Link>
        </DropdownMenuItem>
        {showB2BLink && (
          <DropdownMenuItem asChild>
            <Link
              href="/apply-b2b"
              className="cursor-pointer text-accent font-medium"
            >
              <Briefcase className="mr-2 h-4 w-4" />
              <span>{t("request_b2b")}</span>
            </Link>
          </DropdownMenuItem>
        )}
        {showB2BApproved && (
          <DropdownMenuItem asChild>
            <Link
              href="/apply-b2b"
              className="cursor-pointer text-green-600 font-medium"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              <span>{t("b2b_approved")}</span>
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{t("logout")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
