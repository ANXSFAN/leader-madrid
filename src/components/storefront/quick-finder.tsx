"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";

// TODO: Load application types, base types, and CCT values from product attributes table
export function QuickFinder() {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [application, setApplication] = useState("");
  const [base, setBase] = useState("");
  const [cct, setCct] = useState("");

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (application) params.set("application", application);
    if (base) params.set("base", base);
    if (cct) params.set("cct", cct);
    
    router.push(`/${locale}/search?${params.toString()}`);
  };

  return (
    <div className="bg-card/95 backdrop-blur-md p-6 rounded-xl shadow-xl border border-border max-w-4xl w-full mx-auto">
      <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
        <Search className="w-5 h-5 text-accent" />
        {t("quick_finder")}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Select value={application} onValueChange={setApplication}>
          <SelectTrigger className="bg-card border-border">
            <SelectValue placeholder={t("select_application")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="office">{t("office")}</SelectItem>
            <SelectItem value="home">{t("home")}</SelectItem>
            <SelectItem value="industrial">{t("industrial")}</SelectItem>
            <SelectItem value="outdoor">{t("outdoor")}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={base} onValueChange={setBase}>
          <SelectTrigger className="bg-card border-border">
            <SelectValue placeholder={t("select_base")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="E27">E27</SelectItem>
            <SelectItem value="E14">E14</SelectItem>
            <SelectItem value="GU10">GU10</SelectItem>
            <SelectItem value="T8">T8</SelectItem>
          </SelectContent>
        </Select>

        <Select value={cct} onValueChange={setCct}>
          <SelectTrigger className="bg-card border-border">
            <SelectValue placeholder={t("select_cct")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3000K">{t("warm_3000k")}</SelectItem>
            <SelectItem value="4000K">{t("neutral_4000k")}</SelectItem>
            <SelectItem value="6000K">{t("cool_6000k")}</SelectItem>
          </SelectContent>
        </Select>

        <Button 
          className="bg-accent hover:opacity-90 text-accent-foreground font-bold"
          onClick={handleSearch}
        >
          {t("search")}
        </Button>
      </div>
    </div>
  );
}
