"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { MODULE_KEYS, MODULE_LABELS, type ModuleKey } from "@/lib/modules";
import { updateModuleToggles, type ModuleToggles } from "@/lib/actions/config";
import { useRouter } from "next/navigation";

interface ModuleTogglesFormProps {
  initialToggles: ModuleToggles;
}

export function ModuleTogglesForm({ initialToggles }: ModuleTogglesFormProps) {
  const t = useTranslations("admin.settings");
  const router = useRouter();
  const [toggles, setToggles] = useState<ModuleToggles>(initialToggles);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (key: ModuleKey, checked: boolean) => {
    setToggles((prev) => ({ ...prev, [key]: checked }));
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateModuleToggles(toggles);
      if (result.success) {
        toast.success(t("modules_saved"));
        router.refresh();
      } else {
        toast.error(t("modules_save_error"));
      }
    });
  };

  // Don't allow toggling off settings (would lock yourself out)
  const nonToggleable: ModuleKey[] = ["dashboard", "settings"];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("modules_desc")}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {MODULE_KEYS.filter((k) => !nonToggleable.includes(k)).map((key) => (
          <div key={key} className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor={`module-${key}`} className="cursor-pointer font-normal">
              {MODULE_LABELS[key]}
            </Label>
            <Switch
              id={`module-${key}`}
              checked={toggles[key]}
              onCheckedChange={(checked) => handleToggle(key, checked)}
            />
          </div>
        ))}
      </div>
      <Button onClick={handleSave} disabled={isPending} className="bg-accent hover:bg-accent/90 text-accent-foreground">
        {isPending ? t("modules_saving") : t("modules_save")}
      </Button>
    </div>
  );
}
