"use client";

import { useState } from "react";
import { applyForB2B } from "@/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { Loader2, Building2, MapPin, Phone, CheckCircle2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { COUNTRY_LIST } from "@/lib/vat";

// Phone country code options (most common first)
const PHONE_CODES = [
  { code: "+34", label: "+34 (ES)" },
  { code: "+33", label: "+33 (FR)" },
  { code: "+49", label: "+49 (DE)" },
  { code: "+39", label: "+39 (IT)" },
  { code: "+351", label: "+351 (PT)" },
  { code: "+31", label: "+31 (NL)" },
  { code: "+48", label: "+48 (PL)" },
  { code: "+86", label: "+86 (CN)" },
  { code: "+1", label: "+1 (US/CA)" },
  { code: "+44", label: "+44 (GB)" },
  { code: "+41", label: "+41 (CH)" },
  { code: "+32", label: "+32 (BE)" },
  { code: "+43", label: "+43 (AT)" },
  { code: "+45", label: "+45 (DK)" },
  { code: "+46", label: "+46 (SE)" },
  { code: "+47", label: "+47 (NO)" },
  { code: "+358", label: "+358 (FI)" },
  { code: "+30", label: "+30 (GR)" },
  { code: "+420", label: "+420 (CZ)" },
  { code: "+36", label: "+36 (HU)" },
  { code: "+40", label: "+40 (RO)" },
  { code: "+7", label: "+7 (RU)" },
  { code: "+90", label: "+90 (TR)" },
  { code: "+52", label: "+52 (MX)" },
  { code: "+55", label: "+55 (BR)" },
  { code: "+61", label: "+61 (AU)" },
  { code: "+81", label: "+81 (JP)" },
  { code: "+82", label: "+82 (KR)" },
  { code: "+971", label: "+971 (AE)" },
  { code: "+966", label: "+966 (SA)" },
];

export default function ApplyB2BPage() {
  const { data: session } = useSession();
  const t = useTranslations("apply_b2b");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phoneCode, setPhoneCode] = useState("+34");
  const [registrationCountry, setRegistrationCountry] = useState("");
  const [industry, setIndustry] = useState("");
  const router = useRouter();

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-secondary">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>{t("access_denied_title")}</CardTitle>
            <CardDescription>{t("access_denied_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/login">{t("login")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const b2bStatus = (session.user as any).b2bStatus;

  if (b2bStatus === "PENDING") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-secondary">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("pending_notice")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (b2bStatus === "APPROVED") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-secondary">
        <Card className="max-w-md w-full text-center">
          <CardHeader className="pb-4">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription className="text-base">
              {t("approved_congratulations")}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    // Select components with name props contribute to FormData natively via Radix hidden <select>.
    // Override with React state as a safety net in case native value desyncs.
    if (!formData.get("registrationCountry")) formData.set("registrationCountry", registrationCountry);
    if (!formData.get("industry")) formData.set("industry", industry);
    if (!formData.get("phoneCountryCode")) formData.set("phoneCountryCode", phoneCode);

    const result = await applyForB2B(session!.user.id, formData);

    if (result.error) {
      setError(result.error);
    } else {
      toast.success(t("success"));
      router.push("/");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-secondary py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-1">{t("description")}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Section 1: Company Information */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold border-l-4 border-accent pl-3 flex items-center gap-2">
                <Building2 size={16} className="text-accent" />
                {t("section_company")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="registrationCountry">{t("registration_country")} *</Label>
                  <Select
                    name="registrationCountry"
                    value={registrationCountry}
                    onValueChange={setRegistrationCountry}
                    required
                  >
                    <SelectTrigger id="registrationCountry">
                      <SelectValue placeholder="-- Select --" />
                    </SelectTrigger>
                    <SelectContent className="bg-card max-h-64">
                      {COUNTRY_LIST.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name} ({c.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyName">{t("company_name")} *</Label>
                  <Input id="companyName" name="companyName" required placeholder="ACME Solutions S.L." />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="taxId">{t("tax_id")} *</Label>
                  <Input id="taxId" name="taxId" required placeholder="B12345678" className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">{t("industry")} *</Label>
                  <Select name="industry" value={industry} onValueChange={setIndustry} required>
                    <SelectTrigger id="industry">
                      <SelectValue placeholder={t("select_industry")} />
                    </SelectTrigger>
                    <SelectContent className="bg-card">
                      <SelectItem value="installers">{t("industry_installers")}</SelectItem>
                      <SelectItem value="construction">{t("industry_construction")}</SelectItem>
                      <SelectItem value="retail">{t("industry_retail")}</SelectItem>
                      <SelectItem value="architecture">{t("industry_architecture")}</SelectItem>
                      <SelectItem value="hospitality">{t("industry_hospitality")}</SelectItem>
                      <SelectItem value="real_estate">{t("industry_real_estate")}</SelectItem>
                      <SelectItem value="other">{t("industry_other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Company Address */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold border-l-4 border-accent pl-3 flex items-center gap-2">
                <MapPin size={16} className="text-accent" />
                {t("section_address")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyStreet">{t("company_street")} *</Label>
                <Input id="companyStreet" name="companyStreet" required placeholder="Calle Mayor 1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyCity">{t("company_city")}</Label>
                  <Input id="companyCity" name="companyCity" placeholder="Madrid" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyZip">{t("company_zip")}</Label>
                  <Input id="companyZip" name="companyZip" placeholder="28001" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Contact */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold border-l-4 border-accent pl-3 flex items-center gap-2">
                <Phone size={16} className="text-accent" />
                {t("section_contact")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>{t("phone_number")} *</Label>
                <div className="flex gap-2">
                  <Select name="phoneCountryCode" value={phoneCode} onValueChange={setPhoneCode}>
                    <SelectTrigger className="w-36 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card max-h-56">
                      {PHONE_CODES.map((pc) => (
                        <SelectItem key={pc.code} value={pc.code}>
                          {pc.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    name="phone"
                    required
                    placeholder="600 000 000"
                    className="flex-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-12 text-base font-bold"
            disabled={loading || !registrationCountry || !industry}
          >
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("submitting")}</>
            ) : (
              t("submit")
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
