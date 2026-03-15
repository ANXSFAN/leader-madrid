"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { seedEUVATRates } from "@/lib/actions/vat";
import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

export function SeedVATButton({ hasData }: { hasData: boolean }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSeed() {
    setLoading(true);
    try {
      const result = await seedEUVATRates();
      if (result.success) {
        toast.success("Tipos de IVA de la UE inicializados correctamente.");
        router.refresh();
      }
    } catch (e) {
      toast.error("Error al inicializar los tipos de IVA.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleSeed} disabled={loading} variant={hasData ? "outline" : "default"}>
      {loading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <RefreshCw className="w-4 h-4 mr-2" />
      )}
      {hasData ? "Actualizar tipos UE" : "Inicializar tipos UE"}
    </Button>
  );
}
