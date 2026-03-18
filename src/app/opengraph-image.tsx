import { ImageResponse } from "next/og";
import { getSiteSettings } from "@/lib/actions/config";

export const alt = "Leader Madrid – Iluminación LED Profesional";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const settings = await getSiteSettings();
  const siteName = settings.siteName || "Leader Madrid";

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0c2340 0%, #091a30 60%, #050e1a 100%)",
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
            background: "radial-gradient(ellipse at center, rgba(255,255,255,0.2) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />

        {/* Brand name */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: "#ffffff",
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
          Iluminación LED Profesional
        </div>

        {/* B2B badge */}
        <div
          style={{
            marginTop: 40,
            background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: 8,
            padding: "10px 28px",
            color: "#ffffff",
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          Distribuidor Mayorista B2B
        </div>
      </div>
    ),
    { ...size }
  );
}
