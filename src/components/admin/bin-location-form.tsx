"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createBinLocation } from "@/lib/actions/bin-location";

interface BinLocationFormProps {
  warehouses: Array<{ id: string; name: string; code: string }>;
}

export function BinLocationForm({ warehouses }: BinLocationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [warehouseId, setWarehouseId] = useState("");
  const [code, setCode] = useState("");
  const [zone, setZone] = useState("");
  const [aisle, setAisle] = useState("");
  const [shelf, setShelf] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!warehouseId || !code) {
      setError("Warehouse and code are required.");
      return;
    }

    startTransition(async () => {
      const result = await createBinLocation({
        warehouseId,
        code: code.toUpperCase(),
        zone: zone || undefined,
        aisle: aisle || undefined,
        shelf: shelf || undefined,
        description: description || undefined,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setCode("");
        setZone("");
        setAisle("");
        setShelf("");
        setDescription("");
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="warehouse">Warehouse</Label>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger>
              <SelectValue placeholder="Select warehouse..." />
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
        <div>
          <Label htmlFor="code">Bin Code</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. A-01-03"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="zone">Zone</Label>
          <Input id="zone" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="e.g. A" />
        </div>
        <div>
          <Label htmlFor="aisle">Aisle</Label>
          <Input id="aisle" value={aisle} onChange={(e) => setAisle(e.target.value)} placeholder="e.g. 01" />
        </div>
        <div>
          <Label htmlFor="shelf">Shelf</Label>
          <Input id="shelf" value={shelf} onChange={(e) => setShelf(e.target.value)} placeholder="e.g. 03" />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." />
      </div>

      <Button type="submit" disabled={isPending} className="bg-yellow-500 hover:bg-yellow-600 text-gray-900">
        {isPending ? "Creating..." : "Create Bin Location"}
      </Button>
    </form>
  );
}
