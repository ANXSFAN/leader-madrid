"use client";

import { useRouter, usePathname } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type LanguageSelectProps = {
  locales: readonly string[];
  labels: Record<string, string>;
};

export function LanguageSelect({ locales, labels }: LanguageSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  return (
    <Select
      value={locale}
      onValueChange={(nextLocale) => {
        router.replace(pathname, { locale: nextLocale });
      }}
    >
      <SelectTrigger className="w-[220px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {locales.map((item) => (
          <SelectItem key={item} value={item}>
            {labels[item] || item.toUpperCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
