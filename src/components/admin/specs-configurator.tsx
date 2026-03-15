"use client";

import { useState, useEffect, useRef } from "react";
import { AttributeDefinition, AttributeOption } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Check, ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { useTranslations } from "next-intl";

const VISIBLE_OPTIONS_COUNT = 5;

/** Shape of the AttributeDefinition.name JSON field */
type AttrNameJson = Record<string, string>;

/** AttributeOption extended with optional display label */
type AttrOptionWithLabel = AttributeOption & { label?: string };

interface SpecsConfiguratorProps {
  definitions: (AttributeDefinition & { options: AttrOptionWithLabel[] })[];
  value: Record<string, string | string[]>;
  onChange: (key: string, value: string | string[] | undefined) => void;
  disabled?: boolean;
}

export function SpecsConfigurator({
  definitions,
  value,
  onChange,
  disabled,
}: SpecsConfiguratorProps) {
  const t = useTranslations("admin.specs");
  const [activeAttributes, setActiveAttributes] = useState<string[]>([]);
  const [expandedAttributes, setExpandedAttributes] = useState<Set<string>>(new Set());
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    const active = Object.keys(value).filter((key) =>
      definitions.some((def) => def.key === key)
    );
    setActiveAttributes((prev) => Array.from(new Set([...prev, ...active])));
  }, [value, definitions]);

  const availableAttributes = definitions.filter(
    (def) => !activeAttributes.includes(def.key)
  );

  const handleAddAttribute = (key: string) => {
    if (!activeAttributes.includes(key)) {
      setActiveAttributes([...activeAttributes, key]);
    }
  };

  const handleRemoveAttribute = (key: string) => {
    setActiveAttributes(activeAttributes.filter((k) => k !== key));
    onChange(key, undefined);
    setCustomInputs((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const toggleExpand = (key: string) => {
    setExpandedAttributes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleValueSelect = (key: string, optionValue: string) => {
    const currentValue = value[key];
    let newValue: string[];

    if (Array.isArray(currentValue)) {
      if (currentValue.includes(optionValue)) {
        newValue = currentValue.filter((v) => v !== optionValue);
      } else {
        newValue = [...currentValue, optionValue];
      }
    } else if (typeof currentValue === "string") {
      if (currentValue === optionValue) {
        newValue = [];
      } else {
        newValue = [currentValue, optionValue];
      }
    } else {
      newValue = [optionValue];
    }

    if (newValue.length === 1) {
      onChange(key, newValue[0]);
    } else if (newValue.length === 0) {
      onChange(key, undefined);
    } else {
      onChange(key, newValue);
    }
  };

  const handleAddCustomValue = (key: string) => {
    const customVal = customInputs[key]?.trim();
    if (!customVal) return;

    const currentValue = value[key];
    let newValue: string[];

    if (Array.isArray(currentValue)) {
      if (currentValue.includes(customVal)) return;
      newValue = [...currentValue, customVal];
    } else if (typeof currentValue === "string") {
      if (currentValue === customVal) return;
      newValue = [currentValue, customVal];
    } else {
      newValue = [customVal];
    }

    if (newValue.length === 1) {
      onChange(key, newValue[0]);
    } else {
      onChange(key, newValue);
    }

    setCustomInputs((prev) => ({ ...prev, [key]: "" }));
  };

  const handleCustomInputKeyDown = (key: string, e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCustomValue(key);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {activeAttributes.map((key) => {
          const def = definitions.find((d) => d.key === key);
          if (!def) return null;

          const currentVal = value[key];
          const selectedValues = Array.isArray(currentVal)
            ? currentVal
            : currentVal
            ? [currentVal]
            : [];

          const allOptions = def.options;
          const isExpanded = expandedAttributes.has(key);
          const hasMore = allOptions.length > VISIBLE_OPTIONS_COUNT;
          const visibleOptions = isExpanded
            ? allOptions
            : allOptions.slice(0, VISIBLE_OPTIONS_COUNT);
          const hiddenCount = allOptions.length - VISIBLE_OPTIONS_COUNT;

          const selectedCustomValues = selectedValues.filter(
            (v) => !allOptions.some((opt) => opt.value === v)
          );

          return (
            <div
              key={key}
              className="rounded-md border p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  {(def.name as AttrNameJson)?.en || def.key}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveAttribute(key)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {visibleOptions.map((option) => {
                  const isSelected = selectedValues.includes(option.value);
                  return (
                    <Badge
                      key={option.id}
                      variant={isSelected ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer select-none px-2 py-0.5 text-xs",
                        isSelected
                          ? "hover:bg-primary/90"
                          : "hover:bg-secondary"
                      )}
                      onClick={() => handleValueSelect(key, option.value)}
                    >
                      {option.label || option.value}
                      {isSelected && <Check className="ml-1 h-2.5 w-2.5" />}
                    </Badge>
                  );
                })}

                {selectedCustomValues.map((cv) => (
                  <Badge
                    key={`custom-${cv}`}
                    variant="default"
                    className="cursor-pointer select-none px-2 py-0.5 text-xs bg-amber-600 hover:bg-amber-700"
                    onClick={() => handleValueSelect(key, cv)}
                  >
                    {cv}
                    <X className="ml-1 h-2.5 w-2.5" />
                  </Badge>
                ))}

                {hasMore && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(key)}
                    className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md border border-dashed"
                  >
                    {isExpanded ? (
                      <>
                        {t("collapse")}
                        <ChevronUp className="h-3 w-3" />
                      </>
                    ) : (
                      <>
                        +{hiddenCount} {t("more")}
                        <ChevronDown className="h-3 w-3" />
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="flex gap-1.5">
                <Input
                  type="text"
                  placeholder={t("custom_value_placeholder")}
                  className="h-7 text-xs"
                  value={customInputs[key] || ""}
                  onChange={(e) =>
                    setCustomInputs((prev) => ({
                      ...prev,
                      [key]: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => handleCustomInputKeyDown(key, e)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs shrink-0"
                  onClick={() => handleAddCustomValue(key)}
                  disabled={!customInputs[key]?.trim()}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {t("add_custom")}
                </Button>
              </div>

              {selectedValues.length > 1 && (
                <p className="text-xs text-blue-600 font-medium">
                  {t("creates_variants", { count: selectedValues.length })}
                </p>
              )}
              {selectedValues.length === 1 && (
                <p className="text-xs text-muted-foreground">
                  {t("common_property")}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full border-dashed">
            <Plus className="mr-2 h-4 w-4" />
            {t("add_spec")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder={t("search_placeholder")} />
            <CommandList>
              <CommandEmpty>{t("no_attribute")}</CommandEmpty>
              <CommandGroup>
                {availableAttributes.map((def) => (
                  <CommandItem
                    key={def.key}
                    value={(def.name as AttrNameJson)?.en || def.key}
                    onSelect={() => handleAddAttribute(def.key)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        activeAttributes.includes(def.key)
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {(def.name as AttrNameJson)?.en || def.key}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
