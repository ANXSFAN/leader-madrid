"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  FileText,
  Package,
  Ship,
  Award,
  ClipboardList,
  Search,
  File,
  Plus,
  X,
  ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CustomsDocument {
  type: string;
  name: string;
  url: string;
}

const DOCUMENT_TYPES = [
  "commercial_invoice",
  "packing_list",
  "bill_of_lading",
  "certificate_of_origin",
  "customs_form",
  "inspection_report",
  "other",
] as const;

const TYPE_ICONS: Record<string, React.ReactNode> = {
  commercial_invoice: <FileText className="h-4 w-4" />,
  packing_list: <Package className="h-4 w-4" />,
  bill_of_lading: <Ship className="h-4 w-4" />,
  certificate_of_origin: <Award className="h-4 w-4" />,
  customs_form: <ClipboardList className="h-4 w-4" />,
  inspection_report: <Search className="h-4 w-4" />,
  other: <File className="h-4 w-4" />,
};

interface CustomsDocumentUploadProps {
  documents: CustomsDocument[];
  onUpdate: (docs: CustomsDocument[]) => void;
  readOnly?: boolean;
}

export function CustomsDocumentUpload({
  documents,
  onUpdate,
  readOnly = false,
}: CustomsDocumentUploadProps) {
  const t = useTranslations("admin.customs.documents");
  const [showForm, setShowForm] = useState(false);
  const [docType, setDocType] = useState<string>("");
  const [docName, setDocName] = useState("");
  const [docUrl, setDocUrl] = useState("");

  function handleAdd() {
    if (!docType || !docName || !docUrl) return;
    const newDoc: CustomsDocument = {
      type: docType,
      name: docName,
      url: docUrl,
    };
    onUpdate([...documents, newDoc]);
    setDocType("");
    setDocName("");
    setDocUrl("");
    setShowForm(false);
  }

  function handleRemove(index: number) {
    const updated = documents.filter((_, i) => i !== index);
    onUpdate(updated);
  }

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{t("title")}</h3>
        {!readOnly && !showForm && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowForm(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("upload")}
          </Button>
        )}
      </div>

      {/* Document List */}
      {documents.length > 0 ? (
        <ul className="space-y-2 mb-4">
          {documents.map((doc, index) => (
            <li
              key={index}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">
                  {TYPE_ICONS[doc.type] || <File className="h-4 w-4" />}
                </span>
                <div>
                  <span className="text-sm font-medium">{doc.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({t(doc.type as string)})
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground mb-4">
          {t("no_documents")}
        </p>
      )}

      {/* Add Document Form */}
      {showForm && (
        <div className="rounded-md border p-4 space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">
              {t("type")}
            </label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger>
                <SelectValue placeholder={t("type")} />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((dtype) => (
                  <SelectItem key={dtype} value={dtype}>
                    {t(dtype)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Name</label>
            <Input
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="Document name"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">URL</label>
            <Input
              value={docUrl}
              onChange={(e) => setDocUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={!docType || !docName || !docUrl}>
              <Plus className="mr-2 h-4 w-4" />
              {t("upload")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowForm(false);
                setDocType("");
                setDocName("");
                setDocUrl("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
