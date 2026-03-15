"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/admin/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getContactSubmissions,
  updateContactStatus,
} from "@/lib/actions/contact";
import { toast } from "sonner";
import { Eye, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function ContactSubmissionsPage() {
  const t = useTranslations("admin.cms.contactSubmissions");
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const data = await getContactSubmissions();
    setSubmissions(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatusUpdate = async (id: string, status: "READ" | "REPLIED") => {
    const result = await updateContactStatus(id, status);
    if (result.success) {
      toast.success(t("status_updated"));
      loadData();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "NEW":
        return <Badge className="bg-blue-100 text-blue-700">{t("status_new")}</Badge>;
      case "READ":
        return <Badge className="bg-yellow-100 text-yellow-700">{t("status_read")}</Badge>;
      case "REPLIED":
        return <Badge className="bg-green-100 text-green-700">{t("status_replied")}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[
          { label: "CMS", href: "/admin/cms/banners" },
          { label: t("title") },
        ]}
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="uppercase tracking-widest text-xs">{t("col_name")}</TableHead>
              <TableHead className="uppercase tracking-widest text-xs">{t("col_email")}</TableHead>
              <TableHead className="uppercase tracking-widest text-xs">{t("col_subject")}</TableHead>
              <TableHead className="uppercase tracking-widest text-xs">{t("col_status")}</TableHead>
              <TableHead className="uppercase tracking-widest text-xs">{t("col_date")}</TableHead>
              <TableHead className="uppercase tracking-widest text-xs">{t("col_actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                  {t("loading")}
                </TableCell>
              </TableRow>
            ) : submissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              submissions.map((sub) => (
                <>
                  <TableRow
                    key={sub.id}
                    className="hover:bg-yellow-50/50 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
                  >
                    <TableCell className="font-medium">{sub.name}</TableCell>
                    <TableCell>{sub.email}</TableCell>
                    <TableCell>{sub.subject}</TableCell>
                    <TableCell>{getStatusBadge(sub.status)}</TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {formatDistanceToNow(new Date(sub.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {sub.status === "NEW" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusUpdate(sub.id, "READ");
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {sub.status !== "REPLIED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusUpdate(sub.id, "REPLIED");
                            }}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        )}
                        {expandedId === sub.id ? (
                          <ChevronUp className="h-4 w-4 mt-2 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 mt-2 text-slate-400" />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedId === sub.id && (
                    <TableRow key={`${sub.id}-detail`}>
                      <TableCell colSpan={6} className="bg-slate-50">
                        <div className="p-4 space-y-2">
                          {sub.company && (
                            <p className="text-sm"><span className="font-bold">{t("detail_company")}:</span> {sub.company}</p>
                          )}
                          {sub.phone && (
                            <p className="text-sm"><span className="font-bold">{t("detail_phone")}:</span> {sub.phone}</p>
                          )}
                          <div className="mt-2">
                            <p className="font-bold text-sm mb-1">{t("detail_message")}:</p>
                            <p className="text-sm text-slate-600 whitespace-pre-wrap bg-white p-3 rounded border">
                              {sub.message}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
