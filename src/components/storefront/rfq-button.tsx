"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { createRFQ } from "@/lib/actions/rfq";
import { toast } from "sonner";
import { FileText, X, Plus, Minus, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RFQProductItem {
  productId: string;
  productName: string;
  variantId?: string;
  variantSku?: string;
  quantity?: number;
  targetPrice?: number;
}

interface RFQButtonProps {
  product: RFQProductItem;
  variant?: "full" | "icon";
  className?: string;
}

export function RFQButton({ product, variant = "full", className }: RFQButtonProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qty, setQty] = useState(product.quantity ?? 1);
  const [targetPrice, setTargetPrice] = useState("");
  const sessionUser = session?.user as { name?: string; email?: string; companyName?: string; phone?: string; b2bStatus?: string } | undefined;
  const [form, setForm] = useState({
    contactName: sessionUser?.name || "",
    contactEmail: sessionUser?.email || "",
    companyName: sessionUser?.companyName || "",
    phone: sessionUser?.phone || "",
    country: "ES",
    message: "",
  });

  const isB2B = sessionUser?.b2bStatus === "APPROVED";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await createRFQ({
        ...form,
        items: [
          {
            productId: product.productId,
            productName: product.productName,
            variantId: product.variantId,
            variantSku: product.variantSku,
            quantity: qty,
            targetPrice: targetPrice ? parseFloat(targetPrice) : undefined,
          },
        ],
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Quote request submitted! We'll contact you within 24h.");
        setOpen(false);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          variant === "full"
            ? "flex items-center justify-center gap-2 w-full py-3 border border-accent text-accent hover:bg-accent/10 font-bold text-sm uppercase tracking-[0.08em] transition-colors rounded-sm"
            : "p-2 rounded-full border border-border hover:border-accent hover:text-accent text-muted-foreground transition-colors",
          className
        )}
      >
        <FileText size={14} />
        {variant === "full" && (isB2B ? "Request Wholesale Quote" : "Request Quote")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  {isB2B ? "Request Wholesale Quote" : "Request a Quote"}
                </h2>
                <p className="text-base text-muted-foreground mt-0.5">{product.productName}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground/80 mb-1">
                    Full Name *
                  </label>
                  <input
                    required
                    value={form.contactName}
                    onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground/80 mb-1">
                    Email *
                  </label>
                  <input
                    required
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="you@company.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground/80 mb-1">
                    Company
                  </label>
                  <input
                    value={form.companyName}
                    onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Company name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground/80 mb-1">
                    Phone
                  </label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="+34 600 000 000"
                  />
                </div>
              </div>

              <div className="bg-muted rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground/80">Order Details</p>
                <div className="flex items-center justify-between">
                  <span className="text-base text-muted-foreground">
                    {product.variantSku ? `SKU: ${product.variantSku}` : "Quantity"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      className="p-1 rounded-full border border-border hover:border-border transition-colors"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-10 text-center text-base font-bold">{qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty((q) => q + 1)}
                      className="p-1 rounded-full border border-border hover:border-border transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">
                    Target price per unit (€) — optional
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground/80 mb-1">
                  Message / Specifications
                </label>
                <textarea
                  rows={3}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  placeholder="Delivery timeframe, specific requirements, quantity breaks..."
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-accent hover:bg-accent/90 text-accent-foreground font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                {loading ? "Sending..." : "Submit Quote Request"}
              </button>

              <p className="text-sm text-center text-muted-foreground">
                Our team will respond within 24 business hours.
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
