import { ImageResponse } from "next/og";
import db from "@/lib/db";
import { getLocalized } from "@/lib/content";
import { getSiteSettings } from "@/lib/actions/config";

export const alt = "Product";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image(
  props: {
    params: Promise<{ locale: string; slug: string }>;
  }
) {
  const params = await props.params;
  const [product, settings] = await Promise.all([
    db.product.findUnique({
      where: { slug: params.slug },
      select: { content: true, sku: true, brand: true },
    }),
    getSiteSettings(),
  ]);

  const siteName = settings.siteName || "Leader Madrid";

  if (!product) {
    // Fallback OG image
    return new ImageResponse(
      (
        <div
          style={{
            background: "#A7144C",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "sans-serif",
            color: "#fff",
            fontSize: 48,
          }}
        >
          {siteName}
        </div>
      ),
      { ...size }
    );
  }

  const content = getLocalized(product.content, params.locale);
  const productContent = product.content as any;
  const images: string[] = Array.isArray(productContent?.images)
    ? productContent.images.filter((img: unknown) => typeof img === "string")
    : [];
  const imageUrl = images[0] || null;

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #A7144C 0%, #7a0f38 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Product image (left side) */}
        {imageUrl && (
          <div
            style={{
              width: 520,
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 48,
              background: "rgba(255,255,255,0.05)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={content.name}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                borderRadius: 16,
              }}
            />
          </div>
        )}

        {/* Text content (right side) */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: imageUrl ? "48px 56px 48px 40px" : "48px 56px",
          }}
        >
          {/* Brand */}
          {product.brand && (
            <div
              style={{
                fontSize: 18,
                color: "#ffffff",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "2px",
                marginBottom: 16,
              }}
            >
              {product.brand}
            </div>
          )}

          {/* Product name */}
          <div
            style={{
              fontSize: content.name.length > 40 ? 36 : 44,
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.2,
              marginBottom: 20,
            }}
          >
            {content.name}
          </div>

          {/* Description excerpt */}
          {content.description && (
            <div
              style={{
                fontSize: 18,
                color: "rgba(255,255,255,0.65)",
                lineHeight: 1.5,
                marginBottom: 32,
                display: "-webkit-box",
                overflow: "hidden",
              }}
            >
              {content.description.slice(0, 100)}
              {content.description.length > 100 ? "…" : ""}
            </div>
          )}

          {/* SKU */}
          <div
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.4)",
              fontFamily: "monospace",
              marginBottom: 32,
            }}
          >
            SKU: {product.sku}
          </div>

          {/* Footer brand */}
          <div
            style={{
              fontSize: 16,
              color: "#ffffff",
              fontWeight: 700,
              letterSpacing: "1px",
            }}
          >
            {siteName}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
