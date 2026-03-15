"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createAddress, updateAddress } from "@/lib/actions/address";
import { toast } from "sonner";
import { Address, AddressType } from "@prisma/client";
import { Plus, Pencil } from "lucide-react";

interface AddressFormDialogProps {
  userId: string;
  address?: Address; // If provided, edit mode
  trigger?: React.ReactNode;
}

export function AddressFormDialog({ userId, address, trigger }: AddressFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [type, setType] = useState<AddressType>(address?.type || "SHIPPING");
  const [firstName, setFirstName] = useState(address?.firstName || "");
  const [lastName, setLastName] = useState(address?.lastName || "");
  const [company, setCompany] = useState(address?.company || "");
  const [street, setStreet] = useState(address?.street || "");
  const [city, setCity] = useState(address?.city || "");
  const [state, setState] = useState(address?.state || "");
  const [zipCode, setZipCode] = useState(address?.zipCode || "");
  const [country, setCountry] = useState(address?.country || "Spain");
  const [phone, setPhone] = useState(address?.phone || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (address) {
        // Update
        const result = await updateAddress(address.id, {
          type,
          firstName,
          lastName,
          company,
          street,
          city,
          state,
          zipCode,
          country,
          phone,
        });
        if (result.success) {
          toast.success("Address updated successfully");
          setOpen(false);
        } else {
          toast.error(result.error || "Failed to update address");
        }
      } else {
        // Create
        const result = await createAddress({
          userId,
          type,
          firstName,
          lastName,
          company,
          street,
          city,
          state,
          zipCode,
          country,
          phone,
        });
        if (result.success) {
          toast.success("Address created successfully");
          setOpen(false);
          // Reset form
          setFirstName("");
          setLastName("");
          setCompany("");
          setStreet("");
          setCity("");
          setState("");
          setZipCode("");
          setCountry("Spain");
          setPhone("");
        } else {
          toast.error(result.error || "Failed to create address");
        }
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant={address ? "ghost" : "default"} size={address ? "icon" : "default"}>
            {address ? <Pencil className="h-4 w-4" /> : <><Plus className="mr-2 h-4 w-4" /> Add Address</>}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{address ? "Edit Address" : "Add New Address"}</DialogTitle>
          <DialogDescription>
            {address ? "Update your address details." : "Add a new shipping or billing address."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="company">Company (Optional)</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="street">Street Address</Label>
              <Input
                id="street"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipCode">Zip Code</Label>
                <Input
                  id="zipCode"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="state">State/Province</Label>
                <Input
                  id="state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Address Type</Label>
              <Select value={type} onValueChange={(v: AddressType) => setType(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SHIPPING">Shipping</SelectItem>
                  <SelectItem value="BILLING">Billing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Address"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
