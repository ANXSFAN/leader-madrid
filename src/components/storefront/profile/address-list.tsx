"use client";

import { Address } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, MapPin } from "lucide-react";
import { deleteAddress } from "@/lib/actions/address";
import { toast } from "sonner";
import { AddressFormDialog } from "./address-form-dialog";
import { useTranslations } from "next-intl";

interface AddressListProps {
  userId: string;
  addresses: Address[];
}

export function AddressList({ userId, addresses }: AddressListProps) {
  const t = useTranslations("profile.addresses");

  const handleDelete = async (addressId: string) => {
    if (confirm(t("confirm_delete"))) {
      const result = await deleteAddress(addressId);
      if (result.success) {
        toast.success(t("deleted"));
      } else {
        toast.error(result.error || t("delete_error"));
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">{t("title")}</h2>
        <AddressFormDialog userId={userId} />
      </div>

      {addresses.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground border rounded-md">
          {t("empty")}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {addresses.map((address) => (
            <Card key={address.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("address_label")}{" "}
                  {address.type === "BILLING" ? t("billing") : t("shipping")}
                </CardTitle>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-sm font-bold mb-1">
                  {address.firstName} {address.lastName}
                </div>
                {address.company && (
                  <div className="text-sm text-muted-foreground mb-1">
                    {address.company}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  {address.street}
                </div>
                <div className="text-sm text-muted-foreground">
                  {address.city}, {address.state} {address.zipCode}
                </div>
                <div className="text-sm text-muted-foreground">
                  {address.country}
                </div>
                {address.phone && (
                  <div className="text-sm text-muted-foreground mt-2">
                    {t("phone_label")}: {address.phone}
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-4">
                  <AddressFormDialog
                    userId={userId}
                    address={address}
                    trigger={
                      <Button variant="outline" size="sm">
                        {t("edit")}
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(address.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
