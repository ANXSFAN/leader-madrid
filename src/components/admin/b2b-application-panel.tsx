"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  MapPin,
  Phone,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { verifyB2BVAT, approveB2BUser, rejectB2BUser } from "@/lib/actions/b2b";

interface B2BApplicationPanelProps {
  user: {
    id: string;
    b2bStatus: string;
    companyName?: string | null;
    taxId?: string | null;
    industry?: string | null;
    phone?: string | null;
    phoneCountryCode?: string | null;
    registrationCountry?: string | null;
    companyStreet?: string | null;
    companyCity?: string | null;
    companyZip?: string | null;
    vatVerified: boolean;
    vatVerifiedAt?: Date | string | null;
    vatVerifiedName?: string | null;
    vatVerifiedAddress?: string | null;
    b2bAppliedAt?: Date | string | null;
    b2bReviewedAt?: Date | string | null;
    b2bRejectionReason?: string | null;
  };
}

const COUNTRY_FLAGS: Record<string, string> = {
  ES: "\u{1F1EA}\u{1F1F8}",
  DE: "\u{1F1E9}\u{1F1EA}",
  FR: "\u{1F1EB}\u{1F1F7}",
  IT: "\u{1F1EE}\u{1F1F9}",
  PT: "\u{1F1F5}\u{1F1F9}",
  NL: "\u{1F1F3}\u{1F1F1}",
  PL: "\u{1F1F5}\u{1F1F1}",
  GB: "\u{1F1EC}\u{1F1E7}",
  BE: "\u{1F1E7}\u{1F1EA}",
  AT: "\u{1F1E6}\u{1F1F9}",
  CH: "\u{1F1E8}\u{1F1ED}",
  SE: "\u{1F1F8}\u{1F1EA}",
  DK: "\u{1F1E9}\u{1F1F0}",
  NO: "\u{1F1F3}\u{1F1F4}",
  FI: "\u{1F1EB}\u{1F1EE}",
  GR: "\u{1F1EC}\u{1F1F7}",
  IE: "\u{1F1EE}\u{1F1EA}",
  CZ: "\u{1F1E8}\u{1F1FF}",
  HU: "\u{1F1ED}\u{1F1FA}",
  RO: "\u{1F1F7}\u{1F1F4}",
  BG: "\u{1F1E7}\u{1F1EC}",
  HR: "\u{1F1ED}\u{1F1F7}",
  SK: "\u{1F1F8}\u{1F1F0}",
  SI: "\u{1F1F8}\u{1F1EE}",
  LT: "\u{1F1F1}\u{1F1F9}",
  LV: "\u{1F1F1}\u{1F1FB}",
  EE: "\u{1F1EA}\u{1F1EA}",
  CY: "\u{1F1E8}\u{1F1FE}",
  MT: "\u{1F1F2}\u{1F1F9}",
  LU: "\u{1F1F1}\u{1F1FA}",
  US: "\u{1F1FA}\u{1F1F8}",
  CA: "\u{1F1E8}\u{1F1E6}",
  MX: "\u{1F1F2}\u{1F1FD}",
  CN: "\u{1F1E8}\u{1F1F3}",
  AU: "\u{1F1E6}\u{1F1FA}",
  MA: "\u{1F1F2}\u{1F1E6}",
  TR: "\u{1F1F9}\u{1F1F7}",
};

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "\u2014";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case "PENDING":
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">PENDING</Badge>;
    case "APPROVED":
      return <Badge className="bg-green-100 text-green-800 border-green-300">APPROVED</Badge>;
    case "REJECTED":
      return <Badge className="bg-red-100 text-red-800 border-red-300">REJECTED</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

interface VerifyResult {
  success?: boolean;
  isValid?: boolean;
  type?: string;
  name?: string;
  address?: string;
  message?: string;
  error?: string;
}

export function B2BApplicationPanel({ user }: B2BApplicationPanelProps) {
  const router = useRouter();
  const t = useTranslations("admin.users.b2b_panel");
  const [localUser, setLocalUser] = useState(user);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  async function handleVerify() {
    setIsVerifying(true);
    setVerifyResult(null);
    try {
      const result = await verifyB2BVAT(user.id);
      setVerifyResult(result);
      if (result.success && result.isValid) {
        setLocalUser((prev) => ({
          ...prev,
          vatVerified: true,
          vatVerifiedAt: new Date().toISOString(),
          vatVerifiedName: result.name || prev.vatVerifiedName,
          vatVerifiedAddress: result.address || prev.vatVerifiedAddress,
        }));
        toast.success(t("verify_success"));
      } else if (result.error) {
        toast.error(result.error);
      } else if (result.isValid === false) {
        toast.error(result.message || t("verify_failed"));
      }
    } catch {
      toast.error(t("verify_request_failed"));
    }
    setIsVerifying(false);
  }

  async function handleApprove() {
    setIsApproving(true);
    try {
      const result = await approveB2BUser(user.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("approve_success"));
        router.push("/admin/customers");
      }
    } catch {
      toast.error(t("approve_failed"));
    }
    setIsApproving(false);
  }

  async function handleReject() {
    setIsRejecting(true);
    try {
      const result = await rejectB2BUser(user.id, rejectReason);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("reject_success"));
        setShowRejectForm(false);
        router.push("/admin/customers");
      }
    } catch {
      toast.error(t("reject_failed"));
    }
    setIsRejecting(false);
  }

  const countryCode = localUser.registrationCountry?.toUpperCase() || "";
  const flag = COUNTRY_FLAGS[countryCode] || "";

  const companyAddress = [
    localUser.companyStreet,
    localUser.companyCity,
    localUser.companyZip,
  ]
    .filter(Boolean)
    .join(", ");

  const phoneDisplay = [localUser.phoneCountryCode, localUser.phone]
    .filter(Boolean)
    .join(" ");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {t("title")}
            </CardTitle>
            <CardDescription className="mt-1">
              {t("description")}
            </CardDescription>
          </div>
          {getStatusBadge(localUser.b2bStatus)}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Info grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("company_name")}
            </p>
            <p className="text-sm font-medium">{localUser.companyName || "\u2014"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("registration_country")}
            </p>
            <p className="text-sm font-medium">
              {flag && <span className="mr-1">{flag}</span>}
              {countryCode || "\u2014"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("vat_tax_id")}
            </p>
            <p className="text-sm font-mono font-medium">{localUser.taxId || "\u2014"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              {t("business_type")}
            </p>
            <p className="text-sm font-medium">{localUser.industry || "\u2014"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {t("company_address")}
            </p>
            <p className="text-sm font-medium">{companyAddress || "\u2014"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {t("phone")}
            </p>
            <p className="text-sm font-medium">{phoneDisplay || "\u2014"}</p>
          </div>
        </div>

        {/* Dates row */}
        <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {t("applied")}: {formatDate(localUser.b2bAppliedAt)}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {t("reviewed")}: {formatDate(localUser.b2bReviewedAt)}
          </span>
        </div>

        <Separator />

        {/* VAT Verification Section */}
        <div>
          <h4 className="text-sm font-semibold mb-3">{t("vat_verification")}</h4>

          {localUser.vatVerified ? (
            <div className="bg-success/10 border border-success/20 rounded-lg p-4 space-y-1">
              <p className="text-sm font-medium text-success flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                {t("verified_on")} {formatDate(localUser.vatVerifiedAt)}
              </p>
              {localUser.vatVerifiedName && (
                <p className="text-sm text-success">
                  {t("company_label")}: {localUser.vatVerifiedName}
                </p>
              )}
              {localUser.vatVerifiedAddress && (
                <p className="text-sm text-success">
                  {t("address_label")}: {localUser.vatVerifiedAddress}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("not_verified")}</p>
          )}

          {/* Verify result display */}
          {verifyResult && !verifyResult.isValid && verifyResult.message && (
            <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{verifyResult.message}</p>
            </div>
          )}
          {verifyResult && verifyResult.error && (
            <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{verifyResult.error}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 mt-4">
            <Button
              variant="outline"
              onClick={handleVerify}
              disabled={isVerifying || localUser.b2bStatus === "APPROVED"}
            >
              {isVerifying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              {t("verify_vat")}
            </Button>

            {localUser.b2bStatus !== "APPROVED" && (
              <Button
                className="bg-success hover:bg-success/90 text-primary-foreground"
                onClick={handleApprove}
                disabled={isApproving}
              >
                {isApproving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                {t("approve")}
              </Button>
            )}

            {localUser.b2bStatus !== "REJECTED" && (
              <Button
                variant="destructive"
                onClick={() => setShowRejectForm(true)}
              >
                <XCircle className="mr-2 h-4 w-4" />
                {t("reject")}
              </Button>
            )}
          </div>

          {/* Reject form */}
          {showRejectForm && (
            <div className="mt-4 space-y-3">
              <Textarea
                placeholder={t("reject_reason_placeholder")}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={isRejecting}
                >
                  {isRejecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("confirm_rejection")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowRejectForm(false)}
                >
                  {t("cancel")}
                </Button>
              </div>
            </div>
          )}

          {/* Show rejection reason if already rejected */}
          {localUser.b2bStatus === "REJECTED" && localUser.b2bRejectionReason && (
            <div className="mt-3 p-3 bg-destructive/10 rounded-lg">
              <p className="text-sm text-destructive">
                {t("rejection_reason")}: {localUser.b2bRejectionReason}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
