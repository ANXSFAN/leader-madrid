import { ImageResponse } from "next/og";
import { getSiteSettings } from "@/lib/actions/config";

export const alt = "ZELURA – Professional LED Lighting Solutions";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const settings = await getSiteSettings();
  const siteName = settings.siteName || "ZELURA";

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #1e3a5f 0%, #0f2040 60%, #1a1a2e 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Decorative light beam */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: 300,
            height: 300,
            background: "radial-gradient(ellipse at center, rgba(250,204,21,0.3) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />

        {/* Brand name */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: "#facc15",
            letterSpacing: "-2px",
            marginBottom: 16,
          }}
        >
          {siteName}
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            color: "rgba(255,255,255,0.85)",
            fontWeight: 400,
            letterSpacing: "2px",
            textTransform: "uppercase",
          }}
        >
          Professional LED Lighting Solutions
        </div>

        {/* B2B badge */}
        <div
          style={{
            marginTop: 40,
            background: "rgba(250,204,21,0.15)",
            border: "1px solid rgba(250,204,21,0.4)",
            borderRadius: 8,
            padding: "10px 28px",
            color: "#facc15",
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          B2B Wholesale Available
        </div>
      </div>
    ),
    { ...size }
  );
}
