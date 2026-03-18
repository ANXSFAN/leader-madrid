"use client";

import React from "react";
import Image from "next/image";
import { Download, FileText, Award } from "lucide-react";

interface SpecEntry {
  key: string;
  label: string;
  value: string;
}

interface ProductDocument {
  id: string;
  type: string;
  name: string;
  url: string;
  imageUrl?: string | null;
  description?: string | null;
}

interface ProductDetailTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  specEntries: SpecEntry[];
  description: string;
  t: (key: string, values?: Record<string, any>) => string;
  documents?: ProductDocument[];
}

export function ProductDetailTabs({
  activeTab,
  setActiveTab,
  specEntries,
  description,
  t,
  documents = [],
}: ProductDetailTabsProps) {
  const downloadableDocs = documents.filter((d) => d.url);
  const certDocs = documents.filter(
    (d) => d.type === "CERTIFICATE" && d.imageUrl
  );
  const hasSidebar = downloadableDocs.length > 0 || certDocs.length > 0;

  // Pair specs for desktop 4-column table (2 key-value pairs per row)
  const specPairs: { left: SpecEntry; right: SpecEntry | null }[] = [];
  for (let i = 0; i < specEntries.length; i += 2) {
    specPairs.push({
      left: specEntries[i],
      right: specEntries[i + 1] || null,
    });
  }

  return (
    <div className="mt-12">
      {/* Tab navigation */}
      <div className="flex border-b border-border">
        {[
          { id: "specs", label: t("specs") },
          { id: "description", label: t("description") },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 pb-3 text-sm font-bold uppercase tracking-widest transition-colors whitespace-nowrap relative ${
              activeTab === tab.id
                ? "text-accent"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
            )}
          </button>
        ))}
      </div>

      <div className="pt-8">
        {/* ========== Specs Tab: table + sidebar ========== */}
        {activeTab === "specs" && (
          <div
            className={`flex flex-col ${hasSidebar ? "lg:flex-row" : ""} gap-8`}
          >
            {/* --- Left: Specs Table --- */}
            <div className={hasSidebar ? "lg:flex-[2] min-w-0" : "w-full"}>
              {specEntries.length > 0 ? (
                <>
                  {/* Desktop: 4-column table */}
                  <div className="hidden md:block border border-border rounded-xl overflow-hidden">
                    <table className="w-full border-collapse text-[13px]">
                      <tbody>
                        {specPairs.map((pair, i) => (
                          <tr
                            key={i}
                            className={
                              i % 2 === 0 ? "bg-muted/30" : "bg-card"
                            }
                          >
                            <td className="px-4 py-2.5 text-muted-foreground border-r border-border/30 w-[28%]">
                              {pair.left.label}
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-foreground text-right border-r border-border w-[22%]">
                              {pair.left.value}
                            </td>
                            {pair.right ? (
                              <>
                                <td className="px-4 py-2.5 text-muted-foreground border-r border-border/30 w-[28%]">
                                  {pair.right.label}
                                </td>
                                <td className="px-4 py-2.5 font-semibold text-foreground text-right w-[22%]">
                                  {pair.right.value}
                                </td>
                              </>
                            ) : (
                              <td colSpan={2} />
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile: 2-column list */}
                  <div className="md:hidden border border-border rounded-xl overflow-hidden">
                    {specEntries.map((spec, i) => (
                      <div
                        key={spec.key}
                        className={`flex justify-between items-center px-4 py-2.5 text-[13px] ${
                          i % 2 === 0 ? "bg-muted/30" : "bg-card"
                        } ${
                          i < specEntries.length - 1
                            ? "border-b border-border/30"
                            : ""
                        }`}
                      >
                        <span className="text-muted-foreground">
                          {spec.label}
                        </span>
                        <span className="font-semibold text-foreground text-right ml-4">
                          {spec.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  {t("no_description")}
                </p>
              )}
            </div>

            {/* --- Right: Documents & Certificates Sidebar --- */}
            {hasSidebar && (
              <div className="lg:flex-1 min-w-0 flex flex-col gap-6">
                {/* Documents card */}
                {downloadableDocs.length > 0 && (
                  <div className="border border-border rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3 bg-muted/30 border-b border-border">
                      <FileText size={16} className="text-accent" />
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
                        {t("downloads")}
                      </h3>
                    </div>
                    <div className="divide-y divide-border/40">
                      {downloadableDocs.map((doc) => (
                        <a
                          key={doc.id}
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-4 px-5 py-5 hover:bg-muted/20 transition-colors group"
                        >
                          <div className="shrink-0 p-3 bg-red-50 rounded-xl text-red-500">
                            <FileText size={24} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold text-foreground block truncate">
                              {doc.name}
                            </span>
                            {doc.description && (
                              <span className="text-xs text-muted-foreground block truncate mt-0.5">
                                {doc.description}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground/60 mt-1 block">PDF</span>
                          </div>
                          <Download
                            size={18}
                            className="shrink-0 text-muted-foreground/30 group-hover:text-accent transition-colors"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Certificates card */}
                {certDocs.length > 0 && (
                  <div className="border border-border rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3 bg-muted/30 border-b border-border">
                      <Award size={16} className="text-accent" />
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
                        {t("certified_quality")}
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 p-5">
                      {certDocs.map((cert) => (
                        <div
                          key={cert.id}
                          className="relative h-14 w-14 rounded-lg border border-border bg-card p-0.5"
                          title={cert.name}
                        >
                          <Image
                            src={cert.imageUrl!}
                            alt={cert.name}
                            fill
                            className="object-contain p-0.5"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========== Description Tab ========== */}
        {activeTab === "description" && (
          <div className="max-w-4xl">
            {description ? (
              <div
                className="product-description max-w-none"
                dangerouslySetInnerHTML={{ __html: description }}
              />
            ) : (
              <p className="text-center text-muted-foreground py-8">
                {t("no_description")}
              </p>
            )}

            {/* Inline specs table (reuses the same data as Specs tab) */}
            {specEntries.length > 0 && (
              <div className="mt-8">
                <h3 className="text-[1.15rem] font-bold text-foreground mb-3 pb-2 border-b-2 border-accent w-fit">
                  {t("specs")}
                </h3>
                {/* Desktop: 4-column table */}
                <div className="hidden md:block border border-border rounded-xl overflow-hidden">
                  <table className="w-full border-collapse text-[13px]">
                    <tbody>
                      {specPairs.map((pair, i) => (
                        <tr
                          key={i}
                          className={i % 2 === 0 ? "bg-muted/30" : "bg-card"}
                        >
                          <td className="px-4 py-2.5 text-muted-foreground border-r border-border/30 w-[28%]">
                            {pair.left.label}
                          </td>
                          <td className="px-4 py-2.5 font-semibold text-foreground text-right border-r border-border w-[22%]">
                            {pair.left.value}
                          </td>
                          {pair.right ? (
                            <>
                              <td className="px-4 py-2.5 text-muted-foreground border-r border-border/30 w-[28%]">
                                {pair.right.label}
                              </td>
                              <td className="px-4 py-2.5 font-semibold text-foreground text-right w-[22%]">
                                {pair.right.value}
                              </td>
                            </>
                          ) : (
                            <td colSpan={2} />
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile: 2-column list */}
                <div className="md:hidden border border-border rounded-xl overflow-hidden">
                  {specEntries.map((spec, i) => (
                    <div
                      key={spec.key}
                      className={`flex justify-between items-center px-4 py-2.5 text-[13px] ${
                        i % 2 === 0 ? "bg-muted/30" : "bg-card"
                      } ${
                        i < specEntries.length - 1
                          ? "border-b border-border/30"
                          : ""
                      }`}
                    >
                      <span className="text-muted-foreground">
                        {spec.label}
                      </span>
                      <span className="font-semibold text-foreground text-right ml-4">
                        {spec.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inline certification badges */}
            {documents.length > 0 && (
              <div className="mt-8">
                <h3 className="text-[1.15rem] font-bold text-foreground mb-3 pb-2 border-b-2 border-accent w-fit">
                  {t("certified_quality")}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {documents.map((doc) => (
                    <span
                      key={doc.id}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-secondary border border-border rounded-full text-[0.825rem] font-medium text-foreground"
                    >
                      <span className="text-accent font-bold text-xs">✓</span>
                      {doc.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
