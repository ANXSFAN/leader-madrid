import { Metadata } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.leadermadrid.com";

export const defaultMetadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Leader Madrid | Iluminación LED Profesional",
    template: "%s | Leader Madrid",
  },
  description: "Distribuidor mayorista de iluminación LED en Madrid. Calidad profesional a precios competitivos para proyectos industriales, arquitectónicos y comerciales.",
  keywords: ["iluminación LED", "LED Madrid", "distribuidor LED", "iluminación profesional", "LED mayorista", "Leader Madrid"],
  authors: [{ name: "Leader Madrid" }],
  creator: "Leader Madrid",
  publisher: "Leader Madrid",
  openGraph: {
    title: "Leader Madrid | Iluminación LED Profesional",
    description: "Distribuidor mayorista de iluminación LED en Madrid. Calidad profesional a precios competitivos.",
    url: APP_URL,
    siteName: "Leader Madrid",
    locale: "es_ES",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Leader Madrid - Professional LED Lighting",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Leader Madrid | Iluminación LED Profesional",
    description: "Distribuidor mayorista de iluminación LED en Madrid. Calidad profesional a precios competitivos.",
    images: ["/og-image.jpg"],
  },
  icons: {
    icon: "/icon.svg",
    apple: "/logo-icon.svg",
  },
  manifest: "/site.webmanifest",
};
