import { Metadata } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.zelura.com";

export const defaultMetadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "ZELURA | Professional LED Lighting Solutions",
    template: "%s | ZELURA",
  },
  description: "High-performance LED lighting for industrial, architectural, and commercial projects. B2B wholesale available.",
  keywords: ["LED lighting", "B2B LED", "Industrial Lighting", "Architectural Lighting", "ZELURA"],
  authors: [{ name: "ZELURA" }],
  creator: "ZELURA",
  publisher: "ZELURA",
  openGraph: {
    title: "ZELURA | Professional LED Lighting Solutions",
    description: "High-performance LED lighting for industrial, architectural, and commercial projects.",
    url: APP_URL,
    siteName: "ZELURA",
    locale: "es_ES",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "ZELURA - Professional LED Lighting",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ZELURA | Professional LED Lighting Solutions",
    description: "High-performance LED lighting for industrial, architectural, and commercial projects.",
    images: ["/og-image.jpg"],
  },
  icons: {
    icon: "/icon.svg",
    apple: "/logo-icon.svg",
  },
  manifest: "/site.webmanifest",
};
